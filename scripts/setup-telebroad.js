#!/usr/bin/env node
/**
 * Telebroad Webhook Setup - Automated Configuration
 * 
 * This script helps you:
 * 1. Start the webhook server
 * 2. Set up ngrok tunnel
 * 3. Generate Telebroad webhook configuration
 * 4. Test the webhook connection
 * 
 * Usage: node scripts/setup-telebroad.js
 */

require('dotenv').config();
const { spawn, exec } = require('child_process');
const http = require('http');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBox(title, content, color = 'cyan') {
  const width = 75;
  console.log('\n' + '╔' + '═'.repeat(width) + '╗');
  console.log('║' + colors[color] + colors.bright + title.padStart((width + title.length) / 2).padEnd(width) + colors.reset + '║');
  console.log('╠' + '═'.repeat(width) + '╣');
  
  const lines = content.split('\n');
  for (const line of lines) {
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, ''); // Remove color codes for length calc
    const displayLine = line.padEnd(width - 1 + (line.length - cleanLine.length));
    console.log('║ ' + displayLine + '║');
  }
  console.log('╚' + '═'.repeat(width) + '╝');
}

function logStep(stepNum, total, title) {
  console.log(`\n${colors.bgBlue}${colors.white} STEP ${stepNum}/${total} ${colors.reset} ${colors.bright}${title}${colors.reset}`);
  console.log('─'.repeat(75));
}

// Check if server is running
function checkServerHealth(port = 3000) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Send test webhook
function sendTestWebhook(port = 3000) {
  return new Promise((resolve, reject) => {
    const testData = JSON.stringify({
      callId: 'TEST-' + Date.now(),
      timestamp: new Date().toISOString(),
      direction: 'inbound',
      duration: 120,
      callerNumber: '+12125551234',
      extension: '101',
      test: true
    });

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/webhooks/call-ended',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': testData.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(testData);
    req.end();
  });
}

// Check if ngrok is installed
function checkNgrokInstalled() {
  return new Promise((resolve) => {
    exec('ngrok version', (error) => {
      resolve(!error);
    });
  });
}

async function showIntro() {
  console.clear();
  logBox('TELEBROAD → AIRTABLE AUTOMATIC SETUP', `
${colors.green}This wizard will set up automatic webhook integration${colors.reset}

${colors.cyan}What happens:${colors.reset}
  1. Start your local webhook server
  2. Expose it to the internet (using ngrok)
  3. Get your webhook URL for Telebroad
  4. Test the connection
  5. Guide you through Telebroad configuration

${colors.yellow}Requirements:${colors.reset}
  ✓ Airtable configured (PAT + Base ID in .env)
  ✓ Internet connection
  ✓ Telebroad TeleConsole admin access

${colors.dim}Press CTRL+C anytime to exit${colors.reset}
`, 'cyan');

  await new Promise(resolve => {
    process.stdin.once('data', resolve);
    console.log('\nPress ENTER to continue...');
  });
}

async function checkPrerequisites() {
  logStep(1, 5, 'Checking Prerequisites');

  // Check .env configuration
  const hasAirtablePat = !!process.env.AIRTABLE_PAT;
  const hasAirtableBase = !!process.env.AIRTABLE_BASE_ID;

  log(`\n${hasAirtablePat ? '✅' : '❌'} Airtable Personal Access Token`, hasAirtablePat ? 'green' : 'red');
  log(`${hasAirtableBase ? '✅' : '❌'} Airtable Base ID`, hasAirtableBase ? 'green' : 'red');

  if (!hasAirtablePat || !hasAirtableBase) {
    log('\n❌ Missing Airtable configuration in .env file', 'red');
    log('Run: npm run setup:full', 'yellow');
    process.exit(1);
  }

  // Check ngrok
  const ngrokInstalled = await checkNgrokInstalled();
  log(`${ngrokInstalled ? '✅' : '⚠️'} ngrok ${ngrokInstalled ? 'installed' : 'not found'}`, ngrokInstalled ? 'green' : 'yellow');

  if (!ngrokInstalled) {
    log('\n⚠️  ngrok not installed. You need it to expose your server.', 'yellow');
    log('Install options:', 'cyan');
    log('  1. Download: https://ngrok.com/download', 'white');
    log('  2. Or run: choco install ngrok -y', 'white');
    log('\nAfter installing ngrok, run this script again.', 'yellow');
    process.exit(0);
  }

  log('\n✅ All prerequisites met!', 'green');
}

