#!/usr/bin/env node
/**
 * Test Airtable Webhook Automations
 * 
 * This script sends test payloads to your Airtable webhook URLs
 * to verify they're working and help you configure the actions.
 * 
 * Usage: node scripts/test-airtable-webhooks.js [webhook-name]
 * 
 * Examples:
 *   node scripts/test-airtable-webhooks.js all
 *   node scripts/test-airtable-webhooks.js call-ended
 *   node scripts/test-airtable-webhooks.js missed
 *   node scripts/test-airtable-webhooks.js ringing
 *   node scripts/test-airtable-webhooks.js voicemail
 */

const https = require('https');

// Your Airtable Webhook URLs
const WEBHOOKS = {
  'call-ended': {
    name: 'Call Ended',
    url: 'https://hooks.airtable.com/workflows/v1/genericWebhook/apppmUWwmIexHE32N/wflq5bd62PGqzqhUd/wtrCKvuLULuKBd0Zy',
    event: 'call.ended',
    description: 'Logs completed calls to Airtable'
  },
  'missed': {
    name: 'Missed Calls',
    url: 'https://hooks.airtable.com/workflows/v1/genericWebhook/apppmUWwmIexHE32N/wflHGFgzaFTu9XOpk/wtrMSQ1OitmmWiv5e',
    event: 'call.missed',
    description: 'Tracks missed calls'
  },
  'ringing': {
    name: 'Ringing',
    url: 'https://hooks.airtable.com/workflows/v1/genericWebhook/apppmUWwmIexHE32N/wflas27IDYywB5p6B/wtraHQshmNuxi48eu',
    event: 'call.ringing',
    description: 'Live call tracking (optional)'
  },
  'voicemail': {
    name: 'Voicemail',
    url: 'https://hooks.airtable.com/workflows/v1/genericWebhook/apppmUWwmIexHE32N/wflX6V7KsMGL0HCyO/wtrlk4GTPm0fqfu7k',
    event: 'voicemail.created',
    description: 'Voicemail notifications (optional)'
  }
};

// Sample payloads matching Telebroad webhook format
const SAMPLE_PAYLOADS = {
  'call-ended': {
    event: 'call.ended',
    callId: 'CALL-' + Date.now(),           // Telebroad Call ID
    uniqueid: 'UNIQ-' + Date.now(),          // Telebroad Unique ID (separate!)
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    duration: 185, // seconds
    callerNumber: '+12125551234',
    caller_number: '+12125551234',
    calledNumber: '+18005559999',
    extension: '101',
    extensionName: 'Main Line',
    status: 'completed',
    disposition: 'ANSWERED',
    recordingUrl: 'https://recordings.telebroad.com/sample.mp3',
    // Additional fields Telebroad might send
    accountId: 'ACC123',
    queueName: 'Support',
    waitTime: 12,
    talkTime: 173
  },
  'missed': {
    event: 'call.missed',
    callId: 'MISSED-' + Date.now(),
    uniqueid: 'UNIQ-MISSED-' + Date.now(),
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    duration: 0,
    callerNumber: '+12125559876',
    caller_number: '+12125559876',
    calledNumber: '+18005559999',
    extension: '101',
    status: 'missed',
    disposition: 'NO ANSWER',
    ringTime: 25 // How long it rang before missing
  },
  'ringing': {
    event: 'call.ringing',
    callId: 'RING-' + Date.now(),
    uniqueid: 'UNIQ-RING-' + Date.now(),
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    callerNumber: '+12125554321',
    caller_number: '+12125554321',
    calledNumber: '+18005559999',
    extension: '101',
    extensionName: 'Main Line',
    status: 'ringing',
    // For live tracking
    callerId: 'John Doe',
    callerIdName: 'John Doe'
  },
  'voicemail': {
    event: 'voicemail.created',
    callId: 'VM-' + Date.now(),
    uniqueid: 'UNIQ-VM-' + Date.now(),
    timestamp: new Date().toISOString(),
    callerNumber: '+12125551111',
    caller_number: '+12125551111',
    extension: '101',
    mailbox: '101',
    duration: 45, // Voicemail duration
    recordingUrl: 'https://recordings.telebroad.com/voicemail-sample.mp3',
    transcription: 'Hi, this is a test voicemail message. Please call me back when you get a chance. Thank you.'
  }
};

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function sendWebhook(webhookKey) {
  return new Promise((resolve, reject) => {
    const webhook = WEBHOOKS[webhookKey];
    const payload = SAMPLE_PAYLOADS[webhookKey];
    
    if (!webhook || !payload) {
      reject(new Error(`Unknown webhook: ${webhookKey}`));
      return;
    }

    const data = JSON.stringify(payload);
    const url = new URL(webhook.url);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    log(`\n📤 Sending ${webhook.name} webhook...`, 'cyan');
    log(`   Event: ${webhook.event}`, 'dim');
    log(`   URL: ${webhook.url.substring(0, 60)}...`, 'dim');

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({
          webhookKey,
          name: webhook.name,
          statusCode: res.statusCode,
          response: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject({ webhookKey, name: webhook.name, error: error.message });
    });

    req.write(data);
    req.end();
  });
}

