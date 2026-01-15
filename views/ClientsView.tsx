
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Client } from '../types';

interface ClientsViewProps {
  clients: Client[];
  onAdd: (c: Client) => void;
  onDelete: (id: string) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ clients, onAdd, onDelete }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', address: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      ...newClient,
      totalJobs: 0
    });
    setNewClient({ name: '', email: '', address: '' });
    setShowAdd(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Client Registry</h2>
             <p className="text-slate-400">Core database for customer assets and service locations.</p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-black hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">{showAdd ? 'close' : 'add'}</span>
            {showAdd ? 'Cancel' : 'Register Client'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-primary/20 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-in">
             <input required placeholder="Organization Name" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
             <input required type="email" placeholder="Billing Email" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
             <input required placeholder="Primary Service Address" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} />
             <button type="submit" className="md:col-span-3 bg-primary text-white font-black py-3 rounded-xl">Initialize Client Identity</button>
          </form>
        )}

        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          {clients.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-4 opacity-40">
              <span className="material-symbols-outlined text-6xl">person_add</span>
              <p className="font-bold">Registry is currently empty.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Organization</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Service Area</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Verification Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                       <p className="font-bold text-white group-hover:text-primary transition-colors">{client.name}</p>
                       <p className="text-xs text-slate-500">{client.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{client.address}</td>
                    <td className="px-6 py-4">
                       <span className="bg-success/5 text-success text-[10px] font-black px-2 py-0.5 rounded-md border border-success/10">ACTIVE REGISTRY</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onDelete(client.id)}
                        className="material-symbols-outlined text-slate-600 hover:text-red-500 transition-colors"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientsView;
