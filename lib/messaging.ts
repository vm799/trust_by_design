/**
 * In-App Messaging Service
 *
 * Foundation for manager ↔ technician communication with:
 * - Real-time message delivery (Supabase Realtime ready)
 * - Offline queue with sync on reconnect
 * - Read receipts and delivery status
 * - Message threading (job-specific conversations)
 * - Priority levels for urgent communications
 * - Attachment support (photos, voice notes)
 */

import { generateSecureLocalId } from './secureId';

// ============================================================================
// TYPES
// ============================================================================

export type MessagePriority = 'normal' | 'high' | 'urgent';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'image' | 'voice' | 'system' | 'job_update';

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'manager' | 'technician' | 'system';
  recipientId: string;
  recipientName: string;
  content: string;
  type: MessageType;
  priority: MessagePriority;
  status: MessageStatus;
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
  // Offline support
  localId?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'voice' | 'document';
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  size?: number;
  duration?: number; // For voice notes
  mimeType: string;
}

export interface MessageThread {
  id: string;
  type: 'direct' | 'job' | 'broadcast';
  jobId?: string;
  jobTitle?: string;
  participants: ThreadParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  // For job threads
  clientName?: string;
  status?: string;
}

export interface ThreadParticipant {
  id: string;
  name: string;
  role: 'manager' | 'technician';
  avatar?: string;
  lastReadAt?: string;
  isOnline?: boolean;
}