async function startWebhookServer() {
  logStep(2, 5, 'Starting Webhook Server');

  const port = process.env.PORT || 3000;
  
  // Check if already running
  const isRunning = await checkServerHealth(port);
  
  if (isRunning) {
    log(`\n✅ Server already running on port ${port}`, 'green');
    return port;
  }

  log(`\nStarting server on port ${port}...`, 'cyan');
  
  const server = spawn('node', ['src/index.js'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: port }
  });

  server.unref();

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  const running = await checkServerHealth(port);
  
  if (running) {
    log(`✅ Server started successfully on http://localhost:${port}`, 'green');
    return port;
  } else {
    log('❌ Failed to start server', 'red');
    log('Try manually: npm start', 'yellow');
    process.exit(1);
  }
}

async function startNgrokTunnel(port) {
  logStep(3, 5, 'Creating Public Tunnel');

  log(`\nStarting ngrok tunnel to port ${port}...`, 'cyan');
  log('This will give you a public HTTPS URL\n', 'dim');

  // Start ngrok in background
  const ngrok = spawn('ngrok', ['http', port.toString()], {
    detached: false,
    stdio: 'pipe'
  });

  // Give ngrok time to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get ngrok URL from API
  return new Promise((resolve) => {
    http.get('http://localhost:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tunnels = JSON.parse(data);
          const httpsUrl = tunnels.tunnels.find(t => t.proto === 'https')?.public_url;
          
          if (httpsUrl) {
            resolve(httpsUrl);
          } else {
            log('❌ Could not get ngrok URL', 'red');
            log('Ngrok may not have started properly', 'yellow');
            resolve(null);
          }
        } catch (e) {
          log('❌ Error reading ngrok API', 'red');
          resolve(null);
        }
      });
    }).on('error', () => {
      log('❌ Could not connect to ngrok', 'red');
      log('Make sure ngrok is running: ngrok http ' + port, 'yellow');
      resolve(null);
    });
  });
}

async function testWebhook() {
  logStep(4, 5, 'Testing Webhook Connection');

  log('\nSending test webhook...', 'cyan');

  try {
    const result = await sendTestWebhook();
    
    if (result.statusCode === 200 && result.body.success) {
      log('\n✅ Webhook test PASSED!', 'green');
      log(`   Call ID: ${result.body.callId}`, 'dim');
      log(`   Direction: ${result.body.details.direction}`, 'dim');
      log(`   Duration: ${result.body.details.duration}s`, 'dim');
      return true;
    } else {
      log(`\n⚠️  Webhook returned status ${result.statusCode}`, 'yellow');
      log('Response: ' + JSON.stringify(result.body, null, 2), 'dim');
      return false;
    }
  } catch (error) {
    log('\n❌ Webhook test FAILED', 'red');
    log('Error: ' + error.message, 'dim');
    return false;
  }
}

