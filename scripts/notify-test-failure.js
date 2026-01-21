#!/usr/bin/env node
/**
 * Test Failure Notification Script
 *
 * Sends Slack/Email notifications when PHASE 1 tests fail
 * Usage: node scripts/notify-test-failure.js <results-json-path> <notification-type>
 *
 * Notification types: slack, email, console (default)
 * Environment variables:
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL
 * - EMAIL_TO: Email recipient address
 * - EMAIL_FROM: Email sender address
 * - SENDGRID_API_KEY: SendGrid API key for email
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RESULTS_JSON_PATH = process.argv[2] || path.join(__dirname, '..', 'test-results', 'results.json');
const NOTIFICATION_TYPE = process.argv[3] || 'console';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const EMAIL_TO = process.env.EMAIL_TO;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@jobproof.pro';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

function parseTestResults(resultsPath) {
  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ Results file not found: ${resultsPath}`);
    process.exit(1);
  }

  const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  const summary = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    failedTests: [],
  };

  if (resultsData.suites) {
    resultsData.suites.forEach(suite => {
      if (suite.specs) {
        suite.specs.forEach(spec => {
          const testName = spec.title;
          const status = spec.ok ? 'PASS' : 'FAIL';

          summary.totalTests++;
          if (status === 'PASS') {
            summary.passed++;
          } else {
            summary.failed++;
            const error = spec.tests?.[0]?.results?.[0]?.error;
            summary.failedTests.push({
              name: testName,
              error: error?.message || error?.stack || 'Unknown error',
            });
          }
        });
      }
    });
  }

  return summary;
}

function generateSlackMessage(summary) {
  const emoji = summary.failed === 0 ? ':white_check_mark:' : ':x:';
  const status = summary.failed === 0 ? 'PASSED' : 'FAILED';

  let message = {
    text: `${emoji} PHASE 1 Auth + Workspace Tests ${status}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} PHASE 1 Tests ${status}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:* ${summary.passed}/${summary.totalTests} tests passed`,
        },
      },
    ],
  };

  if (summary.failed > 0) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Failed Tests:*\n' + summary.failedTests.map(t => `• ${t.name}`).join('\n'),
      },
    });

    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '⚠️ *Action Required:* Fix failing tests before proceeding to PHASE 2.',
      },
    });
  }

  return message;
}

function sendSlackNotification(summary) {
  if (!SLACK_WEBHOOK_URL) {
    console.error('❌ SLACK_WEBHOOK_URL not configured');
    return;
  }

  const message = generateSlackMessage(summary);
  const payload = JSON.stringify(message);

  const url = new URL(SLACK_WEBHOOK_URL);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Slack notification sent');
    } else {
      console.error(`❌ Slack notification failed: ${res.statusCode}`);
    }
  });

  req.on('error', (error) => {
    console.error(`❌ Slack notification error: ${error.message}`);
  });

  req.write(payload);
  req.end();
}

function generateEmailContent(summary) {
  const status = summary.failed === 0 ? '✅ PASSED' : '❌ FAILED';

  let html = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${summary.failed === 0 ? '#22c55e' : '#ef4444'};">
          PHASE 1 Auth + Workspace Tests ${status}
        </h2>
        <p><strong>Summary:</strong> ${summary.passed}/${summary.totalTests} tests passed</p>
  `;

  if (summary.failed > 0) {
    html += `
        <h3 style="color: #ef4444;">Failed Tests:</h3>
        <ul>
    `;
    summary.failedTests.forEach(test => {
      html += `<li><strong>${test.name}</strong><br/><code style="background: #f3f4f6; padding: 5px;">${test.error}</code></li>`;
    });
    html += `
        </ul>
        <p style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px;">
          ⚠️ <strong>Action Required:</strong> Fix failing tests before proceeding to PHASE 2.
        </p>
    `;
  } else {
    html += `
        <p style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 10px;">
          ✅ All tests passed! Ready to proceed to PHASE 2.
        </p>
    `;
  }

  html += `
      </body>
    </html>
  `;

  return html;
}

function sendEmailNotification(summary) {
  if (!SENDGRID_API_KEY || !EMAIL_TO) {
    console.error('❌ Email configuration missing (SENDGRID_API_KEY, EMAIL_TO)');
    return;
  }

  const subject = summary.failed === 0
    ? '✅ PHASE 1 Tests Passed'
    : `❌ PHASE 1 Tests Failed (${summary.failed}/${summary.totalTests})`;

  const emailContent = generateEmailContent(summary);

  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: EMAIL_TO }] }],
    from: { email: EMAIL_FROM },
    subject: subject,
    content: [{ type: 'text/html', value: emailContent }],
  });

  const options = {
    hostname: 'api.sendgrid.com',
    path: '/v3/mail/send',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode === 202) {
      console.log('✅ Email notification sent');
    } else {
      console.error(`❌ Email notification failed: ${res.statusCode}`);
    }
  });

  req.on('error', (error) => {
    console.error(`❌ Email notification error: ${error.message}`);
  });

  req.write(payload);
  req.end();
}

function logToConsole(summary) {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1 TEST NOTIFICATION');
  console.log('='.repeat(60));
  console.log(`Status: ${summary.failed === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${summary.passed}/${summary.totalTests} passed`);

  if (summary.failed > 0) {
    console.log('\n❌ Failed Tests:');
    summary.failedTests.forEach(test => {
      console.log(`  • ${test.name}`);
      console.log(`    Error: ${test.error.substring(0, 100)}...`);
    });
    console.log('\n⚠️  Action Required: Fix failing tests before proceeding to PHASE 2.');
  } else {
    console.log('\n✅ All tests passed! Ready to proceed to PHASE 2.');
  }

  console.log('='.repeat(60));
}

function main() {
  console.log('🔍 Parsing test results...');
  const summary = parseTestResults(RESULTS_JSON_PATH);

  // Skip notification if all tests passed
  if (summary.failed === 0 && process.env.NOTIFY_ON_SUCCESS !== 'true') {
    console.log('✅ All tests passed. Skipping notification (set NOTIFY_ON_SUCCESS=true to notify on success).');
    process.exit(0);
  }

  console.log(`📊 Results: ${summary.passed}/${summary.totalTests} passed, ${summary.failed} failed`);

  switch (NOTIFICATION_TYPE) {
    case 'slack':
      console.log('📤 Sending Slack notification...');
      sendSlackNotification(summary);
      break;
    case 'email':
      console.log('📧 Sending email notification...');
      sendEmailNotification(summary);
      break;
    case 'console':
    default:
      logToConsole(summary);
      break;
  }

  // Append to claude.md
  const claudeMdPath = path.join(__dirname, '..', 'claude.md');
  const notificationLog = `\n### 📢 Notification Sent (${NOTIFICATION_TYPE}) - ${new Date().toISOString()}\n` +
    `Status: ${summary.failed === 0 ? 'PASSED' : 'FAILED'} | ` +
    `Tests: ${summary.passed}/${summary.totalTests}\n`;

  if (fs.existsSync(claudeMdPath)) {
    fs.appendFileSync(claudeMdPath, notificationLog);
  }

  console.log('✅ Notification complete');
}

main();
