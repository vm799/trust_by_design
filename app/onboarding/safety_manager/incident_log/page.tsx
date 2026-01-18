'use client';

/**
 * Safety Manager onboarding step 4: Log safety incident
 * Demonstrates RIDDOR-compliant incident reporting with severity levels
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

/**
 * Safety Manager onboarding step 4: Incident log
 * Teaches RIDDOR incident reporting with severity matrix
 * @returns {JSX.Element} The incident log onboarding page
 */
export default function IncidentLogPage() {
  const [incidentType, setIncidentType] = useState('near_miss');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [logged, setLogged] = useState(false);

  const mockIncidents = [
    { type: 'Near Miss', count: 3, color: 'yellow' },
    { type: 'Minor Injury', count: 1, color: 'orange' },
    { type: 'Major Injury', count: 0, color: 'red' },
  ];

  const colorClassMap: Record<string, { bgClass: string; titleClass: string; subtitleClass: string }> = {
    yellow: {
      bgClass: 'bg-yellow-50',
      titleClass: 'text-yellow-600',
      subtitleClass: 'text-yellow-700',
    },
    orange: {
      bgClass: 'bg-orange-50',
      titleClass: 'text-orange-600',
      subtitleClass: 'text-orange-700',
    },
    red: {
      bgClass: 'bg-red-50',
      titleClass: 'text-red-600',
      subtitleClass: 'text-red-700',
    },
  };

  const isFormValid = incidentType && severity && description.length >= 10;

  /**
   * Validates form and sets logged state to show success UI
   * Only proceeds if incident type, severity, and description (>=10 chars) are provided
   */
  const handleLog = () => {
    if (!isFormValid) return;
    setLogged(true);
  };

  /**
   * Handles step completion and returns incident metadata to persist
   * @returns {Promise<Object>} Step data containing incident type, severity level, and logged flag
   */
  const handleComplete = async () => {
    return {
      incident_logged: true,
      incident_type: incidentType,
      severity,
    };
  };

  return (
    <OnboardingFactory persona="safety_manager" step="incident_log" onComplete={handleComplete}>
      <div className="space-y-8">
        {!logged && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {mockIncidents.map(incident => {
                const classes = colorClassMap[incident.color];
                return (
                  <div key={incident.type} className={`p-4 ${classes.bgClass} rounded-2xl text-center`}>
                    <div className={`text-3xl font-bold ${classes.titleClass} mb-1`}>{incident.count}</div>
                    <div className={`text-sm ${classes.subtitleClass}`}>{incident.type}</div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
              >
                <option value="near_miss">Near Miss</option>
                <option value="minor_injury">Minor Injury</option>
                <option value="major_injury">Major Injury (RIDDOR reportable)</option>
                <option value="property_damage">Property Damage</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Severity</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    onClick={() => setSeverity(level.toString())}
                    className={`py-3 rounded-xl border-2 font-semibold transition-all ${
                      severity === level.toString()
                        ? level <= 2 ? 'border-green-500 bg-green-50 text-green-900' :
                          level === 3 ? 'border-yellow-500 bg-yellow-50 text-yellow-900' :
                          'border-red-500 bg-red-50 text-red-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">1 = Minimal, 5 = Critical</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what happened, who was involved, and immediate actions taken..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none resize-none"
              />
              <p className="text-sm text-gray-500 mt-1">{description.length} characters (minimum 10)</p>
            </div>

            <button
              onClick={handleLog}
              disabled={!isFormValid}
              className="w-full py-4 bg-amber-600 text-white rounded-2xl font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Log Incident
            </button>
          </>
        )}

        {logged && (
          <>
            <div className="p-8 bg-green-50 border-2 border-green-200 rounded-2xl text-center">
              <span className="material-symbols-outlined text-green-600 text-6xl mb-4 inline-block">check_circle</span>
              <h3 className="text-2xl font-bold text-green-900 mb-2">✅ Incident Logged</h3>
              <p className="text-green-700">Incident report submitted for investigation</p>
            </div>

            <div className="p-6 bg-white border-2 border-gray-200 rounded-2xl">
              <h3 className="font-semibold text-gray-900 mb-4">Incident Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-semibold text-gray-900 capitalize">{incidentType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Severity:</span>
                  <span className="font-semibold text-gray-900">{severity}/5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reported:</span>
                  <span className="font-semibold text-gray-900">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <h3 className="font-semibold text-blue-900 mb-3">Next Steps</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Incident report emailed to safety manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Investigation initiated (severity {severity}/5)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>RIDDOR notification {parseInt(severity) >= 4 ? 'REQUIRED' : 'not required'}</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </OnboardingFactory>
  );
}
