'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * Site Supervisor Onboarding - Step 2: Material Tracking
 *
 * Teaches supervisors how to log material deliveries and track inventory
 */
export default function MaterialTrackingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<Array<{
    id: string;
    material: string;
    quantity: string;
    logged: boolean;
  }>>([
    { id: '1', material: 'Electrical cables (100m)', quantity: '', logged: false },
    { id: '2', material: 'PVC pipes (50 units)', quantity: '', logged: false },
    { id: '3', material: 'Safety harnesses (10)', quantity: '', logged: false }
  ]);

  const handleLogDelivery = (id: string, quantity: string) => {
    setDeliveries(prev =>
      prev.map(d =>
        d.id === id
          ? { ...d, quantity, logged: quantity.length > 0 }
          : d
      )
    );
  };

  const handleComplete = async () => {
    setLoading(true);

    const supabase = getSupabase();
    if (!supabase) {
      alert('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('complete_onboarding_step', {
        p_step_key: 'material_tracking'
      });

      if (error) throw error;

      router.push('/onboarding/site_supervisor/safety_rounds');
    } catch (err) {
      console.error('Failed to complete step:', err);
      alert('Failed to save progress');
    } finally {
      setLoading(false);
    }
  };

  const allLogged = deliveries.every(d => d.logged);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-500 text-2xl">
                inventory_2
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Site Supervisor - Step 2 of 4</p>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                Material Tracking
              </h1>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: '50%' }} />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-black text-lg mb-2">
            Log Material Deliveries
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Materials arrive throughout the day. Log each delivery immediately to maintain
            accurate inventory and prevent delays. Include quantity received and condition notes.
          </p>
        </div>

        {/* Delivery Log */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black text-xl uppercase">Today's Deliveries</h3>
            <span className="text-slate-500 text-xs">
              {deliveries.filter(d => d.logged).length} / {deliveries.length} logged
            </span>
          </div>

          {deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className={`
                bg-slate-900 border rounded-2xl p-6 transition-all
                ${delivery.logged ? 'border-success' : 'border-slate-700'}
              `}
            >
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <span className={`material-symbols-outlined ${delivery.logged ? 'text-success' : 'text-slate-500'}`}>
                    {delivery.logged ? 'check_circle' : 'circle'}
                  </span>
                </div>

                <div className="flex-1">
                  <h4 className="text-white font-bold mb-3">{delivery.material}</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 text-xs font-bold uppercase mb-2 block">
                        Quantity Received
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 100m, 50 units"
                        value={delivery.quantity}
                        onChange={(e) => handleLogDelivery(delivery.id, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-xs font-bold uppercase mb-2 block">
                        Condition
                      </label>
                      <select className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                        <option>Good</option>
                        <option>Damaged</option>
                        <option>Partial delivery</option>
                      </select>
                    </div>
                  </div>

                  {delivery.logged && (
                    <div className="mt-3 flex items-center gap-2 text-success text-xs">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      Logged at {new Date().toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Best Practices */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-black text-lg mb-4">📦 Material Management Tips</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5">
                schedule
              </span>
              <p className="text-slate-300 text-sm flex-1">
                Log deliveries within 15 minutes to prevent loss or theft
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5">
                photo_camera
              </span>
              <p className="text-slate-300 text-sm flex-1">
                Take photos of damaged materials for insurance claims
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5">
                warning
              </span>
              <p className="text-slate-300 text-sm flex-1">
                Flag partial deliveries immediately to avoid project delays
              </p>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/onboarding/site_supervisor/daily_briefing')}
            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm uppercase hover:bg-slate-700 transition-all"
          >
            ← Previous Step
          </button>

          <button
            onClick={handleComplete}
            disabled={loading || !allLogged}
            className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm uppercase hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Saving...' : 'Continue'}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>

        {!allLogged && (
          <p className="text-center text-slate-500 text-xs mt-4">
            Log all deliveries to continue
          </p>
        )}
      </div>
    </div>
  );
}
