'use client';

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function RiskAssessmentPage() {
  const [hazards, setHazards] = useState([
    { id: '1', hazard: 'Working at height', likelihood: '', severity: '', risk: '' },
    { id: '2', hazard: 'Electrical shock', likelihood: '', severity: '', risk: '' },
    { id: '3', hazard: 'Manual handling', likelihood: '', severity: '', risk: '' },
  ]);

  const riskMatrix = {
    '1-1': 'Low', '1-2': 'Low', '1-3': 'Medium', '1-4': 'Medium', '1-5': 'High',
    '2-1': 'Low', '2-2': 'Medium', '2-3': 'Medium', '2-4': 'High', '2-5': 'High',
    '3-1': 'Medium', '3-2': 'Medium', '3-3': 'High', '3-4': 'High', '3-5': 'Very High',
    '4-1': 'Medium', '4-2': 'High', '4-3': 'High', '4-4': 'Very High', '4-5': 'Very High',
    '5-1': 'High', '5-2': 'High', '5-3': 'Very High', '5-4': 'Very High', '5-5': 'Very High',
  };

  const updateHazard = (id: string, field: string, value: string) => {
    setHazards(prev => prev.map(h => {
      if (h.id === id) {
        const updated = { ...h, [field]: value };
        if (updated.likelihood && updated.severity) {
          updated.risk = riskMatrix[`${updated.likelihood}-${updated.severity}` as keyof typeof riskMatrix];
        }
        return updated;
      }
      return h;
    }));
  };

  const allAssessed = hazards.every(h => h.risk);

  const handleComplete = async () => {
    return {
      hazards_assessed: hazards.length,
      high_risk_count: hazards.filter(h => h.risk === 'High' || h.risk === 'Very High').length,
    };
  };

  return (
    <OnboardingFactory persona="safety_manager" step="risk_assessment">
      <div className="space-y-8">
        <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-2xl">
          <h3 className="font-semibold text-amber-900 mb-3">HSE 5-Point Scale</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="font-semibold text-amber-900 mb-2">Likelihood:</div>
              <div className="space-y-1 text-amber-700">
                <div>1 - Rare</div>
                <div>2 - Unlikely</div>
                <div>3 - Possible</div>
                <div>4 - Likely</div>
                <div>5 - Almost Certain</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-amber-900 mb-2">Severity:</div>
              <div className="space-y-1 text-amber-700">
                <div>1 - Negligible</div>
                <div>2 - Minor</div>
                <div>3 - Moderate</div>
                <div>4 - Major</div>
                <div>5 - Catastrophic</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {hazards.map(hazard => (
            <div key={hazard.id} className="p-4 border-2 border-gray-200 rounded-xl bg-white">
              <div className="font-semibold text-gray-900 mb-3">{hazard.hazard}</div>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={hazard.likelihood}
                  onChange={(e) => updateHazard(hazard.id, 'likelihood', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">Likelihood</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select
                  value={hazard.severity}
                  onChange={(e) => updateHazard(hazard.id, 'severity', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-amber-500 outline-none"
                >
                  <option value="">Severity</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {hazard.risk && (
                  <div className={`px-3 py-2 rounded-lg text-sm font-semibold text-center ${
                    hazard.risk === 'Low' ? 'bg-green-100 text-green-900' :
                    hazard.risk === 'Medium' ? 'bg-yellow-100 text-yellow-900' :
                    hazard.risk === 'High' ? 'bg-orange-100 text-orange-900' :
                    'bg-red-100 text-red-900'
                  }`}>
                    {hazard.risk}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {allAssessed && (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
              <div>
                <h3 className="font-semibold text-green-900">✅ Risk Assessment Complete</h3>
                <p className="text-sm text-green-700">All hazards assessed using HSE methodology</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </OnboardingFactory>
  );
}
