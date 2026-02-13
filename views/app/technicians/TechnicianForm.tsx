/**
 * TechnicianForm - Add/Edit Technician Form
 *
 * Unified form for creating and editing technicians.
 *
 * Phase 2.5: Client-first flow fix - handles returnTo for job creation wizard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, LoadingSkeleton } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { Technician } from '../../../types';
import { showToast, hapticFeedback } from '../../../lib/microInteractions';
import { saveFormDraft, getFormDraft, clearFormDraft } from '../../../lib/offline/db';

// Form type identifier for Dexie storage
const FORM_TYPE = 'technician';

interface FormData {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  notes: string;
}

const TechnicianForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const returnTo = searchParams.get('returnTo');

  // Use centralized DataContext (FIELD UX FIX: replaces deprecated useWorkspaceData)
  const { technicians, addTechnician, updateTechnician } = useData();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [, setDraftRestored] = useState(false);

  // CLAUDE.md: Load draft from IndexedDB on mount (only for new technicians)
  useEffect(() => {
    if (isEdit) return; // Don't restore draft for edit mode

    const loadDraft = async () => {
      try {
        const draft = await getFormDraft(FORM_TYPE);
        if (draft) {
          setFormData(draft.data as unknown as FormData);
          setDraftRestored(true);
          showToast('Draft restored from previous session', 'info', 3000);
        }
      } catch (e) {
        console.warn('Failed to load draft from IndexedDB:', e);
      }
    };

    loadDraft();
  }, [isEdit]);

  // CLAUDE.md: "Dexie/IndexedDB draft saving (every keystroke)"
  // No debounce - saves immediately on every change
  useEffect(() => {
    if (isEdit) return; // Don't save draft for edit mode

    // Only save if form has content
    if (formData.name || formData.email || formData.phone || formData.specialty || formData.notes) {
      saveFormDraft(FORM_TYPE, formData as unknown as Record<string, unknown>).catch(e => {
        console.warn('Failed to save draft to IndexedDB:', e);
      });
    }
  }, [formData, isEdit]);

  // CLAUDE.md: Clear draft after successful save
  const clearDraft = useCallback(async () => {
    await clearFormDraft(FORM_TYPE);
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    // Load technician from DataContext (reactive, no async needed)
    const technician = technicians.find(t => t.id === id);

    if (technician) {
      setFormData({
        name: technician.name || '',
        email: technician.email || '',
        phone: technician.phone || '',
        specialty: (technician as any).specialty || '',
        notes: (technician as any).notes || '',
      });
    }
    setLoading(false);
  }, [id, isEdit, technicians]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    try {
      const technicianData: Omit<Technician, 'id'> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        status: 'Registered',
        rating: 0,
        jobsCompleted: 0,
      };

      if (isEdit && id) {
        // Update existing technician via DataContext
        const existingTech = technicians.find(t => t.id === id);
        if (existingTech) {
          updateTechnician({ ...existingTech, ...technicianData });
          hapticFeedback('success');
          showToast('Technician updated!', 'success', 3000);
          navigate('/admin/technicians');
        } else {
          throw new Error('Technician not found');
        }
      } else {
        // Create new technician via DataContext (FIELD UX FIX: generate ID, use addTechnician)
        const newTechId = `tech_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newTechnician: Technician = {
          id: newTechId,
          ...technicianData,
        };
        addTechnician(newTechnician);
        hapticFeedback('success');

        // Clear draft after successful creation
        clearDraft();

        showToast('Technician created! Add another?', 'success', 4000);

        // Phase 9: Handle returnTo parameter for flow navigation
        if (returnTo) {
          const decodedReturnTo = decodeURIComponent(returnTo);
          const separator = decodedReturnTo.includes('?') ? '&' : '?';
          navigate(`${decodedReturnTo}${separator}newTechId=${newTechnician.id}`, { replace: true });
        } else {
          // Default: go to technicians list view for easy "add another" workflow
          navigate('/admin/technicians', { replace: true });
        }
      }
    } catch (error) {
      console.error('Failed to save technician:', error);
      showToast('Failed to save technician. Please try again.', 'error', 4000);
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
          title={isEdit ? 'Edit Technician' : 'New Technician'}
          backTo="/admin/technicians"
          backLabel="Technicians"
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
        title={isEdit ? 'Edit Technician' : 'New Technician'}
        backTo="/admin/technicians"
        backLabel="Technicians"
      />

      <PageContent>
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl">
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange('name')}
                  placeholder="e.g. John Smith"
                  className={`
                    w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500
                    focus:outline-none focus:border-primary/50
                    ${errors.name ? 'border-red-500' : 'border-white/10'}
                  `}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  placeholder="technician@example.com"
                  className={`
                    w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500
                    focus:outline-none focus:border-primary/50
                    ${errors.email ? 'border-red-500' : 'border-white/10'}
                  `}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Used to send job assignments and magic links
                </p>
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  placeholder="0400 123 456"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Specialty */}
              <div>
                <label htmlFor="specialty" className="block text-sm font-medium text-slate-300 mb-2">
                  Specialty
                </label>
                <input
                  id="specialty"
                  type="text"
                  value={formData.specialty}
                  onChange={handleChange('specialty')}
                  placeholder="e.g. HVAC, Electrical, Plumbing"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  placeholder="Any additional notes about this technician..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/15">
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
                  {isEdit ? 'Save Changes' : 'Create Technician'}
                </ActionButton>
              </div>
            </div>
          </Card>
        </form>
      </PageContent>
    </div>
  );
};

export default TechnicianForm;
