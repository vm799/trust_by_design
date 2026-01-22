import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { JobProofLogo } from '../components/branding/jobproof-logo';

/**
 * OAuth Setup View
 * 
 * Specifically for users who sign in via Google OAuth for the first time
 * and need to create their workspace and profile.
 */
const OAuthSetup: React.FC = () => {
    const navigate = useNavigate();
    // PERFORMANCE FIX: Use AuthContext instead of calling getUser()
    const { userId, userEmail, session, isAuthenticated } = useAuth();

    const [workspaceName, setWorkspaceName] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            // PERFORMANCE FIX: Use AuthContext session instead of getUser()
            if (!isAuthenticated || !session?.user) {
                navigate('/auth');
                return;
            }

            const supabase = getSupabase();
            if (!supabase) return;

            // Check if profile already exists - if so, skip setup
            const { data: profile } = await supabase
                .from('users')
                .select('id')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                window.location.href = '/#/admin';
                window.location.reload();
                return;
            }

            // Pre-fill full name from metadata if available
            const user = session.user;
            if (user.user_metadata?.full_name) {
                setFullName(user.user_metadata.full_name);
            } else if (user.user_metadata?.name) {
                setFullName(user.user_metadata.name);
            }

            // Suggested workspace name
            const domain = (user.email || '').split('@')[1];
            const suggestedName = domain ? domain.split('.')[0] : 'My Company';
            setWorkspaceName(suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1));
        };

        checkUser();
    }, [navigate, isAuthenticated, session]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId) {
            setError('User session not fully loaded. Please wait a moment and try again.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const supabase = getSupabase();
            if (!supabase) throw new Error('Supabase not configured');

            const workspaceSlug = workspaceName
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            const finalSlug = `${workspaceSlug}-${Math.random().toString(36).substring(2, 7)}`;

            const { data: workspaceId, error: workspaceError } = await supabase.rpc('create_workspace_with_owner', {
                p_user_id: userId,
                p_email: userEmail,
                p_workspace_name: workspaceName,
                p_workspace_slug: finalSlug,
                p_full_name: fullName || null
            });

            if (workspaceError) {
                throw new Error(workspaceError.message || 'Workspace creation failed');
            }

            // Success - reload app state or navigate
            window.location.href = '/#/admin';
            window.location.reload();
        } catch (err) {
            console.error('Setup error:', err);
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 -left-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 -right-20 size-96 bg-blue-500/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md space-y-8 relative z-10 animate-in">
                <div className="text-center space-y-4">
                    <JobProofLogo variant="full" size="lg" showTagline />
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                            One Last Step
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">
                            Create your workspace to start using JobProof.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                    {error && (
                        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-xs font-bold uppercase leading-relaxed text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Company/Workspace Name *
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. Sterling Field Ops"
                                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                                value={workspaceName}
                                onChange={e => setWorkspaceName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Your Full Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Alex Sterling"
                                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                'Finalise Setup'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default OAuthSetup;