function printPayload(webhookKey) {
  const payload = SAMPLE_PAYLOADS[webhookKey];
  const webhook = WEBHOOKS[webhookKey];
  
  console.log(`\n${'═'.repeat(70)}`);
  log(`📋 ${webhook.name} - Sample Payload`, 'bright');
  console.log(`${'─'.repeat(70)}`);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`${'═'.repeat(70)}\n`);
}

function printFieldMapping(webhookKey) {
  const webhook = WEBHOOKS[webhookKey];
  const payload = SAMPLE_PAYLOADS[webhookKey];
  
  console.log(`\n${'═'.repeat(70)}`);
  log(`🔗 ${webhook.name} - Airtable Field Mapping`, 'bright');
  console.log(`${'─'.repeat(70)}`);
  
  if (webhookKey === 'call-ended' || webhookKey === 'missed') {
    log(`
In Airtable Automation, add action "Create Record" in Calls table:

┌────────────────────────┬──────────────────────────────────────┐
│ Airtable Field         │ Map to Webhook Data                  │
├────────────────────────┼──────────────────────────────────────┤
│ Date/Time              │ {{body.timestamp}}                   │
│ Direction              │ ${webhookKey === 'missed' ? '"Missed"' : '{{body.direction}} or "Inbound"'}              │
│ Duration               │ {{body.duration}}  (divide by 60)    │
│ Telebroad Call ID      │ {{body.callId}}                      │
│ Telebroad Unique ID    │ {{body.uniqueid}}  ← NEW FIELD       │
│ Recording URL          │ {{body.recordingUrl}}                │
│ Summary                │ "Caller: " + {{body.callerNumber}}   │
└────────────────────────┴──────────────────────────────────────┘

For "Received By" (team member lookup) - use a Script action.
`, 'reset');
  } else if (webhookKey === 'ringing') {
    log(`
For Ringing webhook, configure these actions:

┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Find Team Member by Extension                          │
├─────────────────────────────────────────────────────────────────┤
│ Action: "Find records"                                          │
│ Table: Team Members                                             │
│ Where: Phone/Extension = {{body.extension}}                     │
│ Max records: 1                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Update Team Member Status to Busy                      │
├─────────────────────────────────────────────────────────────────┤
│ Action: "Update record"                                         │
│ Table: Team Members                                             │
│ Record ID: {{Step 1.First record.Record ID}}                    │
│ Current Status: 🟡 Busy                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ OPTIONAL: Create a "Ringing" record in Calls                   │
├─────────────────────────────────────────────────────────────────┤
│ Action: "Create record"                                         │
│ Table: Calls                                                    │
│ Ring Status: Ringing                                            │
│ Telebroad Call ID: {{body.callId}}                              │
│ Telebroad Unique ID: {{body.uniqueid}}                          │
│ Date/Time: {{body.timestamp}}                                   │
│ Direction: Inbound                                              │
└─────────────────────────────────────────────────────────────────┘

Webhook data available:
  • extension: ${SAMPLE_PAYLOADS['ringing'].extension}
  • callId: Unique call identifier  
  • uniqueid: Telebroad's internal ID
  • callerNumber: Incoming phone number
  • timestamp: When the call started ringing
`, 'reset');
  } else if (webhookKey === 'voicemail') {
    log(`
In Airtable Automation, add action "Create Record" in Calls table:

┌────────────────────────┬──────────────────────────────────────┐
│ Airtable Field         │ Map to Webhook Data                  │
├────────────────────────┼──────────────────────────────────────┤
│ Date/Time              │ {{body.timestamp}}                   │
│ Direction              │ "Inbound"                            │
│ Call Type              │ "Voicemail"                          │
│ Duration               │ {{body.duration}}                    │
│ Telebroad Call ID      │ {{body.callId}}                      │
│ Summary                │ {{body.transcription}}               │
│                        │ Recording: {{body.recordingUrl}}     │
└────────────────────────┴──────────────────────────────────────┘
`, 'reset');
  }
  
  console.log(`${'═'.repeat(70)}\n`);
}

