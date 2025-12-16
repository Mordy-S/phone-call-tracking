require('dotenv').config();
const axios = require('axios');

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const headers = {
  'Authorization': `Bearer ${AIRTABLE_PAT}`,
  'Content-Type': 'application/json'
};

const baseUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

const tables = [
  {
    name: 'Team Members',
    description: 'Helpline team members',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { 
        name: 'Role', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Intaker' }, { name: 'Mentor' }, { name: 'Both' }] }
      },
      { name: 'Phone/Extension', type: 'phoneNumber' },
      { 
        name: 'Specialties', 
        type: 'multipleSelects',
        options: {
          choices: [
            { name: 'Emotional/Mental Health' },
            { name: 'Technology/Internet' },
            { name: 'Kedusha' },
            { name: 'Learning/Motivation' },
            { name: 'Family/Relationships' },
            { name: 'Addiction' },
            { name: 'General' }
          ]
        }
      },
      { 
        name: 'Current Status', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Available' }, { name: 'Busy' }, { name: 'Offline' }] }
      },
      { 
        name: 'Status Last Updated', 
        type: 'dateTime', 
        options: {
          dateFormat: { name: 'us', format: 'M/D/YYYY' },
          timeFormat: { name: '12hour', format: 'h:mma' },
          timeZone: 'America/New_York'
        } 
      },
      { name: 'Usual Hours', type: 'multilineText' },
      { name: 'Notes', type: 'multilineText' },
      { name: 'Active', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } }
    ]
  },
  {
    name: 'Callers',
    description: 'People who call the helpline',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Phone', type: 'phoneNumber' },
      { 
        name: 'Phone Type', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Cell' }, { name: 'Home' }, { name: 'Work' }, { name: 'Public/Other' }] }
      },
      { 
        name: 'Contact Preference', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Can receive callbacks' }, { name: 'Will call back only' }, { name: 'Either' }] }
      },
      { name: 'Best Times', type: 'multilineText' },
      { name: 'Primary Issue', type: 'singleLineText' },
      { name: 'Assigned Mentor', type: 'singleLineText' },
      { 
        name: 'Status', 
        type: 'singleSelect',
        options: { choices: [{ name: 'New' }, { name: 'Active' }, { name: 'Stable' }, { name: 'Closed' }, { name: 'Referred Out' }] }
      },
      { 
        name: 'First Contact', 
        type: 'date', 
        options: { dateFormat: { name: 'us', format: 'M/D/YYYY' } } 
      },
      { name: 'Background Notes', type: 'multilineText' }
    ]
  },
  {
    name: 'Calls',
    description: 'Call records from Telebroad',
    fields: [
      { 
        name: 'Date/Time', 
        type: 'dateTime', 
        options: {
          dateFormat: { name: 'us', format: 'M/D/YYYY' },
          timeFormat: { name: '12hour', format: 'h:mma' },
          timeZone: 'America/New_York'
        } 
      },
      { 
        name: 'Direction', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Inbound' }, { name: 'Outbound' }, { name: 'Missed' }] }
      },
      { 
        name: 'Call Type', 
        type: 'singleSelect',
        options: { choices: [{ name: 'New Caller' }, { name: 'Follow-up' }, { name: 'Crisis' }, { name: 'Check-in' }, { name: 'Voicemail' }] }
      },
      { name: 'Duration', type: 'number', options: { precision: 0 } },
      { name: 'Issue Category', type: 'singleLineText' },
      { name: 'Summary', type: 'multilineText' },
      { 
        name: 'Outcome', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Callback Scheduled' }, { name: 'Caller Will Call Back' }, { name: 'Resolved' }, { name: 'Transferred' }, { name: 'Left Voicemail' }, { name: 'Referred Out' }] }
      },
      { name: 'Mentor for Follow-up', type: 'singleLineText' },
      { 
        name: 'Urgency', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Routine' }, { name: 'Soon (24-48hrs)' }, { name: 'Urgent (same day)' }, { name: 'Crisis (immediate)' }] }
      },
      { name: 'Follow-up Created', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
      { name: 'Telebroad Call ID', type: 'singleLineText' }
    ]
  },
  {
    name: 'Follow-ups',
    description: 'Follow-up tasks and callbacks',
    fields: [
      { name: 'Task Description', type: 'singleLineText' },
      { 
        name: 'Type', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Callback' }, { name: 'Check-in' }, { name: 'Scheduled Session' }, { name: 'Internal Task' }] }
      },
      { 
        name: 'Due Date/Time', 
        type: 'dateTime', 
        options: {
          dateFormat: { name: 'us', format: 'M/D/YYYY' },
          timeFormat: { name: '12hour', format: 'h:mma' },
          timeZone: 'America/New_York'
        } 
      },
      { 
        name: 'Status', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Pending' }, { name: 'Completed' }, { name: 'Rescheduled' }, { name: 'No Answer' }, { name: 'Cancelled' }] }
      },
      { 
        name: 'Priority', 
        type: 'singleSelect',
        options: { choices: [{ name: 'Normal' }, { name: 'High' }, { name: 'Urgent' }] }
      },
      { name: 'Notes', type: 'multilineText' },
      { 
        name: 'Completed Date', 
        type: 'date', 
        options: { dateFormat: { name: 'us', format: 'M/D/YYYY' } } 
      },
      { name: 'Outcome Notes', type: 'multilineText' }
    ]
  }
];

async function createTables() {
  console.log('🚀 Creating Airtable tables...\n');

  for (const tableSchema of tables) {
    try {
      console.log(`📋 Creating table: "${tableSchema.name}"...`);
      const response = await axios.post(baseUrl, tableSchema, { headers });
      console.log(`✅ Successfully created "${tableSchema.name}" (ID: ${response.data.id})\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      if (error.response) {
        console.error(`❌ Failed to create "${tableSchema.name}":`, error.response.data.error.message);
      } else {
        console.error(`❌ Failed to create "${tableSchema.name}":`, error.message);
      }
    }
  }

  console.log('\n🎉 Table creation complete!');
  console.log('\nNext: Add linked fields in Airtable UI:');
  console.log('  - Calls table: add "Caller" (link to Callers), "Received By" (link to Team Members)');
  console.log('  - Follow-ups table: add "Caller", "Assigned To", "Related Call" links');
  console.log('  - Availability Schedule: add "Team Member" link');
  console.log('\nThen run: npm run test:connection\n');
}

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('❌ Error: AIRTABLE_PAT and AIRTABLE_BASE_ID must be set in .env file');
  process.exit(1);
}

createTables().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
