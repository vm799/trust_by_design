
export type JobStatus = 'Pending' | 'In Progress' | 'Submitted' | 'Archived';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type PhotoType = 'Before' | 'During' | 'After' | 'Evidence';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface SafetyCheck {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

export interface Photo {
  id: string;
  url: string; // IndexedDB key reference (e.g., "media_abc123") for offline, or full URL when synced
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

export interface Job {
  id: string;
  title: string;
  client: string;
  clientId: string;
  technician: string;
  techId: string;
  status: JobStatus;
  date: string;
  address: string;
  lat?: number;
  lng?: number;
  w3w?: string;
  notes: string;
  workSummary?: string;
  photos: Photo[];
  signature: string | null; // IndexedDB key reference (e.g., "sig_jobId") when offline
  signatureIsIndexedDBRef?: boolean; // Indicates if signature is a reference key
  signerName?: string;
  signerRole?: string;
  safetyChecklist: SafetyCheck[];
  siteHazards?: string[];
  completedAt?: string;
  templateId?: string;
  syncStatus: SyncStatus;
  lastUpdated: number;
  price?: number;
  magicLinkToken?: string; // Magic link token for technician access
  magicLinkUrl?: string; // Full URL for sharing
  workspaceId?: string; // Workspace ID (from database)
  // Phase C.3: Cryptographic sealing
  sealedAt?: string; // ISO timestamp when evidence was sealed
  sealedBy?: string; // Email of user who sealed the evidence
  evidenceHash?: string; // SHA-256 hash of evidence bundle
  isSealed?: boolean; // Computed: !!sealedAt
}

export interface Invoice {
  id: string;
  jobId: string;
  clientId: string;
  clientName: string;
  amount: number;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
  totalJobs: number;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'Available' | 'On Site' | 'Off Duty' | 'Authorised';
  rating: number;
  jobsCompleted: number;
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