async function testWebhook(webhookKey) {
  try {
    printPayload(webhookKey);
    
    const result = await sendWebhook(webhookKey);
    
    if (result.statusCode === 200) {
      log(`✅ ${result.name}: SUCCESS (${result.statusCode})`, 'green');
      try {
        const parsed = JSON.parse(result.response);
        if (parsed.success) {
          log(`   Response: ${JSON.stringify(parsed)}`, 'dim');
        }
      } catch (e) {
        log(`   Response: ${result.response}`, 'dim');
      }
    } else {
      log(`⚠️  ${result.name}: Status ${result.statusCode}`, 'yellow');
      log(`   Response: ${result.response}`, 'dim');
    }
    
    printFieldMapping(webhookKey);
    
    return result;
  } catch (error) {
    log(`❌ ${error.name || webhookKey}: FAILED`, 'red');
    log(`   Error: ${error.error || error.message}`, 'dim');
    return null;
  }
}

async function testAll() {
  log('\n' + '═'.repeat(70), 'cyan');
  log('  TESTING ALL AIRTABLE WEBHOOKS', 'bright');
  log('═'.repeat(70) + '\n', 'cyan');

  const results = [];
  
  for (const key of Object.keys(WEBHOOKS)) {
    const result = await testWebhook(key);
    results.push(result);
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  log('\n' + '═'.repeat(70), 'cyan');
  log('  SUMMARY', 'bright');
  log('═'.repeat(70), 'cyan');
  
  for (const result of results) {
    if (result && result.statusCode === 200) {
      log(`  ✅ ${result.name}`, 'green');
    } else if (result) {
      log(`  ⚠️  ${result.name} (${result.statusCode})`, 'yellow');
    } else {
      log(`  ❌ Failed`, 'red');
    }
  }
  
  log('\n' + '═'.repeat(70) + '\n', 'cyan');
}

function showHelp() {
  console.log(`
${colors.bright}Airtable Webhook Tester${colors.reset}

Usage: node scripts/test-airtable-webhooks.js [command]

Commands:
  all          Test all webhooks
  call-ended   Test Call Ended webhook
  missed       Test Missed Call webhook
  ringing      Test Ringing webhook
  voicemail    Test Voicemail webhook
  show [name]  Show payload without sending
  help         Show this help

Examples:
  node scripts/test-airtable-webhooks.js all
  node scripts/test-airtable-webhooks.js call-ended
  node scripts/test-airtable-webhooks.js show missed
`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase() || 'help';

  switch (command) {
    case 'all':
      await testAll();
      break;
    case 'call-ended':
    case 'missed':
    case 'ringing':
    case 'voicemail':
      await testWebhook(command);
      break;
    case 'show':
      const showKey = args[1]?.toLowerCase();
      if (showKey && WEBHOOKS[showKey]) {
        printPayload(showKey);
        printFieldMapping(showKey);
      } else {
        log('Usage: node scripts/test-airtable-webhooks.js show [call-ended|missed|ringing|voicemail]', 'yellow');
      }
      break;
    case 'help':
    default:
      showHelp();
  }
}

main().catch(console.error);
