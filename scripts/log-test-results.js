#!/usr/bin/env node
/**
 * Test Result Logger for PHASE 1 Auth + Workspace Tests
 *
 * Parses Playwright JSON results and appends structured summary to claude.md
 * Usage: node scripts/log-test-results.js <path-to-results.json>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CLAUDE_MD_PATH = path.join(__dirname, '..', 'claude.md');
const RESULTS_JSON_PATH = process.argv[2] || path.join(__dirname, '..', 'test-results', 'results.json');

// Test name mappings for PHASE 1
const PHASE_1_TESTS = {
  'Email/Password Signup → Workspace Creation': 'Magic Link Signup',
  'Magic Link Signup Flow': 'Magic Link Signup',
  'Google OAuth Signup → Workspace Setup': 'Google OAuth Signup',
  'Existing User Login (No Duplicate Workspace)': 'Session Refresh',
  'Session Persistence & Logout Flow': 'Logout/Login Cycle',
  'RPC Permission Verification': 'RPC Permissions',
  'OAuth Redirect Allowlist Security': 'OAuth Security',
};

function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function parseTestResults(resultsPath) {
  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ Results file not found: ${resultsPath}`);
    process.exit(1);
  }

  const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  const summary = {
    timestamp: formatTimestamp(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    tests: [],
    errors: [],
  };

  // Parse Playwright results structure
  if (resultsData.suites) {
    resultsData.suites.forEach(suite => {
      if (suite.specs) {
        suite.specs.forEach(spec => {
          const testName = spec.title;
          const status = spec.ok ? 'PASS' : 'FAIL';
          const duration = spec.tests?.[0]?.results?.[0]?.duration || 0;

          summary.totalTests++;
          if (status === 'PASS') summary.passed++;
          else summary.failed++;

          summary.duration += duration;

          summary.tests.push({
            name: testName,
            status,
            duration: Math.round(duration / 1000),
          });

          // Collect errors
          if (status === 'FAIL' && spec.tests?.[0]?.results?.[0]?.error) {
            const error = spec.tests[0].results[0].error;
            summary.errors.push({
              test: testName,
              message: error.message || error.stack || 'Unknown error',
            });
          }
        });
      }
    });
  }

  summary.duration = Math.round(summary.duration / 1000); // Convert to seconds
  return summary;
}

function generateMarkdownReport(summary) {
  const statusEmoji = summary.failed === 0 ? '✅' : '❌';
  const phaseStatus = summary.failed === 0 ? 'PHASE 1 ✅' : 'PHASE 1 ❌';

  let report = `\n\n---\n\n`;
  report += `## ${phaseStatus} - PHASE 1 Auth + Workspace Test Run – ${summary.timestamp}\n\n`;
  report += `**Summary:** ${summary.passed}/${summary.totalTests} tests passed in ${summary.duration}s\n\n`;

  // Test results
  summary.tests.forEach(test => {
    const emoji = test.status === 'PASS' ? '✅' : '❌';
    const mappedName = PHASE_1_TESTS[test.name] || test.name;
    report += `- ${emoji} **${mappedName}**: ${test.status} (${test.duration}s)\n`;
  });

  // Errors section
  if (summary.errors.length > 0) {
    report += `\n### ❌ Errors:\n\n`;
    summary.errors.forEach(error => {
      report += `**${error.test}:**\n`;
      report += `\`\`\`\n${error.message}\n\`\`\`\n\n`;
    });
  } else {
    report += `\n### ✅ No errors detected\n`;
  }

  // Next steps
  if (summary.failed === 0) {
    report += `\n### 🎉 PHASE 1 Complete\n\n`;
    report += `All authentication and workspace flows verified. Ready to proceed to PHASE 2.\n`;
  } else {
    report += `\n### ⚠️ Action Required\n\n`;
    report += `PHASE 1 has ${summary.failed} failing test(s). Fix errors before proceeding to PHASE 2.\n`;
  }

  return report;
}

function appendToClaudeMd(report) {
  try {
    // Create claude.md if it doesn't exist
    if (!fs.existsSync(CLAUDE_MD_PATH)) {
      fs.writeFileSync(CLAUDE_MD_PATH, '# JobProof Test Execution Log\n\n');
      console.log(`📄 Created ${CLAUDE_MD_PATH}`);
    }

    // Append report
    fs.appendFileSync(CLAUDE_MD_PATH, report);
    console.log(`✅ Test results logged to ${CLAUDE_MD_PATH}`);
  } catch (error) {
    console.error(`❌ Failed to write to claude.md: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('🔍 Parsing test results...');
  const summary = parseTestResults(RESULTS_JSON_PATH);

  console.log(`📊 Results: ${summary.passed}/${summary.totalTests} passed`);

  console.log('📝 Generating markdown report...');
  const report = generateMarkdownReport(summary);

  console.log('💾 Appending to claude.md...');
  appendToClaudeMd(report);

  // Exit with appropriate code
  if (summary.failed > 0) {
    console.log('❌ PHASE 1 FAILED - Tests have errors');
    process.exit(1);
  } else {
    console.log('✅ PHASE 1 PASSED - All tests successful');
    process.exit(0);
  }
}

main();
