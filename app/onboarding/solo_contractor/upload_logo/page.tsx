'use client';

/**
 * Solo Contractor - Step 1: Upload Logo
 * Handholding UX for logo upload with preview
 */

import { useState, useRef } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';
import { createClient } from '@/utils/supabase/client';

export default function UploadLogoPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, or SVG)');
      return;
    }

    // Validate file size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setUploadError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleComplete = async () => {
    if (!file) {
      setUploadError('Please select a logo to continue');
      return {};
    }

    setUploading(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to Supabase Storage
      const fileName = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage
        .from('workspace-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('workspace-logos')
        .getPublicUrl(fileName);

      setUploading(false);

      // Return step data
      return {
        logo_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
      };
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message);
      setUploading(false);
      throw err;
    }
  };

  return (
    <OnboardingFactory persona="solo_contractor" step="upload_logo">
      <div className="space-y-8">
        {/* Upload Area */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="logo-upload"
          />

          <label
            htmlFor="logo-upload"
            className={`
              block border-4 border-dashed rounded-3xl p-12 text-center
              cursor-pointer transition-all
              ${file ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'}
            `}
          >
            {preview ? (
              <div className="space-y-4">
                <div className="w-32 h-32 mx-auto rounded-2xl overflow-hidden shadow-lg border-4 border-white">
                  <img
                    src={preview}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-900">
                    ✅ {file?.name}
                  </p>
                  <p className="text-sm text-green-700">
                    {(file!.size / 1024).toFixed(1)} KB • Click to change
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <span className="material-symbols-outlined text-7xl text-gray-400">
                  photo_camera
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Upload Your Company Logo
                  </h3>
                  <p className="text-gray-600">
                    PNG, JPG, or SVG • Max 5MB • Square recommended
                  </p>
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Error Message */}
        {uploadError && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-600">
                error
              </span>
              <p className="text-red-900 font-medium">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Why This Matters */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>Why upload a logo?</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Your logo appears on compliance certificates sent to clients</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Professional branding builds trust and credibility</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Square logos (500×500px) look best on PDF exports</span>
            </li>
          </ul>
        </div>

        {/* Guidelines */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-2xl text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="font-semibold text-gray-900 mb-1">Good</div>
            <div className="text-sm text-gray-600">Square, 500×500px, transparent background</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="font-semibold text-gray-900 mb-1">Acceptable</div>
            <div className="text-sm text-gray-600">Rectangular, white background, clear edges</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl text-center">
            <div className="text-3xl mb-2">❌</div>
            <div className="font-semibold text-gray-900 mb-1">Avoid</div>
            <div className="text-sm text-gray-600">Low resolution, watermarks, complex graphics</div>
          </div>
        </div>

        {/* Uploading State */}
        {uploading && (
          <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined animate-spin text-yellow-600">
                progress_activity
              </span>
              <p className="text-yellow-900 font-medium">Uploading logo...</p>
            </div>
          </div>
        )}
      </div>
    </OnboardingFactory>
  );
}
