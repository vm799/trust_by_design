/**
 * TechJobDetail - Technician Job Detail View
 *
 * Shows job details and evidence capture for technicians.
 *
 * Phase G: Technician Portal
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, ActionButton, EmptyState, LoadingSkeleton } from '../../components/ui';
import { getJobs, getClients, updateJob } from '../../hooks/useWorkspaceData';
import { Job, Client } from '../../types';
import { OfflineIndicator } from '../../components/OfflineIndicator';

interface Photo {
  id?: string;  // REMEDIATION ITEM 9: Added for stable React keys
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
}

const TechJobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!jobId) return;

      try {
        const [jobsData, clientsData] = await Promise.all([
          getJobs(),
          getClients(),
        ]);

        const foundJob = jobsData.find(j => j.id === jobId);
        setJob(foundJob || null);

        if (foundJob) {
          setClient(clientsData.find(c => c.id === foundJob.clientId) || null);
        }
      } catch (error) {
        console.error('Failed to load job:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [jobId]);

  const handleStartJob = async () => {
    if (!job) return;

    try {
      await updateJob(job.id, { status: 'In Progress' });
      setJob({ ...job, status: 'In Progress' });
    } catch (error) {
      console.error('Failed to start job:', error);
      alert('Failed to start job. Please try again.');
    }
  };

  const handleCompleteJob = async () => {
    if (!job) return;

    setSubmitting(true);
    try {
      await updateJob(job.id, { status: 'Complete' });
      navigate('/tech');
    } catch (error) {
      console.error('Failed to complete job:', error);
      alert('Failed to complete job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openMaps = () => {
    if (!job?.address) return;

    const encodedAddress = encodeURIComponent(job.address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapsUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <EmptyState
          icon="work_off"
          title="Job not found"
          description="This job doesn't exist or you don't have access."
          action={{ label: 'Back to Jobs', to: '/tech' }}
        />
      </div>
    );
  }

  const photos = (job.photos || []) as Photo[];
  const beforePhotos = photos.filter(p => p.type === 'before');
  const afterPhotos = photos.filter(p => p.type === 'after');
  const isActive = job.status === 'In Progress';
  const canComplete = beforePhotos.length >= 1 && afterPhotos.length >= 1;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-4">
          <Link to="/tech" className="p-1 text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex-1">
            <h1 className="font-medium text-white truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </h1>
            <p className="text-xs text-slate-500">{client?.name}</p>
          </div>
          <OfflineIndicator />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-32">
        {/* Status Banner */}
        <div className={`
          p-4 rounded-2xl mb-6 flex items-center gap-4
          ${isActive ? 'bg-primary/10 border border-primary/20' : 'bg-slate-800 border border-white/5'}
        `}>
          <div className={`
            size-12 rounded-xl flex items-center justify-center
            ${isActive ? 'bg-primary/20 text-primary' : 'bg-slate-700 text-slate-400'}
          `}>
            <span className="material-symbols-outlined text-2xl">
              {isActive ? 'play_circle' : 'schedule'}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">
                {isActive ? 'Job In Progress' : 'Ready to Start'}
              </p>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${isActive ? 'bg-primary/20 text-primary' : 'bg-slate-600 text-slate-300'}`}>
                {job.status}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              {isActive
                ? 'Capture evidence and complete when done'
                : 'Tap below to start this job'}
            </p>
          </div>
        </div>

        {/* Job Info */}
        <Card className="mb-6">
          <div className="space-y-4">
            {/* Date & Time */}
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-500">schedule</span>
              <div>
                <p className="text-white">
                  {new Date(job.date).toLocaleDateString('en-AU', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-slate-500">
                  {new Date(job.date).toLocaleTimeString('en-AU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Address */}
            {job.address && (
              <button
                onClick={openMaps}
                className="w-full flex items-center gap-3 p-3 -mx-3 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary">location_on</span>
                <div className="flex-1">
                  <p className="text-white">{job.address}</p>
                  <p className="text-sm text-primary">Open in Maps</p>
                </div>
                <span className="material-symbols-outlined text-slate-500">open_in_new</span>
              </button>
            )}

            {/* Description */}
            {job.description && (
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-slate-500">description</span>
                <p className="text-white">{job.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Evidence Section */}
        <section>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Evidence
          </h3>

          {/* Before Photos */}
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Before Photos</h4>
              <span className={`text-xs ${beforePhotos.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {beforePhotos.length} captured
              </span>
            </div>
            {/* REMEDIATION ITEM 9: Use stable keys for photos */}
            {beforePhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {beforePhotos.map((photo, i) => (
                  <div key={photo.id || photo.url || photo.timestamp || `before-${i}`} className="aspect-square rounded-lg bg-slate-800 overflow-hidden">
                    <img
                      src={photo.url || photo.localPath}
                      alt={`Before ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No before photos captured yet</p>
            )}
          </Card>

          {/* After Photos */}
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">After Photos</h4>
              <span className={`text-xs ${afterPhotos.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {afterPhotos.length} captured
              </span>
            </div>
            {afterPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {afterPhotos.map((photo, i) => (
                  <div key={photo.id || photo.url || photo.timestamp || `after-${i}`} className="aspect-square rounded-lg bg-slate-800 overflow-hidden">
                    <img
                      src={photo.url || photo.localPath}
                      alt={`After ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No after photos captured yet</p>
            )}
          </Card>
        </section>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-4 py-4 pb-safe">
        <div className="flex gap-3">
          {!isActive ? (
            <ActionButton
              variant="primary"
              icon="play_arrow"
              onClick={handleStartJob}
              fullWidth
              size="lg"
            >
              Start Job
            </ActionButton>
          ) : (
            <>
              <Link to={`/tech/job/${job.id}/capture`} className="flex-1">
                <ActionButton
                  variant="primary"
                  icon="photo_camera"
                  fullWidth
                  size="lg"
                >
                  Capture
                </ActionButton>
              </Link>
              <ActionButton
                variant={canComplete ? 'secondary' : 'ghost'}
                icon="check"
                onClick={handleCompleteJob}
                disabled={!canComplete}
                loading={submitting}
                size="lg"
              >
                Complete
              </ActionButton>
            </>
          )}
        </div>
        {isActive && !canComplete && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Capture at least 1 before and 1 after photo to complete
          </p>
        )}
      </div>
    </div>
  );
};

export default TechJobDetail;
