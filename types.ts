
export type JobStatus = 'Pending' | 'In Progress' | 'Complete' | 'Submitted' | 'Archived' | 'Paused' | 'Cancelled' | 'Draft';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type PhotoType = 'before' | 'during' | 'after' | 'Before' | 'During' | 'After' | 'Evidence';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';
export type LocationSource = 'gps' | 'manual' | 'cached' | 'w3w_api' | 'unknown';

export interface SafetyCheck {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

export interface Photo {
  id: string;
  url: string; // IndexedDB key reference (e.g., "media_abc123") for offline, or full URL when synced
  localPath?: string; // Local file path for offline photos
  timestamp: string;
  lat?: number;
  lng?: number;
  w3w?: string;
  verified: boolean;
  syncStatus: SyncStatus;
  type: PhotoType;
  isIndexedDBRef?: boolean; // Indicates if url is a reference key to IndexedDB

  // Production Schema Extensions (2026-01-22)
  w3w_verified?: boolean; // W3W address verified via API
  photo_hash?: string; // SHA-256 hash for integrity verification
  photo_hash_algorithm?: string; // Hash algorithm used (default: sha256)
  exif_data?: Record<string, any>; // Full EXIF metadata for audit trail
  device_info?: {
    make?: string;
    model?: string;
    os?: string;
    os_version?: string;
    app_version?: string;
  };
  gps_accuracy?: number; // GPS accuracy in meters
}

export interface JobTemplate {
  id: string;
  name: string;
  description: string;
  defaultTasks: string[];
}

export type JobPriority = 'normal' | 'urgent';

export interface Job {
  id: string;
  title: string;
  client: string;
  clientId: string;
  technician: string;
  techId: string;
  technicianId?: string; // Alias for techId
  status: JobStatus;
  priority?: JobPriority;
  date: string;
  address: string;
  lat?: number;
  lng?: number;
  w3w?: string;
  locationVerified?: boolean; // True if W3W was verified via API, false if mock/manual
  locationSource?: LocationSource; // Source of location data
  invoiceId?: string; // Reference to invoice if created
  notes: string;
  description?: string;
  workSummary?: string;
  photos: Photo[];
  signature: string | null; // IndexedDB key reference (e.g., "sig_jobId") when offline
  signatureIsIndexedDBRef?: boolean; // Indicates if signature is a reference key
  signatureHash?: string; // SHA-256 hash of signature for tamper detection
  signatureTimestamp?: string; // ISO timestamp when signature was captured
  signerName?: string;
  signerRole?: string;
  signerPhotoId?: string; // ID of photo capturing signer's identity (optional verification)
  safetyChecklist: SafetyCheck[];
  siteHazards?: string[];
  completedAt?: string;
  templateId?: string;
  syncStatus: SyncStatus;
  lastUpdated: number;
  price?: number;
  total?: number; // Alias for price
  magicLinkToken?: string; // Magic link token for technician access
  magicLinkUrl?: string; // Full URL for sharing
  magicLinkCreatedAt?: string; // ISO timestamp when magic link was created
  workspaceId?: string; // Workspace ID (from database)
  technicianLinkOpened?: boolean; // Phase 11: Flag for unopened links filtering
  technicianLinkOpenedAt?: string; // ISO timestamp when technician first opened link
  selfEmployedMode?: boolean; // Self-employed mode flag
  techMetadata?: TechJobMetadata; // Technician job creation metadata
  // Phase C.3: Cryptographic sealing
  sealedAt?: string; // ISO timestamp when evidence was sealed
  sealedBy?: string; // Email of user who sealed the evidence
  evidenceHash?: string; // SHA-256 hash of evidence bundle
  isSealed?: boolean; // Computed: !!sealedAt

  // Fix 3.1: Auto-archive sealed jobs >180 days
  archivedAt?: string; // ISO timestamp when job was archived (auto or manual)
  isArchived?: boolean; // Flag indicating job is archived (status='Archived')

  // Client confirmation (satisfaction sign-off)
  clientConfirmation?: {
    signature: string; // Data URL of signature image
    timestamp: string; // ISO timestamp (UTC) when confirmed
    confirmed: boolean; // Always true when present
  };

  // Technician completion notes (work performed, issues, follow-up)
  completionNotes?: string;

