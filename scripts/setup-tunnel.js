#!/usr/bin/env node
/**
 * Tunnel/ngrok Setup Script for Lev Lehazin Helpline
 * 
 * Helps expose your local webhook server to the internet
 * so Zapier/Telebroad can send webhooks to it.
 * 
 * Usage: node scripts/setup-tunnel.js
 */

require('dotenv').config();
const { spawn, exec } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset} `, resolve);
  });
}

// Check if ngrok is installed
function checkNgrok() {
  return new Promise((resolve) => {
    exec('ngrok version', (error, stdout) => {
      if (error) {
        resolve({ installed: false });
      } else {
        resolve({ installed: true, version: stdout.trim() });
      }
    });
  });
}

// Check if localtunnel is installed
function checkLocaltunnel() {
  return new Promise((resolve) => {
    exec('lt --version', (error, stdout) => {
      if (error) {
        resolve({ installed: false });
      } else {
        resolve({ installed: true, version: stdout.trim() });
      }
    });
  });
}

async function installNgrok() {
  log(`
${colors.cyan}NGROK INSTALLATION:${colors.reset}

${colors.yellow}Option 1: Download from website (recommended)${colors.reset}
  1. Go to: https://ngrok.com/download
  2. Download for Windows
  3. Extract ngrok.exe to a folder in your PATH
  4. Sign up at ngrok.com and get your authtoken
  5. Run: ngrok config add-authtoken YOUR_TOKEN

${colors.yellow}Option 2: Install via Chocolatey${colors.reset}
  choco install ngrok

${colors.yellow}Option 3: Install via Scoop${colors.reset}
  scoop install ngrok
`, 'white');
}

async function installLocaltunnel() {
  log(`
${colors.cyan}LOCALTUNNEL INSTALLATION:${colors.reset}

Localtunnel is a free alternative to ngrok.
Install globally with npm:

  npm install -g localtunnel

Then run:
  lt --port 3000
`, 'white');
}

async function startNgrok() {
  const port = process.env.PORT || 3000;
  
  log(`\n${colors.cyan}Starting ngrok tunnel on port ${port}...${colors.reset}`, 'white');
  
  const ngrok = spawn('ngrok', ['http', port.toString()], {
    stdio: 'inherit',
    shell: true
  });

  ngrok.on('error', (err) => {
    log(`Error starting ngrok: ${err.message}`, 'red');
  });

  log(`
${colors.green}Ngrok is starting...${colors.reset}

Once it's running, you'll see a forwarding URL like:
  https://abc123.ngrok.io -> http://localhost:${port}

${colors.yellow}Copy that https URL and use it for:${colors.reset}
  1. Zapier webhooks
  2. Telebroad callback URL
  3. Update WEBHOOK_BASE_URL in .env

${colors.dim}Press Ctrl+C to stop ngrok${colors.reset}
`, 'white');
}

async function startLocaltunnel() {
  const port = process.env.PORT || 3000;
  
  log(`\n${colors.cyan}Starting localtunnel on port ${port}...${colors.reset}`, 'white');
  
  const lt = spawn('lt', ['--port', port.toString()], {
    stdio: 'inherit',
    shell: true
  });

  lt.on('error', (err) => {
    log(`Error starting localtunnel: ${err.message}`, 'red');
  });

  log(`
${colors.green}Localtunnel is starting...${colors.reset}

You'll get a URL like:
  https://xyz.loca.lt

${colors.yellow}Use this URL for Zapier/Telebroad webhooks${colors.reset}

${colors.dim}Press Ctrl+C to stop${colors.reset}
`, 'white');
}

function showWebhookUrls(baseUrl) {
  const port = process.env.PORT || 3000;
  
  log(`
${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}
${colors.bright}                 WEBHOOK ENDPOINTS                              ${colors.reset}
${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}

${colors.yellow}For Zapier / Telebroad, use these URLs:${colors.reset}

${colors.green}Zap 1 - Log Completed Calls:${colors.reset}
  POST ${baseUrl || 'https://YOUR-TUNNEL-URL'}/webhooks/call-ended

