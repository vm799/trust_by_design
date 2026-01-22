/**
 * JobForm - Create/Edit Job Form
 *
 * Unified form for creating and editing jobs.
 *
 * Phase E: Job Lifecycle
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, LoadingSkeleton } from '../../../components/ui';
import { getJobs, getClients, getTechnicians, addJob, updateJob } from '../../../hooks/useWorkspaceData';
import { Job, Client, Technician } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';

interface FormData {
  title: string;
  description: string;
  clientId: string;
  technicianId: string;
  address: string;
  date: string;
  time: string;
  total: string;
}

const JobForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    clientId: searchParams.get('clientId') || '',
    technicianId: '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    total: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, techsData, jobsData] = await Promise.all([
          getClients(),
          getTechnicians(),
          isEdit ? getJobs() : Promise.resolve([]),
        ]);

        setClients(clientsData);
        setTechnicians(techsData);

        if (isEdit && id) {
          const job = jobsData.find(j => j.id === id);
          if (job) {
            const jobDate = new Date(job.date);
            setFormData({
              title: job.title || '',
              description: job.description || '',
              clientId: job.clientId || '',
              technicianId: job.technicianId || '',
              address: job.address || '',
              date: jobDate.toISOString().split('T')[0],
              time: jobDate.toTimeString().slice(0, 5),
              total: job.total?.toString() || '',
            });
          }
        }

        // Auto-fill address from client
        if (!isEdit && searchParams.get('clientId')) {
          const client = clientsData.find(c => c.id === searchParams.get('clientId'));
          if (client?.address) {
            setFormData(prev => ({ ...prev, address: client.address || '' }));
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isEdit, searchParams]);

  // Update address when client changes
  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({ ...prev, clientId }));
    const client = clients.find(c => c.id === clientId);
    if (client?.address && !formData.address) {
      setFormData(prev => ({ ...prev, address: client.address || '' }));
    }
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

      const jobData: Partial<Job> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        clientId: formData.clientId,
        technicianId: formData.technicianId || undefined,
        address: formData.address.trim() || undefined,
        date: dateTime.toISOString(),
        total: formData.total ? parseFloat(formData.total) : undefined,
        status: 'pending',
      };

      if (isEdit && id) {
        await updateJob(id, jobData);
        navigate(route(ROUTES.JOB_DETAIL, { id }));
      } else {
        const newJob = await addJob(jobData as Omit<Job, 'id'>);
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
              {/* Job Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-2">
                  Job Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange('title')}
                  placeholder="e.g. Lawn Mowing, Electrical Inspection"
                  className={`
                    w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500
                    focus:outline-none focus:border-primary/50
                    ${errors.title ? 'border-red-500' : 'border-white/10'}
                  `}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-400">{errors.title}</p>
                )}
              </div>

              {/* Client */}
              <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-slate-300 mb-2">
                  Client <span className="text-red-400">*</span>
                </label>
                <select
                  id="clientId"
                  value={formData.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className={`
                    w-full px-4 py-3 bg-slate-800 border rounded-xl text-white
                    focus:outline-none focus:border-primary/50
                    ${errors.clientId ? 'border-red-500' : 'border-white/10'}
                  `}
                >
                  <option value="">Select a client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="mt-1 text-sm text-red-400">{errors.clientId}</p>
                )}
              </div>

              {/* Technician */}
              <div>
                <label htmlFor="technicianId" className="block text-sm font-medium text-slate-300 mb-2">
                  Assign Technician
                </label>
                <select
                  id="technicianId"
                  value={formData.technicianId}
                  onChange={handleChange('technicianId')}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50"
                >
                  <option value="">Assign later...</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-slate-300 mb-2">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={handleChange('date')}
                    className={`
                      w-full px-4 py-3 bg-slate-800 border rounded-xl text-white
                      focus:outline-none focus:border-primary/50
                      ${errors.date ? 'border-red-500' : 'border-white/10'}
                    `}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-400">{errors.date}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-slate-300 mb-2">
                    Time
                  </label>
                  <input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={handleChange('time')}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={handleChange('address')}
                  placeholder="Job location address"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
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
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              {/* Total */}
              <div>
                <label htmlFor="total" className="block text-sm font-medium text-slate-300 mb-2">
                  Total Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    id="total"
                    type="text"
                    value={formData.total}
                    onChange={handleChange('total')}
                    placeholder="0.00"
                    className={`
                      w-full pl-8 pr-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500
                      focus:outline-none focus:border-primary/50
                      ${errors.total ? 'border-red-500' : 'border-white/10'}
                    `}
                  />
                </div>
                {errors.total && (
                  <p className="mt-1 text-sm text-red-400">{errors.total}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <ActionButton
                  variant="secondary"
                  onClick={() => navigate(-1)}
                  disabled={saving}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  variant="primary"
                  type="submit"
                  loading={saving}
                  icon="check"
                >
                  {isEdit ? 'Save Changes' : 'Create Job'}
                </ActionButton>
              </div>
            </div>
          </Card>
        </form>
      </PageContent>
    </div>
  );
};

export default JobForm;
