/**
 * Test Data Generation Script for JobProof Staging
 *
 * Generates comprehensive test datasets for staging environment validation,
 * load testing, and audit export verification.
 *
 * USAGE:
 *   Direct import: import { generateSmallDataset } from './lib/testing/generateTestData'
 *   CLI:           npx tsx lib/testing/generateTestData.ts --size=small --cleanup
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   VITE_SUPABASE_URL - Supabase project URL
 *   VITE_SUPABASE_ANON_KEY - Supabase anonymous key
 *   WORKSPACE_ID - Test workspace ID (optional, uses current user's workspace)
 *
 * @see CLAUDE.md - Encryption Standards, Sealing, Offline-First Mandates
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type {
  Job,
  Client,
  Technician,
  Photo,
  SafetyCheck,
  JobStatus,
  PhotoType,
  SyncStatus,
} from '../../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TestDataConfig {
  /** Number of sealed jobs to create (0-179 days old) */
  sealedJobsRecentCount: number;
  /** Number of sealed jobs to create (180+ days old) */
  sealedJobsArchiveCount: number;
  /** Number of active jobs (draft, in-progress, awaiting seal) */
  activeJobsCount: number;
  /** Total jobs for load testing */
  loadTestJobsCount: number;
  /** Percentage of jobs with photos */
  jobsWithPhotosPercent: number;
  /** Percentage of jobs with signatures */
  jobsWithSignaturesPercent: number;
  /** Number of sync conflict scenarios to create */
  syncConflictCount: number;
  /** Workspace ID for data isolation */
  workspaceId: string;
}

export interface GenerationResult {
  success: boolean;
  jobsCreated: number;
  clientsCreated: number;
  techniciansCreated: number;
  photosCreated: number;
  signersCreated: number;
  sealedJobsCreated: number;
  conflictScenariosCreated: number;
  durationMs: number;
  error?: string;
  summary: {
    sealedRecentCount: number;
    sealedArchiveCount: number;
    activeJobsCount: number;
    loadTestJobsCount: number;
  };
}

