import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { JobProofLogo } from '../components/branding/jobproof-logo';
import { generateSecureSlugSuffix } from '../lib/secureId';

/**
 * Account Setup View
 *
 * Personal onboarding for new users signing in for the first time.
 * Collects their name and company to create a personalized workspace.
 *
 * Design principles:
 * - Personal & warm (ask for name first)
 * - Show live preview of their workspace
 * - Delightful micro-interactions
 * - Clear value proposition
 */
const OAuthSetup: React.FC = () => {
    const navigate = useNavigate();
    // PERFORMANCE FIX: Use AuthContext instead of calling getUser()
    const { userId, userEmail, session, isAuthenticated, isLoading: authLoading } = useAuth();

    // CRITICAL FIX: Extract metadata values to stable primitives OUTSIDE useEffect
    // This prevents re-renders when session object reference changes on token refresh
    const metadataFullName = session?.user?.user_metadata?.full_name || '';
    const metadataName = session?.user?.user_metadata?.name || '';

    const [workspaceName, setWorkspaceName] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // CRITICAL FIX: Track if we've already checked to prevent duplicate runs
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        // CRITICAL FIX: Wait for auth to finish loading before making any decisions
        if (authLoading) {
            return;
        }

        // CRITICAL FIX: Prevent duplicate checks on re-renders
        if (hasCheckedRef.current) {
            return;
        }

        const checkUser = async () => {
            // Not authenticated - redirect to auth
            if (!isAuthenticated || !userId) {
                hasCheckedRef.current = true;
                navigate('/auth');
                return;
            }

            hasCheckedRef.current = true;

            const supabase = getSupabase();
            if (!supabase) return;

            // Check if profile already exists - if so, skip setup
            const { data: profile } = await supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .single();

            if (profile) {
                // CRITICAL FIX: Navigate to root to go through PersonaRedirect
                // This ensures managers land on /manager/intent (Intent-First UX)
                navigate('/', { replace: true });
                return;
            }

            // Pre-fill full name from metadata if available (use stable primitives)
            if (metadataFullName) {
                setFullName(metadataFullName);
            } else if (metadataName) {
                setFullName(metadataName);
            }

            // Don't pre-fill workspace name - let user customize or use their name as default
        };

        checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, userId]); // CRITICAL: Only stable primitives - no session object or metadata

    // Compute display name for preview
    const firstName = fullName.split(' ')[0] || '';
    const displayWorkspaceName = workspaceName.trim() || (firstName ? `${firstName}'s Workspace` : 'My Workspace');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId) {
            setError('User session not fully loaded. Please wait a moment and try again.');
            return;
        }

        if (!fullName.trim()) {
            setError('Please enter your name so we can personalise your experience.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const supabase = getSupabase();
            if (!supabase) throw new Error('Supabase not configured');

            // Use provided workspace name or generate from user's name
            const finalWorkspaceName = workspaceName.trim() || `${firstName}'s Workspace`;

            const workspaceSlug = finalWorkspaceName
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            const finalSlug = `${workspaceSlug}-${generateSecureSlugSuffix()}`;

            const { data: workspaceId, error: workspaceError } = await supabase.rpc('create_workspace_with_owner', {
                p_user_id: userId,
                p_email: userEmail,
                p_workspace_name: finalWorkspaceName,
                p_workspace_slug: finalSlug,
                p_full_name: fullName.trim()
            });

            if (workspaceError) {
                throw new Error(workspaceError.message || 'Workspace creation failed');
            }

            // CRITICAL FIX: Navigate to root to go through PersonaRedirect
            // This ensures managers land on /manager/intent (Intent-First UX)
            navigate('/', { replace: true });
        } catch (err) {
            console.error('Setup error:', err);
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 -left-20 size-96 bg-emerald-500/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 -right-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md space-y-6 relative z-10 animate-in">
                {/* Welcome Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center size-16 bg-emerald-500/20 rounded-2xl mb-2">
                        <span className="material-symbols-outlined text-emerald-400 text-3xl">waving_hand</span>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
                            Welcome to JobProof
                        </h1>
                        <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto">
                            Let's set up your workspace in 30 seconds. You're about to end payment disputes forever.
                        </p>
                    </div>
                </div>

                {/* Main Form Card */}
                <div className="bg-slate-900 border border-white/5 p-6 sm:p-8 rounded-[2rem] shadow-2xl space-y-6">
                    {error && (
                        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined text-danger text-lg mt-0.5">error</span>
                            <p className="text-danger text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name Field - First & Required */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm text-primary">person</span>
                                What's your name? *
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. Alex Sterling"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white text-base placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                autoFocus
                            />
                            <p className="text-slate-500 text-xs">
                                We'll use this to personalise your experience
                            </p>
                        </div>

                        {/* Workspace Field - Optional */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm text-primary">business</span>
                                Company or workspace name
                            </label>
                            <input
                                type="text"
                                placeholder={firstName ? `${firstName}'s Workspace` : 'My Workspace'}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white text-base placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                value={workspaceName}
                                onChange={e => setWorkspaceName(e.target.value)}
                            />
                            <p className="text-slate-500 text-xs">
                                Leave blank to use "{displayWorkspaceName}"
                            </p>
                        </div>

                        {/* Preview Card */}
                        {fullName && (
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Your workspace preview
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-lg">
                                        {firstName.charAt(0).toUpperCase() || 'J'}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold">{displayWorkspaceName}</p>
                                        <p className="text-slate-400 text-xs">{fullName} · Owner</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !fullName.trim()}
                            className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">rocket_launch</span>
                                    Let's Go
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Value Reminder */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                            14-day free trial
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                            No credit card
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OAuthSetup;
