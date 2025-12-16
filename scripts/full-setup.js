#!/usr/bin/env node
/**
 * Complete System Setup and Verification Script
 * 
 * This script checks the entire setup and provides a status report
 * 
 * Usage: node scripts/full-setup.js
 */

require('dotenv').config();
const axios = require('axios');
const Airtable = require('airtable');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${'═'.repeat(60)}`);
  log(`  ${title}`, 'cyan');
  console.log('═'.repeat(60));
}

// Check environment configuration
function checkEnvironment() {
  logSection('🔧 ENVIRONMENT CONFIGURATION');
  
  const required = {
    'AIRTABLE_PAT': process.env.AIRTABLE_PAT,
    'AIRTABLE_BASE_ID': process.env.AIRTABLE_BASE_ID
  };

  const optional = {
    'WEBHOOK_BASE_URL': process.env.WEBHOOK_BASE_URL,
    'SLACK_WEBHOOK_URL': process.env.SLACK_WEBHOOK_URL,
    'NOTIFICATION_EMAIL': process.env.NOTIFICATION_EMAIL,
    'PORT': process.env.PORT || '3000'
  };

  let allRequired = true;

  console.log('\n  Required:');
  for (const [key, value] of Object.entries(required)) {
    if (value) {
      const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
      log(`    ✓ ${key}: ${masked}`, 'green');
    } else {
      log(`    ✗ ${key}: Not set`, 'red');
      allRequired = false;
    }
  }

  console.log('\n  Optional:');
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      log(`    ✓ ${key}: ${value.substring(0, 30)}...`, 'green');
    } else {
      log(`    ○ ${key}: Not set`, 'yellow');
    }
  }

  return allRequired;
}

// Check Airtable connection and tables
async function checkAirtable() {
  logSection('📊 AIRTABLE CONNECTION');

  if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
    log('  ✗ Cannot check - missing credentials', 'red');
    return false;
  }

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);
    
    const requiredTables = [
      'Team Members',
      'Callers',
      'Calls',
      'Follow-ups',
      'Availability Schedule'
    ];

    const results = {};

    for (const tableName of requiredTables) {
      try {
        const records = await base(tableName).select({ maxRecords: 1 }).firstPage();
        results[tableName] = { exists: true, recordCount: 'accessible' };
        log(`  ✓ ${tableName}: Connected`, 'green');
      } catch (error) {
        if (error.message.includes('Could not find table')) {
          results[tableName] = { exists: false };
          log(`  ✗ ${tableName}: Table not found`, 'red');
        } else {
          results[tableName] = { exists: false, error: error.message };
          log(`  ✗ ${tableName}: Error - ${error.message}`, 'red');
        }
      }
    }

    const allTablesExist = Object.values(results).every(r => r.exists);
    return allTablesExist;
  } catch (error) {
    log(`  ✗ Connection failed: ${error.message}`, 'red');
    return false;
  }
}

// Check required fields in each table
async function checkAirtableFields() {
  logSection('📋 AIRTABLE FIELDS CHECK');

  if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
    log('  ✗ Cannot check - missing credentials', 'red');
    return false;
  }

  try {
    // Use metadata API to get field info
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}` }
      }
    );

    const tables = response.data.tables;
    
    // Required fields for each table
    const requiredFields = {
      'Calls': [
        'Date/Time', 'Direction', 'Duration', 'Telebroad Call ID',
        'Caller', 'Received By', 'Call Type', 'Summary', 'Outcome',
        'Follow-up Created', 'Urgency', 'Mentor for Follow-up'
      ],
      'Callers': [
        'Name', 'Phone', 'Phone Type', 'Contact Preference', 
        'Status', 'Primary Issue', 'Assigned Mentor'
      ],
      'Follow-ups': [
        'Related Call', 'Caller', 'Assigned To', 'Type',
        'Due Date/Time', 'Status', 'Priority', 'Notes'
      ],
      'Team Members': [
        'Name', 'Role', 'Phone/Extension', 'Specialties',
        'Current Status', 'Active'
      ]
    };

    let allFieldsOk = true;

    for (const [tableName, required] of Object.entries(requiredFields)) {
      const table = tables.find(t => t.name === tableName);
      if (!table) {
        log(`\n  ${tableName}: Table not found`, 'red');
        allFieldsOk = false;
        continue;
      }

      const existingFields = table.fields.map(f => f.name);
      const missing = required.filter(f => !existingFields.includes(f));

      console.log(`\n  ${tableName}:`);
      if (missing.length === 0) {
        log(`    ✓ All ${required.length} required fields exist`, 'green');
      } else {
        log(`    ⚠ Missing ${missing.length} fields:`, 'yellow');
        for (const field of missing) {
          log(`      - ${field}`, 'yellow');
        }
        allFieldsOk = false;
      }
    }

    return allFieldsOk;
  } catch (error) {
    log(`  ✗ Error checking fields: ${error.message}`, 'red');
    return false;
  }
}

