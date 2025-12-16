#!/usr/bin/env node
/**
 * Create Link Fields in Airtable
 * 
 * This script creates the missing link fields that connect tables together.
 * 
 * Usage: node scripts/create-link-fields.js
 */

require('dotenv').config();
const axios = require('axios');

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getTableId(tableName) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
      }
    );
    
    const table = response.data.tables.find(t => t.name === tableName);
    return table ? table.id : null;
  } catch (error) {
    console.error('Error getting table ID:', error.message);
    return null;
  }
}

async function fieldExists(tableId, fieldName) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
      }
    );
    
    const table = response.data.tables.find(t => t.id === tableId);
    if (!table) return false;
    
    return table.fields.some(f => f.name === fieldName);
  } catch (error) {
    return false;
  }
}

async function createLinkField(tableId, fieldName, linkedTableId, options = {}) {
  // Check if field already exists
  if (await fieldExists(tableId, fieldName)) {
    log(`  ⏭ ${fieldName}: Already exists`, 'yellow');
    return { success: true, skipped: true };
  }

  try {
    // Build the field configuration - Airtable API requires specific format
    const fieldConfig = {
      name: fieldName,
      type: 'multipleRecordLinks',
      options: {
        linkedTableId: linkedTableId
      }
    };

    const response = await axios.post(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`,
      fieldConfig,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json'
        }
      }
    );

    log(`  ✓ ${fieldName}: Created successfully`, 'green');
    return { success: true, data: response.data };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    
    // Check if it's a "field already exists" type error
    if (message.includes('already exists') || message.includes('duplicate')) {
      log(`  ⏭ ${fieldName}: Already exists`, 'yellow');
      return { success: true, skipped: true };
    }
    
    log(`  ✗ ${fieldName}: ${message}`, 'red');
    
    // Show manual creation instructions
    log(`     → Create manually in Airtable UI`, 'yellow');
    return { success: false, error: message };
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     CREATE LINK FIELDS IN AIRTABLE                           ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Get table IDs
  log('Getting table IDs...', 'cyan');
  
  const tableIds = {};
  const tableNames = ['Calls', 'Callers', 'Follow-ups', 'Team Members'];
  
  for (const name of tableNames) {
    tableIds[name] = await getTableId(name);
    if (tableIds[name]) {
      log(`  ✓ ${name}: ${tableIds[name]}`, 'green');
    } else {
      log(`  ✗ ${name}: Not found`, 'red');
    }
  }

  if (!tableIds['Calls'] || !tableIds['Callers'] || !tableIds['Follow-ups'] || !tableIds['Team Members']) {
    log('\n❌ Some tables are missing. Create all tables first.', 'red');
    return;
  }

  // Create link fields
  console.log('\n' + '═'.repeat(60));
  log('Creating link fields in Calls table...', 'cyan');
  console.log('═'.repeat(60));

  // Calls -> Callers (Caller field)
  await createLinkField(
    tableIds['Calls'],
    'Caller',
    tableIds['Callers'],
    { single: true, inverseName: 'Calls' }
  );

  // Calls -> Team Members (Received By field)
  await createLinkField(
    tableIds['Calls'],
    'Received By',
    tableIds['Team Members'],
    { single: true }
  );

  // Calls -> Team Members (Mentor for Follow-up field)
  await createLinkField(
    tableIds['Calls'],
    'Mentor for Follow-up',
    tableIds['Team Members'],
    { single: true }
  );

  console.log('\n' + '═'.repeat(60));
  log('Creating link fields in Follow-ups table...', 'cyan');
  console.log('═'.repeat(60));

  // Follow-ups -> Calls (Related Call field)
  await createLinkField(
    tableIds['Follow-ups'],
    'Related Call',
    tableIds['Calls'],
    { single: true }
  );

  // Follow-ups -> Callers (Caller field)
  await createLinkField(
    tableIds['Follow-ups'],
    'Caller',
    tableIds['Callers'],
    { single: true, inverseName: 'Follow-ups' }
  );

  // Follow-ups -> Team Members (Assigned To field)
  await createLinkField(
    tableIds['Follow-ups'],
    'Assigned To',
    tableIds['Team Members'],
    { single: true }
  );

  console.log('\n' + '═'.repeat(60));
  log('Creating link fields in Callers table...', 'cyan');
  console.log('═'.repeat(60));

  // Callers -> Team Members (Assigned Mentor field)
  await createLinkField(
    tableIds['Callers'],
    'Assigned Mentor',
    tableIds['Team Members'],
    { single: true }
  );

  console.log('\n' + '═'.repeat(60));
  log('✅ Link field creation complete!', 'green');
  console.log('═'.repeat(60));
  
  log(`
${colors.yellow}NEXT STEPS:${colors.reset}
1. Run the system check: npm run setup:full
2. Start Zapier setup: npm run setup:zapier
3. Start your server: npm start
`, 'white');
}

main().catch(console.error);
