/**
 * TechnicianList - Technician Management View
 *
 * Displays all technicians with job assignments.
 * REMEDIATION ITEM 10: Added error state with retry UI
 *
 * Phase E: Job Lifecycle
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, EmptyState, ErrorState, LoadingSkeleton, Modal } from '../../../components/ui';
import { getTechnicians, getJobs, addTechnician, deleteTechnician } from '../../../hooks/useWorkspaceData';
import { Technician, Job } from '../../../types';
import { ROUTES } from '../../../lib/routes';

const TechnicianList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  // REMEDIATION ITEM 10
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // REMEDIATION ITEM 10: Extracted loadData for retry functionality
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [techsData, jobsData] = await Promise.all([
        getTechnicians(),
        getJobs(),
      ]);
      setTechnicians(techsData);
      setJobs(jobsData);
    } catch (err) {
      console.error('Failed to load technicians:', err);
      setError('Failed to load technicians. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // REMEDIATION ITEM 7: Memoize tech stats to avoid O(n*m) lookups in render
  const techStatsMap = useMemo(() => {
    const stats: Record<string, { total: number; active: number; completed: number }> = {};

    // Group jobs by technicianId and calculate stats in single pass
    const jobsByTech: Record<string, { total: number; active: number; completed: number }> = {};

    for (const job of jobs) {
      if (job.technicianId) {
        if (!jobsByTech[job.technicianId]) {
          jobsByTech[job.technicianId] = { total: 0, active: 0, completed: 0 };
        }
        jobsByTech[job.technicianId].total++;
        if (job.status === 'in-progress' || job.status === 'In Progress') {
          jobsByTech[job.technicianId].active++;
        }
        if (job.status === 'complete' || job.status === 'Submitted') {
          jobsByTech[job.technicianId].completed++;
        }
      }
    }

    return jobsByTech;
  }, [jobs]);

  // Get job stats for each technician (uses memoized stats)
  const getTechStats = (techId: string) => {
    return techStatsMap[techId] ?? { total: 0, active: 0, completed: 0 };
  };

  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    setSaving(true);
    try {
      const newTech = await addTechnician({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
      });
      setTechnicians([...technicians, newTech]);
      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '' });
    } catch (error) {
      console.error('Failed to add technician:', error);
      alert('Failed to add technician. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (techId: string) => {
    if (!confirm('Are you sure you want to remove this technician?')) return;

    try {
      await deleteTechnician(techId);
      setTechnicians(technicians.filter(t => t.id !== techId));
    } catch (error) {
      console.error('Failed to delete technician:', error);
      alert('Failed to remove technician. Please try again.');
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Technicians"
          actions={[{ label: 'Add Technician', icon: 'add', onClick: () => setShowAddModal(true), variant: 'primary' }]}
        />
        <PageContent>
          <LoadingSkeleton variant="list" count={5} />
        </PageContent>
      </div>
    );
  }

  // REMEDIATION ITEM 10: Show error state with retry
  if (error) {
    return (
      <div>
        <PageHeader
          title="Technicians"
          actions={[{ label: 'Add Technician', icon: 'add', onClick: () => setShowAddModal(true), variant: 'primary' }]}
        />
        <PageContent>
          <ErrorState
            title="Failed to load technicians"
            message={error}
            onRetry={loadData}
            secondaryAction={{ label: 'Go Back', onClick: () => window.history.back(), icon: 'arrow_back' }}
          />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Technicians"
        subtitle={`${technicians.length} technician${technicians.length !== 1 ? 's' : ''}`}
        actions={[{ label: 'Add Technician', icon: 'add', onClick: () => setShowAddModal(true), variant: 'primary' }]}
      />

      <PageContent>
        {technicians.length === 0 ? (
          <EmptyState
            icon="engineering"
            title="No technicians yet"
            description="Add your first technician to start dispatching jobs."
            action={{ label: 'Add Technician', onClick: () => setShowAddModal(true), icon: 'add' }}
          />
        ) : (
          <div className="space-y-3">
            {technicians.map(tech => {
              const stats = getTechStats(tech.id);

              return (
                <Card key={tech.id}>
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-white/5">
                      <span className="text-lg font-bold text-amber-400">
                        {tech.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{tech.name}</p>
                      <p className="text-sm text-slate-400 truncate">
                        {tech.phone || tech.email || 'No contact info'}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-sm font-medium text-white">{stats.active}</p>
                        <p className="text-xs text-slate-500">Active</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{stats.completed}</p>
                        <p className="text-xs text-slate-500">Completed</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-400">{stats.total}</p>
                        <p className="text-xs text-slate-500">Total Jobs</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => handleDelete(tech.id)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove technician"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>

      {/* Add Technician Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Technician"
        size="sm"
      >
        <form onSubmit={handleAddTechnician} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Smith"
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0400 123 456"
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <ActionButton
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              disabled={saving}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="primary"
              type="submit"
              loading={saving}
              icon="add"
            >
              Add Technician
            </ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TechnicianList;
