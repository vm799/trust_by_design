'use client';

/**
 * Solo Contractor - Step 3: Add Safety Checklist
 * Handholding UX for creating reusable safety checklists
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function SafetyChecklistPage() {
  const [checklist, setChecklist] = useState([
    { id: '1', text: 'PPE worn (helmet, gloves, safety boots)', checked: false },
    { id: '2', text: 'Work area inspected for hazards', checked: false },
    { id: '3', text: 'Tools in good working condition', checked: false },
    { id: '4', text: 'Emergency exits identified', checked: false },
    { id: '5', text: 'Fire extinguisher location noted', checked: false },
  ]);

  const [customItem, setCustomItem] = useState('');

  const toggleCheck = (id: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const addCustomItem = () => {
    if (!customItem.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      text: customItem.trim(),
      checked: false,
    };

    setChecklist(prev => [...prev, newItem]);
    setCustomItem('');
  };

  const removeItem = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };

  const checkedCount = checklist.filter(item => item.checked).length;
  const totalCount = checklist.length;
  const allChecked = checkedCount === totalCount && totalCount > 0;

  const handleComplete = async () => {
    // In production, save checklist as template
    return {
      checklist_id: 'template_' + Date.now(),
      items: checklist.map(item => item.text),
      total_items: checklist.length,
    };
  };

  return (
    <OnboardingFactory persona="solo_contractor" step="safety_checklist">
      <div className="space-y-8">
        {/* Progress Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">{totalCount}</div>
            <div className="text-sm text-blue-700">Total Items</div>
          </div>
          <div className="p-4 bg-green-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">{checkedCount}</div>
            <div className="text-sm text-green-700">Checked</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0}%
            </div>
            <div className="text-sm text-purple-700">Complete</div>
          </div>
        </div>

        {/* Checklist Items */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">fact_check</span>
            <span>Safety Checklist Items</span>
          </h3>

          <div className="space-y-3">
            {checklist.map((item, index) => (
              <div
                key={item.id}
                className={`
                  p-4 rounded-xl border-2 transition-all
                  ${item.checked
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleCheck(item.id)}
                    className={`
                      w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all
                      ${item.checked
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300 hover:border-blue-400'
                      }
                    `}
                  >
                    {item.checked && (
                      <span className="material-symbols-outlined text-white text-xl">
                        check
                      </span>
                    )}
                  </button>

                  <div className="flex-1">
                    <div className={`font-medium ${item.checked ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                      {item.text}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {index >= 5 && ( // Only custom items can be removed
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Custom Item */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">add_circle</span>
            <span>Add Custom Safety Check</span>
          </h3>

          <div className="flex gap-3">
            <input
              type="text"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomItem()}
              placeholder="e.g., Lockout/tagout procedures verified"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
            <button
              onClick={addCustomItem}
              disabled={!customItem.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Add
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-2">
            Add safety checks specific to your trade (electrical, plumbing, HVAC, etc.)
          </p>
        </div>

        {/* All Checked Success */}
        {allChecked && (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-4xl">
                verified
              </span>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">
                  ✅ All Safety Checks Complete!
                </h3>
                <p className="text-sm text-green-700">
                  This checklist will be saved as a template for all your future jobs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Why This Matters */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>Why safety checklists?</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Regulatory compliance - inspectors expect documented safety procedures</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Insurance protection - evidence of due diligence in case of incidents</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Habit formation - consistent safety checks prevent 95% of accidents</span>
            </li>
          </ul>
        </div>

        {/* Industry Examples */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">
            📋 Common checks by trade:
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="font-semibold text-gray-900 mb-2">⚡ Electrical</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Voltage tester calibrated</li>
                <li>• Circuit breakers labeled</li>
                <li>• Arc flash PPE available</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="font-semibold text-gray-900 mb-2">🔧 Plumbing</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Water main location identified</li>
                <li>• Gas lines marked and avoided</li>
                <li>• Pressure test equipment ready</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="font-semibold text-gray-900 mb-2">❄️ HVAC</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Refrigerant handling certified</li>
                <li>• Roof access secured</li>
                <li>• Electrical lockout verified</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="font-semibold text-gray-900 mb-2">🏗️ General Construction</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Fall protection inspected</li>
                <li>• Scaffolding tagged green</li>
                <li>• Dust masks available</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </OnboardingFactory>
  );
}
