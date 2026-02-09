/**
 * EvidenceReview - Professional Evidence Report
 *
 * Comprehensive forensic report view for sealed/reviewed jobs.
 * Designed for manager review, client presentation, and legal compliance.
 *
 * Sections:
 * 1. Report Header (job title, reference, seal status)
 * 2. Job Summary (date, address, client, technician)
 * 3. Evidence Gallery grouped by type (before/during/after)
 * 4. Photo metadata (GPS, W3W, timestamp, integrity)
 * 5. Client Signature & Confirmation
 * 6. Cryptographic Seal Certificate
 * 7. Chain of Custody Timeline
 *
 * Phase E: Job Lifecycle / Phase H: Seal & Verify
 */

import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, EmptyState, LoadingSkeleton } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { route, ROUTES } from '../../../lib/routes';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import SealBadge from '../../../components/SealBadge';
import { resolveTechnicianId } from '../../../lib/utils/technicianIdNormalization';

interface Photo {
  id?: string;
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
  location?: { lat: number; lng: number; accuracy?: number };
  lat?: number;
  lng?: number;
  gps_accuracy?: number;
  w3w?: string;
  w3w_verified?: boolean;
  photo_hash?: string;
  hash?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
  device_info?: { make?: string; model?: string; os?: string };
}

const EvidenceReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { jobs, clients, technicians, isLoading: loading } = useData();

  const job = useMemo(() => jobs.find(j => j.id === id) || null, [jobs, id]);
  const client = useMemo(() =>
    job ? clients.find(c => c.id === job.clientId) || null : null,
    [clients, job]
  );
  const technician = useMemo(() => {
    if (!job) return null;
    const resolved = resolveTechnicianId(job);
    return resolved.assignedTechnicianId
      ? technicians.find(t => t.id === resolved.assignedTechnicianId) || null
      : null;
  }, [technicians, job]);

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const photos = useMemo(() => (job?.photos || []) as Photo[], [job]);
  const isSealed = Boolean(job?.sealedAt);

  const grouped = useMemo(() => {
    const before = photos.filter(p => p.type === 'before');
    const during = photos.filter(p => p.type === 'during');
    const after = photos.filter(p => p.type === 'after');
    const other = photos.filter(p => !p.type);
    return { before, during, after, other };
  }, [photos]);

  // Compute integrity summary
  const integritySummary = useMemo(() => {
    const total = photos.length;
    const withGPS = photos.filter(p => p.lat || p.lng || p.location).length;
    const withW3W = photos.filter(p => p.w3w).length;
    const w3wVerified = photos.filter(p => p.w3w_verified).length;
    const withHash = photos.filter(p => p.photo_hash || p.hash).length;
    return { total, withGPS, withW3W, w3wVerified, withHash };
  }, [photos]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Evidence Report" backTo={ROUTES.JOBS} backLabel="Jobs" />
        <PageContent>
          <LoadingSkeleton variant="card" count={3} />
        </PageContent>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        <PageHeader title="Job Not Found" backTo={ROUTES.JOBS} backLabel="Jobs" />
        <PageContent>
          <EmptyState
            icon="work_off"
            title="Job not found"
            description="The job you're looking for doesn't exist or has been deleted."
            action={{ label: 'Back to Jobs', to: ROUTES.JOBS }}
          />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Evidence Report"
        subtitle={job.title || `Job #${job.id.slice(0, 6)}`}
        backTo={route(ROUTES.JOB_DETAIL, { id: job.id })}
        backLabel="Job Details"
      />

      <PageContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8 max-w-5xl mx-auto"
        >
          {/* ============================================================ */}
          {/* SECTION 1: REPORT HEADER */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <div className={`rounded-2xl p-6 border-2 ${
              isSealed
                ? 'bg-gradient-to-br from-emerald-950/50 to-slate-900 border-emerald-500/30'
                : 'bg-gradient-to-br from-slate-900 to-slate-800 border-white/10'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`material-symbols-outlined text-3xl ${isSealed ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isSealed ? 'verified' : 'description'}
                    </span>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">
                        {job.title || 'Untitled Job'}
                      </h2>
                      <p className="text-xs text-slate-400 font-mono">
                        REF: {job.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
                  isSealed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : job.status === 'Submitted'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-slate-700 text-slate-300 border border-white/10'
                }`}>
                  {isSealed ? 'Cryptographically Sealed' : job.status === 'Submitted' ? 'Awaiting Seal' : 'Under Review'}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ============================================================ */}
          {/* SECTION 2: JOB SUMMARY */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <Card>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                Job Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Date */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm text-white font-medium">
                    {new Date(job.date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Client */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Client</p>
                  <p className="text-sm text-white font-medium">{client?.name || job.client || 'N/A'}</p>
                  {client?.email && (
                    <p className="text-xs text-slate-400">{client.email}</p>
                  )}
                </div>

                {/* Technician */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Technician</p>
                  <p className="text-sm text-white font-medium">{technician?.name || job.technician || 'N/A'}</p>
                  {technician?.email && (
                    <p className="text-xs text-slate-400">{technician.email}</p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Location</p>
                  <p className="text-sm text-white font-medium">{job.address || 'N/A'}</p>
                  {job.w3w && (
                    <p className="text-xs text-emerald-400 font-mono">///{job.w3w}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              {(job.description || job.notes) && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Description</p>
                  <p className="text-sm text-slate-300">{job.description || job.notes}</p>
                </div>
              )}

              {/* Amount */}
              {(job.total || job.price) && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Amount</p>
                  <p className="text-lg font-black text-white">£{(job.total || job.price || 0).toFixed(2)}</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* ============================================================ */}
          {/* SECTION 3: EVIDENCE INTEGRITY SUMMARY */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <Card>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                Evidence Integrity
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <IntegrityMetric
                  label="Total Photos"
                  value={integritySummary.total}
                  icon="photo_camera"
                  color="text-white"
                />
                <IntegrityMetric
                  label="GPS Tagged"
                  value={integritySummary.withGPS}
                  total={integritySummary.total}
                  icon="location_on"
                  color={integritySummary.withGPS === integritySummary.total ? 'text-emerald-400' : 'text-amber-400'}
                />
                <IntegrityMetric
                  label="W3W Tagged"
                  value={integritySummary.withW3W}
                  total={integritySummary.total}
                  icon="grid_3x3"
                  color={integritySummary.withW3W === integritySummary.total ? 'text-emerald-400' : 'text-amber-400'}
                />
                <IntegrityMetric
                  label="W3W Verified"
                  value={integritySummary.w3wVerified}
                  total={integritySummary.withW3W}
                  icon="verified"
                  color={integritySummary.w3wVerified === integritySummary.withW3W && integritySummary.withW3W > 0 ? 'text-emerald-400' : 'text-amber-400'}
                />
                <IntegrityMetric
                  label="Hash Verified"
                  value={integritySummary.withHash}
                  total={integritySummary.total}
                  icon="fingerprint"
                  color={integritySummary.withHash === integritySummary.total ? 'text-emerald-400' : 'text-amber-400'}
                />
              </div>
            </Card>
          </motion.div>

          {/* ============================================================ */}
          {/* SECTION 4: SEAL CERTIFICATE */}
          {/* ============================================================ */}
          {isSealed && (
            <motion.div variants={fadeInUp}>
              <SealBadge jobId={job.id} />
            </motion.div>
          )}

          {/* Auto-Seal Banner */}
          {!isSealed && job.status === 'Submitted' && photos.length > 0 && (
            <motion.div variants={fadeInUp}>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
                <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-emerald-400">lock_clock</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Auto-Seal in Progress</p>
                  <p className="text-sm text-slate-400">
                    Evidence is being cryptographically sealed automatically after technician submission.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* SECTION 5: EVIDENCE GALLERY */}
          {/* ============================================================ */}
          {photos.length === 0 ? (
            <EmptyState
              icon="photo_camera"
              title="No evidence yet"
              description="Evidence will appear here once the technician uploads photos."
            />
          ) : (
            <>
              {/* Before Photos */}
              {grouped.before.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-blue-400 text-lg">photo_camera_front</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Before Work ({grouped.before.length})</h3>
                      <p className="text-xs text-slate-400">Conditions documented prior to work commencing</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.before.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `before-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* During Photos */}
              {grouped.during.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-400 text-lg">construction</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">During Work ({grouped.during.length})</h3>
                      <p className="text-xs text-slate-400">Progress documentation during work execution</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.during.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `during-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* After Photos */}
              {grouped.after.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">After Work ({grouped.after.length})</h3>
                      <p className="text-xs text-slate-400">Completed work evidence and final state</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.after.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `after-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Other Photos */}
              {grouped.other.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-slate-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400 text-lg">image</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">Other ({grouped.other.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.other.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `other-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* SECTION 6: CLIENT SIGNATURE & CONFIRMATION */}
          {/* ============================================================ */}
          {(job.signature || job.clientConfirmation) && (
            <motion.div variants={fadeInUp}>
              <Card>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                  Client Confirmation
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Signature */}
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Signature</p>
                    <div className={`rounded-xl p-4 border-2 ${
                      isSealed
                        ? 'bg-slate-900 border-emerald-500/20'
                        : 'bg-slate-900 border-white/10'
                    }`}>
                      {(job.clientConfirmation?.signature || job.signature) ? (
                        <img
                          src={job.clientConfirmation?.signature || job.signature || ''}
                          alt="Client Signature"
                          className="max-h-32 mx-auto"
                        />
                      ) : (
                        <p className="text-center text-slate-500 text-sm py-4">No signature captured</p>
                      )}
                    </div>
                    {job.signerName && (
                      <p className="text-sm text-white font-medium mt-2">{job.signerName}</p>
                    )}
                    {job.signerRole && (
                      <p className="text-xs text-slate-400">{job.signerRole}</p>
                    )}
                  </div>

                  {/* Confirmation Details */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Confirmation Details</p>

                    {job.clientConfirmation?.confirmed && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        <span className="text-sm font-medium">Client confirmed satisfaction</span>
                      </div>
                    )}

                    {job.clientConfirmation?.timestamp && (
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Signed At</p>
                        <p className="text-sm text-white font-mono">
                          {new Date(job.clientConfirmation.timestamp).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'UTC',
                          })} UTC
                        </p>
                      </div>
                    )}

                    {job.signatureHash && (
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Signature Hash</p>
                        <p className="text-[10px] text-slate-300 font-mono break-all">
                          {job.signatureHash.slice(0, 32)}...
                        </p>
                      </div>
                    )}

                    {job.completedAt && (
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Job Completed</p>
                        <p className="text-sm text-white font-mono">
                          {new Date(job.completedAt).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          })} UTC
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* SECTION 7: REPORT FOOTER */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <div className="text-center py-6 border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                Generated by JobProof
              </p>
              <p className="text-[9px] text-slate-600">
                This report was generated on {new Date().toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}. Evidence integrity is verified via SHA-256 hashing and RSA-2048 digital signatures.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </PageContent>

      {/* ============================================================ */}
      {/* PHOTO VIEWER MODAL - Enhanced with GPS/W3W metadata */}
      {/* ============================================================ */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setSelectedPhoto(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>

          {/* Photo */}
          <img
            src={selectedPhoto.url || selectedPhoto.localPath}
            alt="Evidence"
            className="max-w-full max-h-[65vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />

          {/* Metadata Panel */}
          <div
            className="mt-4 w-full max-w-2xl bg-slate-900/90 backdrop-blur rounded-2xl p-4 border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Timestamp */}
              {selectedPhoto.timestamp && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Captured</p>
                  <p className="text-xs text-white font-mono">
                    {new Date(selectedPhoto.timestamp).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {/* GPS */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">GPS</p>
                {(selectedPhoto.lat || selectedPhoto.location) ? (
                  <div>
                    <p className="text-xs text-emerald-400 font-mono">
                      {(selectedPhoto.lat || selectedPhoto.location?.lat)?.toFixed(6)},
                      {(selectedPhoto.lng || selectedPhoto.location?.lng)?.toFixed(6)}
                    </p>
                    {(selectedPhoto.gps_accuracy || selectedPhoto.location?.accuracy) && (
                      <p className="text-[10px] text-slate-400">
                        ±{Math.round(selectedPhoto.gps_accuracy || selectedPhoto.location?.accuracy || 0)}m accuracy
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Not captured</p>
                )}
              </div>

              {/* W3W */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">What3Words</p>
                {selectedPhoto.w3w ? (
                  <div>
                    <p className="text-xs text-emerald-400 font-mono">
                      ///{selectedPhoto.w3w}
                    </p>
                    <p className={`text-[10px] flex items-center gap-1 ${
                      selectedPhoto.w3w_verified ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      <span className="material-symbols-outlined text-[10px]">
                        {selectedPhoto.w3w_verified ? 'verified' : 'warning'}
                      </span>
                      {selectedPhoto.w3w_verified ? 'API Verified' : 'Unverified'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Not captured</p>
                )}
              </div>

              {/* Integrity */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Integrity</p>
                {(selectedPhoto.photo_hash || selectedPhoto.hash) ? (
                  <p className="text-[10px] text-emerald-400 font-mono break-all">
                    {(selectedPhoto.photo_hash || selectedPhoto.hash || '').slice(0, 16)}...
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">No hash</p>
                )}
              </div>
            </div>

            {/* Type badge and seal status */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
              {selectedPhoto.type && (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                  selectedPhoto.type === 'before' ? 'bg-blue-500/20 text-blue-400' :
                  selectedPhoto.type === 'during' ? 'bg-amber-500/20 text-amber-400' :
                  selectedPhoto.type === 'after' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {selectedPhoto.type}
                </span>
              )}
              {isSealed && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Sealed
                </span>
              )}
              {selectedPhoto.syncStatus && (
                <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                  selectedPhoto.syncStatus === 'synced' ? 'text-emerald-400' :
                  selectedPhoto.syncStatus === 'pending' ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  <span className="material-symbols-outlined text-sm">
                    {selectedPhoto.syncStatus === 'synced' ? 'cloud_done' :
                     selectedPhoto.syncStatus === 'pending' ? 'cloud_upload' : 'cloud_off'}
                  </span>
                  {selectedPhoto.syncStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// INTEGRITY METRIC COMPONENT
// ============================================================================

interface IntegrityMetricProps {
  label: string;
  value: number;
  total?: number;
  icon: string;
  color: string;
}

const IntegrityMetric: React.FC<IntegrityMetricProps> = ({ label, value, total, icon, color }) => (
  <div className="text-center p-3 bg-slate-800/50 rounded-xl">
    <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
    <p className="text-lg font-black text-white mt-1">
      {value}{total !== undefined && <span className="text-slate-500 text-sm">/{total}</span>}
    </p>
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
  </div>
);

// ============================================================================
// PHOTO CARD COMPONENT - Forensic enhanced
// ============================================================================

interface PhotoCardProps {
  photo: Photo;
  locked: boolean;
  onClick: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, locked, onClick }) => {
  const hasGPS = Boolean(photo.lat || photo.lng || photo.location);
  const hasW3W = Boolean(photo.w3w);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative rounded-xl overflow-hidden
        bg-[#121212] border-2 transition-all duration-300 group text-left w-full
        ${locked
          ? 'border-[#00FFCC]/50 shadow-[0_0_15px_rgba(0,255,204,0.3)]'
          : 'border-white/10 hover:border-white/20'
        }
      `}
    >
      {/* Photo */}
      <div className="aspect-[4/3]">
        <img
          src={photo.url || photo.localPath}
          alt="Evidence"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      {/* Top badges */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
        {photo.type && (
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
            photo.type === 'before' ? 'bg-blue-500/20 text-blue-400' :
            photo.type === 'during' ? 'bg-amber-500/20 text-amber-400' :
            photo.type === 'after' ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {photo.type}
          </span>
        )}
        {locked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="size-7 rounded-full bg-[#00FFCC]/20 flex items-center justify-center shadow-[0_0_10px_rgba(0,255,204,0.5)]"
          >
            <span className="material-symbols-outlined text-sm text-[#00FFCC]">verified_user</span>
          </motion.div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
      </div>

      {/* Bottom metadata panel */}
      <div className="bg-slate-900 p-3 space-y-2">
        {/* Timestamp */}
        {photo.timestamp && (
          <p className="font-mono text-[10px] text-slate-300">
            {new Date(photo.timestamp).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {/* Location info */}
        {(hasGPS || hasW3W) && (
          <div className="space-y-1">
            {hasGPS && (
              <p className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px] text-emerald-400">location_on</span>
                {(photo.lat || photo.location?.lat)?.toFixed(4)}, {(photo.lng || photo.location?.lng)?.toFixed(4)}
                {(photo.gps_accuracy || photo.location?.accuracy) && (
                  <span className="text-slate-500 ml-1">±{Math.round(photo.gps_accuracy || photo.location?.accuracy || 0)}m</span>
                )}
              </p>
            )}
            {hasW3W && (
              <p className="text-[9px] font-mono flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px] text-emerald-400">grid_3x3</span>
                <span className={photo.w3w_verified ? 'text-emerald-400' : 'text-amber-400'}>
                  ///{photo.w3w}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Integrity indicators */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${hasGPS ? 'text-[#00FFCC]' : 'text-slate-500'}`}>
            <span className="material-symbols-outlined text-[10px]">
              {hasGPS ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            GPS
          </span>
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${hasW3W && photo.w3w_verified ? 'text-[#00FFCC]' : 'text-slate-500'}`}>
            <span className="material-symbols-outlined text-[10px]">
              {hasW3W && photo.w3w_verified ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            W3W
          </span>
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${locked ? 'text-[#00FFCC]' : 'text-slate-500'}`}>
            <span className="material-symbols-outlined text-[10px]">
              {locked ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            Sealed
          </span>
          {photo.syncStatus === 'pending' && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-amber-400">
              <span className="material-symbols-outlined text-[10px]">cloud_upload</span>
              Sync
            </span>
          )}
          {photo.syncStatus === 'failed' && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-red-400">
              <span className="material-symbols-outlined text-[10px]">cloud_off</span>
              Failed
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
};

export default EvidenceReview;
