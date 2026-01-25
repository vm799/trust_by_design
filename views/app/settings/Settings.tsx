/**
 * Settings - Settings Hub
 *
 * Main settings page with links to sub-settings.
 *
 * Phase A: Foundation
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, ConfirmDialog } from '../../../components/ui';
import { useAuth } from '../../../lib/AuthContext';
import { signOut } from '../../../lib/auth';
import { ROUTES } from '../../../lib/routes';
import { useNavigation } from '../../../hooks/useNavigation';

interface SettingsSection {
  title: string;
  description: string;
  icon: string;
  to?: string;
  onClick?: () => void;
  color?: string;
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { goBack } = useNavigation('/admin');
  const { userEmail } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to log out. Please try again.');
    } finally {
      setLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  const settingsSections: SettingsSection[] = [
    {
      title: 'Workspace',
      description: 'Company name, logo, and general settings',
      icon: 'business',
      to: ROUTES.SETTINGS_WORKSPACE,
    },
    {
      title: 'Billing & Subscription',
      description: 'Manage your subscription and payment methods',
      icon: 'credit_card',
      to: ROUTES.SETTINGS_BILLING,
    },
    {
      title: 'Team Members',
      description: 'Invite and manage team members',
      icon: 'group',
      to: ROUTES.SETTINGS_TEAM,
    },
    {
      title: 'Technicians',
      description: 'Manage field technicians',
      icon: 'engineering',
      to: ROUTES.TECHNICIANS,
    },
    {
      title: 'Notifications',
      description: 'Email and push notification preferences',
      icon: 'notifications',
      to: ROUTES.SETTINGS + '/notifications',
    },
    {
      title: 'Integrations',
      description: 'Connect with other apps and services',
      icon: 'extension',
      to: ROUTES.SETTINGS + '/integrations',
    },
  ];

  return (
    <div>
      {/* Back Button */}
      <div className="px-6 pt-4">
        <button
          onClick={() => goBack()}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back
        </button>
      </div>

      <PageHeader
        title="Settings"
        subtitle="Manage your workspace and preferences"
      />

      <PageContent>
        {/* User Profile Card */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {userEmail?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <p className="text-lg font-medium text-white">{userEmail}</p>
              <p className="text-sm text-slate-400">Account Owner</p>
            </div>
            <ActionButton
              variant="danger"
              icon="logout"
              onClick={() => setShowLogoutDialog(true)}
            >
              Sign Out
            </ActionButton>
          </div>
        </Card>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingsSections.map((section, i) => (
            <Link key={i} to={section.to || '#'}>
              <Card variant="interactive" className="h-full">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl text-slate-400">
                      {section.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{section.title}</p>
                    <p className="text-sm text-slate-400 mt-1">{section.description}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Danger Zone */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Danger Zone
          </h3>
          <Card className="border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Delete Workspace</p>
                <p className="text-sm text-slate-400">
                  Permanently delete your workspace and all data
                </p>
              </div>
              <ActionButton variant="danger">
                Delete Workspace
              </ActionButton>
            </div>
          </Card>
        </div>
      </PageContent>

      {/* Logout Confirmation */}
      <ConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        variant="warning"
        icon="logout"
        loading={loggingOut}
      />
    </div>
  );
};

export default Settings;
