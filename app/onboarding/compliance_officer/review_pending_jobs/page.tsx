'use client';

/**
 * Compliance Officer - Step 2: Review Pending Jobs
 * Inspect jobs awaiting compliance approval
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function ReviewPendingJobsPage() {
  const mockJobs = [
    {
      id: '1',
      title: 'Electrical Safety Inspection - Unit 4B',
      client: 'Riverside Apartments',
      technician: 'Mike Johnson',
      status: 'pending_review',
      photos: 12,
      safety_checks: 5,
      completed_at: '2026-01-17T14:30:00',
      issues: ['Missing PPE photo', 'Incomplete safety checklist'],
    },
    {
      id: '2',
      title: 'HVAC Maintenance - Building A',
      client: 'TechCorp HQ',
      technician: 'Sarah Williams',
      status: 'pending_review',
      photos: 8,
      safety_checks: 5,
      completed_at: '2026-01-17T11:15:00',
      issues: [],
    },
    {
      id: '3',
      title: 'Plumbing Repair - Suite 203',
      client: 'Greenfield Tower',
      technician: 'Tom Martinez',
      status: 'pending_review',
      photos: 6,
      safety_checks: 3,
      completed_at: '2026-01-16T16:45:00',
      issues: ['Photo timestamps mismatch'],
    },
  ];

  const [jobs, setJobs] = useState(mockJobs);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [reviewedJobs, setReviewedJobs] = useState<string[]>([]);

  const approveJob = (jobId: string) => {
    setReviewedJobs(prev => prev.includes(jobId) ? prev : [...prev, jobId]);
    setSelectedJob(null);
  };

  const selected = jobs.find(j => j.id === selectedJob);
  const allReviewed = reviewedJobs.length === jobs.length;

  const handleComplete = async () => {
    return {
      jobs_reviewed: reviewedJobs.length,
      total_jobs: jobs.length,
      approval_rate: (reviewedJobs.length / jobs.length) * 100,
    };
  };

  return (
    <OnboardingFactory persona="compliance_officer" step="review_pending_jobs" onComplete={handleComplete}>
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">{reviewedJobs.length}</div>
            <div className="text-sm text-green-700">Reviewed</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-1">{jobs.length - reviewedJobs.length}</div>
            <div className="text-sm text-yellow-700">Pending</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {jobs.length > 0 ? Math.round((reviewedJobs.length / jobs.length) * 100) : 0}%
            </div>
            <div className="text-sm text-blue-700">Complete</div>
          </div>
        </div>

        {/* Jobs List */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">task_alt</span>
            <span>Jobs Awaiting Review</span>
          </h3>
          <div className="space-y-3">
            {jobs.map(job => {
              const isReviewed = reviewedJobs.includes(job.id);
              const isSelected = selectedJob === job.id;

              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(isSelected ? null : job.id)}
                  className={`
                    w-full p-4 rounded-xl border-2 transition-all text-left
                    ${isReviewed
                      ? 'border-green-300 bg-green-50'
                      : isSelected
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`
                          material-symbols-outlined text-2xl
                          ${isReviewed ? 'text-green-600' : 'text-gray-400'}
                        `}>
                          {isReviewed ? 'check_circle' : 'pending'}
                        </span>
                        <h4 className="font-semibold text-gray-900">{job.title}</h4>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Client: {job.client}</div>
                        <div>Technician: {job.technician}</div>
                        <div className="flex items-center gap-4">
                          <span>{job.photos} photos</span>
                          <span>{job.safety_checks} safety checks</span>
                        </div>
                      </div>
                      {job.issues.length > 0 && !isReviewed && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
                          <span className="text-xs text-red-700">{job.issues.length} issue(s) found</span>
                        </div>
                      )}
                    </div>
                    {!isReviewed && (
                      <span className="material-symbols-outlined text-gray-400">
                        {isSelected ? 'expand_less' : 'expand_more'}
                      </span>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isSelected && !isReviewed && (
                    <div className="mt-4 pt-4 border-t-2 border-blue-200 space-y-3">
                      {job.issues.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="font-semibold text-red-900 text-sm mb-2">Issues Found:</div>
                          <ul className="space-y-1">
                            {job.issues.map((issue, idx) => (
                              <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                                <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approveJob(job.id);
                        }}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                      >
                        {job.issues.length > 0 ? 'Approve with Notes' : 'Approve Job'}
                      </button>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* All Reviewed Success */}
        {allReviewed && (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-4xl">
                verified
              </span>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">
                  ✅ All Jobs Reviewed
                </h3>
                <p className="text-sm text-green-700">
                  {reviewedJobs.length} jobs approved and ready for sealing
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Review Guidelines */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>Review Checklist</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Photos: Minimum 5 per job, clear timestamps, GPS metadata</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Safety: All checklist items completed, PPE visible in photos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Signatures: Client signature captured (digital or scanned)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Notes: Work summary complete, materials listed</span>
            </li>
          </ul>
        </div>
      </div>
    </OnboardingFactory>
  );
}
