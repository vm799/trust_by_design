
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isAdmin = true }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  if (!isAdmin) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 font-sans selection:bg-primary/30">
        <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="bg-primary size-7 rounded-md flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm">verified</span>
              </div>
              <div>
                <h1 className="text-sm font-black leading-none tracking-tight">JobProof</h1>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Field Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 bg-success rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connected</span>
            </div>
          </div>
        </header>
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 pb-32">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 relative">
      {/* Desktop Sidebar */}
      <aside className="w-72 hidden lg:flex flex-col border-r border-white/5 bg-slate-950/50 backdrop-blur-md">
        <div className="p-8">
          <Link to="/home" className="flex items-center gap-3 group">
            <div className="bg-primary size-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-all">
              <span className="material-symbols-outlined text-white text-xl">verified</span>
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">JobProof</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-6 space-y-2 overflow-y-auto pb-8">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 mt-8 px-3 text-white/40">Main Menu</div>
          <NavLink to="/admin" icon="dashboard" label="Dashboard" active={location.pathname === '/admin'} id="nav-dashboard" />
          <NavLink to="/admin/clients" icon="group" label="Clients" active={location.pathname === '/admin/clients'} id="nav-clients" />
          <NavLink to="/admin/technicians" icon="engineering" label="Technicians" active={location.pathname === '/admin/technicians'} id="nav-techs" />
          <NavLink to="/admin/templates" icon="assignment" label="Job Templates" active={location.pathname === '/admin/templates'} />
          
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 mt-8 px-3 text-white/40">Account & Billing</div>
          <NavLink to="/admin/billing" icon="payments" label="Subscription" active={location.pathname === '/admin/billing'} />
          <NavLink to="/admin/settings" icon="settings" label="Workspace Settings" active={location.pathname === '/admin/settings'} id="nav-settings" />
          
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 mt-8 px-3 text-white/40">Support</div>
          <NavLink to="/admin/help" icon="help_center" label="Help Center" active={location.pathname === '/admin/help'} />
          <NavLink to="/docs/audit" icon="description" label="System Audit" active={location.pathname === '/docs/audit'} />
        </nav>

        <div className="p-6 border-t border-white/5">
          <Link to="/admin/profile" className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${location.pathname === '/admin/profile' ? 'bg-primary/10 border-primary/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-black text-white">A</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">Alex Sterling</p>
              <p className="text-[10px] text-slate-500 truncate uppercase font-black tracking-widest">Enterprise</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden bg-slate-950/90 backdrop-blur-xl animate-in">
           <div className="flex flex-col h-full p-6">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex items-center gap-3">
                    <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-white"><span className="material-symbols-outlined text-sm">verified</span></div>
                    <span className="text-xl font-black text-white">JobProof</span>
                 </div>
                 <button onClick={toggleMobileMenu} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white"><span className="material-symbols-outlined">close</span></button>
              </div>
              <nav className="flex-1 space-y-4">
                 <MobileNavLink to="/admin" icon="dashboard" label="Dashboard" onClick={toggleMobileMenu} />
                 <MobileNavLink to="/admin/clients" icon="group" label="Clients" onClick={toggleMobileMenu} />
                 <MobileNavLink to="/admin/technicians" icon="engineering" label="Technicians" onClick={toggleMobileMenu} />
                 <MobileNavLink to="/admin/billing" icon="payments" label="Subscription" onClick={toggleMobileMenu} />
                 <MobileNavLink to="/admin/settings" icon="settings" label="Workspace" onClick={toggleMobileMenu} />
                 <MobileNavLink to="/admin/help" icon="help_center" label="Support" onClick={toggleMobileMenu} />
              </nav>
              <Link to="/admin/profile" onClick={toggleMobileMenu} className="mt-8 p-4 bg-white/5 rounded-2xl flex items-center gap-3">
                 <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white font-black">A</div>
                 <span className="text-sm font-bold text-white">Alex Sterling</span>
              </Link>
           </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto relative">
        <header className="h-16 lg:h-20 border-b border-white/5 flex items-center justify-between px-6 lg:px-12 bg-slate-950/50 backdrop-blur sticky top-0 z-40">
           <div className="flex items-center gap-4">
              <button onClick={toggleMobileMenu} className="lg:hidden text-white"><span className="material-symbols-outlined">menu</span></button>
              <h1 className="text-lg lg:text-xl font-black text-white tracking-tight italic">
                {location.pathname === '/admin' ? 'Operations Control' : 
                 location.pathname === '/admin/clients' ? 'Client Registry' :
                 location.pathname === '/admin/technicians' ? 'Technicians' :
                 location.pathname === '/admin/templates' ? 'Templates' : 
                 location.pathname === '/admin/billing' ? 'Billing' : 
                 location.pathname === '/admin/profile' ? 'My Profile' :
                 location.pathname === '/admin/help' ? 'Help Center' : 'System View'}
              </h1>
           </div>
           <div className="flex items-center gap-3">
             <Link to="/admin/create" id="btn-dispatch" className="bg-primary hover:bg-primary-hover text-white text-xs lg:text-sm font-black px-4 lg:px-6 py-2 lg:py-3 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm lg:text-base">add</span>
                <span className="hidden sm:inline">Dispatch Job</span>
                <span className="sm:hidden">Dispatch</span>
             </Link>
           </div>
        </header>
        <main className="p-6 lg:p-12 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: string, label: string, active?: boolean, id?: string }> = ({ to, icon, label, active, id }) => (
  <Link to={to} id={id} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-primary/10 text-primary border border-primary/20 shadow-inner' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <span className="material-symbols-outlined">{icon}</span>
    <span className="text-sm font-bold">{label}</span>
  </Link>
);

const MobileNavLink: React.FC<{ to: string, icon: string, label: string, onClick: () => void }> = ({ to, icon, label, onClick }) => (
  <Link to={to} onClick={onClick} className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 text-white font-black uppercase text-xs tracking-widest active:bg-primary/20 transition-all">
    <span className="material-symbols-outlined text-primary">{icon}</span>
    {label}
  </Link>
);

export default Layout;
