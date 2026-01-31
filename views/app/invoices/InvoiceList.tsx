/**
 * InvoiceList - Invoice Management List View
 *
 * Displays all invoices with status filtering.
 * REMEDIATION ITEM 10: Added error state with retry UI
 *
 * Phase I: Invoice Flow
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, StatusBadge, EmptyState, ErrorState, LoadingSkeleton } from '../../../components/ui';
import { getInvoices, getClients, getJobs } from '../../../hooks/useWorkspaceData';
import { Invoice, Client, Job } from '../../../types';
import { ROUTES } from '../../../lib/routes';

type StatusType = 'pending' | 'paid' | 'overdue';
type FilterStatus = 'all' | StatusType;

const InvoiceList: React.FC = () => {
  useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  // REMEDIATION ITEM 10
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  // REMEDIATION ITEM 10: Extracted loadData for retry functionality
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoicesData, clientsData, jobsData] = await Promise.all([
        getInvoices(),
        getClients(),
        getJobs(),
      ]);
      setInvoices(invoicesData);
      setClients(clientsData);
      setJobs(jobsData);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError('Failed to load invoices. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get invoice status
  const getInvoiceStatus = (invoice: Invoice): StatusType => {
    if (invoice.paidAt) return 'paid';
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) return 'overdue';
    return 'pending';
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (statusFilter !== 'all') {
      result = result.filter(inv => getInvoiceStatus(inv) === statusFilter);
    }

    // Sort by date (newest first)
    return result.sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [invoices, statusFilter]);

  // Get totals
  const totals = useMemo(() => {
    return {
      all: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      pending: invoices.filter(inv => getInvoiceStatus(inv) === 'pending').reduce((sum, inv) => sum + (inv.total || 0), 0),
      paid: invoices.filter(inv => getInvoiceStatus(inv) === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0),
      overdue: invoices.filter(inv => getInvoiceStatus(inv) === 'overdue').reduce((sum, inv) => sum + (inv.total || 0), 0),
    };
  }, [invoices]);

  // REMEDIATION ITEM 7: Memoize lookups to avoid O(n) find() calls in render loop
  const clientsById = useMemo(() => {
    const map: Record<string, Client> = {};
    for (const client of clients) {
      map[client.id] = client;
    }
    return map;
  }, [clients]);

  const jobsById = useMemo(() => {
    const map: Record<string, Job> = {};
    for (const job of jobs) {
      map[job.id] = job;
    }
    return map;
  }, [jobs]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Invoices" />
        <PageContent>
          <LoadingSkeleton variant="list" count={5} />
        </PageContent>
      </div>
    );
  }

  // REMEDIATION ITEM 10: Show error state with retry
  if (error) {
    return (
      <div>
        <PageHeader title="Invoices" />
        <PageContent>
          <ErrorState
            title="Failed to load invoices"
            message={error}
            onRetry={loadData}
            secondaryAction={{ label: 'Go Back', onClick: () => window.history.back(), icon: 'arrow_back' }}
          />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
      >
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all' as FilterStatus, label: 'All', color: 'bg-slate-500/10 text-slate-400' },
            { value: 'pending' as FilterStatus, label: 'Pending', color: 'bg-orange-500/10 text-orange-400' },
            { value: 'paid' as FilterStatus, label: 'Paid', color: 'bg-green-500/10 text-green-400' },
            { value: 'overdue' as FilterStatus, label: 'Overdue', color: 'bg-red-500/10 text-red-400' },
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`
                px-3 py-1.5 text-sm rounded-lg transition-all
                ${statusFilter === filter.value
                  ? 'bg-primary text-white'
                  : filter.color + ' hover:opacity-80'}
              `}
            >
              {filter.label}
              <span className="ml-1.5 opacity-70">
                ${totals[filter.value].toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      </PageHeader>

      <PageContent>
        {filteredInvoices.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No invoices"
            description="Invoices will appear here when you generate them from sealed jobs."
          />
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map(invoice => {
              // REMEDIATION ITEM 7: Use memoized lookups instead of O(n) find()
              const client = invoice.clientId ? clientsById[invoice.clientId] : undefined;
              const job = invoice.jobId ? jobsById[invoice.jobId] : undefined;
              const status = getInvoiceStatus(invoice);

              return (
                <Link key={invoice.id} to={route(ROUTES.INVOICE_DETAIL, { id: invoice.id })}>
                  <Card variant="interactive">
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`
                        size-12 rounded-xl flex items-center justify-center shrink-0
                        ${status === 'paid' ? 'bg-green-500/10 text-green-400' :
                          status === 'overdue' ? 'bg-red-500/10 text-red-400' :
                          'bg-orange-500/10 text-orange-400'}
                      `}>
                        <span className="material-symbols-outlined text-2xl">
                          {status === 'paid' ? 'check_circle' :
                           status === 'overdue' ? 'warning' :
                           'schedule'}
                        </span>
                      </div>

                      {/* Invoice Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white">
                            {invoice.number || `INV-${invoice.id.slice(0, 6).toUpperCase()}`}
                          </p>
                          <StatusBadge status={status} variant="compact" />
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {client?.name || 'Unknown client'}
                          {job && ` • ${job.title || `Job #${job.id.slice(0, 6)}`}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {invoice.createdAt &&
                            new Date(invoice.createdAt).toLocaleDateString('en-AU', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          {invoice.dueDate && ` • Due ${new Date(invoice.dueDate).toLocaleDateString('en-AU', {
                            month: 'short',
                            day: 'numeric',
                          })}`}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">
                          ${(invoice.total || 0).toFixed(2)}
                        </p>
                      </div>

                      <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageContent>
    </div>
  );
};

export default InvoiceList;
