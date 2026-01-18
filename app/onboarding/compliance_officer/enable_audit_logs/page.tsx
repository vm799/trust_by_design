'use client';

/**
 * Compliance Officer - Step 1: Enable Audit Logs
 * Learn about comprehensive audit trail tracking
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function EnableAuditLogsPage() {
  const [logsEnabled, setLogsEnabled] = useState(false);

  const auditFeatures = [
    { id: '1', name: 'User Actions', description: 'Track all user login, logout, and permission changes', checked: false },
    { id: '2', name: 'Job Modifications', description: 'Log every job create, update, seal, and delete', checked: false },
    { id: '3', name: 'Evidence Uploads', description: 'Record all photo uploads with timestamps and GPS', checked: false },
    { id: '4', name: 'Certificate Generation', description: 'Track certificate creation and delivery', checked: false },
    { id: '5', name: 'Data Exports', description: 'Log all report exports for regulatory compliance', checked: false },
  ];

  const [features, setFeatures] = useState(auditFeatures);

  const toggleFeature = (id: string) => {
    setFeatures(prev =>
      prev.map(f => f.id === id ? { ...f, checked: !f.checked } : f)
    );
  };

  const allEnabled = features.every(f => f.checked);

  const handleComplete = async () => {
    return {
      audit_logs_enabled: true,
      features_enabled: features.filter(f => f.checked).map(f => f.name),
    };
  };

  return (
    <OnboardingFactory persona="compliance_officer" step="enable_audit_logs">
      <div className="space-y-8">
        {/* Enable Toggle */}
        <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-green-900 mb-1">
                Audit Trail Tracking
              </h3>
              <p className="text-green-700 text-sm">
                Comprehensive logging for regulatory compliance
              </p>
            </div>
            <button
              onClick={() => setLogsEnabled(!logsEnabled)}
              className={`
                relative w-16 h-8 rounded-full transition-colors
                ${logsEnabled ? 'bg-green-600' : 'bg-gray-300'}
              `}
            >
              <div className={`
                absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform
                ${logsEnabled ? 'left-9' : 'left-1'}
              `} />
            </button>
          </div>
          {logsEnabled && (
            <div className="text-sm text-green-800 font-medium">
              ✅ Audit logging is now active across your workspace
            </div>
          )}
        </div>

        {/* Audit Features Checklist */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">fact_check</span>
            <span>Audit Capabilities</span>
          </h3>
          <div className="space-y-3">
            {features.map(feature => (
              <button
                key={feature.id}
                onClick={() => toggleFeature(feature.id)}
                className={`
                  w-full p-4 rounded-xl border-2 transition-all text-left
                  ${feature.checked
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-200'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                    ${feature.checked
                      ? 'bg-green-600 border-green-600'
                      : 'bg-white border-gray-300'
                    }
                  `}>
                    {feature.checked && (
                      <span className="material-symbols-outlined text-white text-sm">
                        check
                      </span>
                    )}
                  </div>
                  <div>
                    <div className={`font-semibold ${feature.checked ? 'text-green-900' : 'text-gray-900'}`}>
                      {feature.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {feature.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Success Message */}
        {allEnabled && logsEnabled && (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-4xl">
                verified
              </span>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">
                  ✅ All Audit Features Enabled
                </h3>
                <p className="text-sm text-green-700">
                  Your workspace now has comprehensive audit trail tracking for regulatory compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Compliance Benefits */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>Why audit logs matter</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>ISO 9001, ISO 27001, SOC 2 compliance requirements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>GDPR Article 30: Records of processing activities</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Legal disputes: Timestamped evidence of all actions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Insurance claims: Prove due diligence with complete audit trail</span>
            </li>
          </ul>
        </div>

        {/* Retention Policy */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="text-2xl font-bold text-gray-900 mb-1">7 Years</div>
            <div className="text-sm text-gray-600">Audit log retention (UK legal requirement)</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="text-2xl font-bold text-gray-900 mb-1">Real-time</div>
            <div className="text-sm text-gray-600">Log updates (instant visibility)</div>
          </div>
        </div>
      </div>
    </OnboardingFactory>
  );
}
