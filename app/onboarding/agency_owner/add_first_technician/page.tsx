'use client';

/**
 * Agency Owner - Step 1: Add First Technician
 * Handholding UX for inviting team members
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';
import { createClient } from '@/utils/supabase/client';

export default function AddFirstTechnicianPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'technician', // technician, supervisor, admin
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = formData.name && formData.email && formData.phone;

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

      // Create technician
      const { data: technician, error: techError } = await supabase
        .from('technicians')
        .insert({
          workspace_id: profile.workspace_id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
        })
        .select()
        .single();

      if (techError) throw techError;

      setCreating(false);

      // Return step data
      return {
        technician_id: technician.id,
        technician_name: formData.name,
        technician_email: formData.email,
      };
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
      throw err;
    }
  };

  return (
    <OnboardingFactory persona="agency_owner" step="add_first_technician">
      <div className="space-y-8">
        {/* Form */}
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., John Smith"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none text-lg"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g., john.smith@example.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none text-lg"
            />
            <p className="text-sm text-gray-500 mt-1">
              They'll receive an invitation email to join your workspace
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g., 07700 900000"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none text-lg"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Role
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'technician', label: 'Technician', icon: 'build', desc: 'Field worker' },
                { value: 'supervisor', label: 'Supervisor', icon: 'engineering', desc: 'Site manager' },
                { value: 'admin', label: 'Admin', icon: 'admin_panel_settings', desc: 'Office staff' },
              ].map((role) => (
                <button
                  key={role.value}
                  onClick={() => setFormData({ ...formData, role: role.value })}
                  className={`
                    p-4 rounded-xl border-2 transition-all text-left
                    ${formData.role === role.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <span className={`material-symbols-outlined text-3xl mb-2 block ${formData.role === role.value ? 'text-purple-600' : 'text-gray-400'}`}>
                    {role.icon}
                  </span>
                  <div className={`font-semibold text-sm ${formData.role === role.value ? 'text-purple-900' : 'text-gray-700'}`}>
                    {role.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{role.desc}</div>
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
              <span>Team Member Preview</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Name:</span>
                <span className="font-semibold text-green-900">{formData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Email:</span>
                <span className="font-semibold text-green-900">{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Phone:</span>
                <span className="font-semibold text-green-900">{formData.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Role:</span>
                <span className="font-semibold text-green-900 capitalize">{formData.role}</span>
              </div>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="p-6 bg-purple-50 border-2 border-purple-200 rounded-2xl">
          <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>What happens when you add team members?</span>
          </h3>
          <ul className="space-y-2 text-sm text-purple-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-purple-500 text-lg">check_circle</span>
              <span>They get instant access to the workspace with their assigned role</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-purple-500 text-lg">check_circle</span>
              <span>You can assign jobs to them directly from the dashboard</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-purple-500 text-lg">check_circle</span>
              <span>Track their work completion and compliance metrics in real-time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-purple-500 text-lg">check_circle</span>
              <span>They can upload photos and complete jobs from their mobile devices</span>
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
              <p className="text-yellow-900 font-medium">Adding team member...</p>
            </div>
          </div>
        )}
      </div>
    </OnboardingFactory>
  );
}
