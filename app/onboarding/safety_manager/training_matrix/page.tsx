'use client';

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function TrainingMatrixPage() {
  const [technicians, setTechnicians] = useState([
    {
      id: '1',
      name: 'Mike Johnson',
      role: 'Electrician',
      certifications: {
        electrical: { status: 'valid', expiry: '2026-06-15' },
        first_aid: { status: 'expiring', expiry: '2026-02-28' },
        working_at_height: { status: 'expired', expiry: '2025-11-30' },
      },
    },
    {
      id: '2',
      name: 'Sarah Williams',
      role: 'HVAC Technician',
      certifications: {
        gas_safe: { status: 'valid', expiry: '2026-09-12' },
        first_aid: { status: 'valid', expiry: '2026-07-20' },
        confined_space: { status: 'valid', expiry: '2026-04-10' },
      },
    },
  ]);

  const getStatusColor = (status: string) => {
    if (status === 'valid') return 'bg-green-100 text-green-900';
    if (status === 'expiring') return 'bg-yellow-100 text-yellow-900';
    return 'bg-red-100 text-red-900';
  };

  const handleComplete = async () => {
    const total = technicians.reduce((sum, t) => sum + Object.keys(t.certifications).length, 0);
    const expiring = technicians.reduce((sum, t) =>
      sum + Object.values(t.certifications).filter(c => c.status === 'expiring').length, 0
    );
    const expired = technicians.reduce((sum, t) =>
      sum + Object.values(t.certifications).filter(c => c.status === 'expired').length, 0
    );

    return {
      technicians_tracked: technicians.length,
      total_certifications: total,
      expiring_soon: expiring,
      expired: expired,
    };
  };

  return (
    <OnboardingFactory persona="safety_manager" step="training_matrix">
      <div className="space-y-8">
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">{technicians.length}</div>
            <div className="text-sm text-blue-700">Technicians</div>
          </div>
          <div className="p-4 bg-green-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {technicians.reduce((sum, t) => sum + Object.values(t.certifications).filter(c => c.status === 'valid').length, 0)}
            </div>
            <div className="text-sm text-green-700">Valid Certs</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {technicians.reduce((sum, t) => sum + Object.values(t.certifications).filter(c => c.status === 'expiring').length, 0)}
            </div>
            <div className="text-sm text-yellow-700">Expiring</div>
          </div>
          <div className="p-4 bg-red-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-red-600 mb-1">
              {technicians.reduce((sum, t) => sum + Object.values(t.certifications).filter(c => c.status === 'expired').length, 0)}
            </div>
            <div className="text-sm text-red-700">Expired</div>
          </div>
        </div>

        <div className="space-y-4">
          {technicians.map(tech => (
            <div key={tech.id} className="p-6 bg-white border-2 border-gray-200 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{tech.name}</h3>
                  <p className="text-sm text-gray-600">{tech.role}</p>
                </div>
                <span className="material-symbols-outlined text-gray-400 text-3xl">person</span>
              </div>
              <div className="space-y-2">
                {Object.entries(tech.certifications).map(([cert, data]) => (
                  <div key={cert} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900 capitalize">{cert.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">Expires: {data.expiry}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(data.status)}`}>
                        {data.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3">💡 Pro Tip</h3>
          <p className="text-sm text-blue-700">
            Set up email alerts 30 days before expiry. Most insurance policies require valid certifications for all on-site technicians.
          </p>
        </div>
      </div>
    </OnboardingFactory>
  );
}