${colors.green}Zap 2 - Missed Call Alerts:${colors.reset}
  POST ${baseUrl || 'https://YOUR-TUNNEL-URL'}/webhooks/missed-call

${colors.green}Zap 3 - Create Follow-up:${colors.reset}
  POST ${baseUrl || 'https://YOUR-TUNNEL-URL'}/webhooks/create-followup

${colors.green}Zap 4 - Get Overdue Alerts:${colors.reset}
  GET ${baseUrl || 'https://YOUR-TUNNEL-URL'}/webhooks/overdue-alerts

${colors.green}Daily Digest:${colors.reset}
  GET ${baseUrl || 'https://YOUR-TUNNEL-URL'}/webhooks/daily-digest

${colors.green}Health Check:${colors.reset}
  GET ${baseUrl || 'https://YOUR-TUNNEL-URL'}/health

${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}
`, 'white');
}

function showInstructions() {
  log(`
╔══════════════════════════════════════════════════════════════╗
║     LEV LEHAZIN - TUNNEL SETUP FOR WEBHOOKS                  ║
╚══════════════════════════════════════════════════════════════╝

${colors.cyan}WHY DO YOU NEED THIS?${colors.reset}

Your webhook server runs locally (localhost:3000), but Zapier
and Telebroad need a public URL to send webhooks to.

A tunnel creates a public URL that forwards to your local server.

${colors.cyan}OPTIONS:${colors.reset}

1. ${colors.green}ngrok${colors.reset} (recommended)
   - Stable, fast, good free tier
   - Requires signup at ngrok.com
   - Free: 1 tunnel, random URL each time
   - Paid: Custom domains, more tunnels

2. ${colors.green}localtunnel${colors.reset} (free alternative)
   - Completely free, no signup
   - Install with: npm install -g localtunnel
   - Less stable than ngrok

3. ${colors.green}Cloudflare Tunnel${colors.reset} (production)
   - Best for production use
   - Free with Cloudflare account
   - More complex setup

${colors.cyan}FOR PRODUCTION:${colors.reset}
Consider deploying your server to:
- Railway.app (easy Node.js hosting)
- Render.com
- Heroku
- DigitalOcean App Platform
`, 'white');
}

async function main() {
  showInstructions();
  
  // Check installed tools
  log('\n${colors.cyan}Checking installed tools...${colors.reset}', 'white');
  
  const ngrokStatus = await checkNgrok();
  const ltStatus = await checkLocaltunnel();
  
  if (ngrokStatus.installed) {
    log(`  ✓ ngrok: ${ngrokStatus.version}`, 'green');
  } else {
    log('  ○ ngrok: Not installed', 'yellow');
  }
  
  if (ltStatus.installed) {
    log(`  ✓ localtunnel: installed`, 'green');
  } else {
    log('  ○ localtunnel: Not installed', 'yellow');
  }
  
  // Menu
  console.log(`
${colors.cyan}What would you like to do?${colors.reset}
  1. Start ngrok tunnel
  2. Start localtunnel
  3. Install ngrok (show instructions)
  4. Install localtunnel
  5. Show webhook URLs
  6. Exit
`);
  
  const choice = await ask('Enter choice (1-6):');
  
  switch (choice) {
    case '1':
      if (!ngrokStatus.installed) {
        log('\nngrok is not installed. See installation instructions:', 'yellow');
        await installNgrok();
      } else {
        await startNgrok();
      }
      break;
    case '2':
      if (!ltStatus.installed) {
        log('\nInstalling localtunnel...', 'cyan');
        exec('npm install -g localtunnel', async (error) => {
          if (error) {
            log(`Error installing: ${error.message}`, 'red');
          } else {
            log('Installed successfully!', 'green');
            await startLocaltunnel();
          }
        });
      } else {
        await startLocaltunnel();
      }
      break;
    case '3':
      await installNgrok();
      break;
    case '4':
      await installLocaltunnel();
      break;
    case '5':
      const url = await ask('Enter your tunnel URL (or press Enter for placeholder):');
      showWebhookUrls(url || null);
      break;
    case '6':
      log('Goodbye!', 'green');
      break;
    default:
      log('Invalid choice', 'red');
  }
  
  rl.close();
}

main().catch(console.error);