async function showTelebroadInstructions(webhookUrl) {
  logStep(5, 5, 'Configure Telebroad Webhooks');

  const fullUrl = webhookUrl + '/webhooks/call-ended';

  logBox('COPY THIS WEBHOOK URL', fullUrl, 'green');

  log(`
${colors.cyan}NOW IN TELEBROAD TELECONSOLE:${colors.reset}

1. ${colors.bright}Log into TeleConsole${colors.reset}
   URL: ${colors.blue}https://teleconsole.telebroad.com${colors.reset}

2. ${colors.bright}Navigate to Webhooks Settings${colors.reset}
   Go to: Settings → Webhooks (or Integrations → Webhooks)

3. ${colors.bright}Create New Webhook${colors.reset}
   Click "Add Webhook" or "+ New Webhook"

4. ${colors.bright}Configure Webhook:${colors.reset}

   ${colors.yellow}Event/Trigger:${colors.reset}      Call Ended (or "Call Completed")
   ${colors.yellow}Webhook URL:${colors.reset}        ${colors.green}${fullUrl}${colors.reset}
   ${colors.yellow}Method:${colors.reset}             POST
   ${colors.yellow}Content-Type:${colors.reset}       application/json

5. ${colors.bright}Map Fields (Field Mapping):${colors.reset}

   ┌─────────────────────────┬──────────────────────────┐
   │ ${colors.cyan}Telebroad Field${colors.reset}         │ ${colors.cyan}Send As (JSON Key)${colors.reset}       │
   ├─────────────────────────┼──────────────────────────┤
   │ Call ID / Unique ID     │ callId                   │
   │ Timestamp / Call Time   │ timestamp                │
   │ Direction               │ direction                │
   │ Duration (seconds)      │ duration                 │
   │ Caller Number           │ callerNumber             │
   │ Extension               │ extension                │
   │ Recording URL           │ recordingUrl (optional)  │
   └─────────────────────────┴──────────────────────────┘

6. ${colors.bright}Test the Webhook${colors.reset}
   - Click "Test" or "Send Test Webhook" in Telebroad
   - You should see the webhook arrive in your terminal
   - Check Airtable to see if a call record was created

7. ${colors.bright}Enable the Webhook${colors.reset}
   - Toggle the webhook to "Active" or "Enabled"
   - All future calls will now auto-log to Airtable!

${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}

${colors.bright}IMPORTANT NOTES:${colors.reset}

${colors.yellow}⚠️  Keep These Running:${colors.reset}
   - Your webhook server (port ${process.env.PORT || 3000})
   - ngrok tunnel (for public URL)
   - Both must stay running to receive webhooks

${colors.cyan}🚀 Make It Permanent:${colors.reset}
   See TELEBROAD_WEBHOOK_SETUP.md for:
   - Running server as Windows service
   - Using permanent tunnel (ngrok paid or Cloudflare)
   - Deploying to cloud (Heroku, Railway, Render)

${colors.green}✅ Once configured, all calls auto-sync to Airtable!${colors.reset}
`, 'white');
}

async function showSummary(webhookUrl) {
  logBox('🎉 SETUP COMPLETE!', `
${colors.green}Your webhook integration is ready!${colors.reset}

${colors.cyan}What's Running:${colors.reset}
  ✓ Webhook server: http://localhost:${process.env.PORT || 3000}
  ✓ Public URL: ${webhookUrl}
  ✓ Endpoint: /webhooks/call-ended

${colors.yellow}Next Steps:${colors.reset}
  1. Configure webhook in Telebroad (see instructions above)
  2. Test by making a call through Telebroad
  3. Check Airtable "Calls" table for new record

${colors.cyan}Useful Commands:${colors.reset}
  npm run status          - Check Airtable tables
  npm run test:webhooks   - Test webhooks manually
  npm run automations     - Set up follow-up automations

${colors.dim}Keep this terminal open to see webhook logs in real-time${colors.reset}
`, 'green');
}

// Main execution
async function main() {
  try {
    await showIntro();
    await checkPrerequisites();
    
    const port = await startWebhookServer();
    const webhookUrl = await startNgrokTunnel(port);
    
    if (!webhookUrl) {
      log('\n❌ Could not create public tunnel', 'red');
      log('You can manually run: ngrok http ' + port, 'yellow');
      log('Then use the ngrok URL in Telebroad', 'yellow');
      process.exit(1);
    }

    log(`\n${colors.bgGreen}${colors.white} SUCCESS ${colors.reset} Public URL: ${colors.green}${webhookUrl}${colors.reset}\n`);

    await testWebhook();
    await showTelebroadInstructions(webhookUrl);
    await showSummary(webhookUrl);

    log('\n' + colors.yellow + 'Press CTRL+C to stop when done configuring Telebroad' + colors.reset);
    
    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle CTRL+C
process.on('SIGINT', () => {
  log('\n\n👋 Shutting down...', 'yellow');
  log('Note: Server and ngrok may still be running in background', 'dim');
  log('To stop manually:', 'cyan');
  log('  - Close ngrok terminal window', 'white');
  log('  - Run: Get-Process node | Stop-Process', 'white');
  process.exit(0);
});

main();
