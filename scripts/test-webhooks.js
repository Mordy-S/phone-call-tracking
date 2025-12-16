#!/usr/bin/env node
/**
 * Webhook Testing Script for Lev Lehazin Helpline
 * 
 * Simulates Telebroad webhook calls to test your integration
 * 
 * Usage:
 *   node scripts/test-webhooks.js --call        # Test call logging
 *   node scripts/test-webhooks.js --missed      # Test missed call
 *   node scripts/test-webhooks.js --all         # Run all tests
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Sample test data simulating Telebroad webhooks
const testData = {
  // Normal completed call
  completedCall: {
    callId: `TEST-${Date.now()}`,
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    duration: 245, // seconds
    callerNumber: '+1234567890',
    extension: '101',
    recordingUrl: 'https://example.com/recording/test123'
  },

  // Missed call
  missedCall: {
    callId: `MISSED-${Date.now()}`,
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    duration: 0,
    callerNumber: '+1987654321',
    extension: '101',
    missed: true
  },

  // Outbound call
  outboundCall: {
    callId: `OUT-${Date.now()}`,
    timestamp: new Date().toISOString(),
    direction: 'outbound',
    duration: 180,
    callerNumber: '+1555555555',
    extension: '102'
  }
};

async function testEndpoint(name, endpoint, method, data) {
  console.log(`\n${'─'.repeat(60)}`);
  log(`Testing: ${name}`, 'cyan');
  console.log(`${method.toUpperCase()} ${BASE_URL}${endpoint}`);
  console.log('Payload:', JSON.stringify(data, null, 2));
  console.log('─'.repeat(60));

  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    log('✅ SUCCESS', 'green');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    log('❌ FAILED', 'red');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('Error: Could not connect to server');
      console.log(`Make sure your server is running: npm start`);
    } else {
      console.log('Error:', error.message);
    }
    return { success: false, error: error.message };
  }
}

async function testHealthCheck() {
  return testEndpoint('Health Check', '/health', 'get', null);
}

async function testCallEnded() {
  return testEndpoint(
    'Call Ended Webhook (Zap 1)',
    '/webhooks/call-ended',
    'post',
    testData.completedCall
  );
}

async function testMissedCall() {
  return testEndpoint(
    'Missed Call Webhook (Zap 2)',
    '/webhooks/missed-call',
    'post',
    testData.missedCall
  );
}

async function testOutboundCall() {
  return testEndpoint(
    'Outbound Call Webhook',
    '/webhooks/call-ended',
    'post',
    testData.outboundCall
  );
}

async function testOverdueAlerts() {
  return testEndpoint(
    'Overdue Follow-up Alerts (Zap 4)',
    '/webhooks/overdue-alerts',
    'get',
    null
  );
}

async function testDailyDigest() {
  return testEndpoint(
    'Daily Digest',
    '/webhooks/daily-digest',
    'get',
    null
  );
}

async function testCreateFollowup(callId) {
  return testEndpoint(
    'Create Follow-up from Call',
    '/webhooks/create-followup',
    'post',
    { callId }
  );
}

async function runAllTests() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     LEV LEHAZIN HELPLINE - WEBHOOK TEST SUITE                ║
╚══════════════════════════════════════════════════════════════╝
  
  Server URL: ${BASE_URL}
  `);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Run tests in sequence
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Call Ended', fn: testCallEnded },
    { name: 'Missed Call', fn: testMissedCall },
    { name: 'Outbound Call', fn: testOutboundCall },
    { name: 'Overdue Alerts', fn: testOverdueAlerts },
    { name: 'Daily Digest', fn: testDailyDigest }
  ];

  for (const test of tests) {
    const result = await test.fn();
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
    results.tests.push({ name: test.name, ...result });
  }

  // Summary
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      TEST SUMMARY                            ║
╚══════════════════════════════════════════════════════════════╝`);
  
  log(`  Passed: ${results.passed}`, 'green');
  log(`  Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  console.log(`  Total:  ${results.passed + results.failed}`);
  
  if (results.failed > 0) {
    log('\n  Some tests failed. Make sure:', 'yellow');
    console.log('  1. Your server is running: npm start');
    console.log('  2. Airtable is properly configured');
    console.log('  3. All required tables and fields exist');
  } else {
    log('\n  ✅ All tests passed! Your webhooks are ready.', 'green');
  }

  return results;
}

function showHelp() {
  console.log(`
${colors.bright}LEV LEHAZIN HELPLINE - WEBHOOK TESTER${colors.reset}

${colors.cyan}USAGE:${colors.reset}
  node scripts/test-webhooks.js [OPTIONS]

${colors.cyan}OPTIONS:${colors.reset}
  --help          Show this help
  --all           Run all webhook tests
  --health        Test health endpoint
  --call          Test call-ended webhook
  --missed        Test missed-call webhook
  --outbound      Test outbound call
  --overdue       Test overdue alerts
  --digest        Test daily digest
  --followup ID   Test follow-up creation (requires call ID)

${colors.cyan}EXAMPLES:${colors.reset}
  node scripts/test-webhooks.js --all
  node scripts/test-webhooks.js --call
  node scripts/test-webhooks.js --followup rec123abc

${colors.cyan}ENVIRONMENT:${colors.reset}
  WEBHOOK_BASE_URL  Server URL (default: http://localhost:3000)

${colors.yellow}NOTE:${colors.reset} Start your server first with: npm start
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--all')) {
    await runAllTests();
    return;
  }

  // Individual tests
  if (args.includes('--health')) {
    await testHealthCheck();
  }
  if (args.includes('--call')) {
    await testCallEnded();
  }
  if (args.includes('--missed')) {
    await testMissedCall();
  }
  if (args.includes('--outbound')) {
    await testOutboundCall();
  }
  if (args.includes('--overdue')) {
    await testOverdueAlerts();
  }
  if (args.includes('--digest')) {
    await testDailyDigest();
  }
  if (args.includes('--followup')) {
    const idx = args.indexOf('--followup');
    const callId = args[idx + 1];
    if (!callId) {
      log('Error: --followup requires a call ID', 'red');
      return;
    }
    await testCreateFollowup(callId);
  }
}

main().catch(console.error);
