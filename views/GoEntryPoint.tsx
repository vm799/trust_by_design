/**
 * GoEntryPoint.tsx - Validated Handshake Entry Point
 *
 * This is the ONLY public entry point for technician links.
 * It replaces the legacy /technician/:token route with a secure
 * validated handshake flow.
 *
 * Flow:
 * 1. Parse accessCode from URL
 * 2. Validate accessCode (checksum, structure, expiry)
 * 3. Commit handshake to localStorage (IMMUTABLE until sync)
 * 4. Redirect to /run/:jobId (internal workspace)
 *
 * Security Features:
 * - Checksum validation prevents Job ID guessing
 * - Email embedded in accessCode ensures report delivery
 * - Handshake is locked until job completes
 * - Invalid/expired codes show AccessDenied screen
 *
 * @author Claude Code - Architectural Refactor
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HandshakeService, HandshakeError } from '../lib/handshakeService';
import { useTheme } from '../lib/theme';

// ============================================================================
// TYPES
// ============================================================================

type ValidationState =
  | { status: 'validating' }
  | { status: 'success'; jobId: string }
  | { status: 'error'; error: HandshakeError };

// ============================================================================
// COMPONENT
// ============================================================================

const GoEntryPoint: React.FC = () => {
  const { accessCode } = useParams<{ accessCode: string }>();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [state, setState] = useState<ValidationState>({ status: 'validating' });

  // Theme-aware classes
  const bgClass = isDark ? 'bg-slate-950' : 'bg-slate-100';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const subtextClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardClass = isDark
    ? 'bg-slate-900 border-white/10'
    : 'bg-white border-slate-200 shadow-md';

  // Validate access code on mount
  useEffect(() => {
    if (!accessCode) {
      setState({
        status: 'error',
        error: {
          type: 'INVALID_ACCESS_CODE',
          message: 'No access code provided in the URL.',
        },
      });
      return;
    }

    // Validate the access code
    const result = HandshakeService.validate(accessCode);

    if (result.success && result.context) {
      // Commit the handshake (locks it)
      HandshakeService.commit(result.context);

      // Brief success state before redirect
      setState({ status: 'success', jobId: result.context.jobId });

      // Redirect to internal workspace after short delay
      setTimeout(() => {
        // Build the URL with handshake params embedded
        const params = new URLSearchParams();
        params.set('c', result.context!.checksum);
        params.set('me', result.context!.deliveryEmail);
        if (result.context!.clientEmail) {
          params.set('ce', result.context!.clientEmail);
        }

        navigate(`/run/${result.context!.jobId}?${params.toString()}`, { replace: true });
      }, 500);
    } else {
      setState({
        status: 'error',
        error: result.error || {
          type: 'UNKNOWN',
          message: 'An unknown error occurred.',
        },
      });
    }
  }, [accessCode, navigate]);

  // ============================================================================
  // RENDER: VALIDATING STATE
  // ============================================================================

  if (state.status === 'validating') {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className="text-center space-y-4">
          <div className={`size-16 border-4 ${isDark ? 'border-primary/30 border-t-primary' : 'border-orange-500/30 border-t-orange-500'} rounded-full animate-spin mx-auto`} />
          <p className={`text-sm font-medium uppercase tracking-widest ${subtextClass}`}>
            Validating Access...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: SUCCESS STATE (brief flash before redirect)
  // ============================================================================

  if (state.status === 'success') {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className="text-center space-y-4">
          <div className="size-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
          </div>
          <div className="space-y-2">
            <h1 className={`text-2xl font-bold ${textClass}`}>Access Validated</h1>
            <p className={subtextClass}>Loading your job...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: ERROR STATE (AccessDenied Screen)
  // ============================================================================

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
      <div className={`max-w-md w-full ${cardClass} rounded-[2rem] border p-8 space-y-6`}>
        {/* Error Icon */}
        <div className="text-center">
          <div className={`size-20 rounded-2xl flex items-center justify-center mx-auto ${
            state.error.type === 'EXPIRED_LINK' ? 'bg-yellow-500/20' : 'bg-red-500/20'
          }`}>
            <span className={`material-symbols-outlined text-5xl ${
              state.error.type === 'EXPIRED_LINK' ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {state.error.type === 'EXPIRED_LINK' ? 'schedule' :
               state.error.type === 'LOCKED' ? 'lock' :
               state.error.type === 'CHECKSUM_MISMATCH' ? 'security' : 'error'}
            </span>
          </div>
        </div>

        {/* Error Title */}
        <div className="text-center space-y-2">
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>
            {state.error.type === 'EXPIRED_LINK' ? 'Link Expired' :
             state.error.type === 'LOCKED' ? 'Job In Progress' :
             state.error.type === 'CHECKSUM_MISMATCH' ? 'Invalid Link' :
             state.error.type === 'MISSING_PARAMS' ? 'Incomplete Link' :
             'Access Denied'}
          </h1>
          <p className={`text-sm ${subtextClass}`}>
            {state.error.message}
          </p>
        </div>

        {/* Error Details for MISSING_PARAMS */}
        {state.error.type === 'MISSING_PARAMS' && (
          <div className={`${isDark ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl p-4`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${subtextClass}`}>
              Missing Information:
            </p>
            <ul className={`text-sm space-y-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {state.error.missingFields.map((field) => (
                <li key={field} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-sm">close</span>
                  {field === 'jobId' ? 'Job ID' :
                   field === 'deliveryEmail' ? 'Manager Email' :
                   field === 'checksum' ? 'Security Code' : field}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Help Section */}
        <div className={`${isDark ? 'bg-slate-800/30' : 'bg-slate-50'} rounded-xl p-4 border ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${subtextClass}`}>
            What to do:
          </p>
          <ul className={`text-sm space-y-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_forward</span>
              Contact your manager for a new link
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_forward</span>
              Make sure you copied the full link
            </li>
            {state.error.type === 'LOCKED' && (
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_forward</span>
                Complete your current job first
              </li>
            )}
          </ul>
        </div>

        {/* Action Buttons - 56px min height for thumb use */}
        <div className="space-y-3">
          <a
            href="/#/track-lookup"
            className={`block w-full py-4 min-h-[56px] ${isDark
              ? 'bg-primary hover:bg-primary/90 text-white'
              : 'bg-orange-500 hover:bg-orange-400 text-slate-900 border-2 border-slate-900 shadow-[4px_4px_0px_#1e293b]'
            } font-black rounded-xl uppercase tracking-widest text-center transition-all active:scale-[0.98]`}
          >
            <span className="material-symbols-outlined align-middle mr-2">search</span>
            Enter Link Manually
          </a>

          {/* Contact Manager - Large touch target */}
          <button
            onClick={() => {
              // Try to find manager email from any stored context
              const email = HandshakeService.getDeliveryEmail();
              if (email) {
                window.location.href = `mailto:${email}?subject=Job%20Link%20Issue&body=Hi,%0A%0AI%20received%20a%20job%20link%20but%20it%20appears%20to%20be%20invalid.%0A%0ACould%20you%20please%20send%20me%20a%20new%20link?%0A%0AThank%20you`;
              } else {
                alert('Please contact your manager directly for a new job link.');
              }
            }}
            className={`w-full py-4 min-h-[56px] ${isDark
              ? 'bg-slate-700 hover:bg-slate-600 text-white'
              : 'bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300'
            } font-bold rounded-xl transition-all active:scale-[0.98]`}
          >
            <span className="material-symbols-outlined align-middle mr-2">mail</span>
            Contact Manager
          </button>
        </div>

        {/* Footer */}
        <p className={`text-center text-xs ${subtextClass}`}>
          If problems persist, ask your manager to create a new job link.
        </p>
      </div>
    </div>
  );
};

export default GoEntryPoint;
