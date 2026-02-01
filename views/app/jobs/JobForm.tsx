/**
 * JobForm - Enhanced Create/Edit Job Form
 *
 * Features:
 * - Priority selection (Normal/Urgent) with color coding
 * - Inline client/technician creation
 * - Form draft auto-save (8hr retention)
 * - Auto-focus flow between fields
 * - Button click affordance
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, LoadingSkeleton, Modal } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { Job, Client, Technician, JobPriority } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';

const DRAFT_STORAGE_KEY = 'jobproof_job_draft';
const DRAFT_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

interface FormData {
  title: string;
  description: string;
  clientId: string;
  technicianId: string;
  address: string;
  date: string;
  time: string;
  total: string;
  priority: JobPriority;
}

interface DraftData {
  formData: FormData;
  savedAt: number;
}

const JobForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  // Use DataContext for state management
  const {
    jobs,
    clients,
    technicians,
    addJob: contextAddJob,
    updateJob: contextUpdateJob,
    addClient: contextAddClient,
    addTechnician: contextAddTechnician,
    isLoading: dataLoading
  } = useData();

  // Memoized job derivation for edit mode
  const existingJob = useMemo(() =>
    isEdit && id ? jobs.find(j => j.id === id) || null : null,
    [jobs, id, isEdit]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Inline creation modals
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddTech, setShowAddTech] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newTechName, setNewTechName] = useState('');
  const [newTechEmail, setNewTechEmail] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [addingTech, setAddingTech] = useState(false);

  // Load saved draft or start fresh
  const loadDraft = useCallback((): FormData => {
    if (isEdit) return getDefaultFormData(); // Don't load drafts when editing

    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft: DraftData = JSON.parse(saved);
        if (Date.now() - draft.savedAt < DRAFT_EXPIRY_MS) {
          return draft.formData;
        }
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to load draft:', e);
    }
    return getDefaultFormData();
  }, [isEdit]);

  function getDefaultFormData(): FormData {
    return {
      title: '',
      description: '',
      clientId: searchParams.get('clientId') || '',
      technicianId: '',
      address: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      total: '',
      priority: 'normal',
    };
  }

  const [formData, setFormData] = useState<FormData>(loadDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Auto-focus refs
  const titleRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<HTMLSelectElement>(null);
  const technicianRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  // Save draft on form changes (debounced)
  useEffect(() => {
    if (isEdit) return;

    const timer = setTimeout(() => {
      const draft: DraftData = {
        formData,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, isEdit]);

  // Clear draft on successful save
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  // Auto-focus title field on mount
  useEffect(() => {
    if (!loading && titleRef.current) {
      titleRef.current.focus();
    }
  }, [loading]);

  // Initialize form data from existing job or client address
  useEffect(() => {
    // Wait for DataContext to finish loading
    if (dataLoading) return;

    // Edit mode: populate form from existing job
    if (isEdit && existingJob) {
      const jobDate = new Date(existingJob.date);
      setFormData({
        title: existingJob.title || '',
        description: existingJob.description || existingJob.notes || '',
        clientId: existingJob.clientId || '',
        technicianId: existingJob.technicianId || existingJob.techId || '',
        address: existingJob.address || '',
        date: jobDate.toISOString().split('T')[0],
        time: jobDate.toTimeString().slice(0, 5),
        total: existingJob.total?.toString() || existingJob.price?.toString() || '',
        priority: existingJob.priority || 'normal',
      });
    }

    // Auto-fill address from client (only for new jobs without draft)
    if (!isEdit && searchParams.get('clientId') && !formData.address) {
      const client = clients.find(c => c.id === searchParams.get('clientId'));
      if (client?.address) {
        setFormData(prev => ({ ...prev, address: client.address || '' }));
      }
    }

    setLoading(false);
  }, [dataLoading, isEdit, existingJob, searchParams, clients, formData.address]);

  // Update address when client changes
  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({ ...prev, clientId }));
    const client = clients.find(c => c.id === clientId);
    if (client?.address && !formData.address) {
      setFormData(prev => ({ ...prev, address: client.address || '' }));
    }
    // Auto-focus next field
    setTimeout(() => technicianRef.current?.focus(), 100);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Job title is required';
    }

    if (!formData.clientId) {
      newErrors.clientId = 'Client is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (formData.total && isNaN(parseFloat(formData.total))) {
      newErrors.total = 'Invalid amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time || '09:00'}`);

      clearDraft();

      if (isEdit && id && existingJob) {
        // Update existing job - use full Job object
        const updatedJob: Job = {
          ...existingJob,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          notes: formData.description.trim() || '',
          clientId: formData.clientId,
          technicianId: formData.technicianId || undefined,
          techId: formData.technicianId || '',
          address: formData.address.trim() || undefined,
          date: dateTime.toISOString(),
          total: formData.total ? parseFloat(formData.total) : undefined,
          price: formData.total ? parseFloat(formData.total) : undefined,
          priority: formData.priority,
        };
        contextUpdateJob(updatedJob);
        navigate(route(ROUTES.JOB_DETAIL, { id }));
      } else {
        // Create new job
        const newJob: Job = {
          id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          notes: formData.description.trim() || '',
          clientId: formData.clientId,
          technicianId: formData.technicianId || undefined,
          techId: formData.technicianId || '',
          address: formData.address.trim() || undefined,
          date: dateTime.toISOString(),
          total: formData.total ? parseFloat(formData.total) : undefined,
          price: formData.total ? parseFloat(formData.total) : undefined,
          priority: formData.priority,
          status: 'Pending',
          photos: [],
          safetyChecklist: [],
          siteHazards: [],
          syncStatus: 'pending',
          lastUpdated: Date.now(),
        };
        contextAddJob(newJob);
        navigate(route(ROUTES.JOB_DETAIL, { id: newJob.id }));
      }
    } catch (error) {
      console.error('Failed to save job:', error);
      alert('Failed to save job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Inline client creation
  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setAddingClient(true);
    try {
      const newClient: Client = {
        id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: newClientName.trim(),
        email: newClientEmail.trim() || undefined,
        phone: '',
        address: '',
      };
      contextAddClient(newClient);
      setFormData(prev => ({ ...prev, clientId: newClient.id }));
      setShowAddClient(false);
      setNewClientName('');
      setNewClientEmail('');
      setTimeout(() => technicianRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to add client:', error);
    } finally {
      setAddingClient(false);
    }
  };

  // Inline technician creation
  const handleAddTech = async () => {
    if (!newTechName.trim()) return;
    setAddingTech(true);
    try {
      const newTech: Technician = {
        id: `tech-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: newTechName.trim(),
        email: newTechEmail.trim() || undefined,
        phone: '',
        status: 'Authorised',
      };
      contextAddTechnician(newTech);
      setFormData(prev => ({ ...prev, technicianId: newTech.id }));
      setShowAddTech(false);
      setNewTechName('');
      setNewTechEmail('');
      setTimeout(() => dateRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to add technician:', error);
    } finally {
      setAddingTech(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title={isEdit ? 'Edit Job' : 'New Job'}
          backTo={ROUTES.JOBS}
          backLabel="Jobs"
        />
        <PageContent>
          <LoadingSkeleton variant="card" count={1} />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Job' : 'New Job'}
        backTo={isEdit ? route(ROUTES.JOB_DETAIL, { id: id! }) : ROUTES.JOBS}
        backLabel={isEdit ? 'Back' : 'Jobs'}
      />

      <PageContent>
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl">
            <div className="space-y-6">
              {/* Draft indicator */}
              {!isEdit && formData.title && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-sm">save</span>
                  Draft auto-saved
                </div>
              )}

              {/* Priority Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Priority
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: 'normal' }))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      formData.priority === 'normal'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">schedule</span>
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: 'urgent' }))}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      formData.priority === 'urgent'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">priority_high</span>
                    Urgent
                  </button>
                </div>
              </div>

              {/* Job Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-2">
                  Job Title <span className="text-red-400">*</span>
                </label>
                <input
                  ref={titleRef}
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange('title')}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), clientRef.current?.focus())}
                  placeholder="e.g. Boiler Service, Roof Inspection"
                  className={`w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.title ? 'border-red-500 bg-red-500/5' : 'border-white/10'
                  }`}
                />
                {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
              </div>

              {/* Client with inline add */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="clientId" className="text-sm font-medium text-slate-300">
                    Client <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddClient(true)}
                    className="text-xs text-primary hover:text-primary-hover font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    New Client
                  </button>
                </div>
                {clients.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAddClient(true)}
                    className="w-full px-4 py-3 bg-slate-800 border border-dashed border-white/20 rounded-xl text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">add</span>
                    Add your first client
                  </button>
                ) : (
                  <select
                    ref={clientRef}
                    id="clientId"
                    value={formData.clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className={`w-full px-4 py-3 bg-slate-800 border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                      errors.clientId ? 'border-red-500 bg-red-500/5' : 'border-white/10'
                    }`}
                  >
                    <option value="">Select a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                )}
                {errors.clientId && <p className="mt-1 text-sm text-red-400">{errors.clientId}</p>}
              </div>

              {/* Technician with inline add */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="technicianId" className="text-sm font-medium text-slate-300">
                    Assign Technician
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddTech(true)}
                    className="text-xs text-primary hover:text-primary-hover font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    New Tech
                  </button>
                </div>
                {technicians.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAddTech(true)}
                    className="w-full px-4 py-3 bg-slate-800 border border-dashed border-white/20 rounded-xl text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">add</span>
                    Add your first technician
                  </button>
                ) : (
                  <select
                    ref={technicianRef}
                    id="technicianId"
                    value={formData.technicianId}
                    onChange={(e) => {
                      handleChange('technicianId')(e);
                      if (e.target.value) setTimeout(() => dateRef.current?.focus(), 100);
                    }}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="">Assign later...</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date & Time - Responsive grid for mobile (stacked) vs desktop (side-by-side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-slate-300 mb-2">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={dateRef}
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={handleChange('date')}
                    className={`w-full px-4 py-4 min-h-[56px] bg-slate-800 border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                      errors.date ? 'border-red-500 bg-red-500/5' : 'border-white/10'
                    }`}
                  />
                  {errors.date && <p className="mt-1 text-sm text-red-400">{errors.date}</p>}
                </div>
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-slate-300 mb-2">
                    Time
                  </label>
                  <input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => {
                      handleChange('time')(e);
                      setTimeout(() => addressRef.current?.focus(), 100);
                    }}
                    className="w-full px-4 py-4 min-h-[56px] bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
                  Address
                </label>
                <input
                  ref={addressRef}
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={handleChange('address')}
                  placeholder="Job location address"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={handleChange('description')}
                  placeholder="Job details, scope of work, special instructions..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>

              {/* Total */}
              <div>
                <label htmlFor="total" className="block text-sm font-medium text-slate-300 mb-2">
                  Total Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">£</span>
                  <input
                    id="total"
                    type="text"
                    value={formData.total}
                    onChange={handleChange('total')}
                    placeholder="0.00"
                    className={`w-full pl-8 pr-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                      errors.total ? 'border-red-500 bg-red-500/5' : 'border-white/10'
                    }`}
                  />
                </div>
                {errors.total && <p className="mt-1 text-sm text-red-400">{errors.total}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={saving}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-[2] py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 ${
                    formData.priority === 'urgent'
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                      : 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20'
                  }`}
                >
                  {saving ? (
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">check</span>
                      {isEdit ? 'Save Changes' : 'Create Job'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </Card>
        </form>

        {/* Add Client Modal */}
        <Modal isOpen={showAddClient} onClose={() => setShowAddClient(false)} title="Quick Add Client" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Company or person name"
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email (optional)
              </label>
              <input
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClient(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddClient}
                disabled={!newClientName.trim() || addingClient}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingClient ? (
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Client
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Add Technician Modal */}
        <Modal isOpen={showAddTech} onClose={() => setShowAddTech(false)} title="Quick Add Technician" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Technician Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newTechName}
                onChange={(e) => setNewTechName(e.target.value)}
                placeholder="Full name"
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTech()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email (optional)
              </label>
              <input
                type="email"
                value={newTechEmail}
                onChange={(e) => setNewTechEmail(e.target.value)}
                placeholder="tech@company.com"
                className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTech(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTech}
                disabled={!newTechName.trim() || addingTech}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingTech ? (
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Tech
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      </PageContent>
    </div>
  );
};

export default JobForm;