// Check if server can be started
async function checkServer() {
  logSection('🌐 WEBHOOK SERVER');

  const port = process.env.PORT || 3000;
  const url = `http://localhost:${port}/health`;

  try {
    const response = await axios.get(url, { timeout: 3000 });
    log(`  ✓ Server running on port ${port}`, 'green');
    log(`  ✓ Health check: ${JSON.stringify(response.data)}`, 'green');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log(`  ○ Server not running (port ${port})`, 'yellow');
      log(`    Start with: npm start`, 'dim');
    } else {
      log(`  ✗ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

// Generate setup instructions
function generateInstructions(results) {
  logSection('📝 NEXT STEPS');

  const steps = [];

  if (!results.environment) {
    steps.push({
      priority: 'HIGH',
      task: 'Set up environment variables',
      details: 'Edit .env file and add AIRTABLE_PAT and AIRTABLE_BASE_ID'
    });
  }

  if (!results.airtable) {
    steps.push({
      priority: 'HIGH', 
      task: 'Create Airtable tables',
      details: 'Run: npm run create:tables\nOr create manually in Airtable UI'
    });
  }

  if (!results.fields) {
    steps.push({
      priority: 'HIGH',
      task: 'Add missing Airtable fields',
      details: 'See SETUP_STATUS.md for field checklist'
    });
  }

  if (!results.server) {
    steps.push({
      priority: 'MEDIUM',
      task: 'Start webhook server',
      details: 'Run: npm start\nFor production, use: npm run scheduler'
    });
  }

  steps.push({
    priority: 'MEDIUM',
    task: 'Set up Zapier integrations',
    details: 'Run: node scripts/setup-zapier.js'
  });

  steps.push({
    priority: 'LOW',
    task: 'Test the integration',
    details: 'Run: node scripts/test-webhooks.js --all'
  });

  if (steps.length === 0) {
    log('\n  ✅ Everything is set up! Your system is ready.', 'green');
  } else {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const priorityColor = step.priority === 'HIGH' ? 'red' : step.priority === 'MEDIUM' ? 'yellow' : 'green';
      console.log(`\n  ${i + 1}. [${colors[priorityColor]}${step.priority}${colors.reset}] ${step.task}`);
      console.log(`     ${colors.dim}${step.details}${colors.reset}`);
    }
  }
}

// Quick commands reference
function showQuickCommands() {
  logSection('⚡ QUICK COMMANDS');
  
  console.log(`
  ${colors.cyan}Setup & Configuration:${colors.reset}
    npm run test:connection      Test Airtable connection
    npm run status               Show system status
    node scripts/setup-zapier.js Interactive Zapier setup guide

  ${colors.cyan}Running the System:${colors.reset}
    npm start                    Start webhook server
    npm run scheduler            Start background scheduler
    npm run auto                 Run all automations once

  ${colors.cyan}Testing:${colors.reset}
    node scripts/test-webhooks.js --all    Test all webhooks
    node scripts/test-webhooks.js --call   Test call logging

  ${colors.cyan}Daily Operations:${colors.reset}
    npm run auto:digest          Morning digest
    npm run auto:overdue         Check overdue follow-ups
    npm run auto:followups       Create pending follow-ups
`);
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     LEV LEHAZIN HELPLINE - FULL SYSTEM CHECK                 ║
╚══════════════════════════════════════════════════════════════╝`);

  const results = {
    environment: false,
    airtable: false,
    fields: false,
    server: false
  };

  // Run all checks
  results.environment = checkEnvironment();
  results.airtable = await checkAirtable();
  results.fields = await checkAirtableFields();
  results.server = await checkServer();

  // Summary
  logSection('📊 SUMMARY');
  
  console.log(`
  Environment:     ${results.environment ? colors.green + '✓ OK' : colors.red + '✗ Issues'}${colors.reset}
  Airtable Tables: ${results.airtable ? colors.green + '✓ OK' : colors.red + '✗ Issues'}${colors.reset}
  Airtable Fields: ${results.fields ? colors.green + '✓ OK' : colors.yellow + '⚠ Missing'}${colors.reset}
  Webhook Server:  ${results.server ? colors.green + '✓ Running' : colors.yellow + '○ Not running'}${colors.reset}
`);

  // Generate instructions based on results
  generateInstructions(results);
  
  // Show quick commands
  showQuickCommands();
}

main().catch(console.error);
