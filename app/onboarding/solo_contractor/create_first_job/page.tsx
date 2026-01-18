'use client';

/**
 * Solo Contractor - Step 2: Create First Job
 * Handholding UX for job creation tutorial
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';
import { createClient } from '@/utils/supabase/client';

export default function CreateFirstJobPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState({
    client_name: '',
    job_title: '',
    location: '',
    job_type: 'installation', // installation, maintenance, inspection, repair
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = formData.client_name && formData.job_title && formData.location;

  const handleComplete = async () => {
    if (!isFormValid) {
      setError('Please fill in all required fields');
      throw new Error('Form validation failed');
    }

    setCreating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's workspace
      const { data: profile } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create client first
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          workspace_id: profile.workspace_id,
          name: formData.client_name,
          email: `${formData.client_name.toLowerCase().replace(/\s+/g, '.')}@example.com`, // Demo email
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Create job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          workspace_id: profile.workspace_id,
          client_id: client.id,
          title: formData.job_title,
          location: formData.location,
          status: 'pending',
          created_by_user_id: user.id,
          assigned_technician_id: user.id, // Assign to self
        })
        .select()
        .single();

      if (jobError) throw jobError;

      setCreating(false);

      // Return step data
      return {
        job_id: job.id,
        client_id: client.id,
        job_title: formData.job_title,
      };
    } catch (err: any) {
      console.error('Job creation failed:', err);
      setError(err.message);
      setCreating(false);
      throw err;
    }
  };

  return (
    <OnboardingFactory persona="solo_contractor" step="create_first_job">
      <div className="space-y-8">
        {/* Form */}
        <div className="space-y-6">
          {/* Client Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              placeholder="e.g., Johnson Residence"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-lg"
            />
            <p className="text-sm text-gray-500 mt-1">
              Who is this job for? (Property name or homeowner)
            </p>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
              placeholder="e.g., Electrical Safety Inspection"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-lg"
            />
            <p className="text-sm text-gray-500 mt-1">
              Brief description of the work (shows on certificates)
            </p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Job Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., 42 Oak Street, Manchester M1 1AB"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-lg"
            />
            <p className="text-sm text-gray-500 mt-1">
              Full address or site location
            </p>
          </div>

          {/* Job Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Job Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'installation', label: 'Installation', icon: 'construction' },
                { value: 'maintenance', label: 'Maintenance', icon: 'build' },
                { value: 'inspection', label: 'Inspection', icon: 'search' },
                { value: 'repair', label: 'Repair', icon: 'handyman' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFormData({ ...formData, job_type: type.value })}
                  className={`
                    p-4 rounded-xl border-2 transition-all
                    ${formData.job_type === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }
                  `}
                >
                  <span className="material-symbols-outlined text-3xl mb-2">
                    {type.icon}
                  </span>
                  <div className="font-semibold text-sm">{type.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-600">error</span>
              <p className="text-red-900 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Preview */}
        {isFormValid && (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Job Preview</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Client:</span>
                <span className="font-semibold text-green-900">{formData.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Job:</span>
                <span className="font-semibold text-green-900">{formData.job_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Location:</span>
                <span className="font-semibold text-green-900">{formData.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Type:</span>
                <span className="font-semibold text-green-900 capitalize">{formData.job_type}</span>
              </div>
            </div>
          </div>
        )}

        {/* What Happens Next */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>What happens next?</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>This job will be created in your workspace (you can edit it later)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>You'll add photos, safety checks, and notes as you complete the work</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>When done, generate a compliance certificate to send to the client</span>
            </li>
          </ul>
        </div>

        {/* Creating State */}
        {creating && (
          <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined animate-spin text-yellow-600">
                progress_activity
              </span>
              <p className="text-yellow-900 font-medium">Creating job...</p>
            </div>
          </div>
        )}
      </div>
    </OnboardingFactory>
  );
}
