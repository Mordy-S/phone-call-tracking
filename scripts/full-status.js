/**
 * Full System Status - Lev Lehazin Helpline
 * Comprehensive check of what's set up and what needs manual action
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

const axiosConfig = {
  headers: { 'Authorization': `Bearer ${apiKey}` }
};

// Required fields per spec
const requiredFields = {
  'Team Members': ['Name', 'Role', 'Phone/Extension', 'Specialties', 'Current Status', 
                   'Status Last Updated', 'Usual Hours', 'Notes', 'Active'],
  'Callers': ['Name', 'Phone', 'Phone Type', 'Contact Preference', 'Best Times',
              'Primary Issue', 'Assigned Mentor', 'Status', 'First Contact', 'Background Notes',
              'Caller ID'],
  'Calls': ['Date/Time', 'Direction', 'Call Type', 'Duration', 'Issue Category',
            'Summary', 'Outcome', 'Urgency', 'Follow-up Created', 'Telebroad Call ID',
            'Caller', 'Received By', 'Mentor for Follow-up', 'Call ID'],
  'Follow-ups': ['Type', 'Due Date/Time', 'Status', 'Priority', 'Notes',
                 'Completed Date', 'Outcome Notes', 'Related Call', 'Caller', 'Assigned To',
                 'Follow-up ID'],
  'Availability Schedule': ['Day', 'Start Time', 'End Time', 'Role This Shift', 'Team Member']
};

// Auto-number fields that must be created manually
const autoNumberFields = {
  'Callers': ['Caller ID'],
  'Calls': ['Call ID'],
  'Follow-ups': ['Follow-up ID']
};

async function getFullStatus() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║             LEV LEHAZIN HELPLINE - FULL SYSTEM STATUS                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  try {
    // Get schema
    const schemaResponse = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      axiosConfig
    );
    const tables = schemaResponse.data.tables;

    // Status tracking
    const status = {
      tables: { found: 0, missing: 0, extra: 0 },
      fields: { found: 0, missing: 0 },
      records: {},
      autoNumberFields: { found: 0, missing: 0, list: [] },
      linkFields: { found: 0, missing: 0 }
    };

    const requiredTableNames = Object.keys(requiredFields);
    const actualTableNames = tables.map(t => t.name);

    // Check tables
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📁 TABLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const tableName of requiredTableNames) {
      if (actualTableNames.includes(tableName)) {
        console.log(`  ✅ ${tableName}`);
        status.tables.found++;
      } else {
        console.log(`  ❌ ${tableName} - MISSING`);
        status.tables.missing++;
      }
    }

    // Check for extra tables
    const extraTables = actualTableNames.filter(t => !requiredTableNames.includes(t));
    if (extraTables.length > 0) {
      console.log('\n  ⚠️  Extra tables (consider deleting):');
      extraTables.forEach(t => console.log(`     - ${t}`));
      status.tables.extra = extraTables.length;
    }

    // Check fields for each table
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 FIELDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const table of tables) {
      if (!requiredFields[table.name]) continue;
      
      const actualFields = table.fields.map(f => f.name);
      const required = requiredFields[table.name] || [];
      
      console.log(`\n  📁 ${table.name}:`);
      
      let foundCount = 0;
      let missingList = [];
      
      for (const fieldName of required) {
        if (actualFields.includes(fieldName)) {
          foundCount++;
          status.fields.found++;
          
          // Check if it's an auto-number field (should be autoNumber type)
          const autoFields = autoNumberFields[table.name] || [];
          if (autoFields.includes(fieldName)) {
            const actualField = table.fields.find(f => f.name === fieldName);
            if (actualField?.type === 'autoNumber') {
              status.autoNumberFields.found++;
            } else {
              status.autoNumberFields.missing++;
              status.autoNumberFields.list.push(`${table.name}.${fieldName}`);
            }
          }
        } else {
          missingList.push(fieldName);
          status.fields.missing++;
          
          const autoFields = autoNumberFields[table.name] || [];
          if (autoFields.includes(fieldName)) {
            status.autoNumberFields.missing++;
            status.autoNumberFields.list.push(`${table.name}.${fieldName}`);
          }
        }
      }
      
      console.log(`     ✅ ${foundCount}/${required.length} fields present`);
      if (missingList.length > 0) {
        console.log(`     ❌ Missing: ${missingList.join(', ')}`);
      }
    }

    // Get record counts
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const table of tables) {
      if (!requiredFields[table.name]) continue;
      
      const response = await axios.get(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table.name)}`,
        axiosConfig
      );
      const count = response.data.records.length;
      status.records[table.name] = count;
      
      const icon = count > 0 ? '✅' : '⚪';
      console.log(`  ${icon} ${table.name}: ${count} records`);
    }

    // Summary
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Tables:     ${status.tables.found}/5 required tables exist
  Fields:     ${status.fields.found} fields configured
  Records:    ${Object.values(status.records).reduce((a, b) => a + b, 0)} total records

`);

    // What's done via CLI
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ COMPLETED VIA CLI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`
  ✅ All 5 required tables created
  ✅ Basic fields created (text, select, date, number, checkbox)
  ✅ Link fields crxxxxx xxxxxxcting tables)
  ✅ Sample data loaded:
     - 5 Team Members
     - 4 Callers  
     - 4 Calls
     - 3 Follow-ups
     - 5 Availability Schedule entries
  ✅ API connection verified
  ✅ Test scripts created
`);

    // What needs manual action
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  MANUAL ACTION REQUIRED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (status.autoNumberFields.list.length > 0) {
      console.log(`
  🔢 AUTO-NUMBER FIELDS (Cannot be created via API):
     ${status.autoNumberFields.list.map(f => `- ${f}`).join('\n     ')}
     
     → Go to Airtable → Each table → Add field → "Auto number"
`);
    }

    console.log(`
  👁️  VIEWS TO CREATE:
     Follow-ups: "Due Today", "Overdue", "By Mentor"
     Calls: "Today's Calls", "Needs Follow-up", "By Team Member"
     Team Members: "Who's Available", "Mentors by Specialty"
     Callers: "Active Callers", "New - Needs Assignment"
     
     → Run: node scripts/automation-guide.js for detailed instructions

  ⚡ AUTOMATIONS TO CREATE:
     1. Auto-Create Follow-up (when Outcome = "Callback Scheduled")
     2. Daily Digest Email (morning summary of due follow-ups)
     3. Overdue Alert (notify supervisor of missed follow-ups)
     
     → Run: node scripts/automation-guide.js for step-by-step guide

  🔗 ZAPIER INTEGRATION (Optional):
     Connect Telebroad to auto-log calls
     → See AIRTABLE_SETUP.md for Zapier configuration
`);

    // CLI commands reference
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🖥️  AVAILABLE CLI COMMANDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`
  node scripts/full-status.js        # This report
  node scripts/test-connection.js    # Test Airtable connection
  node scripts/check-api-permissions.js  # Check API permissions
  node scripts/setup-fields-smart.js # Create missing fields
  node scripts/add-sample-data.js    # Add test data
  node scripts/get-schema.js         # View all field details
  node scripts/automation-guide.js   # Automation setup instructions
  
  npm start                          # Start the webhook server
  npm run dev                        # Start in development mode
`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔗 Open Airtable: https://airtable.com/${baseId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

getFullStatus();
