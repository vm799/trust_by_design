
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/AppLayout';
import { Technician, UserProfile } from '../types';
import { navigateToNextStep } from '../lib/onboarding';
import { generateUUID } from '../lib/secureId';

interface TechniciansViewProps {
  user: UserProfile | null;
  techs: Technician[];
  onAdd: (t: Technician) => void;
  onDelete: (id: string) => void;
}

const TechniciansView: React.FC<TechniciansViewProps> = ({ user, techs, onAdd, onDelete }) => {
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', email: '' });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: generateUUID(),
      name: newTech.name,
      email: newTech.email,
      status: 'Authorised',
      rating: 0,
      jobsCompleted: 0
    });
    setNewTech({ name: '', email: '' });
    setShowAdd(false);

    // Trigger guided flow auto-navigation
    navigateToNextStep('ADD_TECHNICIAN', user?.persona, navigate);
  };

  const handleDelete = useCallback(async (techId: string) => {
    setDeletingId(techId);
    setDeleteError(null);
    setConfirmDeleteId(null);

    try {
      await onDelete(techId);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete technician');
      setDeletingId(null);
    }
  }, [onDelete]);

  // Filter technicians by search query (name, email, status)
  const filteredTechs = useMemo(() => {
    if (!searchQuery.trim()) return techs;
    const q = searchQuery.toLowerCase().trim();
    return techs.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.status?.toLowerCase().includes(q)
    );
  }, [techs, searchQuery]);

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {deleteError && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3 animate-in">
            <span className="material-symbols-outlined text-danger flex-shrink-0">error</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-danger">Failed to delete technician</p>
              <p className="text-xs text-slate-300 mt-1">{deleteError}</p>
            </div>
            <button
              onClick={() => setDeleteError(null)}
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Dismiss error"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Workforce</h2>
            <p className="text-slate-400">Your team of technicians.</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2 uppercase tracking-widest min-h-[44px]"
          >
            <span className="material-symbols-outlined text-lg font-black">{showAdd ? 'close' : 'add'}</span>
            {showAdd ? 'Cancel' : 'Add Technician'}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Search by name, email, or status..."
            aria-label="Search technicians"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border-2 border-slate-700 focus:border-blue-500/50 rounded-xl pl-10 pr-4 py-3 min-h-[44px] text-sm text-white outline-none transition-colors placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-primary/20 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-in shadow-2xl">
            <input required placeholder="Technician Name" aria-label="Technician Name" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newTech.name} onChange={e => setNewTech({ ...newTech, name: e.target.value })} />
            <input required type="email" placeholder="Technician Email" aria-label="Technician Email" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newTech.email} onChange={e => setNewTech({ ...newTech, email: e.target.value })} />
            <button type="submit" className="md:col-span-2 bg-primary text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs">Add Technician</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechs.length === 0 ? (
            <div className="col-span-full py-20 bg-slate-900 border border-dashed border-white/5 rounded-3xl text-center opacity-40">
              <span className="material-symbols-outlined text-5xl mb-2 font-black">engineering</span>
              <p className="font-black uppercase tracking-widest text-[10px]">
                {searchQuery ? 'No technicians match your search.' : 'No field workforce registered.'}
              </p>
            </div>
          ) : (
            filteredTechs.map(tech => (
              <div key={tech.id} className="bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-blue-500/20 p-6 rounded-3xl space-y-4 hover:border-blue-500/50 transition-all group relative shadow-lg shadow-blue-500/10">
                {/* ID Badge and Status */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.15em] font-mono">Tech ID</p>
                    <p className="text-xs font-black text-white font-mono">{tech.id.toUpperCase().substring(0, 8)}</p>
                  </div>
                  <span className={`text-[8px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest whitespace-nowrap ml-2 ${tech.status === 'Authorised' ? 'bg-success/10 text-success border-success/30' : 'bg-slate-700/50 text-slate-300 border-slate-600/30'}`}>
                    {tech.status}
                  </span>
                </div>

                {/* Avatar and Name */}
                <div className="flex gap-3">
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black text-2xl uppercase flex-shrink-0 shadow-lg shadow-blue-500/30">
                    {tech.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-white uppercase text-sm tracking-tight group-hover:text-blue-400 transition-colors">{tech.name}</h3>
                    <p className="text-[10px] text-blue-300 font-mono truncate">{tech.email}</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Jobs Completed</p>
                    <p className="text-lg font-black text-white">{tech.jobsCompleted || 0}</p>
                  </div>
                  {tech.rating > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-amber-500">star</span>
                        Rating
                      </p>
                      <p className="text-lg font-black text-amber-400">{tech.rating.toFixed(1)}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setConfirmDeleteId(tech.id)}
                    disabled={deletingId === tech.id}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-2 border-red-500/20 hover:border-red-500/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove technician"
                  >
                    {deletingId === tech.id ? (
                      <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-xs">delete</span>
                    )}
                    <span className="hidden sm:inline">{deletingId === tech.id ? 'Deleting...' : 'Remove'}</span>
                  </button>
                  <button
                    onClick={() => navigate(`/admin/jobs?technician=${tech.id}`)}
                    className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-2 border-blue-500/30 hover:border-blue-500/50 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 min-h-[44px]"
                    title="View technician's jobs"
                  >
                    <span className="material-symbols-outlined text-xs">work</span>
                    <span className="hidden sm:inline">Jobs</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Confirm Delete Modal */}
        {confirmDeleteId && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="bg-slate-900 border-2 border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-400 text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Confirm Delete</h3>
                  <p className="text-sm text-slate-400">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Are you sure you want to delete technician <strong className="text-white">{techs.find(t => t.id === confirmDeleteId)?.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border-2 border-red-500/30 font-bold py-3 rounded-xl text-sm transition-colors min-h-[44px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TechniciansView;
