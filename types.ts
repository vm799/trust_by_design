
export type JobStatus = 'Pending' | 'In Progress' | 'Submitted' | 'Archived';

export interface Photo {
  id: string;
  url: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  verified: boolean;
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
  notes: string;
  photos: Photo[];
  signature: string | null;
  completedAt?: string;
  templateId?: string;
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
