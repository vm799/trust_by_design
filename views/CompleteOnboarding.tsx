import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { getJobs, getClients, getTechnicians } from '../lib/db';
import { PersonaType, PERSONA_METADATA, PERSONA_STEPS } from '../lib/onboarding';
import PersonaCard from '../components/PersonaCard';

/**
 * Complete Onboarding - Persona Selection View
 * Ported from Next.js implementation to work with Vite/React Router
 */
const CompleteOnboarding: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkState = async () => {
            const supabase = getSupabase();
            if (!supabase) return;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/auth');
                return;
            }
            setUser(user);

            // Check if already has persona
            const { data: personas } = await supabase
                .from('user_personas')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .limit(1);

            if (personas && personas.length > 0) {
                if (personas[0].is_complete) {
                    navigate('/admin');
                    return;
                }
                // If has incomplete persona, we'd normally resume, 
                // but for now we'll just show the selection or stay here
            }

            setLoading(false);
        };

        checkState();
    }, [navigate]);

    const handlePersonaSelect = async (persona: PersonaType) => {
        if (selecting) return;
        setSelecting(true);

        try {
            const supabase = getSupabase();
            if (!supabase || !user) throw new Error('Not authenticated');

            // Get user profile to get workspace_id
            const { data: profile } = await supabase
                .from('users')
                .select('workspace_id')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Profile not found. Please complete workspace setup.');

            // Get first step
            const steps = PERSONA_STEPS[persona];
            const firstStep = steps[0].step_key;

            // Upsert persona
            const { error: personaError } = await supabase
                .from('user_personas')
                .upsert({
                    user_id: user.id,
                    workspace_id: profile.workspace_id,
                    persona_type: persona,
                    is_active: true,
                    is_complete: false,
                    current_step: firstStep
                }, { onConflict: 'user_id,persona_type' });

            if (personaError) throw personaError;

            // Finish onboarding selection
            localStorage.setItem('jobproof_onboarding_v4', 'true');

            // Special handling for Agency Owners - send to pricing/billing
            if (persona === 'agency_owner') {
                navigate('/pricing');
            } else {
                navigate('/admin');
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

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-12 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <div className="bg-primary/10 size-20 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-5xl">person_check</span>
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Choose Your Role</h1>
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
