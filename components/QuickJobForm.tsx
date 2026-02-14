import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, TechJobMetadata } from '../types';
import { InfoBox } from './ui';
import {
  notifyManagerOfTechJob,
  getTechnicianWorkMode,
  setTechnicianWorkMode,
  storeMagicLinkLocal
} from '../lib/db';
import { convertToW3WCached, generateMockW3W } from '../lib/services/what3words';
import { generateSecureJobId } from '../lib/secureId';
import { JOB_STATUS, SYNC_STATUS } from '../lib/constants';
import { toast } from '../lib/toast';

interface QuickJobFormProps {
  techId: string;
  techName: string;
  techEmail?: string; // Email for magic link delivery (optional, uses fallback)
  workspaceId: string;
  onJobCreated: (job: Job) => void;
  onCancel: () => void;
  existingClients?: { id: string; name: string; address: string }[];
}

/**
 * QuickJobForm - Simplified job creation for technicians in the field
 *
 * Features:
 * - Minimal required fields (title, client/location)
 * - Auto-captures current location
 * - Work mode toggle (employed vs self-employed)
 * - Manager notification for employed mode
 * - Client receipt generation for self-employed mode
 */
const QuickJobForm: React.FC<QuickJobFormProps> = ({
  techId,
  techName,
  techEmail,
  workspaceId,
  onJobCreated,
  onCancel,
  existingClients = []
}) => {
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  // Location state
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'captured' | 'denied'>('idle');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [w3w, setW3w] = useState('');

  // Work mode
  const [workMode, setWorkMode] = useState<'employed' | 'self_employed'>('employed');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  // UAT Fix #15: Success state for proper feedback after job creation
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  // Load work mode from settings
  useEffect(() => {
    setWorkMode(getTechnicianWorkMode());
  }, []);

  const captureLocation = useCallback(() => {
    setLocationStatus('capturing');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        let w3wAddress = null;
        try {
          const w3wResult = await convertToW3WCached(lat, lng);
          w3wAddress = w3wResult ? `///${w3wResult.words}` : null;
        } catch (error) {
          console.warn('W3W API failed, using mock:', error);
        }

        if (!w3wAddress) {
          w3wAddress = generateMockW3W();
        }

        setCoords({ lat, lng });
        setW3w(w3wAddress);
        setLocationStatus('captured');
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationStatus('denied');
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  }, []);

  // Auto-capture location on mount
  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

  const handleWorkModeChange = (mode: 'employed' | 'self_employed') => {
    setWorkMode(mode);
    setTechnicianWorkMode(mode);
  };

  const selectClient = (client: { id: string; name: string; address: string }) => {
    setClientName(client.name);
    setClientAddress(client.address);
    setShowClientList(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.warning('Please enter a job title');
      return;
    }

    if (!clientName.trim() && workMode === 'employed') {
      toast.warning('Please enter a client name');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate job ID
      const jobId = generateSecureJobId();

      // Create tech job metadata
      const techMetadata: TechJobMetadata = {
        creationOrigin: workMode === 'self_employed' ? 'self_employed' : 'technician',
        createdByTechId: techId,
        createdByTechName: techName,
        managerNotified: workMode === 'employed',
        managerNotifiedAt: workMode === 'employed' ? new Date().toISOString() : undefined,
      };

      // Create the job
      const newJob: Job = {
        id: jobId,
        title: title.trim(),
        client: clientName.trim() || 'Self',
        clientId: '', // Will be linked later if needed
        technician: techName,
        techId: techId,
        status: JOB_STATUS.IN_PROGRESS,
        date: new Date().toISOString().split('T')[0],
        address: clientAddress.trim() || w3w || 'Current Location',
        lat: coords.lat,
        lng: coords.lng,
        w3w: w3w,
        notes: description.trim(),
        description: description.trim(),
        photos: [],
        signature: null,
        safetyChecklist: [
          { id: 'sc1', label: 'PPE (Hard Hat, Gloves, Hi-Vis) Worn', checked: false, required: true },
          { id: 'sc2', label: 'Site Hazards Identified & Controlled', checked: false, required: true },
          { id: 'sc3', label: 'Required Permits/Authorisations Checked', checked: false, required: true },
          { id: 'sc4', label: 'Area Clear of Bystanders', checked: false, required: true }
        ],
        syncStatus: SYNC_STATUS.PENDING,
        lastUpdated: Date.now(),
        price: price ? parseFloat(price) : undefined,
        workspaceId: workspaceId,
      };

      // Store the job with tech metadata
      const jobWithMetadata = {
        ...newJob,
        techMetadata,
      };

      // Generate magic link for this job
      // Use technician email if provided, otherwise use a fallback for field-generated jobs
      const deliveryEmail = techEmail || `${techId}@field.jobproof.local`;
      const magicLink = storeMagicLinkLocal(jobId, deliveryEmail, workspaceId);
      jobWithMetadata.magicLinkToken = magicLink.token;
      jobWithMetadata.magicLinkUrl = magicLink.url;

      // Notify manager if in employed mode
      if (workMode === 'employed') {
        notifyManagerOfTechJob(
          workspaceId,
          jobId,
          title.trim(),
          techId,
          techName,
          'tech_job_created'
        );
      }

      // For self-employed mode, pre-generate receipt data structure
      if (workMode === 'self_employed') {
        // Receipt will be fully generated after job is sealed
        // For now, just mark the intent
        jobWithMetadata.selfEmployedMode = true;
      }

      // UAT Fix #15: Show success state with job details and next steps
      setCreatedJob(jobWithMetadata);
      setShowSuccess(true);

      // Call parent callback
      onJobCreated(jobWithMetadata);

    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job. Please try again.');
      setIsSubmitting(false);
    }
  };

  // UAT Fix #15: Handle continue to work on job
  const handleStartWorking = () => {
    setShowSuccess(false);
    onCancel(); // This will close the form and show the job
  };

  // UAT Fix #15: Handle view dashboard
  const handleViewDashboard = () => {
    navigate('/contractor');
  };

  // UAT Fix #15: Handle share magic link
  const handleShareLink = async () => {
    if (!createdJob) return;
    const magicLinkUrl = createdJob.magicLinkUrl;

    if (typeof navigator !== 'undefined' && 'share' in navigator && magicLinkUrl) {
      try {
        await navigator.share({
          title: `Job: ${createdJob.title}`,
          text: 'Access job details and evidence capture:',
          url: magicLinkUrl,
        });
      } catch (err) {
        // Fallback to copy
        if (magicLinkUrl) {
          navigator.clipboard.writeText(magicLinkUrl);
          toast.info('Link copied to clipboard!');
        }
      }
    } else if (magicLinkUrl) {
      navigator.clipboard.writeText(magicLinkUrl);
      toast.info('Link copied to clipboard!');
    }
  };

  // UAT Fix #15: Send link via email
  const handleEmailLink = () => {
    if (!createdJob) return;
    const magicLinkUrl = createdJob.magicLinkUrl;
    const emailSubject = encodeURIComponent(`Job Assignment: ${createdJob.title}`);
    const emailBody = encodeURIComponent(
      `A new job has been created.\n\n` +
      `Job: ${createdJob.title}\n` +
      `Client: ${createdJob.client}\n` +
      `Location: ${createdJob.address}\n\n` +
      `Access the job here:\n${magicLinkUrl}`
    );
    window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
  };

  // UAT Fix #15: Success modal after job creation
  if (showSuccess && createdJob) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col animate-in">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-6">
            {/* Success Icon */}
            <div className="text-center space-y-4">
              <div className="size-20 rounded-[2rem] bg-success/20 flex items-center justify-center mx-auto animate-[bounce_0.5s_ease-out]">
                <span className="material-symbols-outlined text-success text-5xl">check_circle</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Job Created!</h2>
                <p className="text-slate-400 text-sm mt-1">{createdJob.title}</p>
              </div>
            </div>

            {/* Manager Notification Status */}
            {workMode === 'employed' && (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl">notifications_active</span>
                <div>
                  <p className="text-sm font-bold text-white">Manager Notified</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Your manager will see this job in their dashboard and can review, approve, or assign it.
                  </p>
                </div>
              </div>
            )}

            {workMode === 'self_employed' && (
              <div className="bg-success/10 border border-success/30 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-success text-xl">receipt</span>
                <div>
                  <p className="text-sm font-bold text-white">Ready for Evidence</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Complete the job and seal evidence. A client receipt will be generated for payment.
                  </p>
                </div>
              </div>
            )}

            {/* Job Summary */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job ID</span>
                <span className="text-xs font-mono text-primary">{createdJob.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</span>
                <span className="text-xs text-white font-bold">{createdJob.client}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</span>
                <span className="text-xs text-white font-bold truncate max-w-[60%]">{createdJob.address}</span>
              </div>
            </div>

            {/* Share Options */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Share Job Link</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleShareLink}
                  className="py-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-white text-xs font-medium tracking-wide transition-all press-spring"
                  title="Share via your phone's native share menu"
                >
                  <span className="material-symbols-outlined text-sm">share</span>
                  Share
                </button>
                <button
                  onClick={handleEmailLink}
                  className="py-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-white text-xs font-medium tracking-wide transition-all press-spring"
                >
                  <span className="material-symbols-outlined text-sm">email</span>
                  Email
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleStartWorking}
                className="w-full py-5 bg-primary rounded-2xl font-black text-white text-sm uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-98 press-spring"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                Start Working on Job
              </button>
              <button
                onClick={handleViewDashboard}
                className="w-full py-4 bg-white/5 rounded-2xl font-bold text-slate-400 text-xs uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">dashboard</span>
                View Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col animate-in">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Quick Job</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Field-initiated</p>
        </div>
        <button
          onClick={onCancel}
          className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Work Mode Toggle */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Work Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleWorkModeChange('employed')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                workMode === 'employed'
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm mr-2 align-middle">group</span>
              Employed
            </button>
            <button
              onClick={() => handleWorkModeChange('self_employed')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                workMode === 'self_employed'
                  ? 'bg-success text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm mr-2 align-middle">person</span>
              Self-Employed
            </button>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
            {workMode === 'employed'
              ? 'Your manager will be notified when you create this job.'
              : 'You\'ll get a client receipt for payment & legal audit trail.'}
          </p>
        </div>

        {/* Location Status */}
        <div className={`rounded-2xl p-4 border ${
          locationStatus === 'captured'
            ? 'bg-success/10 border-success/30'
            : locationStatus === 'denied'
              ? 'bg-warning/10 border-warning/30'
              : 'bg-primary/10 border-primary/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-xl flex items-center justify-center ${
              locationStatus === 'captured'
                ? 'bg-success/20 text-success'
                : locationStatus === 'denied'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-primary/20 text-primary'
            }`}>
              <span className="material-symbols-outlined text-xl">
                {locationStatus === 'captured' ? 'location_on' : locationStatus === 'denied' ? 'location_off' : 'my_location'}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Location</p>
              {locationStatus === 'captured' ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-red-500 font-black text-xs">{'///'}</span>
                  <span className="text-xs font-bold text-white">{w3w.replace('///', '')}</span>
                </div>
              ) : locationStatus === 'capturing' ? (
                <p className="text-xs text-slate-400">Acquiring GPS...</p>
              ) : (
                <p className="text-xs text-warning">Permission denied</p>
              )}
            </div>
            {locationStatus === 'denied' && (
              <button
                onClick={captureLocation}
                className="text-[9px] font-black text-warning uppercase bg-warning/20 px-3 py-1.5 rounded-lg"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Job Title */}
        <div className="space-y-2">
          <label htmlFor="quick-job-title" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Job Title <span className="text-danger">*</span>
          </label>
          <input
            id="quick-job-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Emergency Boiler Repair"
            className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:border-primary focus:outline-none transition-colors text-sm font-bold"
          />
        </div>

        {/* Client Name */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Client Name {workMode === 'employed' && <span className="text-danger">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              onFocus={() => existingClients.length > 0 && setShowClientList(true)}
              placeholder="Client or property name"
              className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:border-primary focus:outline-none transition-colors text-sm font-bold"
            />
            {showClientList && existingClients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-10 max-h-48 overflow-y-auto">
                {existingClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => selectClient(client)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <p className="text-sm font-bold text-white">{client.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{client.address}</p>
                  </button>
                ))}
                <button
                  onClick={() => setShowClientList(false)}
                  className="w-full text-center py-2 text-[10px] font-bold text-slate-400 border-t border-white/15"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Client Address */}
        <div className="space-y-2">
          <label htmlFor="quick-job-address" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</label>
          <input
            id="quick-job-address"
            type="text"
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder={w3w || 'Will use current location'}
            className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:border-primary focus:outline-none transition-colors text-sm font-bold"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label htmlFor="quick-job-description" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
          <textarea
            id="quick-job-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of work to be done..."
            rows={3}
            className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-500 focus:border-primary focus:outline-none transition-colors text-sm font-bold resize-none"
          />
        </div>

        {/* Price (optional, shown prominently in self-employed mode) */}
        {workMode === 'self_employed' && (
          <div className="space-y-2">
            <label htmlFor="quick-job-price" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Quote / Price <span className="text-slate-500">(for receipt)</span>
            </label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">£</span>
              <input
                id="quick-job-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-white placeholder:text-slate-500 focus:border-primary focus:outline-none transition-colors text-sm font-bold"
              />
            </div>
          </div>
        )}

        {/* Info Banner */}
        <InfoBox
          icon="info"
          title="What happens next?"
          variant="tip"
          persistKey="quickjob_next_steps"
        >
          {workMode === 'employed'
            ? 'This creates a new job and notifies your manager. You can start capturing photos immediately. The job will appear in their dashboard for approval.'
            : 'This creates a job for your records. Complete it, seal the evidence, and a client receipt will be generated for payment.'}
        </InfoBox>
      </div>

      {/* Footer Actions */}
      <footer className="p-6 border-t border-white/10 space-y-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || (workMode === 'employed' && !clientName.trim())}
          className="w-full py-5 bg-primary rounded-2xl font-black text-white text-sm uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-98"
        >
          {isSubmitting ? (
            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">add</span>
              Create & Start Job
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-4 bg-white/5 rounded-2xl font-bold text-slate-400 text-xs uppercase tracking-widest hover:text-white transition-colors"
        >
          Cancel
        </button>
      </footer>
    </div>
  );
};

export default QuickJobForm;
