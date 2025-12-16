require('dotenv').config();
const axios = require('axios');

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const headers = {
  'Authorization': `Bearer ${AIRTABLE_PAT}`,
  'Content-Type': 'application/json'
};

const baseUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

// Table schemas matching your system configuration
const tables = [
  {
    name: 'Team Members',
    description: 'Helpline team members (Intakers and Mentors)',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { 
        name: 'Role', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Intaker' },
            { name: 'Mentor' },
            { name: 'Both' }
          ]
        }
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
        options: {
          choices: [
            { name: '🟢 Available' },
            { name: '🟡 Busy' },
            { name: '🔴 Offline' }
          ]
        }
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
        options: {
          choices: [
            { name: 'Cell' },
            { name: 'Home' },
            { name: 'Work' },
            { name: 'Public/Other' }
          ]
        }
      },
      { 
        name: 'Contact Preference', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Can receive callbacks' },
            { name: 'Will call back only' },
            { name: 'Either' }
          ]
        }
      },
      { name: 'Best Times', type: 'multilineText' },
      { name: 'Primary Issue', type: 'singleLineText' },
      { name: 'Assigned Mentor', type: 'singleLineText' },
      { 
        name: 'Status', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'New' },
            { name: 'Active' },
            { name: 'Stable' },
            { name: 'Closed' },
            { name: 'Referred Out' }
          ]
        }
      },
      { 
        name: 'First Contact', 
        type: 'date',
        options: {
          dateFormat: { name: 'us', format: 'M/D/YYYY' }
        }
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
        options: {
          choices: [
            { name: 'Inbound' },
            { name: 'Outbound' },
            { name: 'Missed' }
          ]
        }
      },
      { 
        name: 'Call Type', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'New Caller' },
            { name: 'Follow-up' },
            { name: 'Crisis' },
            { name: 'Check-in' },
            { name: 'Voicemail' }
          ]
        }
      },
      { name: 'Duration', type: 'number', options: { precision: 0 } },
      { name: 'Issue Category', type: 'singleLineText' },
      { name: 'Summary', type: 'multilineText' },
      { 
        name: 'Outcome', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Callback Scheduled' },
            { name: 'Caller Will Call Back' },
            { name: 'Resolved' },
            { name: 'Transferred' },
            { name: 'Left Voicemail' },
            { name: 'Referred Out' }
          ]
        }
      },
      { name: 'Mentor for Follow-up', type: 'singleLineText' },
      { 
        name: 'Urgency', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Routine' },
            { name: 'Soon (24-48hrs)' },
            { name: 'Urgent (same day)' },
            { name: 'Crisis (immediate)' }
          ]
        }
      },
      { name: 'Follow-up Created', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
      { name: 'Telebroad Call ID', type: 'singleLineText' }
    ]
  },
  {
    name: 'Follow-ups',
    description: 'Follow-up tasks and callbacks',
    fields: [
      { name: 'Task ID', type: 'singleLineText' },
      { 
        name: 'Type', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Callback' },
            { name: 'Check-in' },
            { name: 'Scheduled Session' },
            { name: 'Internal Task' }
          ]
        }
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
        options: {
          choices: [
            { name: 'Pending' },
            { name: 'Completed' },
            { name: 'Rescheduled' },
            { name: 'No Answer' },
            { name: 'Cancelled' }
          ]
        }
      },
      { 
        name: 'Priority', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Normal' },
            { name: 'High' },
            { name: 'Urgent' }
          ]
        }
      },
      { name: 'Notes', type: 'multilineText' },
      { 
        name: 'Completed Date', 
        type: 'date',
        options: {
          dateFormat: { name: 'us', format: 'M/D/YYYY' }
        }
      },
      { name: 'Outcome Notes', type: 'multilineText' }
    ]
  },
  {
    name: 'Availability Schedule',
    description: 'Team member availability schedule',
    fields: [
      { name: 'Schedule Entry', type: 'singleLineText' },
      { 
        name: 'Day', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Sunday' },
            { name: 'Monday' },
            { name: 'Tuesday' },
            { name: 'Wednesday' },
            { name: 'Thursday' },
            { name: 'Motzei Shabbos' }
          ]
        }
      },
      { name: 'Start Time', type: 'singleLineText' },
      { name: 'End Time', type: 'singleLineText' },
      { 
        name: 'Role This Shift', 
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Intaker' },
            { name: 'Mentor On-Call' }
          ]
        }
      }
    ]
  }
];

async function createTables() {
  console.log('🚀 Creating Airtable tables...\n');

  for (const tableSchema of tables) {
    try {
      console.log(`📋 Creating table: "${tableSchema.name}"...`);
      
      const response = await axios.post(baseUrl, tableSchema, { headers });
      
      console.log(`✅ Successfully created "${tableSchema.name}" (ID: ${response.data.id})`);
      console.log(`   Fields: ${response.data.fields.length} fields created\n`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      if (error.response) {
        console.error(`❌ Failed to create "${tableSchema.name}":`, error.response.data);
      } else {
        console.error(`❌ Failed to create "${tableSchema.name}":`, error.message);
      }
    }
  }

  console.log('\n🎉 Table creation complete!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run test:connection');
  console.log('2. Add linked record fields (Caller, Received By, etc.) manually in Airtable UI');
  console.log('3. Start adding data to your tables');
}

// Add linked record relationships after tables are created
async function addLinkedFields() {
  console.log('\n\n🔗 Setting up table relationships...');
  console.log('⚠️  Note: Linked record fields must be added via Airtable UI');
  console.log('\nManual steps needed in Airtable:');
  console.log('\n1. In "Calls" table, add these linked fields:');
  console.log('   - Caller → link to Callers table');
  console.log('   - Received By → link to Team Members table');
  console.log('\n2. In "Follow-ups" table, add these linked fields:');
  console.log('   - Related Call → link to Calls table');
  console.log('   - Caller → link to Callers table');
  console.log('   - Assigned To → link to Team Members table');
  console.log('\n3. In "Callers" table, add these linked fields:');
  console.log('   - Calls → link to Calls table (will auto-create from Calls link)');
  console.log('   - Follow-ups → link to Follow-ups table (will auto-create)');
  console.log('\n4. In "Availability Schedule" table, add:');
  console.log('   - Team Member → link to Team Members table');
}

// Run the script
if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('❌ Error: AIRTABLE_PAT and AIRTABLE_BASE_ID must be set in .env file');
  process.exit(1);
}

createTables()
  .then(() => addLinkedFields())
  .catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
