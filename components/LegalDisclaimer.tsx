/**
 * Legal Disclaimer Component
 *
 * Displays legal notice that JobProof is a technical evidence tool,
 * not legal authority. Required by Phase C.5 to prevent false trust claims.
 *
 * Phase: C.5 - Remove False UI Claims
 */

import React from 'react';

const LegalDisclaimer: React.FC = () => {
  return (
    <div className="bg-slate-50 border-l-4 border-slate-300 p-6 rounded-lg shadow-sm">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-slate-400 text-lg">info</span>
        <div className="text-[10px] text-slate-400 space-y-2">
          <p className="font-bold uppercase tracking-wide text-slate-700">Legal Notice</p>
          <p className="leading-relaxed">
            This is a technical evidence capture tool, not legal authority.
          </p>
          <p className="leading-relaxed">
            No guarantee of court admissibility. Consult legal counsel for admissibility requirements.
          </p>
          <p className="leading-relaxed">
            Identity verification is account-based (email), not legally verified (no KYC).
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalDisclaimer;