  // Phase 15: Field Proof System (Security-Hardened)
  // NOTE: Raw tokens are NEVER stored - only hashes
  techTokenHash?: string; // SHA256 hash of token (raw never stored)
  techPinHash?: string; // SHA256 hash of PIN (raw never stored)
  tokenExpiresAt?: string; // ISO timestamp for token expiration
  tokenUsed?: boolean; // True when token has been used for proof submission
  tokenUsedAt?: string; // ISO timestamp of first token access
  proofData?: Record<string, unknown>; // JSONB proof metadata (keep small, use Storage refs)
  beforePhoto?: string; // Supabase Storage URL for before photo
  afterPhoto?: string; // Supabase Storage URL for after photo
  notesBefore?: string; // Tech notes before work
  notesAfter?: string; // Tech notes after work (completion notes)
  clientSignature?: string; // Supabase Storage URL for client signature
  clientSignatureAt?: string; // ISO timestamp when client signed
  clientNameSigned?: string; // Printed name on signature
  proofCompletedAt?: string; // ISO timestamp when full proof submitted
  managerNotifiedAt?: string; // ISO timestamp when manager emailed
  clientNotifiedAt?: string; // ISO timestamp when client emailed
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  jobId: string;
  clientId: string;
  clientName: string;
  amount: number;
  total: number;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  paidAt?: string;
  number?: string;
  items: InvoiceItem[];
  notes?: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  totalJobs: number;
  type?: string;
  notes?: string;
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'Available' | 'On Site' | 'Off Duty' | 'Authorised';
  rating: number;
  jobsCompleted: number;
  specialty?: string;
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  workspaceName: string;
  persona?: string;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
}

// ============================================================================
// PRODUCTION SCHEMA EXTENSIONS (2026-01-22)
// ============================================================================

export interface ClientSignoff {
  id: string;
  job_id: string;
  workspace_id: string;
  client_id?: string;

  signature_url?: string;
  signature_data?: string;
  signature_verified: boolean;
  signer_name: string;
  signer_email?: string;

  satisfaction_rating?: number; // 1-5
  feedback_text?: string;
  would_recommend?: boolean;

  signed_at?: string;
  created_at: string;
  updated_at: string;

  sync_status: 'pending' | 'synced' | 'failed';
}

export interface JobStatusHistoryEntry {
  id: string;
  job_id: string;
  workspace_id: string;

  previous_status?: string;
  new_status: string;
  changed_by_user_id?: string;
  changed_by_email?: string;
  reason?: string;
  metadata: Record<string, any>;

  created_at: string;
}

export interface JobDispatch {
  id: string;
  job_id: string;
  workspace_id: string;

  sent_by_user_id: string;
  sent_by_email?: string;
  sent_to_technician_id?: string;
  sent_to_email?: string;
  sent_to_phone?: string;

  dispatch_channel: 'sms' | 'email' | 'qr' | 'direct_link' | 'in_app';
  magic_link_token?: string;
  magic_link_url?: string;
  qr_code_url?: string;

  delivery_status: 'pending' | 'sent' | 'delivered' | 'opened' | 'failed' | 'bounced';
  opened_at?: string;
  error_message?: string;

  attempt_number: number;
  last_attempt_at?: string;

  created_at: string;
}

export interface JobTimeEntry {
  id: string;
  job_id: string;
  workspace_id: string;
  user_id?: string;

  started_at: string;
  ended_at?: string;
  duration_seconds?: number;

  activity_type: 'work' | 'break' | 'travel' | 'waiting' | 'other';
  notes?: string;
  location_lat?: number;
  location_lng?: number;

  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;

  type: 'job_assigned' | 'job_started' | 'job_completed' | 'job_sealed' |
        'signature_needed' | 'sync_complete' | 'sync_failed' |
        'client_feedback' | 'admin_alert' | 'system_notification';
  title: string;
  message?: string;
  related_job_id?: string;

  delivery_status: 'pending' | 'sent' | 'read' | 'failed' | 'dismissed';
  sent_at?: string;
  read_at?: string;
  dismissed_at?: string;

  channels: ('in_app' | 'email' | 'push' | 'sms')[];

  priority: 'low' | 'normal' | 'high' | 'urgent';

  action_url?: string;
  action_label?: string;

  created_at: string;
}

export interface SyncQueueEntry {
  id: string;
  workspace_id: string;
  user_id: string;

  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'job' | 'photo' | 'safety_check' | 'signature' | 'signoff' | 'time_entry';
  entity_id?: string;

  payload: Record<string, any>;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  error_message?: string;
  conflict_resolution?: string;

