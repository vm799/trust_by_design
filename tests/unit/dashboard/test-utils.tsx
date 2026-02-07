import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DataContext } from '../../../lib/DataContext';
import { Job, Technician, Client } from '../../../types';
import { vi } from 'vitest';

export interface TestContextValue {
  jobs: Job[];
  technicians: Technician[];
  clients: Client[];
  updateJob: (job: Job) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  addJob: (job: Omit<Job, 'id'>) => Promise<Job>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const defaultTestContextValue: TestContextValue = {
  jobs: [],
  technicians: [],
  clients: [],
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  addJob: vi.fn(),
  isLoading: false,
  error: null,
  refresh: vi.fn(),
};

export function TestWrapper({
  children,
  value = defaultTestContextValue,
}: {
  children: React.ReactNode;
  value?: TestContextValue;
}) {
  return (
    <BrowserRouter>
      <DataContext.Provider value={value as any}>
        {children}
      </DataContext.Provider>
    </BrowserRouter>
  );
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

export function createTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Job',
    clientId: 'client-1',
    client: 'Test Client',
    techId: 'tech-1',
    technicianId: 'tech-1',
    technician: 'Test Tech',
    status: 'In Progress',
    syncStatus: 'synced',
    priority: 'normal',
    date: new Date().toISOString(),
    photos: [],
    signature: null,
    notes: '',
    address: 'Test Address',
    lastUpdated: Date.now(),
    ...overrides,
  } as Job;
}

export function createTestTechnician(overrides: Partial<Technician> = {}): Technician {
  return {
    id: `tech-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Technician',
    email: 'tech@test.com',
    status: 'Available',
    workMode: 'employed',
    ...overrides,
  } as Technician;
}

export function createTestClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Test Client',
    email: 'client@test.com',
    address: '123 Test St',
    ...overrides,
  } as Client;
}
