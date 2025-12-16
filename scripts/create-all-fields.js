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

// Get table metadata to find table IDs
async function getBaseSchema() {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      axiosConfig
    );
    return response.data.tables;
  } catch (error) {
    console.error('Error fetching base schema:', error.response?.data || error.message);
    throw error;
  }
}

// Field definitions for each table
const tableFieldDefinitions = {
  'Team Members': [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Role', type: 'singleSelect', options: { choices: [
      { name: 'Intaker' }, { name: 'Mentor' }, { name: 'Both' }
    ]}},
    { name: 'Phone/Extension', type: 'phoneNumber' },
    { name: 'Specialties', type: 'multipleSelects', options: { choices: [
      { name: 'Emotional/Mental Health' },
      { name: 'Technology/Internet' },
      { name: 'Kedusha' },
      { name: 'Learning/Motivation' },
      { name: 'Family/Relationships' },
      { name: 'Addiction' },
      { name: 'General' }
    ]}},
    { name: 'Current Status', type: 'singleSelect', options: { choices: [
      { name: '🟢 Available' }, { name: '🟡 Busy' }, { name: '🔴 Offline' }
    ]}},
    // Status Last Updated - auto field, create manually
    { name: 'Usual Hours', type: 'multilineText' },
    { name: 'Notes', type: 'multilineText' },
    { name: 'Active', type: 'checkbox', options: { icon: 'check', color: 'greenBright' }}
  ],
  'Callers': [
    // Caller ID - auto number, create manually in UI
    { name: 'Name', type: 'singleLineText' },
    { name: 'Phone', type: 'phoneNumber' },
    { name: 'Phone Type', type: 'singleSelect', options: { choices: [
      { name: 'Cell' }, { name: 'Home' }, { name: 'Work' }, { name: 'Public/Other' }
    ]}},
    { name: 'Contact Preference', type: 'singleSelect', options: { choices: [
      { name: 'Can receive callbacks' }, { name: 'Will call back only' }, { name: 'Either' }
    ]}},
    { name: 'Best Times', type: 'singleLineText' },
    { name: 'Primary Issue', type: 'singleSelect', options: { choices: [
      { name: 'Emotional/Mental Health' },
      { name: 'Technology/Internet' },
      { name: 'Kedusha' },
      { name: 'Learning/Motivation' },
      { name: 'Family/Relationships' },
      { name: 'Addiction' },
      { name: 'General' }
    ]}},
    { name: 'Status', type: 'singleSelect', options: { choices: [
      { name: 'New' }, { name: 'Active' }, { name: 'Stable' }, { name: 'Closed' }, { name: 'Referred Out' }
    ]}},
    { name: 'First Contact', type: 'date', options: { dateFormat: { name: 'us' }}},
    { name: 'Background Notes', type: 'multilineText' }
    // Link fields need to be added after: Assigned Mentor, Calls, Follow-ups
  ],
  'Calls': [
    // Call ID - auto number, create manually in UI
    { name: 'Date/Time', type: 'dateTime', options: { timeZone: 'client', dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }}},
    { name: 'Direction', type: 'singleSelect', options: { choices: [
      { name: 'Inbound' }, { name: 'Outbound' }, { name: 'Missed' }
    ]}},
    { name: 'Call Type', type: 'singleSelect', options: { choices: [
      { name: 'New Caller' }, { name: 'Follow-up' }, { name: 'Crisis' }, { name: 'Check-in' }, { name: 'Voicemail' }
    ]}},
    { name: 'Duration', type: 'number', options: { precision: 0 }},
    { name: 'Issue Category', type: 'multipleSelects', options: { choices: [
      { name: 'Emotional/Mental Health' },
      { name: 'Technology/Internet' },
      { name: 'Kedusha' },
      { name: 'Learning/Motivation' },
      { name: 'Family/Relationships' },
      { name: 'Addiction' },
      { name: 'General' }
    ]}},
    { name: 'Summary', type: 'multilineText' },
    { name: 'Outcome', type: 'singleSelect', options: { choices: [
      { name: 'Callback Scheduled' },
      { name: 'Caller Will Call Back' },
      { name: 'Resolved' },
      { name: 'Transferred' },
      { name: 'Left Voicemail' },
      { name: 'Referred Out' }
    ]}},
    { name: 'Urgency', type: 'singleSelect', options: { choices: [
      { name: 'Routine' },
      { name: 'Soon (24-48hrs)' },
      { name: 'Urgent (same day)' },
      { name: 'Crisis (immediate)' }
    ]}},
    { name: 'Follow-up Created', type: 'checkbox', options: { icon: 'check', color: 'greenBright' }},
    { name: 'Telebroad Call ID', type: 'singleLineText' }
    // Link fields: Caller, Received By, Mentor for Follow-up
  ],
  'Follow-ups': [
    // Follow-up ID - auto number, create manually in UI
    { name: 'Type', type: 'singleSelect', options: { choices: [
      { name: 'Callback' }, { name: 'Check-in' }, { name: 'Scheduled Session' }, { name: 'Internal Task' }
    ]}},
    { name: 'Due Date/Time', type: 'dateTime', options: { timeZone: 'client', dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }}},
    { name: 'Status', type: 'singleSelect', options: { choices: [
      { name: 'Pending' }, { name: 'Completed' }, { name: 'Rescheduled' }, { name: 'No Answer' }, { name: 'Cancelled' }
    ]}},
    { name: 'Priority', type: 'singleSelect', options: { choices: [
      { name: 'Normal' }, { name: 'High' }, { name: 'Urgent' }
    ]}},
    { name: 'Notes', type: 'multilineText' },
    { name: 'Completed Date', type: 'date', options: { dateFormat: { name: 'us' }}},
    { name: 'Outcome Notes', type: 'multilineText' }
    // Link fields: Related Call, Caller, Assigned To
  ],
  'Availability Schedule': [
    { name: 'Day', type: 'singleSelect', options: { choices: [
      { name: 'Sunday' }, { name: 'Monday' }, { name: 'Tuesday' }, 
      { name: 'Wednesday' }, { name: 'Thursday' }, { name: 'Motzei Shabbos' }
    ]}},
    { name: 'Start Time', type: 'singleLineText' },
    { name: 'End Time', type: 'singleLineText' },
    { name: 'Role This Shift', type: 'singleSelect', options: { choices: [
      { name: 'Intaker' }, { name: 'Mentor On-Call' }
    ]}}
    // Link field: Team Member
  ]
};

