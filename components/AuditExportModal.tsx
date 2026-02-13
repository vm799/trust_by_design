/**
 * Audit Export Modal Component
 *
 * Provides UI for exporting audit trails in CSV or JSON format.
 * Supports filtering by status, date range, and seal status.
 *
 * Features:
 * - Export format selection (CSV/JSON)
 * - Job status filtering
 * - Date range filtering
 * - Sealed jobs only toggle
 * - Real-time preview of record count
 * - Download file generation with SHA-256 verification
 *
 * Phase: 3.2 - Audit Trail Export (CSV/JSON with SHA-256)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ActionButton } from './ui';
import type { Job, JobStatus } from '../types';
import {
  generateAuditTrail,
  exportAsCSV,
  exportAsJSON,
  filterJobsByStatus,
  filterJobsByDateRange,
  filterSealedJobs,
  downloadFile,
  generateDownloadFilename,
} from '../lib/utils/auditExport';
import { showToast } from '../lib/microInteractions';

interface AuditExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
}

type ExportFormat = 'csv' | 'json';
type FilterType = 'all' | 'sealed' | 'status' | 'dateRange';

const JOB_STATUSES: JobStatus[] = [
  'Pending',
  'In Progress',
  'Complete',
  'Submitted',
  'Archived',
  'Paused',
  'Cancelled',
  'Draft',
];

const AuditExportModal: React.FC<AuditExportModalProps> = ({ isOpen, onClose, jobs }) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedStatus, setSelectedStatus] = useState<JobStatus>('Archived');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate filtered jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    switch (filterType) {
      case 'sealed':
        result = filterSealedJobs(result);
        break;
      case 'status':
        result = filterJobsByStatus(result, selectedStatus);
        break;
      case 'dateRange':
        result = filterJobsByDateRange(result, startDate, endDate);
        break;
      case 'all':
      default:
        // No filtering
        break;
    }

    return result;
  }, [jobs, filterType, selectedStatus, startDate, endDate]);

  // Generate audit records
  const auditRecords = useMemo(() => {
    return generateAuditTrail(filteredJobs);
  }, [filteredJobs]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);

      let content: string;
      let mimeType: string;
      let format: 'csv' | 'json';

      if (exportFormat === 'csv') {
        content = exportAsCSV(auditRecords);
        mimeType = 'text/csv';
        format = 'csv';
      } else {
        content = exportAsJSON(auditRecords);
        mimeType = 'application/json';
        format = 'json';
      }

      const filename = generateDownloadFilename(format);
      downloadFile(content, filename, mimeType);

      showToast(
        `Exported ${auditRecords.length} records as ${format.toUpperCase()}`,
        'success',
        3000
      );

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      showToast(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        3000
      );
    } finally {
      setIsExporting(false);
    }
  }, [exportFormat, auditRecords, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Audit Trail"
      description="Export job records with SHA-256 verification hashes"
      size="lg"
    >
      <div className="space-y-6">
        {/* Format Selection */}
        <div>
          <span className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Export Format
          </span>
          <div className="flex gap-3">
            {(['csv', 'json'] as const).map(format => (
              <button
                key={format}
                onClick={() => setExportFormat(format)}
                className={`px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] ${
                  exportFormat === format
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Selection */}
        <div>
          <span className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Filter Options
          </span>
          <div className="space-y-3">
            <button
              onClick={() => setFilterType('all')}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-all min-h-[44px] flex items-center gap-2 ${
                filterType === 'all'
                  ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className="material-symbols-outlined">apps</span>
              All Jobs ({jobs.length})
            </button>

            <button
              onClick={() => setFilterType('sealed')}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-all min-h-[44px] flex items-center gap-2 ${
                filterType === 'sealed'
                  ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className="material-symbols-outlined">verified</span>
              Sealed Jobs Only ({jobs.filter(j => j.sealedAt).length})
            </button>

            <div>
              <button
                onClick={() => setFilterType('status')}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all min-h-[44px] flex items-center gap-2 ${
                  filterType === 'status'
                    ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="material-symbols-outlined">label</span>
                Filter by Status
              </button>

              {filterType === 'status' && (
                <div className="mt-3 ml-4">
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value as JobStatus)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {JOB_STATUSES.map(status => (
                      <option key={status} value={status}>
                        {status} ({jobs.filter(j => j.status === status).length})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={() => setFilterType('dateRange')}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all min-h-[44px] flex items-center gap-2 ${
                  filterType === 'dateRange'
                    ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className="material-symbols-outlined">calendar_month</span>
                Filter by Date Range
              </button>

              {filterType === 'dateRange' && (
                <div className="mt-3 ml-4 space-y-3">
                  <div>
                    <label htmlFor="audit-start-date" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                      Start Date
                    </label>
                    <input
                      id="audit-start-date"
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="audit-end-date" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                      End Date
                    </label>
                    <input
                      id="audit-end-date"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Export Preview */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Export Preview
            </p>
            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100 rounded">
              {auditRecords.length} records
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {auditRecords.length === 0
              ? 'No jobs match the selected filters'
              : `Will export ${auditRecords.length} job${auditRecords.length !== 1 ? 's' : ''} with audit data and SHA-256 verification hashes`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg font-medium text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <ActionButton
            onClick={handleExport}
            disabled={auditRecords.length === 0 || isExporting}
            loading={isExporting}
            icon={isExporting ? 'hourglass_bottom' : 'download'}
            variant="primary"
          >
            {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
          </ActionButton>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
          <div className="flex gap-2">
            <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">
              info
            </span>
            <div className="text-xs text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-1">Audit Trail Details</p>
              <ul className="space-y-1 text-xs opacity-90">
                <li>• Each record includes job title, client, status, and photo count</li>
                <li>• Sealed jobs show SHA-256 verification hash for tamper detection</li>
                <li>• Timestamps are in ISO format (UTC)</li>
                <li>• CSV format suitable for Excel/Google Sheets</li>
                <li>• JSON format suitable for API integration and archival</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AuditExportModal;
