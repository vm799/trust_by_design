/**
 * InvoiceDetail - Invoice Detail View
 *
 * Shows invoice details with send/mark paid actions.
 *
 * Phase I: Invoice Flow
 */

import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, EmptyState, LoadingSkeleton, ConfirmDialog } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { Invoice, Client, Job } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Use DataContext for state management
  const {
    invoices,
    clients,
    jobs,
    updateInvoice: contextUpdateInvoice,
    deleteInvoice: contextDeleteInvoice,
    isLoading: loading
  } = useData();

  // Memoized derivation from DataContext
  const invoice = useMemo(() => invoices.find(i => i.id === id) || null, [invoices, id]);
  const client = useMemo(() =>
    invoice ? clients.find(c => c.id === invoice.clientId) || null : null,
    [clients, invoice]
  );
  const job = useMemo(() =>
    invoice ? jobs.find(j => j.id === invoice.jobId) || null : null,
    [jobs, invoice]
  );

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleDelete = async () => {
    if (!invoice) return;

    setProcessing(true);
    try {
      contextDeleteInvoice(invoice.id);
      navigate(ROUTES.INVOICES);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    } finally {
      setProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;

    setProcessing(true);
    try {
      // Use DataContext updateInvoice with full Invoice object
      const updatedInvoice: Invoice = { ...invoice, paidAt: new Date().toISOString() };
      contextUpdateInvoice(updatedInvoice);
      setShowMarkPaidDialog(false);
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
      alert('Failed to update invoice. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Get status
  const getStatus = (): 'paid' | 'overdue' | 'pending' => {
    if (!invoice) return 'pending';
    if (invoice.paidAt) return 'paid';
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) return 'overdue';
    return 'pending';
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Invoice" backTo={ROUTES.INVOICES} backLabel="Invoices" />
        <PageContent>
          <LoadingSkeleton variant="card" count={2} />
        </PageContent>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <PageHeader title="Invoice Not Found" backTo={ROUTES.INVOICES} backLabel="Invoices" />
        <PageContent>
          <EmptyState
            icon="receipt_long"
            title="Invoice not found"
            description="The invoice you're looking for doesn't exist or has been deleted."
            action={{ label: 'Back to Invoices', to: ROUTES.INVOICES }}
          />
        </PageContent>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div>
      <PageHeader
        title={invoice.number || `INV-${invoice.id.slice(0, 6).toUpperCase()}`}
        backTo={ROUTES.INVOICES}
        backLabel="Invoices"
        actions={[
          ...(status !== 'paid' ? [{
            label: 'Mark as Paid',
            icon: 'check_circle',
            onClick: () => setShowMarkPaidDialog(true),
            variant: 'primary' as const,
          }] : []),
          { label: 'Send', icon: 'send', variant: 'secondary' as const },
          { label: 'Download PDF', icon: 'download', variant: 'secondary' as const },
          { label: 'Delete', icon: 'delete', onClick: () => setShowDeleteDialog(true), variant: 'danger' as const },
        ]}
      />

      <PageContent>
        {/* Status Banner */}
        <div className={`
          p-4 rounded-2xl mb-6 flex items-center gap-4
          ${status === 'paid' ? 'bg-green-500/10 border border-green-500/20' :
            status === 'overdue' ? 'bg-red-500/10 border border-red-500/20' :
            'bg-orange-500/10 border border-orange-500/20'}
        `}>
          <div className={`
            size-12 rounded-xl flex items-center justify-center
            ${status === 'paid' ? 'bg-green-500/20 text-green-400' :
              status === 'overdue' ? 'bg-red-500/20 text-red-400' :
              'bg-orange-500/20 text-orange-400'}
          `}>
            <span className="material-symbols-outlined text-2xl">
              {status === 'paid' ? 'check_circle' :
               status === 'overdue' ? 'warning' :
               'schedule'}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">
              {status === 'paid' ? 'Paid' :
               status === 'overdue' ? 'Overdue' :
               'Pending Payment'}
            </p>
            <p className="text-sm text-slate-400">
              {status === 'paid' && invoice.paidAt
                ? `Paid on ${new Date(invoice.paidAt).toLocaleDateString('en-AU')}`
                : status === 'overdue' && invoice.dueDate
                ? `Was due ${new Date(invoice.dueDate).toLocaleDateString('en-AU')}`
                : invoice.dueDate
                ? `Due ${new Date(invoice.dueDate).toLocaleDateString('en-AU')}`
                : 'No due date set'}
            </p>
          </div>
          <p className="text-2xl font-bold text-white">
            ${(invoice.total || 0).toFixed(2)}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Line Items */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Line Items
              </h3>
              {invoice.items && invoice.items.length > 0 ? (
                <div className="space-y-3">
                  {invoice.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-white">{item.description}</p>
                        <p className="text-sm text-slate-400">
                          {item.quantity} x ${item.unitPrice?.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium text-white">
                        ${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <p className="font-semibold text-white">Total</p>
                    <p className="text-xl font-bold text-white">
                      ${(invoice.total || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No line items</p>
              )}
            </Card>

            {/* Notes */}
            {invoice.notes && (
              <Card>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  Notes
                </h3>
                <p className="text-white whitespace-pre-wrap">{invoice.notes}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Bill To
              </h3>
              {client ? (
                <Link to={route(ROUTES.CLIENT_DETAIL, { id: client.id })}>
                  <div className="hover:bg-white/5 -m-2 p-2 rounded-lg transition-colors">
                    <p className="font-medium text-white">{client.name}</p>
                    {client.address && (
                      <p className="text-sm text-slate-400 mt-1">{client.address}</p>
                    )}
                    {client.email && (
                      <p className="text-sm text-slate-400">{client.email}</p>
                    )}
                  </div>
                </Link>
              ) : (
                <p className="text-slate-400">No client assigned</p>
              )}
            </Card>

            {/* Related Job */}
            {job && (
              <Card>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  Related Job
                </h3>
                <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
                  <div className="hover:bg-white/5 -m-2 p-2 rounded-lg transition-colors">
                    <p className="font-medium text-white">
                      {job.title || `Job #${job.id.slice(0, 6)}`}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {new Date(job.date).toLocaleDateString('en-AU')}
                    </p>
                    {job.sealedAt && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="material-symbols-outlined text-sm text-emerald-400">verified</span>
                        <span className="text-xs text-emerald-400">Sealed</span>
                      </div>
                    )}
                  </div>
                </Link>
              </Card>
            )}

            {/* Invoice Details */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Invoice Number</span>
                  <span className="text-white">{invoice.number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created</span>
                  <span className="text-white">
                    {invoice.createdAt
                      ? new Date(invoice.createdAt).toLocaleDateString('en-AU')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Due Date</span>
                  <span className="text-white">
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString('en-AU')
                      : '-'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </PageContent>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={processing}
      />

      {/* Mark Paid Confirmation */}
      <ConfirmDialog
        isOpen={showMarkPaidDialog}
        onClose={() => setShowMarkPaidDialog(false)}
        onConfirm={handleMarkPaid}
        title="Mark as Paid"
        message="Mark this invoice as paid? This will update the invoice status."
        confirmLabel="Mark as Paid"
        variant="info"
        icon="check_circle"
        loading={processing}
      />
    </div>
  );
};

export default InvoiceDetail;
