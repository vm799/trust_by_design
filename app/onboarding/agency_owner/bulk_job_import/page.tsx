'use client';

/**
 * Agency Owner - Step 2: Bulk Job Import
 * CSV upload or manual job creation
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function BulkJobImportPage() {
  const [importMethod, setImportMethod] = useState<'csv' | 'manual'>('manual');
  const [jobsCount, setJobsCount] = useState(0);

  const handleComplete = async () => {
    return {
      import_method: importMethod,
      jobs_created: jobsCount > 0 ? jobsCount : 3, // Demo: 3 jobs created
    };
  };

  return (
    <OnboardingFactory persona="agency_owner" step="bulk_job_import">
      <div className="space-y-8">
        {/* Import Method Selection */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Choose Import Method</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setImportMethod('csv')}
              className={`
                p-6 rounded-2xl border-2 transition-all text-left
                ${importMethod === 'csv'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className="material-symbols-outlined text-4xl text-purple-600 mb-3 block">
                upload_file
              </span>
              <div className="font-semibold text-lg text-gray-900 mb-2">CSV Upload</div>
              <div className="text-sm text-gray-600">
                Import 100+ jobs at once from spreadsheet
              </div>
            </button>

            <button
              onClick={() => setImportMethod('manual')}
              className={`
                p-6 rounded-2xl border-2 transition-all text-left
                ${importMethod === 'manual'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className="material-symbols-outlined text-4xl text-purple-600 mb-3 block">
                edit_note
              </span>
              <div className="font-semibold text-lg text-gray-900 mb-2">Manual Entry</div>
              <div className="text-sm text-gray-600">
                Add jobs one at a time with full control
              </div>
            </button>
          </div>
        </div>

        {/* Demo Success */}
        <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-green-600 text-4xl">
              check_circle
            </span>
            <div>
              <h3 className="font-semibold text-green-900 mb-1">
                ✅ 3 Jobs Created Successfully
              </h3>
              <p className="text-sm text-green-700">
                You can create more jobs from your dashboard after onboarding
              </p>
            </div>
          </div>
        </div>

        {/* Pro Tip */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">lightbulb</span>
            <span>💡 Pro Tip</span>
          </h3>
          <p className="text-sm text-blue-700">
            Use CSV import to migrate existing jobs from spreadsheets. Download our template to get started with the correct column format.
          </p>
        </div>
      </div>
    </OnboardingFactory>
  );
}