export interface SendMessageRequest {
  threadId: string;
  content: string;
  type?: MessageType;
  priority?: MessagePriority;
  attachments?: File[];
  replyToId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'jobproof_message_queue';
const THREADS_CACHE_KEY = 'jobproof_threads_cache';
const MESSAGES_CACHE_KEY = 'jobproof_messages_cache';

// ============================================================================
// MESSAGE QUEUE (Offline Support)
// ============================================================================

interface QueuedMessage {
  localId: string;
  request: SendMessageRequest;
  senderId: string;
  senderName: string;
  senderRole: 'manager' | 'technician';
  recipientId: string;
  recipientName: string;
  queuedAt: string;
  retryCount: number;
}

function getMessageQueue(): QueuedMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessageQueue(queue: QueuedMessage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function generateLocalId(): string {
  return generateSecureLocalId('local');
}

// ============================================================================
// CORE MESSAGING FUNCTIONS
// ============================================================================

/**
 * Send a message (queues if offline)
 */
export async function sendMessage(
  request: SendMessageRequest,
  sender: { id: string; name: string; role: 'manager' | 'technician' },
  recipient: { id: string; name: string }
): Promise<Message> {
  const localId = generateLocalId();

  // Create optimistic message for immediate UI update
  const optimisticMessage: Message = {
    id: localId,
    localId,
    threadId: request.threadId,
    senderId: sender.id,
    senderName: sender.name,
    senderRole: sender.role,
    recipientId: recipient.id,
    recipientName: recipient.name,
    content: request.content,
    type: request.type || 'text',
    priority: request.priority || 'normal',
    status: 'sending',
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  // Store optimistic message in local cache
  cacheMessage(optimisticMessage);

  // Check if online
  if (!navigator.onLine) {
    // Queue for later
    const queuedMessage: QueuedMessage = {
      localId,
      request,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      recipientId: recipient.id,
      recipientName: recipient.name,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };

    const queue = getMessageQueue();
    queue.push(queuedMessage);
    saveMessageQueue(queue);

    optimisticMessage.status = 'sending';
    return optimisticMessage;
  }

  // Try to send immediately
  try {
    const sentMessage = await deliverMessage(optimisticMessage, request.attachments);
    return sentMessage;
  } catch (error) {
    // Queue on failure
    const queuedMessage: QueuedMessage = {
      localId,
      request,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      recipientId: recipient.id,
      recipientName: recipient.name,
      queuedAt: new Date().toISOString(),
      retryCount: 1,
    };

    const queue = getMessageQueue();
    queue.push(queuedMessage);
    saveMessageQueue(queue);

    optimisticMessage.status = 'failed';
    optimisticMessage.syncStatus = 'failed';
    cacheMessage(optimisticMessage);

    return optimisticMessage;
  }
}

/**
 * Deliver message to server
 */
async function deliverMessage(
  message: Message,
  attachments?: File[]
): Promise<Message> {
  // Upload attachments first if any
  let uploadedAttachments: MessageAttachment[] = [];

  if (attachments && attachments.length > 0) {
    uploadedAttachments = await uploadAttachments(attachments);
  }

  // In production, this would call Supabase
  // For now, simulate with localStorage for development
  const sentMessage: Message = {
    ...message,
    id: generateSecureLocalId('msg'),
    status: 'sent',
    syncStatus: 'synced',
    attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
  };

  // Update cache
  cacheMessage(sentMessage);

  // Update thread's last message
  updateThreadLastMessage(message.threadId, sentMessage);

  return sentMessage;
}

/**
 * Upload attachments to storage
 */
async function uploadAttachments(files: File[]): Promise<MessageAttachment[]> {
  const attachments: MessageAttachment[] = [];

  for (const file of files) {
    // In production, upload to Supabase Storage
    // For development, create blob URLs
    const url = URL.createObjectURL(file);

    const attachment: MessageAttachment = {
      id: generateSecureLocalId('att'),
      type: file.type.startsWith('image/') ? 'image'
           : file.type.startsWith('audio/') ? 'voice'
           : 'document',
      url,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
    };

    // Generate thumbnail for images
    if (attachment.type === 'image') {
      attachment.thumbnailUrl = url; // Same URL for dev
    }

    attachments.push(attachment);
  }

  return attachments;
}

/**
 * Process offline message queue
 */
export async function processMessageQueue(): Promise<{
  sent: number;
  failed: number;
}> {
  const queue = getMessageQueue();
  if (queue.length === 0) {
    return { sent: 0, failed: 0 };
  }


  let sent = 0;
  let failed = 0;
  const remainingQueue: QueuedMessage[] = [];

  for (const queuedMessage of queue) {
    try {
      const optimisticMessage: Message = {
        id: queuedMessage.localId,
        localId: queuedMessage.localId,
        threadId: queuedMessage.request.threadId,
        senderId: queuedMessage.senderId,
        senderName: queuedMessage.senderName,
        senderRole: queuedMessage.senderRole,
        recipientId: queuedMessage.recipientId,
        recipientName: queuedMessage.recipientName,
        content: queuedMessage.request.content,
        type: queuedMessage.request.type || 'text',
        priority: queuedMessage.request.priority || 'normal',
        status: 'sending',
        createdAt: queuedMessage.queuedAt,
        syncStatus: 'pending',
      };

      await deliverMessage(optimisticMessage);
      sent++;
    } catch (error) {
      queuedMessage.retryCount++;

      // Keep in queue if under 5 retries
      if (queuedMessage.retryCount < 5) {
        remainingQueue.push(queuedMessage);
      } else {
        failed++;
        console.error('[Messaging] Message permanently failed after 5 retries:', queuedMessage.localId);
      }
    }
  }

  saveMessageQueue(remainingQueue);

  return { sent, failed };
}

// ============================================================================
// THREAD MANAGEMENT
// ============================================================================

/**
 * Get or create a thread for a job
 */
export function getOrCreateJobThread(
  jobId: string,
  jobTitle: string,
  clientName: string,
  participants: ThreadParticipant[]
): MessageThread {
  const threads = getThreadsCache();

  // Check if thread exists
  const existing = threads.find(t => t.type === 'job' && t.jobId === jobId);
  if (existing) {
    return existing;
  }

  // Create new thread
  const thread: MessageThread = {
    id: `thread_job_${jobId}`,
    type: 'job',
    jobId,
    jobTitle,
    clientName,
    participants,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  threads.push(thread);
  saveThreadsCache(threads);

  return thread;
}

/**
 * Get or create a direct message thread
 */
export function getOrCreateDirectThread(
  user1: ThreadParticipant,
  user2: ThreadParticipant
): MessageThread {
  const threads = getThreadsCache();

  // Check if thread exists (order independent)
  const existing = threads.find(t =>
    t.type === 'direct' &&
    t.participants.some(p => p.id === user1.id) &&
    t.participants.some(p => p.id === user2.id)
  );

  if (existing) {
    return existing;
  }

  // Create new thread
  const thread: MessageThread = {
    id: `thread_dm_${user1.id}_${user2.id}`,
    type: 'direct',
    participants: [user1, user2],
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  threads.push(thread);
  saveThreadsCache(threads);

  return thread;
}

/**
 * Get all threads for a user
 */
export function getThreadsForUser(userId: string): MessageThread[] {
  const threads = getThreadsCache();
  return threads
    .filter(t => t.participants.some(p => p.id === userId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Get messages for a thread
 */
export function getMessagesForThread(threadId: string, limit = 50): Message[] {
  const cache = getMessagesCache();
  const messages = cache[threadId] || [];
  return messages.slice(-limit);
}

/**
 * Mark thread as read
 */
export function markThreadAsRead(threadId: string, userId: string): void {
  const threads = getThreadsCache();
  const thread = threads.find(t => t.id === threadId);

  if (thread) {
    thread.unreadCount = 0;
    const participant = thread.participants.find(p => p.id === userId);
    if (participant) {
      participant.lastReadAt = new Date().toISOString();
    }
    saveThreadsCache(threads);
  }

  // Mark all messages as read
  const cache = getMessagesCache();
  const messages = cache[threadId] || [];
  const now = new Date().toISOString();

  for (const msg of messages) {
    if (msg.recipientId === userId && !msg.readAt) {
      msg.readAt = now;
      msg.status = 'read';
    }
  }

  saveMessagesCache(cache);
}

// ============================================================================
// CACHING UTILITIES
// ============================================================================

function getThreadsCache(): MessageThread[] {
  try {
    const stored = localStorage.getItem(THREADS_CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveThreadsCache(threads: MessageThread[]): void {
  localStorage.setItem(THREADS_CACHE_KEY, JSON.stringify(threads));
}

function getMessagesCache(): Record<string, Message[]> {
  try {
    const stored = localStorage.getItem(MESSAGES_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveMessagesCache(cache: Record<string, Message[]>): void {
  localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(cache));
}

function cacheMessage(message: Message): void {
  const cache = getMessagesCache();
  const threadMessages = cache[message.threadId] || [];

  // Update existing or add new
  const existingIndex = threadMessages.findIndex(
    m => m.id === message.id || m.localId === message.localId
  );

  if (existingIndex >= 0) {
    threadMessages[existingIndex] = message;
  } else {
    threadMessages.push(message);
  }

  // Keep only last 200 messages per thread
  if (threadMessages.length > 200) {
    threadMessages.splice(0, threadMessages.length - 200);
  }

  cache[message.threadId] = threadMessages;
  saveMessagesCache(cache);
}

function updateThreadLastMessage(threadId: string, message: Message): void {
  const threads = getThreadsCache();
  const thread = threads.find(t => t.id === threadId);

  if (thread) {
    thread.lastMessage = message;
    thread.updatedAt = new Date().toISOString();

    // Increment unread for recipient
    if (message.recipientId !== message.senderId) {
      thread.unreadCount = (thread.unreadCount || 0) + 1;
    }

    saveThreadsCache(threads);
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTION (Supabase Ready)
// ============================================================================

type MessageHandler = (message: Message) => void;
type ThreadHandler = (thread: MessageThread) => void;

const messageSubscribers = new Map<string, Set<MessageHandler>>();
const threadSubscribers = new Set<ThreadHandler>();

/**
 * Subscribe to new messages in a thread
 */
export function subscribeToThread(
  threadId: string,
  handler: MessageHandler
): () => void {
  if (!messageSubscribers.has(threadId)) {
    messageSubscribers.set(threadId, new Set());
  }

  messageSubscribers.get(threadId)!.add(handler);

  // Return unsubscribe function
  return () => {
    messageSubscribers.get(threadId)?.delete(handler);
  };
}

/**
 * Subscribe to thread updates (new messages, unread counts)
 */
export function subscribeToThreadUpdates(handler: ThreadHandler): () => void {
  threadSubscribers.add(handler);

  return () => {
    threadSubscribers.delete(handler);
  };
}

/**
 * Notify subscribers of new message
 */
function notifyMessageSubscribers(message: Message): void {
  const handlers = messageSubscribers.get(message.threadId);
  handlers?.forEach(handler => handler(message));
}

// ============================================================================
// SYSTEM MESSAGES
// ============================================================================

/**
 * Create a system message (job updates, status changes, etc.)
 */
export function createSystemMessage(
  threadId: string,
  content: string,
  metadata?: Record<string, any>
): Message {
  const message: Message = {
    id: generateSecureLocalId('sys'),
    threadId,
    senderId: 'system',
    senderName: 'System',
    senderRole: 'system',
    recipientId: 'all',
    recipientName: 'All Participants',
    content,
    type: 'system',
    priority: 'normal',
    status: 'delivered',
    metadata,
    createdAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
    syncStatus: 'synced',
  };

  cacheMessage(message);
  updateThreadLastMessage(threadId, message);
  notifyMessageSubscribers(message);

  return message;
}

/**
 * Create job update message
 */
export function createJobUpdateMessage(
  threadId: string,
  updateType: 'status_change' | 'photo_added' | 'signature_added' | 'sealed',
  details: string
): Message {
  const icons: Record<string, string> = {
    status_change: '🔄',
    photo_added: '📷',
    signature_added: '✍️',
    sealed: '🔒',
  };

  return createSystemMessage(
    threadId,
    `${icons[updateType]} ${details}`,
    { updateType }
  );
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize messaging service
 */
export function initializeMessaging(): void {
  // Process queue when coming online
  window.addEventListener('online', () => {
    processMessageQueue();
  });

  // Process any existing queue on startup
  if (navigator.onLine) {
    setTimeout(() => processMessageQueue(), 2000);
  }

}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get total unread count for a user
 */
export function getTotalUnreadCount(userId: string): number {
  const threads = getThreadsForUser(userId);
  return threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
}

/**
 * Search messages
 */
export function searchMessages(
  userId: string,
  query: string
): Message[] {
  const threads = getThreadsForUser(userId);
  const cache = getMessagesCache();
  const results: Message[] = [];
  const lowerQuery = query.toLowerCase();

  for (const thread of threads) {
    const messages = cache[thread.id] || [];
    const matches = messages.filter(m =>
      m.content.toLowerCase().includes(lowerQuery)
    );
    results.push(...matches);
  }

  return results.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Delete message (soft delete)
 */
export function deleteMessage(messageId: string, threadId: string): boolean {
  const cache = getMessagesCache();
  const messages = cache[threadId];

  if (!messages) return false;

  const index = messages.findIndex(m => m.id === messageId);
  if (index >= 0) {
    messages[index].content = '[Message deleted]';
    messages[index].type = 'system';
    saveMessagesCache(cache);
    return true;
  }

  return false;
}

/**
 * Format timestamp for display
 */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
