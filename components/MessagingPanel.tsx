/**
 * MessagingPanel Component
 *
 * In-app messaging interface for technicians to communicate with managers.
 * Features:
 * - Job-specific conversations
 * - Offline message queuing
 * - Read receipts
 * - Attachment support
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { hapticTap, hapticSuccess } from '../lib/haptics';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';
import {
  Message,
  MessageThread,
  sendMessage,
  getMessagesForThread,
  getThreadsForUser,
  markThreadAsRead,
  subscribeToThread,
  formatMessageTime,
  getTotalUnreadCount,
} from '../lib/messaging';

interface MessagingPanelProps {
  userId: string;
  userName: string;
  userRole: 'manager' | 'technician';
  currentJobId?: string;
  onClose: () => void;
}

const MessagingPanel: React.FC<MessagingPanelProps> = ({
  userId,
  userName,
  userRole,
  currentJobId,
  onClose,
}) => {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load threads with adaptive polling (respects online/offline + visibility)
  const loadThreads = useCallback(() => {
    const userThreads = getThreadsForUser(userId);
    setThreads(userThreads);

    // Auto-select job thread if on a job
    if (currentJobId && !selectedThread) {
      const jobThread = userThreads.find(t => t.jobId === currentJobId);
      if (jobThread) {
        setSelectedThread(jobThread);
      }
    }
  }, [userId, currentJobId, selectedThread]);

  // Adaptive polling: 10s when active, 60s when hidden, stops when offline
  // Immediate refresh on reconnect or visibility change (critical for bunker)
  useAdaptivePolling({
    callback: loadThreads,
    activeInterval: 10000,   // 10s when visible (was 5s - 50% reduction)
    inactiveInterval: 60000, // 60s when tab hidden
    pollWhenOffline: true,   // Keep polling locally - it's just localStorage
    enabled: true,
    deps: [userId, currentJobId],
  });

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Load messages when thread selected
  useEffect(() => {
    if (selectedThread) {
      const threadMessages = getMessagesForThread(selectedThread.id);
      setMessages(threadMessages);
      markThreadAsRead(selectedThread.id, userId);

      // Subscribe to new messages
      const unsubscribe = subscribeToThread(selectedThread.id, (msg) => {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      });

      return unsubscribe;
    }
  }, [selectedThread, userId, scrollToBottom]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread || isSending) return;

    hapticTap();
    setIsSending(true);

    const recipient = selectedThread.participants.find(p => p.id !== userId);
    if (!recipient) {
      setIsSending(false);
      return;
    }

    try {
      const sentMessage = await sendMessage(
        {
          threadId: selectedThread.id,
          content: newMessage.trim(),
          type: 'text',
        },
        { id: userId, name: userName, role: userRole },
        { id: recipient.id, name: recipient.name }
      );

      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      hapticSuccess();
      scrollToBottom();
    } catch (error) {
      console.error('[Messaging] Failed to send:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Select thread
  const handleSelectThread = (thread: MessageThread) => {
    hapticTap();
    setSelectedThread(thread);
  };

  // Back to thread list
  const handleBack = () => {
    hapticTap();
    setSelectedThread(null);
  };

  // Render thread list
  const renderThreadList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Messages</h2>
        <button
          onClick={onClose}
          aria-label="Close messages"
          className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-slate-800"
        >
          <span className="material-symbols-outlined text-lg text-slate-400">close</span>
        </button>
      </div>

      {/* Offline Banner */}
      {isOffline && (
        <div className="px-4 py-2 bg-warning/20 border-b border-warning/30">
          <p className="text-xs text-warning">Offline - Messages will send when connected</p>
        </div>
      )}

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">chat_bubble_outline</span>
            <p className="text-xs text-slate-500">No conversations yet</p>
          </div>
        ) : (
          threads.map(thread => (
            <button
              key={thread.id}
              onClick={() => handleSelectThread(thread)}
              className="w-full p-4 border-b border-white/15 hover:bg-slate-800 transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  thread.type === 'job' ? 'bg-primary/20' : 'bg-slate-700'
                }`}>
                  <span className="material-symbols-outlined text-lg text-primary">
                    {thread.type === 'job' ? 'work' : 'person'}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white truncate">
                      {thread.type === 'job' ? thread.jobTitle : thread.participants.find(p => p.id !== userId)?.name}
                    </p>
                    {thread.lastMessage && (
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {formatMessageTime(thread.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  {thread.type === 'job' && thread.clientName && (
                    <p className="text-xs text-slate-500 truncate">{thread.clientName}</p>
                  )}
                  {thread.lastMessage && (
                    <p className="text-xs text-slate-400 truncate mt-1">
                      {thread.lastMessage.senderName}: {thread.lastMessage.content}
                    </p>
                  )}
                </div>

                {/* Unread Badge */}
                {thread.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{thread.unreadCount}</span>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // Render conversation
  const renderConversation = () => {
    if (!selectedThread) return null;

    const otherParticipant = selectedThread.participants.find(p => p.id !== userId);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <button
            onClick={handleBack}
            aria-label="Go back to message list"
            className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-slate-800"
          >
            <span className="material-symbols-outlined text-lg text-slate-400">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {selectedThread.type === 'job' ? selectedThread.jobTitle : otherParticipant?.name}
            </p>
            {selectedThread.type === 'job' && (
              <p className="text-xs text-slate-500">Job conversation</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close messages"
            className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-slate-800"
          >
            <span className="material-symbols-outlined text-lg text-slate-400">close</span>
          </button>
        </div>

        {/* Offline Banner */}
        {isOffline && (
          <div className="px-4 py-2 bg-warning/20 border-b border-warning/30">
            <p className="text-xs text-warning">Offline - Messages will send when connected</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">forum</span>
              <p className="text-xs text-slate-500">Start the conversation</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id || msg.localId}
                className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.type === 'system'
                      ? 'bg-slate-800 text-center w-full'
                      : msg.senderId === userId
                      ? 'bg-primary text-white'
                      : 'bg-slate-800 text-white'
                  }`}
                >
                  {/* Sender name for received messages */}
                  {msg.senderId !== userId && msg.type !== 'system' && (
                    <p className="text-xs text-slate-400 mb-1">{msg.senderName}</p>
                  )}

                  {/* Message content */}
                  <p className={`text-sm ${msg.type === 'system' ? 'text-slate-400 text-xs' : ''}`}>
                    {msg.content}
                  </p>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map(att => (
                        <div key={att.id} className="text-xs text-slate-300">
                          {att.type === 'image' ? (
                            <img src={att.url} alt={att.filename || 'Attached image'} className="max-w-full rounded-lg" />
                          ) : att.type === 'voice' ? (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <audio src={att.url} controls className="w-full" />
                          ) : (
                            <a href={att.url} className="underline">{att.filename}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timestamp & Status */}
                  <div className={`flex items-center gap-1 mt-1 ${
                    msg.senderId === userId ? 'justify-end' : 'justify-start'
                  }`}>
                    <span className="text-xs opacity-60">
                      {formatMessageTime(msg.createdAt)}
                    </span>
                    {msg.senderId === userId && (
                      <span className="material-symbols-outlined text-xs opacity-60">
                        {msg.status === 'read' ? 'done_all'
                          : msg.status === 'delivered' ? 'done_all'
                          : msg.status === 'sent' ? 'done'
                          : msg.status === 'failed' ? 'error'
                          : 'schedule'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || isSending}
              className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-white">
                {isSending ? 'hourglass_empty' : 'send'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950 flex flex-col">
      {selectedThread ? renderConversation() : renderThreadList()}
    </div>
  );
};

export default MessagingPanel;

/**
 * Message Badge Component
 * Shows unread count in nav/header with adaptive polling
 */
export const MessageBadge: React.FC<{ userId: string; onClick: () => void }> = ({
  userId,
  onClick,
}) => {
  const [unreadCount, setUnreadCount] = useState(0);

  // Adaptive polling for unread count - less aggressive since badge is always visible
  const updateCount = useCallback(() => {
    setUnreadCount(getTotalUnreadCount(userId));
  }, [userId]);

  useAdaptivePolling({
    callback: updateCount,
    activeInterval: 15000,   // 15s when visible (was 5s - 66% reduction)
    inactiveInterval: 120000, // 2min when tab hidden
    pollWhenOffline: true,    // Still check localStorage when offline
    enabled: true,
    deps: [userId],
  });

  return (
    <button
      onClick={() => { hapticTap(); onClick(); }}
      aria-label={`Open messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      className="relative min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-slate-800 border border-white/10"
    >
      <span className="material-symbols-outlined text-white">chat</span>
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </div>
      )}
    </button>
  );
};
