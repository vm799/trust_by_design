'use client';

import OnboardingFactory from '@/components/OnboardingFactory';

export default function ComplianceDashboardPage() {
  const mockMetrics = {
    jobsCompleted: 47,
    activeTeam: 12,
    complianceScore: 98,
    certificatesIssued: 43,
  };

  const handleComplete = async () => {
    return {
      dashboard_viewed: true,
      metrics_loaded: true,
    };
  };

  return (
    <OnboardingFactory persona="agency_owner" step="compliance_dashboard">
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 bg-green-50 rounded-2xl text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">{mockMetrics.jobsCompleted}</div>
            <div className="text-sm text-green-700">Jobs Completed</div>
          </div>
          <div className="p-6 bg-blue-50 rounded-2xl text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">{mockMetrics.activeTeam}</div>
            <div className="text-sm text-blue-700">Active Team</div>
          </div>
          <div className="p-6 bg-purple-50 rounded-2xl text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">{mockMetrics.complianceScore}%</div>
            <div className="text-sm text-purple-700">Compliance</div>
          </div>
          <div className="p-6 bg-orange-50 rounded-2xl text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">{mockMetrics.certificatesIssued}</div>
            <div className="text-sm text-orange-700">Certificates</div>
          </div>
        </div>

        <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-green-600 text-4xl">celebration</span>
            <div>
              <h3 className="font-semibold text-green-900 text-xl mb-1">🎉 Agency Setup Complete!</h3>
              <p className="text-green-700">Your team dashboard is ready. Manage technicians, track jobs, and monitor compliance.</p>
            </div>
          </div>
        </div>
      </div>
    </OnboardingFactory>
  );
}
