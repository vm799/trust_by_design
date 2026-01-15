
export type JobStatus = 'Pending' | 'In Progress' | 'Submitted' | 'Archived';
export type SyncStatus = 'synced' | 'pending' | 'failed';
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
  url: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  w3w?: string;
  verified: boolean;
  syncStatus: SyncStatus;
  type: PhotoType;
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
  signature: string | null;
  signerName?: string;
  signerRole?: string;
  safetyChecklist: SafetyCheck[];
  siteHazards?: string[];
  completedAt?: string;
  templateId?: string;
  syncStatus: SyncStatus;
  lastUpdated: number;
  price?: number;
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
  address: string;
  totalJobs: number;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  status: 'Available' | 'On Site' | 'Off Duty';
  rating: number;
  jobsCompleted: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role: string;
  workspaceName: string;
}
