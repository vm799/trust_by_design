'use client';

/**
 * Compliance Officer - Step 4: Export Audit Report
 * Generate compliance reports for regulators
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

/**
 * Compliance Officer onboarding step 4: Export audit report
 * Demonstrates compliance report generation for regulatory submission
 * @returns {JSX.Element} The export report onboarding page
 */
export default function ExportReportPage() {
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'audit'>('summary');
  const [dateRange, setDateRange] = useState('last_30_days');
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeBlockchain, setIncludeBlockchain] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const mockStats = {
    total_jobs: 47,
    sealed_jobs: 43,
    pending_jobs: 4,
    compliance_score: 98,
    total_photos: 564,
    safety_incidents: 0,
  };

  /**
   * Simulates PDF report generation with 2-second delay
   * Sets generating and generated states to show progress UI
   */
  const handleGenerate = async () => {
    setGenerating(true);
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setGenerating(false);
    setGenerated(true);
  };

  /**
   * Handles step completion and returns report metadata to persist
   * @returns {Promise<Object>} Step data containing report type, date range, and job count
   */
  const handleComplete = async () => {
    return {
      report_generated: true,
      report_type: reportType,
      date_range: dateRange,
      jobs_included: mockStats.total_jobs,
    };
  };

  return (
    <OnboardingFactory persona="compliance_officer" step="export_report" onComplete={handleComplete}>
      <div className="space-y-8">
        {!generating && !generated && (
          <>
            {/* Report Type Selection */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">description</span>
                <span>Report Type</span>
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { value: 'summary', label: 'Summary Report', icon: 'summarize', desc: 'High-level overview (5 pages)' },
                  { value: 'detailed', label: 'Detailed Report', icon: 'article', desc: 'Full job details (50+ pages)' },
                  { value: 'audit', label: 'Audit Trail', icon: 'history', desc: 'Complete log export (CSV)' },
                ].map(type => (
                  <button
                    key={type.value}
                    onClick={() => setReportType(type.value as any)}
                    className={`
                      p-6 rounded-xl border-2 transition-all text-left
                      ${reportType === type.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <span className={`material-symbols-outlined text-4xl mb-3 block ${
                      reportType === type.value ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {type.icon}
                    </span>
                    <div className="font-semibold text-gray-900 mb-1">{type.label}</div>
                    <div className="text-sm text-gray-600">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Date Range</h3>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none text-gray-900"
              >
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="last_90_days">Last 90 days</option>
                <option value="last_year">Last year</option>
                <option value="all_time">All time</option>
              </select>
            </div>

            {/* Include Options */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Include</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-green-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={includePhotos}
                    onChange={(e) => setIncludePhotos(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-200"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Photo Evidence</div>
                    <div className="text-sm text-gray-600">Embed all {mockStats.total_photos} photos in PDF</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-green-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeBlockchain}
                    onChange={(e) => setIncludeBlockchain(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-200"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Blockchain Verification</div>
                    <div className="text-sm text-gray-600">Include transaction IDs for {mockStats.sealed_jobs} sealed jobs</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Preview Stats */}
            <div className="p-6 bg-gray-50 border-2 border-gray-200 rounded-2xl">
              <h3 className="font-semibold text-gray-900 mb-4">Report Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{mockStats.total_jobs}</div>
                  <div className="text-sm text-gray-600">Total Jobs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{mockStats.sealed_jobs}</div>
                  <div className="text-sm text-gray-600">Sealed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{mockStats.pending_jobs}</div>
                  <div className="text-sm text-gray-600">Pending</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{mockStats.compliance_score}%</div>
                  <div className="text-sm text-gray-600">Compliance</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{mockStats.total_photos}</div>
                  <div className="text-sm text-gray-600">Photos</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{mockStats.safety_incidents}</div>
                  <div className="text-sm text-gray-600">Incidents</div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-2xl font-semibold text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-2xl">download</span>
              <span>Generate {reportType === 'summary' ? 'Summary' : reportType === 'detailed' ? 'Detailed' : 'Audit'} Report</span>
            </button>
          </>
        )}

        {/* Generating State */}
        {generating && (
          <div className="p-12 text-center">
            <div className="w-24 h-24 border-8 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Generating Report...
            </h3>
            <p className="text-gray-600 mb-6">
              Processing {mockStats.total_jobs} jobs, {mockStats.total_photos} photos, {mockStats.sealed_jobs} blockchain seals
            </p>
            <div className="max-w-md mx-auto space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">check_circle</span>
                <span>Collecting job data...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">check_circle</span>
                <span>Verifying blockchain seals...</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                <span>Rendering PDF...</span>
              </div>
            </div>
          </div>
        )}

        {/* Generated Success */}
        {generated && (
          <>
            <div className="p-8 bg-green-50 border-2 border-green-200 rounded-2xl text-center">
              <span className="material-symbols-outlined text-green-600 text-6xl mb-4 inline-block">
                check_circle
              </span>
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                🎉 Report Generated Successfully
              </h3>
              <p className="text-green-700 mb-6">
                Your compliance report is ready for download
              </p>

              {/* Download Button */}
              <button className="px-8 py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors inline-flex items-center gap-3 shadow-xl mb-4">
                <span className="material-symbols-outlined text-2xl">download</span>
                <span>Download Report.pdf</span>
              </button>

              <div className="text-sm text-green-700">
                Report size: ~{includePhotos ? '45' : '2'} MB | Password protected
              </div>
            </div>

            {/* Report Contents */}
            <div className="p-6 bg-white border-2 border-gray-200 rounded-2xl">
              <h3 className="font-semibold text-gray-900 mb-4">Report Contents</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                  <span>Executive summary with compliance score (98%)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                  <span>Job-by-job breakdown ({mockStats.total_jobs} jobs)</span>
                </li>
                {includePhotos && (
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                    <span>Photo evidence ({mockStats.total_photos} photos with metadata)</span>
                  </li>
                )}
                {includeBlockchain && (
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                    <span>Blockchain verification links ({mockStats.sealed_jobs} seals)</span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                  <span>Safety incidents log ({mockStats.safety_incidents} incidents)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                  <span>Technician performance metrics</span>
                </li>
              </ul>
            </div>

            {/* Regulatory Use */}
            <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined">info</span>
                <span>Regulatory Submission</span>
              </h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Accepted by OFGEM, HSE, CQC, and ICO audits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>ISO 9001 audit evidence submission ready</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Insurance claim documentation (Legal & General, AXA approved)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Court proceedings: Admissible under ECA 2000</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </OnboardingFactory>
  );
}
