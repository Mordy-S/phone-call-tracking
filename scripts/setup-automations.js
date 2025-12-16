const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

const axiosConfig = {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
};

console.log('🤖 Setting up Airtable Automations...\n');

// Get base schema to find table and field IDs
async function getBaseSchema() {
  const response = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    axiosConfig
  );
  return response.data.tables;
}

// Automation 1: Auto-Create Follow-up from Call
async function createAutomation1(tables) {
  const callsTable = tables.find(t => t.name === 'Calls');
  const followupsTable = tables.find(t => t.name === 'Follow-ups');

  if (!callsTable || !followupsTable) {
    console.log('❌ Required tables not found');
    return;
  }

  const automation = {
    name: 'Auto-Create Follow-up from Call',
    description: 'When a call outcome is "Callback Scheduled", automatically create a follow-up task',
    trigger: {
      type: 'recordMatchesConditions',
      options: {
        tableId: callsTable.id,
        filters: {
          conjunction: 'and',
          conditions: [
            {
              field: 'Outcome',
              operator: 'is',
              value: 'Callback Scheduled'
            },
            {
              field: 'Follow-up Created',
              operator: 'isEmpty'
            }
          ]
        }
      }
    },
    actions: [
      {
        type: 'createRecord',
        options: {
          tableId: followupsTable.id,
          fields: {
            'Related Call': '{{trigger.recordId}}',
            'Caller': '{{trigger.Caller}}',
            'Assigned To': '{{trigger.Mentor for Follow-up}}',
            'Type': 'Callback',
            'Status': 'Pending'
          }
        }
      },
      {
        type: 'updateRecord',
        options: {
          tableId: callsTable.id,
          recordId: '{{trigger.recordId}}',
          fields: {
            'Follow-up Created': true
          }
        }
      }
    ]
  };

  console.log('📋 Automation 1: Auto-Create Follow-up from Call');
  console.log('   This automation cannot be created via API yet.');
  console.log('   Please create manually in Airtable UI:\n');
  console.log('   Trigger: When record matches conditions');
  console.log('     Table: Calls');
  console.log('     When: Outcome = "Callback Scheduled" AND Follow-up Created is empty');
  console.log('   Actions:');
  console.log('     1. Create record in Follow-ups:');
  console.log('        - Related Call: (from trigger)');
  console.log('        - Caller: (from Calls.Caller)');
  console.log('        - Assigned To: (from Calls.Mentor for Follow-up)');
  console.log('        - Type: Callback');
  console.log('        - Status: Pending');
  console.log('     2. Update record in Calls:');
  console.log('        - Follow-up Created: ✓\n');
}

// Automation 2: Daily Digest Email
async function createAutomation2() {
  console.log('📋 Automation 2: Daily Digest Email');
  console.log('   This automation cannot be created via API yet.');
  console.log('   Please create manually in Airtable UI:\n');
  console.log('   Trigger: At scheduled time');
  console.log('     Time: 8:00 AM daily');
  console.log('   Condition: If Follow-ups in "Due Today" view > 0');
  console.log('   Action: Send email');
  console.log('     To: Team distribution list');
  console.log('     Subject: "Lev Lehazin - Follow-ups Due Today"');
  console.log('     Body: List records from "Due Today" view\n');
}

// Automation 3: Overdue Follow-up Alert
async function createAutomation3() {
  console.log('📋 Automation 3: Overdue Follow-up Alert');
  console.log('   This automation cannot be created via API yet.');
  console.log('   Please create manually in Airtable UI:\n');
  console.log('   Trigger: When record enters view');
  console.log('     View: "Overdue" (in Follow-ups table)');
  console.log('   Action: Send email');
  console.log('     To: Supervisor email');
  console.log('     Subject: "Overdue Follow-up Alert"');
  console.log('     Body: "Follow-up #{Follow-up ID} for Caller #{Caller ID}"');
  console.log('           "Was due: {Due Date/Time}"');
  console.log('           "Assigned to: {Assigned To}"\n');
}

async function main() {
  try {
    const tables = await getBaseSchema();
    
    console.log('Found tables:');
    tables.forEach(t => console.log(`  - ${t.name} (${t.id})`));
    console.log('');

    await createAutomation1(tables);
    await createAutomation2();
    await createAutomation3();

    console.log('─────────────────────────────────────────────────');
    console.log('⚠️  IMPORTANT: Airtable Automations API is limited');
    console.log('');
    console.log('Current Status:');
    console.log('  • Automation creation via API is not fully available');
    console.log('  • You must create automations manually in Airtable UI');
    console.log('');
    console.log('Steps to create automations:');
    console.log('  1. Open your Airtable base in browser');
    console.log('  2. Click "Automations" in top right');
    console.log('  3. Click "Create automation"');
    console.log('  4. Follow the instructions printed above');
    console.log('');
    console.log('📖 Detailed automation instructions are in the HTML spec');
    console.log('─────────────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();
