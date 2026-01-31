import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getJobs, getClients, getTechnicians } from '../lib/db';
import { PersonaType, PERSONA_METADATA, PERSONA_STEPS } from '../lib/onboarding';
import PersonaCard from '../components/PersonaCard';

/**
 * Complete Onboarding - Name Capture + Persona Selection View
 * Ported from Next.js implementation to work with Vite/React Router
 *
 * CRITICAL FIX (Jan 2026): Fixed auth loop by:
 * - Adding isLoading check before redirecting
 * - Using hasChecked ref to prevent duplicate checks
 * - Removed navigate from dependencies
 *
 * FIX (Jan 2026): Added name capture step before persona selection
 * - Magic link users were bypassing name capture
 * - Now checks if full_name is set, shows name input if missing
 */
const CompleteOnboarding: React.FC = () => {
    const navigate = useNavigate();
    // PERFORMANCE FIX: Use AuthContext instead of calling getUser()
    const { userId, isAuthenticated, isLoading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);

    // NEW: Track onboarding step (1 = name, 2 = persona)
    const [step, setStep] = useState<'name' | 'persona'>('name');
    const [fullName, setFullName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [userEmail, setUserEmail] = useState('');

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

        const checkState = async () => {
            // Not authenticated - redirect to auth
            if (!isAuthenticated || !userId) {
                hasCheckedRef.current = true;
                navigate('/auth');
                return;
            }

            hasCheckedRef.current = true;

            const supabase = getSupabase();
            if (!supabase) {
                setLoading(false);
                return;
            }

            // Check user profile for name (use maybeSingle to avoid 406 on new users)
            const { data: profile } = await supabase
                .from('users')
                .select('full_name, email')
                .eq('id', userId)
                .maybeSingle();

            if (profile) {
                setUserEmail(profile.email || '');
                // If user already has a name, skip to persona selection
                if (profile.full_name && profile.full_name.trim()) {
                    setFullName(profile.full_name);
                    setStep('persona');
                }
            }

            // Check if already has persona
            const { data: personas } = await supabase
                .from('user_personas')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .limit(1);

            if (personas && personas.length > 0) {
                if (personas[0].is_complete) {
                    // Navigate to root to go through PersonaRedirect (Intent-First UX)
                    navigate('/');
                    return;
                }
                // If has incomplete persona, we'd normally resume,
                // but for now we'll just show the selection or stay here
            }

            setLoading(false);
        };

        checkState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, userId]); // CRITICAL: Only stable primitives - navigate excluded to prevent re-runs

    // NEW: Handle name submission
    const handleNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || savingName) return;

        setSavingName(true);
        try {
            const supabase = getSupabase();
            if (!supabase || !userId) throw new Error('Not authenticated');

            // Update user profile with name
            const { error } = await supabase
                .from('users')
                .update({ full_name: fullName.trim() })
                .eq('id', userId);

            if (error) throw error;

            // Move to persona selection
            setStep('persona');
        } catch (err) {
            console.error('Failed to save name:', err);
            alert('Failed to save name. Please try again.');
        } finally {
            setSavingName(false);
        }
    };

    const handlePersonaSelect = async (persona: PersonaType) => {
        if (selecting) return;
        setSelecting(true);

        try {
            const supabase = getSupabase();
            // PERFORMANCE FIX: Use userId from AuthContext
            if (!supabase || !userId) throw new Error('Not authenticated');

            // Get user profile to get workspace_id
            let { data: profile } = await supabase
                .from('users')
                .select('workspace_id, email')
                .eq('id', userId)
                .maybeSingle();

            // If no profile or no workspace, create one
            if (!profile || !profile.workspace_id) {
                const workspaceName = fullName ? `${fullName.split(' ')[0]}'s Workspace` : 'My Workspace';
                const workspaceSlug = workspaceName
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

                // Try to create workspace via RPC
                const { error: rpcError } = await supabase.rpc('create_workspace_with_owner', {
                    p_user_id: userId,
                    p_email: userEmail || profile?.email || '',
                    p_workspace_name: workspaceName,
                    p_workspace_slug: workspaceSlug,
                    p_full_name: fullName || null
                });

                if (rpcError) {
                    // Foreign key error = user doesn't exist in auth.users (stale session)
                    if (rpcError.message?.includes('fk_users_auth') || rpcError.code === '23503') {
                        console.error('[Onboarding] User not in auth.users - clearing stale session');
                        await supabase.auth.signOut();
                        navigate('/auth', { replace: true });
                        return;
                    }
                    // 409/23505 = conflict, workspace/user already exists - that's OK
                    if (rpcError.code !== '409' && rpcError.code !== '23505') {
                        console.error('Workspace creation failed:', rpcError);
                        throw new Error('Failed to create workspace. Please try again.');
                    }
                }

                // Refetch profile after creation
                const { data: newProfile } = await supabase
                    .from('users')
                    .select('workspace_id, email')
                    .eq('id', userId)
                    .maybeSingle();

                if (!newProfile?.workspace_id) {
                    throw new Error('Workspace setup incomplete. Please refresh and try again.');
                }
                profile = newProfile;
            }

            // At this point profile is guaranteed to have workspace_id
            const workspaceId = profile!.workspace_id;

            // Get first step
            const steps = PERSONA_STEPS[persona];
            const firstStep = steps[0].step_key;

            // Upsert persona
            const { error: personaError } = await supabase
                .from('user_personas')
                .upsert({
                    user_id: userId,
                    workspace_id: workspaceId,
                    persona_type: persona,
                    is_active: true,
                    is_complete: false,
                    current_step: firstStep
                }, { onConflict: 'user_id,persona_type' });

            if (personaError) throw personaError;

            // Finish onboarding selection
            localStorage.setItem('jobproof_onboarding_v4', 'true');

            // UX Spec: Route to role-specific onboarding wizard
            // Agency Owners and Managers get the full step-by-step wizard
            if (persona === 'agency_owner' || persona === 'site_supervisor' || persona === 'safety_manager') {
                navigate('/manager-onboarding');
            } else {
                // Navigate to root to go through PersonaRedirect (Intent-First UX)
                navigate('/');
            }
        } catch (err) {
            console.error('Persona selection failed:', err);
            alert(err instanceof Error ? err.message : 'Failed to select persona');
            setSelecting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin size-12 border-4 border-primary/30 border-t-primary rounded-full"></div>
            </div>
        );
    }

    // STEP 1: Name capture (if name is missing)
    if (step === 'name') {
        return (
            <div className="min-h-screen bg-slate-950 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-12 overflow-y-auto flex items-center justify-center">
                <div className="w-full max-w-md space-y-8">
                    {/* Progress indicator */}
                    <div className="flex items-center justify-center gap-2">
                        <div className="size-3 rounded-full bg-primary"></div>
                        <div className="w-8 h-0.5 bg-slate-700"></div>
                        <div className="size-3 rounded-full bg-slate-700"></div>
                    </div>

                    <div className="text-center space-y-4">
                        <div className="bg-primary/10 size-20 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/20">
                            <span className="material-symbols-outlined text-primary text-5xl">waving_hand</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">Welcome!</h1>
                        <p className="text-slate-400">
                            Let's get you set up. What should we call you?
                        </p>
                    </div>

                    <form onSubmit={handleNameSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="fullName" className="block text-sm font-bold text-slate-300 uppercase tracking-wider">
                                Your Name
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Smith"
                                autoFocus
                                autoComplete="name"
                                className="w-full px-4 py-4 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                                required
                            />
                            {userEmail && (
                                <p className="text-slate-500 text-xs mt-2">
                                    Signing in as {userEmail}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={!fullName.trim() || savingName}
                            className="w-full py-4 bg-primary hover:bg-primary-hover disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {savingName ? (
                                <>
                                    <div className="animate-spin size-5 border-2 border-white/30 border-t-white rounded-full"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Continue
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // STEP 2: Persona selection
    return (
        <div className="min-h-screen bg-slate-950 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-12 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-12">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2">
                    <div className="size-3 rounded-full bg-emerald-500"></div>
                    <div className="w-8 h-0.5 bg-emerald-500"></div>
                    <div className="size-3 rounded-full bg-primary"></div>
                </div>

                <div className="text-center space-y-4">
                    <div className="bg-primary/10 size-20 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-5xl">person_check</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">
                        Hi{fullName ? `, ${fullName.split(' ')[0]}` : ''}! Choose Your Role
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Select how you will use JobProof. We'll customise your experience with workflows optimised for your daily operations.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(['solo_contractor', 'agency_owner', 'compliance_officer', 'safety_manager', 'site_supervisor'] as PersonaType[]).map(p => (
                        <PersonaCard
                            key={p}
                            persona={p}
                            onSelect={handlePersonaSelect}
                            disabled={selecting}
                        />
                    ))}
                </div>

                {selecting && (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-center">
                        <div className="space-y-4">
                            <div className="animate-spin size-12 border-4 border-primary/30 border-t-primary rounded-full mx-auto"></div>
                            <p className="text-white font-black uppercase tracking-widest text-sm">Configuring Workspace...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompleteOnboarding;