  attempt_count: number;
  max_attempts: number;
  last_attempt_at?: string;
  next_retry_at?: string;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// TECHNICIAN-INITIATED JOBS (2026-01-23)
// ============================================================================

/**
 * Job creation origin - tracks who initiated the job
 * 'manager' - Created by manager/admin via dashboard (default)
 * 'technician' - Created by technician in the field
 * 'self_employed' - Created by self-employed technician (no manager)
 */
export type JobCreationOrigin = 'manager' | 'technician' | 'self_employed';

/**
 * Work mode for the user/workspace
 * 'employed' - Works under a manager, jobs require approval
 * 'self_employed' - Independent contractor, generates own audit trails
 */
export type TechnicianWorkMode = 'employed' | 'self_employed';

/**
 * Extended job metadata for technician-initiated jobs
 */
export interface TechJobMetadata {
  creationOrigin: JobCreationOrigin;
  createdByTechId?: string;      // Technician ID who created it
  createdByTechName?: string;    // Technician name for display
  managerNotified?: boolean;     // Whether manager was notified
  managerNotifiedAt?: string;    // When manager was notified
  approvedByManager?: boolean;   // For employed mode: manager approval
  approvedAt?: string;           // When approved
  approvedBy?: string;           // Manager who approved

  // Self-employed mode fields
  clientReceiptGenerated?: boolean;
  clientReceiptUrl?: string;
  clientReceiptSentAt?: string;
  clientReceiptSentVia?: 'email' | 'sms' | 'copy' | 'share';
}

/**
 * Manager notification for technician-created jobs
 */
export interface TechJobNotification {
  id: string;
  workspace_id: string;
  job_id: string;

  type: 'tech_job_created' | 'tech_job_completed' | 'tech_job_needs_review';
  title: string;
  message: string;

  created_by_tech_id: string;
  created_by_tech_name: string;
  created_at: string;

  is_read: boolean;
  read_at?: string;

  // Action tracking
  action_taken?: 'approved' | 'rejected' | 'reassigned';
  action_at?: string;
  action_by?: string;
}

/**
 * Client receipt for self-employed mode
 * A lightweight proof-of-work document for payment/legal purposes
 */
export interface ClientReceipt {
  id: string;
  job_id: string;
  workspace_id: string;

  // Client info
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;

  // Work details
  job_title: string;
  job_description?: string;
  work_date: string;
  work_location: string;
  work_location_w3w?: string;

  // Evidence summary
  photos_count: number;
  has_signature: boolean;
  signer_name?: string;
  sealed_at?: string;
  evidence_hash?: string;

  // Payment info (optional)
  amount?: number;
  currency?: string;
  payment_status?: 'pending' | 'paid' | 'invoiced';

  // Timestamps
  generated_at: string;
  sent_at?: string;
  sent_via?: 'email' | 'sms' | 'copy' | 'share';
}

// ============================================================================
// FOCUS STACK SYSTEM (2026-02 - Context Thrash Prevention)
// ============================================================================

/**
 * User role determines dashboard behavior
 * - solo_contractor: Self-dispatched, needs overview without planning overhead
 * - technician: Assigned work, tight sequencing, no queue management
 * - manager: Exception handling, technician oversight (counts, not lists)
 */
export type FocusRole = 'solo_contractor' | 'technician' | 'manager';

/**
 * Attention level for jobs in the focus system
 * - focus: The ONE job currently being worked on
 * - queue: Next 3 jobs (preview only)
 * - collapsed: All remaining jobs (hidden, scroll-only)
 */
export type AttentionLevel = 'focus' | 'queue' | 'collapsed';

/**
 * Focus state for a user/workspace
 * Only ONE job can be in focus at any time
 */
export interface FocusState {
  activeJobId: string | null;
  lastActivityAt: number;
  role: FocusRole;
}

/**
 * Job with focus-related metadata for queue ordering
 */
export interface JobFocusMetadata {
  queuePosition?: number;        // Order in queue (system-determined, not user-editable)
  lastActivityAt?: number;       // Timestamp of last user interaction
  focusEnteredAt?: number;       // When job entered focus state
  focusExitedAt?: number;        // When job left focus state
}

/**
 * Attention item for manager dashboard
 * Only exceptions appear in the attention queue
 */
export interface AttentionItem {
  id: string;
  type: 'idle_technician' | 'rapid_switching' | 'stuck_job' | 'sync_failed' | 'urgent_job';
  technicianId?: string;
  technicianName?: string;
  jobId?: string;
  jobTitle?: string;
  message: string;
  severity: 'warning' | 'critical';
  timestamp: number;
}

/**
 * Technician summary for manager view
 * Shows counts, not job lists
 */
export interface TechnicianSummary {
  id: string;
  name: string;
  activeJobId: string | null;
  activeJobTitle?: string;
  jobsRemaining: number;
  lastActivityAt: number;
  status: 'working' | 'idle' | 'offline';
}
