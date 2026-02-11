/**
 * ClientForm - Add/Edit Client Form
 *
 * Unified form for creating and editing clients.
 * CLAUDE.md: Dexie/IndexedDB draft saving (every keystroke)
 *
 * Phase D: Client Registry
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, LoadingSkeleton } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { useAuth } from '../../../lib/AuthContext';
import { Client } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';
import { showToast } from '../../../lib/microInteractions';
import { saveFormDraft, getFormDraft, clearFormDraft } from '../../../lib/offline/db';

// Form type identifier for Dexie storage - scoped by workspace at runtime
const FORM_TYPE = 'client';

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  type: 'residential' | 'commercial';
  notes: string;
}

const ClientForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const returnTo = searchParams.get('returnTo');

  // Use centralized DataContext (FIELD UX FIX: replaces deprecated useWorkspaceData)
  const { clients, addClient, updateClient } = useData();
  const { workspaceId } = useAuth();

  // Workspace-scoped draft key prevents cross-workspace collisions
  const draftKey = workspaceId ? `${FORM_TYPE}_${workspaceId}` : FORM_TYPE;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    type: 'residential',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [, setDraftRestored] = useState(false);

  // CLAUDE.md: Load draft from IndexedDB on mount (only for new clients)
  useEffect(() => {
    if (isEdit) return; // Don't restore draft for edit mode

    const loadDraft = async () => {
      try {
        const draft = await getFormDraft(draftKey);
        if (draft) {
          // Type-safe cast: FormDraft stores Record<string, unknown>, narrow to FormData
          setFormData(draft.data as unknown as FormData);
          setDraftRestored(true);
          showToast('Draft restored from previous session', 'info', 3000);
        }
      } catch (e) {
        console.warn('Failed to load draft from IndexedDB:', e);
      }
    };

    loadDraft();
  }, [isEdit, draftKey]);

  // CLAUDE.md: "Dexie/IndexedDB draft saving (every keystroke)"
  // No debounce - saves immediately on every change
  useEffect(() => {
    if (isEdit) return; // Don't save draft for edit mode

    // Only save if form has content
    if (formData.name || formData.email || formData.phone || formData.address || formData.notes) {
      // Cast FormData to Record for saveFormDraft which expects generic storage type
      saveFormDraft(draftKey, formData as unknown as Record<string, unknown>).catch(e => {
        console.warn('Failed to save draft to IndexedDB:', e);
      });
    }
  }, [formData, isEdit, draftKey]);

  // CLAUDE.md: Clear draft after successful save
  const clearDraft = useCallback(async () => {
    await clearFormDraft(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (!isEdit) return;

    // Load client from DataContext (reactive, no async needed)
    const client = clients.find(c => c.id === id);

    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        type: (client.type as 'residential' | 'commercial') || 'residential',
        notes: client.notes || '',
      });
    }
    setLoading(false);
  }, [id, isEdit, clients]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
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
      const clientData: Omit<Client, 'id'> = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        type: formData.type,
        notes: formData.notes.trim() || undefined,
        totalJobs: 0,
      };

      if (isEdit && id) {
        // Update existing client via DataContext
        const existingClient = clients.find(c => c.id === id);
        if (existingClient) {
          updateClient({ ...existingClient, ...clientData });
          showToast('Client updated!', 'success', 3000);
          navigate(route(ROUTES.CLIENT_DETAIL, { id }));
        } else {
          throw new Error('Client not found');
        }
      } else {
        // Create new client via DataContext (FIELD UX FIX: generate ID, use addClient)
        const newClientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newClient: Client = {
          id: newClientId,
          ...clientData,
        };
        addClient(newClient);

        // Clear draft after successful creation
        clearDraft();

        showToast('Client created! Would you like to add a technician?', 'success', 4000);

        // Phase 9: Handle returnTo parameter for flow navigation, otherwise go to list
        if (returnTo) {
          // Decode and navigate back to the original page (e.g., job creation)
          const decodedReturnTo = decodeURIComponent(returnTo);
          const separator = decodedReturnTo.includes('?') ? '&' : '?';
          navigate(`${decodedReturnTo}${separator}newClientId=${newClient.id}`, { replace: true });
        } else {
          // Default: go to clients list view for easy "add another" workflow
          navigate(ROUTES.CLIENTS, { replace: true });
        }
      }
    } catch (error) {
      console.error('Failed to save client:', error);
      showToast('Failed to save client. Please try again.', 'error', 4000);
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
          title={isEdit ? 'Edit Client' : 'New Client'}
          backTo={ROUTES.CLIENTS}
          backLabel="Clients"
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
        title={isEdit ? 'Edit Client' : 'New Client'}
        backTo={isEdit ? route(ROUTES.CLIENT_DETAIL, { id: id! }) : ROUTES.CLIENTS}
        backLabel={isEdit ? 'Back' : 'Clients'}
      />

      <PageContent>
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl">
            <div className="space-y-6">
              {/* Client Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Client Type
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'residential' }))}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border transition-all
                      ${formData.type === 'residential'
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-slate-800 border-white/10 text-slate-400 hover:border-white/20'}
                    `}
                  >
                    <span className="material-symbols-outlined mb-1">home</span>
                    <p className="text-sm font-medium">Residential</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'commercial' }))}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border transition-all
                      ${formData.type === 'commercial'
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-slate-800 border-white/10 text-slate-400 hover:border-white/20'}
                    `}
                  >
                    <span className="material-symbols-outlined mb-1">business</span>
                    <p className="text-sm font-medium">Commercial</p>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange('name')}
                  placeholder="e.g. Smith Residence or Acme Corp"
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
                  placeholder="123 Main St, Sydney NSW 2000"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange('email')}
                    placeholder="client@example.com"
                    className={`
                      w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500
                      focus:outline-none focus:border-primary/50
                      ${errors.email ? 'border-red-500' : 'border-white/10'}
                    `}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                  )}
                </div>
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
                  placeholder="Any additional notes about this client..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                />
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
                  {isEdit ? 'Save Changes' : 'Create Client'}
                </ActionButton>
              </div>
            </div>
          </Card>
        </form>
      </PageContent>
    </div>
  );
};

export default ClientForm;
