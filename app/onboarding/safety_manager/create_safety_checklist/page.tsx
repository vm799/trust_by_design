'use client';

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function CreateSafetyChecklistPage() {
  const defaultItems = [
    { id: '1', text: 'PPE worn (helmet, gloves, safety boots, high-vis vest)', checked: false },
    { id: '2', text: 'Work area inspected for hazards (trip hazards, overhead dangers)', checked: false },
    { id: '3', text: 'Tools in good working condition (visual inspection)', checked: false },
    { id: '4', text: 'Emergency exits identified and unobstructed', checked: false },
    { id: '5', text: 'Fire extinguisher location noted', checked: false },
    { id: '6', text: 'First aid kit accessible', checked: false },
  ];

  const [items, setItems] = useState(defaultItems);
  const [customItem, setCustomItem] = useState('');

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const addCustomItem = () => {
    if (!customItem.trim()) return;
    setItems(prev => [...prev, { id: Date.now().toString(), text: customItem.trim(), checked: false }]);
    setCustomItem('');
  };

  const handleComplete = async () => {
    return {
      checklist_id: 'template_' + Date.now(),
      items: items.map(i => i.text),
      total_items: items.length,
    };
  };

  return (
    <OnboardingFactory persona="safety_manager" step="create_safety_checklist">
      <div className="space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-amber-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-amber-600 mb-1">{items.length}</div>
            <div className="text-sm text-amber-700">Total Items</div>
          </div>
          <div className="p-4 bg-green-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">{items.filter(i => i.checked).length}</div>
            <div className="text-sm text-green-700">Checked</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {items.length > 0 ? Math.round((items.filter(i => i.checked).length / items.length) * 100) : 0}%
            </div>
            <div className="text-sm text-blue-700">Complete</div>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                item.checked ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${
                  item.checked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                }`}>
                  {item.checked && <span className="material-symbols-outlined text-white text-xl">check</span>}
                </div>
                <div className={`font-medium ${item.checked ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                  {item.text}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={customItem}
            onChange={(e) => setCustomItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomItem()}
            placeholder="Add custom safety check..."
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none"
          />
          <button
            onClick={addCustomItem}
            disabled={!customItem.trim()}
            className="px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-all"
          >
            Add
          </button>
        </div>

        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3">💡 Pro Tip</h3>
          <p className="text-sm text-blue-700">
            Create reusable templates for different job types (electrical, plumbing, HVAC). Consistent checklists reduce accidents by 95%.
          </p>
        </div>
      </div>
    </OnboardingFactory>
  );
}