// Link field definitions (created after basic fields)
const linkFieldDefinitions = {
  'Callers': [
    { name: 'Assigned Mentor', type: 'multipleRecordLinks', options: { linkedTableId: 'TEAM_MEMBERS_ID', prefersSingleRecordLink: false }}
  ],
  'Calls': [
    { name: 'Received By', type: 'multipleRecordLinks', options: { linkedTableId: 'TEAM_MEMBERS_ID', prefersSingleRecordLink: false }},
    { name: 'Mentor for Follow-up', type: 'multipleRecordLinks', options: { linkedTableId: 'TEAM_MEMBERS_ID', prefersSingleRecordLink: false }}
  ],
  'Availability Schedule': []
};

async function createFields(tableId, tableName, fields) {
  console.log(`\n📝 Creating fields for "${tableName}"...`);
  
  for (const field of fields) {
    try {
      const response = await axios.post(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
        field,
        axiosConfig
      );
      console.log(`   ✅ Created: ${field.name} (${field.type})`);
    } catch (error) {
      if (error.response?.data?.error?.type === 'INVALID_REQUEST_BODY' && 
          error.response?.data?.error?.message?.includes('already exists')) {
        console.log(`   ⏭️  Skipped: ${field.name} (already exists)`);
      } else {
        console.log(`   ❌ Failed: ${field.name} - ${error.response?.data?.error?.message || error.message}`);
      }
    }
  }
}

async function createAllFields() {
  try {
    console.log('🔧 Setting up all table fields...\n');
    
    // Get table IDs
    const tables = await getBaseSchema();
    const tableMap = {};
    tables.forEach(table => {
      tableMap[table.name] = table.id;
    });

    console.log('📋 Found tables:');
    Object.entries(tableMap).forEach(([name, id]) => {
      console.log(`   ${name}: ${id}`);
    });

    // Create basic fields first
    for (const [tableName, fields] of Object.entries(tableFieldDefinitions)) {
      if (tableMap[tableName]) {
        await createFields(tableMap[tableName], tableName, fields);
      } else {
        console.log(`⚠️  Table "${tableName}" not found`);
      }
    }

    // Create link fields (with table IDs)
    console.log('\n🔗 Creating link fields...');
    for (const [tableName, linkFields] of Object.entries(linkFieldDefinitions)) {
      if (!tableMap[tableName]) continue;

      const processedLinks = linkFields.map(field => {
        const linkedTableName = field.options.linkedTableId.replace('_ID', '').replace(/_/g, ' ');
        const tableNames = {
          'TEAM MEMBERS': 'Team Members',
          'CALLERS': 'Callers',
          'CALLS': 'Calls',
          'FOLLOWUPS': 'Follow-ups'
        };
        const actualTableName = tableNames[linkedTableName] || linkedTableName;
        
        return {
          ...field,
          options: {
            ...field.options,
            linkedTableId: tableMap[actualTableName]
          }
        };
      });

      await createFields(tableMap[tableName], tableName, processedLinks);
    }

    console.log('\n✨ Field creation complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify fields in Airtable UI');
    console.log('   2. Run: node scripts/setup-views.js');
    console.log('   3. Run: node scripts/setup-automations.js');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createAllFields();
