/**
 * AuditLogViewer Component
 *
 * Displays audit trail for a job showing all evidence state changes.
 * Critical for legal defensibility and chain of custody review.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AuditEvent,
  AuditEventType,
  getAuditEventsForJob,
  verifyAuditChain
} from '../lib/auditLog';

interface AuditLogViewerProps {
  jobId: string;
  onClose?: () => void;
  compact?: boolean;
}

// Event type metadata for display
const EVENT_METADATA: Record<AuditEventType, {
  icon: string;
  label: string;
  color: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
}> = {
  // Job lifecycle
  JOB_ACCESSED: { icon: 'login', label: 'Job Accessed', color: 'text-slate-500 dark:text-slate-400', severity: 'info' },
  JOB_STARTED: { icon: 'play_arrow', label: 'Job Started', color: 'text-primary', severity: 'info' },
  JOB_SUBMITTED: { icon: 'check_circle', label: 'Job Submitted', color: 'text-success', severity: 'success' },
  JOB_SEALED: { icon: 'lock', label: 'Job Sealed', color: 'text-success', severity: 'success' },
  JOB_REOPENED: { icon: 'lock_open', label: 'Job Reopened', color: 'text-warning', severity: 'warning' },
  // Photo events
  PHOTO_CAPTURED: { icon: 'photo_camera', label: 'Photo Captured', color: 'text-primary', severity: 'info' },
  PHOTO_DELETED: { icon: 'delete', label: 'Photo Deleted', color: 'text-warning', severity: 'warning' },
  PHOTO_SYNCED: { icon: 'cloud_done', label: 'Photo Synced', color: 'text-success', severity: 'success' },
  PHOTO_SYNC_FAILED: { icon: 'cloud_off', label: 'Photo Sync Failed', color: 'text-danger', severity: 'danger' },
  // Signature events
  SIGNATURE_CAPTURED: { icon: 'draw', label: 'Signature Captured', color: 'text-primary', severity: 'info' },
  SIGNATURE_CLEARED: { icon: 'backspace', label: 'Signature Cleared', color: 'text-warning', severity: 'warning' },
  SIGNATURE_FINALIZED: { icon: 'verified', label: 'Signature Finalized', color: 'text-success', severity: 'success' },
  // Location events
  LOCATION_CAPTURED: { icon: 'my_location', label: 'GPS Location Verified', color: 'text-success', severity: 'success' },
  LOCATION_MANUAL_ENTRY: { icon: 'edit_location', label: 'Manual Location Entry', color: 'text-warning', severity: 'warning' },
  LOCATION_DENIED: { icon: 'location_off', label: 'Location Access Denied', color: 'text-danger', severity: 'danger' },
  LOCATION_MOCK_FALLBACK: { icon: 'warning', label: 'Mock Location Used', color: 'text-danger', severity: 'danger' },
  // Safety checklist
  CHECKLIST_ITEM_CHECKED: { icon: 'check_box', label: 'Checklist Completed', color: 'text-success', severity: 'success' },
  CHECKLIST_ITEM_UNCHECKED: { icon: 'check_box_outline_blank', label: 'Checklist Unchecked', color: 'text-warning', severity: 'warning' },
  // Notes
  NOTES_UPDATED: { icon: 'edit_note', label: 'Notes Updated', color: 'text-slate-500 dark:text-slate-400', severity: 'info' },
  // Sync events
  SYNC_STARTED: { icon: 'sync', label: 'Sync Started', color: 'text-primary', severity: 'info' },
  SYNC_COMPLETED: { icon: 'cloud_done', label: 'Sync Completed', color: 'text-success', severity: 'success' },
  SYNC_FAILED: { icon: 'sync_problem', label: 'Sync Failed', color: 'text-danger', severity: 'danger' },
  // Security events
  TOKEN_VALIDATED: { icon: 'key', label: 'Token Validated', color: 'text-success', severity: 'success' },
  TOKEN_EXPIRED: { icon: 'timer_off', label: 'Token Expired', color: 'text-warning', severity: 'warning' },
  TOKEN_INVALID: { icon: 'key_off', label: 'Invalid Token', color: 'text-danger', severity: 'danger' },
  UNAUTHORIZED_ACCESS_ATTEMPT: { icon: 'gpp_bad', label: 'Unauthorized Access', color: 'text-danger', severity: 'danger' },
};

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  jobId,
  onClose,
  compact = false,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [chainEventCount, setChainEventCount] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Load audit events
  useEffect(() => {
    const loadEvents = async () => {
      const jobEvents = getAuditEventsForJob(jobId);
      setEvents(jobEvents);

      // Verify chain integrity
      const verification = await verifyAuditChain(jobId);
      setChainValid(verification.valid);
      setChainEventCount(verification.events);
    };

    loadEvents();
  }, [jobId]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;

    const filterMap: Record<string, AuditEventType[]> = {
      photos: ['PHOTO_CAPTURED', 'PHOTO_DELETED', 'PHOTO_SYNCED', 'PHOTO_SYNC_FAILED'],
      signatures: ['SIGNATURE_CAPTURED', 'SIGNATURE_CLEARED', 'SIGNATURE_FINALIZED'],
      location: ['LOCATION_CAPTURED', 'LOCATION_MANUAL_ENTRY', 'LOCATION_DENIED', 'LOCATION_MOCK_FALLBACK'],
      security: ['TOKEN_VALIDATED', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'UNAUTHORIZED_ACCESS_ATTEMPT'],
      warnings: events.filter(e => {
        const meta = EVENT_METADATA[e.eventType];
        return meta && (meta.severity === 'warning' || meta.severity === 'danger');
      }).map(e => e.eventType) as AuditEventType[],
    };

    const allowedTypes = filterMap[filter];
    if (allowedTypes) {
      return events.filter(e => allowedTypes.includes(e.eventType));
    }
    return events;
  }, [events, filter]);

  // Format timestamp - British English with UTC timezone
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + ' UTC',
    };
  };

  // Get severity background color
  const getSeverityBg = (severity: 'info' | 'success' | 'warning' | 'danger') => {
    switch (severity) {
      case 'success': return 'bg-success/10';
      case 'warning': return 'bg-warning/10';
      case 'danger': return 'bg-danger/10';
      default: return 'bg-gray-100 dark:bg-slate-800';
    }
  };

  // Count warnings/errors
  const warningCount = useMemo(() => {
    return events.filter(e => {
      const meta = EVENT_METADATA[e.eventType];
      return meta && (meta.severity === 'warning' || meta.severity === 'danger');
    }).length;
  }, [events]);

  if (compact) {
    // Compact view for inline display
    return (
      <div className="bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">Audit Trail</span>
          </div>
          <div className="flex items-center gap-2">
            {chainValid !== null && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                chainValid ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              }`}>
                <span className="material-symbols-outlined text-xs">
                  {chainValid ? 'verified' : 'gpp_bad'}
                </span>
                {chainValid ? 'Valid' : 'Broken'}
              </div>
            )}
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{events.length} events</span>
          </div>
        </div>

        {/* Recent events */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {events.slice(-5).reverse().map(event => {
            const meta = EVENT_METADATA[event.eventType];
            const ts = formatTimestamp(event.timestamp);
            return (
              <div key={event.id} className="flex items-center gap-3 text-xs">
                <span className={`material-symbols-outlined text-sm ${meta?.color || 'text-slate-500 dark:text-slate-400'}`}>
                  {meta?.icon || 'info'}
                </span>
                <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">{meta?.label || event.eventType}</span>
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">{ts.time}</span>
              </div>
            );
          })}
        </div>

        {warningCount > 0 && (
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-warning text-sm">warning</span>
            <span className="text-xs text-warning">{warningCount} warning{warningCount > 1 ? 's' : ''} detected</span>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="fixed inset-0 z-[150] bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">history</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Audit Trail</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Job: {jobId}</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">close</span>
              </button>
            )}
          </div>

          {/* Chain verification badge */}
          <div className="flex items-center gap-3 mt-4">
            {chainValid !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                chainValid
                  ? 'bg-success/10 border border-success/20 text-success'
                  : 'bg-danger/10 border border-danger/20 text-danger'
              }`}>
                <span className="material-symbols-outlined text-sm">
                  {chainValid ? 'verified' : 'gpp_bad'}
                </span>
                {chainValid ? 'Chain Integrity Verified' : 'Chain Integrity Broken'}
              </div>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">{chainEventCount} events in chain</span>
            {warningCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 text-warning text-xs">
                <span className="material-symbols-outlined text-xs">warning</span>
                {warningCount} warning{warningCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-white/15 flex gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'photos', label: 'Photos' },
            { id: 'signatures', label: 'Signatures' },
            { id: 'location', label: 'Location' },
            { id: 'security', label: 'Security' },
            { id: 'warnings', label: 'Warnings' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-colors whitespace-nowrap ${
                filter === f.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">history</span>
              <p className="text-slate-500 dark:text-slate-400 text-sm">No audit events found</p>
            </div>
          ) : (
            filteredEvents.map((event, index) => {
              const meta = EVENT_METADATA[event.eventType];
              const ts = formatTimestamp(event.timestamp);
              const isExpanded = expandedEvent === event.id;
              const isLast = index === filteredEvents.length - 1;

              return (
                <div key={event.id} className="relative">
                  {/* Timeline connector */}
                  {!isLast && (
                    <div className="absolute left-5 top-12 w-px h-[calc(100%-2rem)] bg-gray-100 dark:bg-slate-800" />
                  )}

                  <button
                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isExpanded
                        ? 'bg-gray-100 dark:bg-slate-800 border-slate-300 dark:border-white/20'
                        : `${getSeverityBg(meta?.severity || 'info')} border-slate-200 dark:border-white/15 hover:border-slate-200 dark:hover:border-white/10`
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        meta?.severity === 'danger' ? 'bg-danger/20' :
                        meta?.severity === 'warning' ? 'bg-warning/20' :
                        meta?.severity === 'success' ? 'bg-success/20' :
                        'bg-gray-100 dark:bg-slate-800'
                      }`}>
                        <span className={`material-symbols-outlined ${meta?.color || 'text-slate-500 dark:text-slate-400'}`}>
                          {meta?.icon || 'info'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {meta?.label || event.eventType}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{ts.date}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{ts.time}</span>
                          </div>
                        </div>

                        {event.technicianName && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            By: {event.technicianName}
                          </p>
                        )}

                        {/* Sync status */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            event.syncStatus === 'synced'
                              ? 'bg-success/10 text-success'
                              : event.syncStatus === 'failed'
                              ? 'bg-danger/10 text-danger'
                              : 'bg-warning/10 text-warning'
                          }`}>
                            {event.syncStatus}
                          </span>
                          {event.location?.lat && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              GPS: {event.location.lat.toFixed(4)}, {event.location.lng?.toFixed(4)}
                            </span>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Event ID:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{event.id}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Event Hash:</span>
                              <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px] truncate max-w-[200px]">
                                {event.eventHash.substring(0, 16)}...
                              </span>
                            </div>
                            {event.previousEventHash && (
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-500 dark:text-slate-400">Previous Hash:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px] truncate max-w-[200px]">
                                  {event.previousEventHash.substring(0, 16)}...
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">Device:</span>
                              <span className="text-slate-700 dark:text-slate-300 text-[10px] truncate max-w-[200px]">
                                {event.deviceInfo.platform}
                              </span>
                            </div>
                            {Object.keys(event.metadata).length > 0 && (
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Metadata:</p>
                                <pre className="text-[10px] text-slate-500 dark:text-slate-400 font-mono overflow-x-auto">
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expand indicator */}
                      <span className={`material-symbols-outlined text-slate-500 dark:text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}>
                        expand_more
                      </span>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredEvents.length} of {events.length} events
            </span>
            <span className="font-mono">
              Chain hash: {events.length > 0 ? events[events.length - 1].eventHash.substring(0, 12) : 'N/A'}...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
