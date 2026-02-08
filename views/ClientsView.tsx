
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/AppLayout';
import { Client, UserProfile } from '../types';
import { navigateToNextStep } from '../lib/onboarding';
import { secureRandomString } from '../lib/secureId';

interface ClientsViewProps {
  user: UserProfile | null;
  clients: Client[];
  onAdd: (c: Client) => void;
  onDelete: (id: string) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ user, clients, onAdd, onDelete }) => {
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', address: '' });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: secureRandomString(9),
      ...newClient,
      totalJobs: 0
    });
    setNewClient({ name: '', email: '', address: '' });
    setShowAdd(false);

    // Trigger guided flow auto-navigation
    navigateToNextStep('CREATE_CLIENT', user?.persona, navigate);
  };

  const handleDelete = async (clientId: string) => {
    setDeletingId(clientId);
    setDeleteError(null);

    try {
      await onDelete(clientId);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete client');
      setDeletingId(null);
    }
  };

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {deleteError && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3 animate-in">
            <span className="material-symbols-outlined text-danger flex-shrink-0">error</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-danger">Failed to delete client</p>
              <p className="text-xs text-slate-300 mt-1">{deleteError}</p>
            </div>
            <button
              onClick={() => setDeleteError(null)}
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Dismiss error"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Client Registry</h2>
            <p className="text-slate-400">Primary organizational database for customer assets and service locations.</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-white px-5 py-3 min-h-[44px] rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2 uppercase tracking-wide whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-base">{showAdd ? 'close' : 'add'}</span>
            {showAdd ? 'Cancel' : 'Register Client'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-primary/20 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-in">
            <input required placeholder="Client Name" aria-label="Client Name" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
            <input required type="email" placeholder="Verification Email" aria-label="Verification Email" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
            <input required placeholder="Operational Address" aria-label="Operational Address" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} />
            <button type="submit" className="md:col-span-3 bg-primary text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest">Commit Registry Entry</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.length === 0 ? (
            <div className="col-span-full py-20 bg-slate-900 border border-dashed border-white/5 rounded-3xl text-center opacity-40">
              <span className="material-symbols-outlined text-5xl mb-2 font-black">person_add</span>
              <p className="font-black uppercase tracking-widest text-[10px]">Registry is empty.</p>
            </div>
          ) : (
            clients.map(client => (
              <div key={client.id} className="bg-gradient-to-br from-slate-900 to-slate-950 border border-orange-500/20 p-6 rounded-3xl space-y-4 hover:border-orange-500/50 transition-all group shadow-lg shadow-orange-500/10">
                {/* ID Badge and Job Count */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <p className="text-[8px] font-black text-orange-400 uppercase tracking-[0.15em] font-mono">Client ID</p>
                    <p className="text-xs font-black text-white font-mono">{client.id.toUpperCase().substring(0, 8)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Jobs</p>
                    <p className="text-xl font-black text-orange-400">{client.totalJobs || 0}</p>
                  </div>
                </div>

                {/* Organization Name */}
                <div>
                  <h3 className="font-black text-white uppercase text-sm tracking-tight group-hover:text-orange-400 transition-colors">{client.name}</h3>
                  <p className="text-[10px] text-orange-300 font-mono">{client.email}</p>
                </div>

                {/* Location and Details */}
                <div className="bg-white/5 rounded-2xl p-3 space-y-1 border border-white/5">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-xs text-slate-400 flex-shrink-0 mt-0.5">location_on</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{client.address}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleDelete(client.id)}
                    disabled={deletingId === client.id}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove client"
                  >
                    {deletingId === client.id ? (
                      <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-xs">delete</span>
                    )}
                    <span className="hidden sm:inline">{deletingId === client.id ? 'Deleting...' : 'Remove'}</span>
                  </button>
                  <button
                    onClick={() => navigate(`/admin/jobs?client=${client.id}`)}
                    className="flex-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:border-orange-500/50 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 min-h-[36px]"
                    title="View client's jobs"
                  >
                    <span className="material-symbols-outlined text-xs">work</span>
                    <span className="hidden sm:inline">Jobs</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientsView;
