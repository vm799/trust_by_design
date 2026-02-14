/**
 * QuickSearchModal Component
 *
 * Global search for jobs across ID, client, technician, and address fields.
 *
 * Features:
 * - Real-time search across all jobs
 * - Filter by job status
 * - Sort by date or priority
 * - Keyboard navigation (Arrow keys, Enter to navigate)
 * - Global shortcut (Cmd+K / Ctrl+K)
 * - Search history
 * - Full accessibility (WCAG 2.1 AA)
 *
 * Usage:
 * <QuickSearchModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 * />
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../lib/DataContext';
import ModalBase from './ModalBase';
import type { Job } from '../../types';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchFilters {
  query: string;
  status: string | null;
  sortBy: 'date' | 'priority';
}

const SEARCH_HISTORY_KEY = 'quicksearch_history';
const MAX_HISTORY = 5;

const QuickSearchModal: React.FC<QuickSearchModalProps> = React.memo(({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { jobs } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: null,
    sortBy: 'date',
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load search history on mount
  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        // Ignore invalid history
      }
    }
  }, []);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Search results
  const results = useMemo(() => {
    let filtered = [...jobs];

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(j => j.status === filters.status);
    }

    // Search by query
    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(job =>
        job.id.toLowerCase().includes(query) ||
        job.client.toLowerCase().includes(query) ||
        job.address.toLowerCase().includes(query) ||
        (job.technician?.toLowerCase() ?? '').includes(query) ||
        (job.notes?.toLowerCase() ?? '').includes(query)
      );
    }

    // Sort (safe - filtered is already a copy)
    filtered.sort((a, b) => {
      if (filters.sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        // Sort by priority (high, normal, low)
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
        return aPriority - bPriority;
      }
    });

    return filtered.slice(0, 8); // Limit to 8 results for UI
  }, [jobs, filters]);

  const handleQueryChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      query: value,
    }));
    setSelectedIndex(0);
  };

  const handleStatusChange = (status: string | null) => {
    setFilters(prev => ({
      ...prev,
      status,
    }));
    setSelectedIndex(0);
  };

  const handleSortChange = (sortBy: 'date' | 'priority') => {
    setFilters(prev => ({
      ...prev,
      sortBy,
    }));
  };

  const saveToHistory = (query: string) => {
    if (!query.trim()) return;

    const updated = [
      query,
      ...searchHistory.filter(h => h !== query),
    ].slice(0, MAX_HISTORY);

    setSearchHistory(updated);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  };

  const handleSelectResult = (job: Job) => {
    saveToHistory(filters.query);
    navigate(`/app/jobs/${job.id}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pending': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      'Dispatched': 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      'In Progress': 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      'Complete': 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200',
      'Submitted': 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      'Archived': 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    };
    return colors[status] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Search Jobs"
      description="Find jobs by ID, client, technician, or address"
      size="lg"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by ID, client, technician, address..."
          value={filters.query}
          onChange={e => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="
            w-full px-4 py-3 rounded-lg
            bg-white dark:bg-slate-800
            border-2 border-slate-300 dark:border-slate-600
            text-slate-900 dark:text-white
            placeholder-slate-500 dark:placeholder-slate-400
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            min-h-[44px]
          "
          aria-label="Search jobs"
          aria-describedby="search-description"
        />

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-2">
          {/* Status Filter */}
          <select
            value={filters.status || ''}
            onChange={e => handleStatusChange(e.target.value || null)}
            className="
              px-3 py-2 rounded-lg
              bg-white dark:bg-slate-800
              border border-slate-300 dark:border-slate-600
              text-slate-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-primary
              text-sm
            "
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Dispatched">Dispatched</option>
            <option value="In Progress">In Progress</option>
            <option value="Complete">Complete</option>
            <option value="Submitted">Submitted</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Sort By */}
          <select
            value={filters.sortBy}
            onChange={e => handleSortChange(e.target.value as 'date' | 'priority')}
            className="
              px-3 py-2 rounded-lg
              bg-white dark:bg-slate-800
              border border-slate-300 dark:border-slate-600
              text-slate-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-primary
              text-sm
            "
            aria-label="Sort by"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
          </select>
        </div>

        {/* Results */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-slate-400 dark:text-slate-400">
              {filters.query ? 'No jobs found matching your search' : 'Enter a search term'}
            </div>
          ) : (
            <AnimatePresence>
              {results.map((job, index) => (
                <motion.button
                  key={job.id}
                  onClick={() => handleSelectResult(job)}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    w-full p-3 rounded-lg text-left transition-all duration-200
                    ${selectedIndex === index
                      ? 'bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700'
                      : 'bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }
                  `}
                  aria-current={selectedIndex === index ? 'true' : 'false'}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {job.id}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {job.client}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
                        {job.address}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`
                        px-2 py-1 rounded text-xs font-semibold
                        ${getStatusColor(job.status)}
                      `}>
                        {job.status}
                      </span>
                      {job.technician && (
                        <span className="text-xs text-slate-400 dark:text-slate-400">
                          {job.technician}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Search History */}
        {!filters.query && searchHistory.length > 0 && results.length === 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase">
              Recent Searches
            </p>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map(term => (
                <button
                  key={term}
                  onClick={() => handleQueryChange(term)}
                  className="
                    px-2 py-1 rounded text-sm
                    bg-slate-100 dark:bg-slate-700
                    text-slate-700 dark:text-slate-300
                    hover:bg-slate-200 dark:hover:bg-slate-600
                    transition-colors duration-200
                  "
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div id="search-description" className="text-xs text-slate-400 dark:text-slate-400 mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
          <p className="mb-1"><strong>Navigation:</strong> ↑↓ arrows to select, Enter to open</p>
          <p><strong>Keyboard shortcut:</strong> Ctrl+K or Cmd+K to open this search</p>
        </div>
      </div>
    </ModalBase>
  );
});

QuickSearchModal.displayName = 'QuickSearchModal';

export default QuickSearchModal;