export interface ConflictScenario {
  jobId: string;
  localVersion: Job;
  remoteVersion: Job;
  conflictType: 'status_mismatch' | 'evidence_mismatch' | 'signature_mismatch';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: TestDataConfig = {
  sealedJobsRecentCount: 50,
  sealedJobsArchiveCount: 50,
  activeJobsCount: 50,
  loadTestJobsCount: 100,
  jobsWithPhotosPercent: 80,
  jobsWithSignaturesPercent: 70,
  syncConflictCount: 10,
  workspaceId: 'staging-workspace',
};

// Test data templates
const JOB_TITLES = [
  'HVAC Installation',
  'Electrical Repair',
  'Plumbing Service',
  'Roofing Work',
  'Foundation Inspection',
  'Safety Audit',
  'Equipment Installation',
  'Maintenance Service',
  'Emergency Repair',
  'Scheduled Inspection',
];

const CLIENT_NAMES = [
  'Acme Corp',
  'Global Industries',
  'TechVentures Inc',
  'BuildRight LLC',
  'SafeWorks Solutions',
  'GreenTech Energy',
  'Standard Manufacturing',
  'Premier Services',
  'Elite Operations',
  'NextGen Solutions',
];

const TECHNICIAN_NAMES = [
  'John Smith',
  'Jane Doe',
  'Mike Johnson',
  'Sarah Williams',
  'David Brown',
  'Emma Davis',
  'Robert Miller',
  'Lisa Anderson',
  'James Taylor',
  'Jennifer White',
];

const ADDRESSES = [
  '123 Business St, New York, NY 10001',
  '456 Commerce Ave, Los Angeles, CA 90001',
  '789 Industrial Blvd, Chicago, IL 60601',
  '321 Enterprise Ln, Houston, TX 77001',
  '654 Corporate Rd, Phoenix, AZ 85001',
  '987 Trade Center, Philadelphia, PA 19101',
  '111 Market St, San Antonio, TX 78201',
  '222 Center Ave, San Diego, CA 92101',
  '333 District St, Dallas, TX 75201',
  '444 Boulevard Dr, San Jose, CA 95101',
];

const PHOTO_TYPES: PhotoType[] = ['Before', 'During', 'After', 'Evidence'];

const SAFETY_CHECKLIST_TEMPLATES: SafetyCheck[] = [
  {
    id: 'safety-1',
    label: 'PPE worn (hard hat, safety glasses, gloves)',
    checked: true,
    required: true,
  },
  {
    id: 'safety-2',
    label: 'Work area hazards identified and mitigated',
    checked: true,
    required: true,
  },
  {
    id: 'safety-3',
    label: 'Tools and equipment inspected',
    checked: true,
    required: true,
  },
  {
    id: 'safety-4',
    label: 'Emergency exits clear and accessible',
    checked: false,
    required: false,
  },
  {
    id: 'safety-5',
    label: 'First aid kit accessible',
    checked: true,
    required: false,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random item from an array
 */
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random W3W address (What3Words format)
 * Format: three.random.words
 */
function generateRandomW3W(): string {
  const words = [
    'index', 'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot',
    'golf', 'hotel', 'home', 'scale', 'plate', 'paint', 'plain', 'plane',
    'place', 'play', 'raft', 'rate', 'race', 'rare', 'rise', 'riser',
  ];
  return `${randomItem(words)}.${randomItem(words)}.${randomItem(words)}`;
}

/**
 * Generate a SHA-256 hash (simulated for test data)
 * In production, this would be calculated from actual evidence
 */
function generateSHA256Hash(input: string = ''): string {
  const data = input || crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a date N days ago
 */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Generate an ISO timestamp N days ago
 */
function timestampDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate a mock client
 */
function generateMockClient(index: number): Client {
  return {
    id: `client-test-${index}-${crypto.randomBytes(4).toString('hex')}`,
    name: `${randomItem(CLIENT_NAMES)} - Test ${index}`,
    email: `client${index}@test.jobproof.pro`,
    phone: `555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    address: randomItem(ADDRESSES),
    totalJobs: randomInt(1, 50),
    type: randomItem(['commercial', 'residential', 'industrial']),
    notes: `Test client #${index} - Generated for staging validation`,
  };
}

/**
 * Generate a mock technician
 */
function generateMockTechnician(index: number): Technician {
  return {
    id: `tech-test-${index}-${crypto.randomBytes(4).toString('hex')}`,
    name: `${randomItem(TECHNICIAN_NAMES)} - Test ${index}`,
    email: `tech${index}@test.jobproof.pro`,
    phone: `555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    status: randomItem(['Available', 'On Site', 'Off Duty']) as any,
    rating: parseFloat((Math.random() * 5).toFixed(2)),
    jobsCompleted: randomInt(0, 100),
    specialty: randomItem(['HVAC', 'Electrical', 'Plumbing', 'General', 'Safety']),
  };
}

/**
 * Generate mock photos for a job
 */
function generateMockPhotos(jobId: string, count: number = 3): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${jobId}-${i}-${crypto.randomBytes(4).toString('hex')}`,
    url: `https://storage.jobproof.pro/test-photos/${jobId}/photo-${i}.jpg`,
    localPath: undefined,
    timestamp: timestampDaysAgo(randomInt(0, 30)),
    lat: 40.7128 + (Math.random() - 0.5),
    lng: -74.006 + (Math.random() - 0.5),
    w3w: generateRandomW3W(),
    verified: Math.random() > 0.2,
    syncStatus: 'synced' as SyncStatus,
    type: randomItem(PHOTO_TYPES),
    isIndexedDBRef: false,
    w3w_verified: Math.random() > 0.3,
    photo_hash: generateSHA256Hash(`photo-${jobId}-${i}`),
    photo_hash_algorithm: 'sha256',
    gps_accuracy: randomInt(5, 50),
    device_info: {
      make: randomItem(['Apple', 'Samsung', 'Google']),
      model: randomItem(['iPhone 15', 'Galaxy S24', 'Pixel 8']),
      os: randomItem(['iOS', 'Android']),
      os_version: `${randomInt(14, 18)}.0`,
      app_version: '2.1.0',
    },
  }));
}

/**
 * Generate a job with various status combinations
 * Used for sealed, active, and conflict scenarios
 */
function generateMockJob(
  index: number,
  config: {
    status?: JobStatus;
    sealedAt?: string;
    archivedAt?: string;
    withPhotos?: boolean;
    withSignature?: boolean;
    withConflict?: boolean;
    workspaceId: string;
  }
): Job {
  const client = generateMockClient(index);
  const technician = generateMockTechnician(index);
  const jobDate = daysAgo(randomInt(0, 180));
  const jobId = `job-test-${index}-${crypto.randomBytes(4).toString('hex')}`;

  // Calculate seal time based on age
  let sealedAt: string | undefined;
  if (config.sealedAt) {
    sealedAt = config.sealedAt;
  }

  const baseJob: Job = {
    id: jobId,
    title: `${randomItem(JOB_TITLES)} - Test ${index}`,
    client: client.name,
    clientId: client.id,
    technician: technician.name,
    techId: technician.id,
    technicianId: technician.id,
    status: config.status || randomItem(['Pending', 'In Progress', 'Complete'] as JobStatus[]),
    priority: randomItem(['normal', 'urgent']) as any,
    date: jobDate,
    address: randomItem(ADDRESSES),
    lat: 40.7128 + (Math.random() - 0.5),
    lng: -74.006 + (Math.random() - 0.5),
    w3w: generateRandomW3W(),
    locationVerified: Math.random() > 0.3,
    locationSource: randomItem(['gps', 'manual', 'cached', 'w3w_api']) as any,
    notes: `Test job #${index} - Generated for staging environment`,
    description: `Detailed work description for test job ${index}`,
    workSummary: `Work was completed successfully on test job ${index}`,
    photos: config.withPhotos ? generateMockPhotos(jobId, randomInt(2, 5)) : [],
    signature: config.withSignature ? `sig-${jobId}` : null,
    signatureHash: config.withSignature ? generateSHA256Hash(jobId) : undefined,
    signatureTimestamp: config.withSignature ? timestampDaysAgo(randomInt(0, 30)) : undefined,
    signerName: config.withSignature ? randomItem(TECHNICIAN_NAMES) : undefined,
    signerRole: config.withSignature ? randomItem(['Technician', 'Manager', 'Client']) : undefined,
    safetyChecklist: SAFETY_CHECKLIST_TEMPLATES.map(s => ({
      ...s,
      checked: Math.random() > 0.2,
    })),
    siteHazards: Math.random() > 0.5 ? ['Trip hazard', 'Electrical', 'Heavy equipment'] : undefined,
    completedAt: config.status === 'Complete' ? timestampDaysAgo(randomInt(0, 30)) : undefined,
    syncStatus: 'synced' as SyncStatus,
    lastUpdated: Date.now(),
    price: randomInt(100, 5000),
    workspaceId: config.workspaceId,

    // Evidence sealing fields
    sealedAt: sealedAt,
    sealedBy: sealedAt ? `tech${randomInt(1, 10)}@test.jobproof.pro` : undefined,
    evidenceHash: sealedAt ? generateSHA256Hash(jobId) : undefined,
    isSealed: !!sealedAt,

    // Archive fields
    archivedAt: config.archivedAt,
    isArchived: !!config.archivedAt,

    // Client confirmation
    clientConfirmation: Math.random() > 0.5 && sealedAt ? {
      signature: 'data:image/png;base64,iVBORw0KGgo...',
      timestamp: timestampDaysAgo(randomInt(0, 30)),
      confirmed: true,
    } : undefined,

    // Token and proof fields
    techTokenHash: generateSHA256Hash(`token-${jobId}`),
    techPinHash: generateSHA256Hash(`pin-${jobId}`),
    tokenExpiresAt: timestampDaysAgo(-7), // Expires in 7 days
    tokenUsed: Math.random() > 0.3,
    tokenUsedAt: Math.random() > 0.3 ? timestampDaysAgo(randomInt(0, 5)) : undefined,
    beforePhoto: config.withPhotos ? `https://storage.jobproof.pro/before-${jobId}.jpg` : undefined,
    afterPhoto: config.withPhotos ? `https://storage.jobproof.pro/after-${jobId}.jpg` : undefined,
    notesBefore: 'Initial assessment completed',
    notesAfter: 'Work completed successfully',
    clientSignature: config.withSignature ? `https://storage.jobproof.pro/sig-${jobId}.png` : undefined,
    clientSignatureAt: config.withSignature ? timestampDaysAgo(randomInt(0, 10)) : undefined,
    clientNameSigned: config.withSignature ? randomItem(CLIENT_NAMES) : undefined,
    proofCompletedAt: config.status === 'Complete' ? timestampDaysAgo(randomInt(0, 30)) : undefined,
  };

  return baseJob;
}

// ============================================================================
// SUPABASE OPERATIONS
// ============================================================================

/**
 * Create Supabase client instance
 */
function createSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: Missing Supabase credentials');
    console.error('  Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Batch insert jobs into Supabase
 * Handles large inserts by chunking (Supabase has request size limits)
 */
async function batchInsertJobs(
  client: SupabaseClient,
  jobs: Job[],
  chunkSize: number = 50
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);

    try {
      const { error } = await client
        .from('jobs')
        .insert(chunk.map(job => ({
          id: job.id,
          title: job.title,
          client: job.client,
          client_id: job.clientId,
          technician: job.technician,
          tech_id: job.techId,
          status: job.status,
          priority: job.priority || 'normal',
          date: job.date,
          address: job.address,
          lat: job.lat,
          lng: job.lng,
          w3w: job.w3w,
          location_verified: job.locationVerified,
          location_source: job.locationSource,
          notes: job.notes,
          description: job.description,
          work_summary: job.workSummary,
          photos: job.photos,
          signature: job.signature,
          signature_hash: job.signatureHash,
          signature_timestamp: job.signatureTimestamp,
          signer_name: job.signerName,
          signer_role: job.signerRole,
          safety_checklist: job.safetyChecklist,
          site_hazards: job.siteHazards,
          completed_at: job.completedAt,
          sync_status: job.syncStatus,
          last_updated: job.lastUpdated,
          price: job.price,
          workspace_id: job.workspaceId,
          sealed_at: job.sealedAt,
          sealed_by: job.sealedBy,
          evidence_hash: job.evidenceHash,
          is_sealed: job.isSealed,
          archived_at: job.archivedAt,
          is_archived: job.isArchived,
          client_confirmation: job.clientConfirmation,
          tech_token_hash: job.techTokenHash,
          tech_pin_hash: job.techPinHash,
          token_expires_at: job.tokenExpiresAt,
          token_used: job.tokenUsed,
          token_used_at: job.tokenUsedAt,
          before_photo: job.beforePhoto,
          after_photo: job.afterPhoto,
          notes_before: job.notesBefore,
          notes_after: job.notesAfter,
          client_signature: job.clientSignature,
          client_signature_at: job.clientSignatureAt,
          client_name_signed: job.clientNameSigned,
          proof_completed_at: job.proofCompletedAt,
        })));

      if (error) {
        console.error(`Failed to insert chunk at index ${i}:`, error);
        errors.push(`Chunk ${i}-${i + chunkSize}: ${error.message}`);
        failed += chunk.length;
      } else {
        inserted += chunk.length;
      }
    } catch (error) {
      console.error(`Exception during batch insert at index ${i}:`, error);
      errors.push(`Chunk ${i}-${i + chunkSize}: ${error instanceof Error ? error.message : String(error)}`);
      failed += chunk.length;
    }
  }

  return { inserted, failed, errors };
}

/**
 * Delete all test data for a workspace
 */
async function deleteTestData(
  client: SupabaseClient,
  workspaceId: string
): Promise<{ deleted: number; error?: string }> {
  try {
    const { count, error } = await client
      .from('jobs')
      .delete()
      .eq('workspace_id', workspaceId)
      .select();

    if (error) {
      return { deleted: 0, error: error.message };
    }

    return { deleted: count || 0 };
  } catch (error) {
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// PUBLIC API - DATASET GENERATORS
// ============================================================================

/**
 * Generate a small dataset (100 jobs) for basic validation
 * - 20 sealed recent jobs
 * - 20 sealed archive jobs
 * - 30 active jobs
 * - 30 load test jobs
 */
export async function generateSmallDataset(
  workspaceId: string = DEFAULT_CONFIG.workspaceId
): Promise<GenerationResult> {
  const config: TestDataConfig = {
    ...DEFAULT_CONFIG,
    sealedJobsRecentCount: 20,
    sealedJobsArchiveCount: 20,
    activeJobsCount: 30,
    loadTestJobsCount: 30,
    workspaceId,
  };

  return generateDataset(config);
}

/**
 * Generate a medium dataset (500 jobs) for thorough validation
 * - 100 sealed recent jobs
 * - 100 sealed archive jobs
 * - 150 active jobs
 * - 150 load test jobs
 */
export async function generateMediumDataset(
  workspaceId: string = DEFAULT_CONFIG.workspaceId
): Promise<GenerationResult> {
  const config: TestDataConfig = {
    ...DEFAULT_CONFIG,
    sealedJobsRecentCount: 100,
    sealedJobsArchiveCount: 100,
    activeJobsCount: 150,
    loadTestJobsCount: 150,
    workspaceId,
  };

  return generateDataset(config);
}

/**
 * Generate a large dataset (10,000 jobs) for stress testing
 * Recommended for:
 * - Load testing with realistic data volumes
 * - Performance benchmarking
 * - Database query optimization
 * - Archive/seal performance testing
 */
export async function generateLargeDataset(
  workspaceId: string = DEFAULT_CONFIG.workspaceId
): Promise<GenerationResult> {
  const config: TestDataConfig = {
    ...DEFAULT_CONFIG,
    sealedJobsRecentCount: 2000,
    sealedJobsArchiveCount: 2000,
    activeJobsCount: 3000,
    loadTestJobsCount: 3000,
    jobsWithPhotosPercent: 85,
    jobsWithSignaturesPercent: 75,
    syncConflictCount: 50,
    workspaceId,
  };

  return generateDataset(config);
}

/**
 * Generate custom dataset with specific configuration
 */
export async function generateDataset(config: TestDataConfig): Promise<GenerationResult> {
  const startTime = Date.now();
  const client = createSupabaseClient();

  if (!client) {
    return {
      success: false,
      jobsCreated: 0,
      clientsCreated: 0,
      techniciansCreated: 0,
      photosCreated: 0,
      signersCreated: 0,
      sealedJobsCreated: 0,
      conflictScenariosCreated: 0,
      durationMs: Date.now() - startTime,
      error: 'Failed to create Supabase client',
      summary: {
        sealedRecentCount: 0,
        sealedArchiveCount: 0,
        activeJobsCount: 0,
        loadTestJobsCount: 0,
      },
    };
  }

  try {
    console.log('🚀 Starting test data generation...');
    console.log(`   Workspace: ${config.workspaceId}`);

    // Generate sealed jobs (recent - 0-179 days old)
    console.log(`📦 Generating ${config.sealedJobsRecentCount} sealed recent jobs...`);
    const sealedRecentJobs: Job[] = [];
    for (let i = 0; i < config.sealedJobsRecentCount; i++) {
      const dayOffset = randomInt(0, 179);
      sealedRecentJobs.push(
        generateMockJob(i, {
          status: 'Complete',
          sealedAt: timestampDaysAgo(dayOffset),
          withPhotos: Math.random() < config.jobsWithPhotosPercent / 100,
          withSignature: Math.random() < config.jobsWithSignaturesPercent / 100,
          workspaceId: config.workspaceId,
        })
      );
    }

    // Generate sealed jobs (archive - 180+ days old)
    console.log(`📦 Generating ${config.sealedJobsArchiveCount} sealed archive jobs...`);
    const sealedArchiveJobs: Job[] = [];
    for (let i = 0; i < config.sealedJobsArchiveCount; i++) {
      const dayOffset = randomInt(180, 1000);
      sealedArchiveJobs.push(
        generateMockJob(config.sealedJobsRecentCount + i, {
          status: 'Archived',
          sealedAt: timestampDaysAgo(dayOffset),
          archivedAt: timestampDaysAgo(dayOffset - 1),
          withPhotos: Math.random() < config.jobsWithPhotosPercent / 100,
          withSignature: Math.random() < config.jobsWithSignaturesPercent / 100,
          workspaceId: config.workspaceId,
        })
      );
    }

    // Generate active jobs (draft, in-progress, awaiting seal)
    console.log(`📦 Generating ${config.activeJobsCount} active jobs...`);
    const activeJobs: Job[] = [];
    const activeStatuses: JobStatus[] = ['Draft', 'Pending', 'In Progress', 'Complete'];
    for (let i = 0; i < config.activeJobsCount; i++) {
      activeJobs.push(
        generateMockJob(config.sealedJobsRecentCount + config.sealedJobsArchiveCount + i, {
          status: randomItem(activeStatuses),
          withPhotos: Math.random() < config.jobsWithPhotosPercent / 100,
          withSignature: Math.random() < config.jobsWithSignaturesPercent / 100,
          workspaceId: config.workspaceId,
        })
      );
    }

    // Generate load test jobs
    console.log(`📦 Generating ${config.loadTestJobsCount} load test jobs...`);
    const loadTestJobs: Job[] = [];
    for (let i = 0; i < config.loadTestJobsCount; i++) {
      loadTestJobs.push(
        generateMockJob(
          config.sealedJobsRecentCount + config.sealedJobsArchiveCount + config.activeJobsCount + i,
          {
            withPhotos: Math.random() < config.jobsWithPhotosPercent / 100,
            withSignature: Math.random() < config.jobsWithSignaturesPercent / 100,
            workspaceId: config.workspaceId,
          }
        )
      );
    }

    // Combine all jobs
    const allJobs = [
      ...sealedRecentJobs,
      ...sealedArchiveJobs,
      ...activeJobs,
      ...loadTestJobs,
    ];

    // Insert jobs
    console.log(`💾 Inserting ${allJobs.length} jobs into Supabase...`);
    const insertResult = await batchInsertJobs(client, allJobs, 50);

    if (insertResult.failed > 0) {
      console.warn(`⚠️  ${insertResult.failed} jobs failed to insert`);
      insertResult.errors.forEach(err => console.warn(`   ${err}`));
    }

    // Count photos created
    const photosCreated = allJobs.reduce((sum, job) => sum + (job.photos?.length || 0), 0);

    // Count signatures created
    const signersCreated = allJobs.filter(job => job.signature).length;

    // Create sync conflict scenarios
    console.log(`⚔️  Creating ${config.syncConflictCount} sync conflict scenarios...`);
    const conflicts: ConflictScenario[] = [];
    for (let i = 0; i < Math.min(config.syncConflictCount, activeJobs.length); i++) {
      const job = activeJobs[i];
      conflicts.push({
        jobId: job.id,
        localVersion: {
          ...job,
          status: 'Complete',
          lastUpdated: Date.now(),
        },
        remoteVersion: {
          ...job,
          status: 'In Progress',
          lastUpdated: Date.now() - 60000,
        },
        conflictType: 'status_mismatch',
      });
    }

    console.log(`✅ Test data generation completed!`);
    console.log(`   Jobs created: ${insertResult.inserted}`);
    console.log(`   Photos: ${photosCreated}`);
    console.log(`   Signatures: ${signersCreated}`);
    console.log(`   Sealed recent: ${config.sealedJobsRecentCount}`);
    console.log(`   Sealed archive: ${config.sealedJobsArchiveCount}`);
    console.log(`   Active: ${config.activeJobsCount}`);
    console.log(`   Load test: ${config.loadTestJobsCount}`);
    console.log(`   Sync conflicts: ${conflicts.length}`);

    return {
      success: true,
      jobsCreated: insertResult.inserted,
      clientsCreated: 0, // Created via job generation
      techniciansCreated: 0, // Created via job generation
      photosCreated,
      signersCreated,
      sealedJobsCreated: config.sealedJobsRecentCount + config.sealedJobsArchiveCount,
      conflictScenariosCreated: conflicts.length,
      durationMs: Date.now() - startTime,
      summary: {
        sealedRecentCount: config.sealedJobsRecentCount,
        sealedArchiveCount: config.sealedJobsArchiveCount,
        activeJobsCount: config.activeJobsCount,
        loadTestJobsCount: config.loadTestJobsCount,
      },
    };
  } catch (error) {
    console.error('❌ Test data generation failed:', error);
    return {
      success: false,
      jobsCreated: 0,
      clientsCreated: 0,
      techniciansCreated: 0,
      photosCreated: 0,
      signersCreated: 0,
      sealedJobsCreated: 0,
      conflictScenariosCreated: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      summary: {
        sealedRecentCount: 0,
        sealedArchiveCount: 0,
        activeJobsCount: 0,
        loadTestJobsCount: 0,
      },
    };
  }
}

/**
 * Delete all test data for a workspace
 */
export async function cleanupTestData(
  workspaceId: string = DEFAULT_CONFIG.workspaceId
): Promise<{ success: boolean; deleted: number; error?: string }> {
  const client = createSupabaseClient();

  if (!client) {
    return {
      success: false,
      deleted: 0,
      error: 'Failed to create Supabase client',
    };
  }

  try {
    console.log(`🗑️  Cleaning up test data for workspace: ${workspaceId}`);
    const result = await deleteTestData(client, workspaceId);

    if (result.error) {
      console.error(`❌ Cleanup failed: ${result.error}`);
      return {
        success: false,
        deleted: 0,
        error: result.error,
      };
    }

    console.log(`✅ Deleted ${result.deleted} test jobs`);
    return {
      success: true,
      deleted: result.deleted,
    };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// CLI SUPPORT (for npx tsx execution)
// ============================================================================

/**
 * CLI entry point - allows running directly with:
 * npx tsx lib/testing/generateTestData.ts --size=small --workspace=test-ws --cleanup
 */
async function main() {
  const args = process.argv.slice(2);
  const params = new Map<string, string>();

  // Parse command-line arguments
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    params.set(key.replace('--', ''), value || 'true');
  });

  const size = params.get('size') || 'small';
  const workspace = params.get('workspace') || DEFAULT_CONFIG.workspaceId;
  const shouldCleanup = params.has('cleanup');

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         JobProof Test Data Generation Script v2.0          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Configuration:`);
  console.log(`  Size: ${size}`);
  console.log(`  Workspace: ${workspace}`);
  console.log(`  Cleanup after: ${shouldCleanup ? 'YES' : 'NO'}`);
  console.log();

  let result;

  try {
    if (shouldCleanup) {
      console.log('🧹 Pre-cleanup: Removing existing test data...');
      await cleanupTestData(workspace);
      console.log();
    }

    console.log('Generating dataset...');
    console.log();

    switch (size.toLowerCase()) {
      case 'small':
        result = await generateSmallDataset(workspace);
        break;
      case 'medium':
        result = await generateMediumDataset(workspace);
        break;
      case 'large':
        result = await generateLargeDataset(workspace);
        break;
      default:
        console.error(`Unknown size: ${size}. Use small, medium, or large.`);
        process.exit(1);
    }

    if (result.success) {
      console.log();
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                    Generation Successful                    ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log();
      console.log(`Duration: ${(result.durationMs / 1000).toFixed(2)}s`);
      console.log();
      process.exit(0);
    } else {
      console.error();
      console.error('❌ Generation failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
