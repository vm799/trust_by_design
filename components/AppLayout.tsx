import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { JobProofLogo } from './branding/jobproof-logo';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user?: UserProfile | null;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = React.memo(({ children, user, isAdmin = true }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen(prev => !prev), []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-primary/30 transition-colors">
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-4 py-4 transition-colors">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <JobProofLogo variant="full" size="sm" showTagline={false} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Secure Evidence Capture</span>
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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 relative transition-colors">
      {/* Desktop Sidebar */}
      <aside className="w-72 hidden lg:flex flex-col border-r border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md transition-colors">
        <div className="p-8">
          <Link to="/home" className="group">
            <JobProofLogo variant="full" size="md" className="transition-transform group-hover:scale-105" />
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto pb-8">
          <div className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] mb-4 mt-8 px-3">Management</div>
          <NavLink to="/admin" icon="dashboard" label="Dashboard" active={location.pathname === '/admin'} id="nav-dashboard" />
          <NavLink to="/admin/clients" icon="group" label="Clients" active={location.pathname === '/admin/clients'} id="nav-clients" />
          <NavLink to="/admin/technicians" icon="engineering" label="Technicians" active={location.pathname === '/admin/technicians'} id="nav-techs" />

          <div className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] mb-4 mt-8 px-3">Financials</div>
          <NavLink to="/admin/invoices" icon="receipt_long" label="Invoices" active={location.pathname === '/admin/invoices'} />

          <div className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] mb-4 mt-8 px-3">System</div>
          <NavLink to="/admin/settings" icon="settings" label="Settings" active={location.pathname === '/admin/settings'} id="nav-settings" />
          <NavLink to="/admin/help" icon="help_center" label="Help Center" active={location.pathname === '/admin/help'} />
        </nav>

        <div className="p-6 border-t border-white/5">
          <Link to="/admin/profile" className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${location.pathname === '/admin/profile' ? 'bg-primary/10 border-primary/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-black text-white">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{user?.name || 'User'}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-300 truncate uppercase font-black tracking-widest">
                  {user?.persona?.replace(/_/g, ' ') || user?.role || 'Member'}
                </p>
                {user?.persona && (
                  <span className="text-[8px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                    Active
                  </span>
                )}
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl animate-in transition-colors">
          <div className="flex flex-col h-full p-6">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-white"><span className="material-symbols-outlined text-sm font-black">verified</span></div>
                <span className="text-xl font-black text-slate-900 dark:text-white uppercase">JobProof</span>
              </div>
              <button
                onClick={toggleMobileMenu}
                className="min-h-[44px] min-w-[44px] rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-900 dark:text-white"
                aria-label="Close navigation menu"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <nav className="flex-1 space-y-4">
              <MobileNavLink to="/admin" icon="dashboard" label="Dashboard" onClick={toggleMobileMenu} />
              <MobileNavLink to="/admin/clients" icon="group" label="Clients" onClick={toggleMobileMenu} />
              <MobileNavLink to="/admin/technicians" icon="engineering" label="Technicians" onClick={toggleMobileMenu} />
              <MobileNavLink to="/admin/invoices" icon="receipt_long" label="Invoices" onClick={toggleMobileMenu} />
              <MobileNavLink to="/admin/settings" icon="settings" label="Settings" onClick={toggleMobileMenu} />
            </nav>
            <Link to="/admin/profile" onClick={toggleMobileMenu} className="mt-8 p-4 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white font-black">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name || 'User'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate uppercase font-bold">
                    {user?.persona?.replace(/_/g, ' ') || user?.role || 'Member'}
                  </p>
                  {user?.persona && (
                    <span className="text-[8px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-bold">
                      Active
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto relative text-slate-900 dark:text-slate-100 transition-colors">
        <header className="h-16 lg:h-20 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 lg:px-12 bg-white/50 dark:bg-slate-950/50 backdrop-blur sticky top-0 z-40 transition-colors">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden text-slate-900 dark:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-3">
              {location.pathname !== '/admin' && (
                <Link
                  to="/admin"
                  className="size-9 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                  aria-label="Back to Dashboard"
                >
                  <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-lg" aria-hidden="true">arrow_back</span>
                </Link>
              )}
              <h1 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                {location.pathname === '/admin' ? 'Dashboard' :
                  location.pathname === '/admin/create' ? 'Create Job' :
                    location.pathname === '/admin/clients' ? 'Clients' :
                      location.pathname === '/admin/technicians' ? 'Technicians' :
                        location.pathname === '/admin/templates' ? 'Protocols' :
                          location.pathname === '/admin/invoices' ? 'Invoices' :
                            location.pathname === '/admin/profile' ? 'Profile' :
                              location.pathname === '/admin/help' ? 'Support' :
                                location.pathname.startsWith('/admin/report/') ? 'Job Report' : 'Settings'}
              </h1>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/create"
              id="btn-dispatch"
              className="bg-primary hover:bg-primary-hover text-white text-xs lg:text-sm font-black min-h-[44px] min-w-[44px] px-4 lg:px-5 py-2.5 lg:py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95"
              aria-label="Create new job"
            >
              <span className="material-symbols-outlined text-base font-black" aria-hidden="true">add</span>
              <span className="hidden sm:inline tracking-widest uppercase">New Job</span>
            </Link>
          </div>
        </header>
        <main className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
});

Layout.displayName = 'Layout';

const NavLink: React.FC<{ to: string, icon: string, label: string, active?: boolean, id?: string }> = React.memo(({ to, icon, label, active, id }) => (
  <Link
    to={to}
    id={id}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-primary/10 text-primary border border-primary/20 shadow-inner' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
    aria-current={active ? 'page' : undefined}
  >
    <span className="material-symbols-outlined font-black">{icon}</span>
    <span className="text-sm font-medium tracking-widest">{label}</span>
  </Link>
));

NavLink.displayName = 'NavLink';

const MobileNavLink: React.FC<{ to: string, icon: string, label: string, onClick: () => void }> = React.memo(({ to, icon, label, onClick }) => (
  <Link to={to} onClick={onClick} className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-black uppercase text-xs tracking-widest active:bg-primary/20 transition-all">
    <span className="material-symbols-outlined text-primary font-black">{icon}</span>
    {label}
  </Link>
));

MobileNavLink.displayName = 'MobileNavLink';

export default Layout;
