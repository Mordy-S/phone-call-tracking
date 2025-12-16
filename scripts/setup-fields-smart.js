/**
 * Smart Field Setup - Check and Create Missing Fields
 * This script:
 * 1. Gets current schema from Airtable
 * 2. Compares with required fields from spec
 * 3. Creates only missing fields
 * 4. Reports status
 */
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

// All required fields per the Lev Lehazin specification
const requiredFields = {
  'Team Members': [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Role', type: 'singleSelect', options: { choices: [
      { name: 'Intaker' }, { name: 'Mentor' }, { name: 'Both' }
    ]}},
    { name: 'Phone/Extension', type: 'phoneNumber' },
    { name: 'Specialties', type: 'multipleSelects', options: { choices: [
      { name: 'Emotional/Mental Health' }, { name: 'Technology/Internet' },
      { name: 'Kedusha' }, { name: 'Learning/Motivation' },
      { name: 'Family/Relationships' }, { name: 'Addiction' }, { name: 'General' }
    ]}},
    { name: 'Current Status', type: 'singleSelect', options: { choices: [
      { name: '🟢 Available' }, { name: '🟡 Busy' }, { name: '🔴 Offline' }
    ]}},
    { name: 'Status Last Updated', type: 'dateTime', options: { 
      dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }, timeZone: 'client' 
    }},
    { name: 'Usual Hours', type: 'multilineText' },
    { name: 'Notes', type: 'multilineText' },
    { name: 'Active', type: 'checkbox', options: { icon: 'check', color: 'greenBright' }}
  ],
  'Callers': [
    // Note: Caller ID (Auto Number) must be created manually in UI
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
      { name: 'Emotional/Mental Health' }, { name: 'Technology/Internet' },
      { name: 'Kedusha' }, { name: 'Learning/Motivation' },
      { name: 'Family/Relationships' }, { name: 'Addiction' }, { name: 'General' }
    ]}},
    { name: 'Status', type: 'singleSelect', options: { choices: [
      { name: 'New' }, { name: 'Active' }, { name: 'Stable' }, { name: 'Closed' }, { name: 'Referred Out' }
    ]}},
    { name: 'First Contact', type: 'date', options: { dateFormat: { name: 'us' }}},
    { name: 'Background Notes', type: 'multilineText' }
    // Link fields: Assigned Mentor, Calls, Follow-ups - created separately
  ],
  'Calls': [
    // Note: Call ID (Auto Number) must be created manually in UI
    { name: 'Date/Time', type: 'dateTime', options: { 
      dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }, timeZone: 'client' 
    }},
    { name: 'Direction', type: 'singleSelect', options: { choices: [
      { name: 'Inbound' }, { name: 'Outbound' }, { name: 'Missed' }
    ]}},
    { name: 'Call Type', type: 'singleSelect', options: { choices: [
      { name: 'New Caller' }, { name: 'Follow-up' }, { name: 'Crisis' }, { name: 'Check-in' }, { name: 'Voicemail' }
    ]}},
    { name: 'Duration', type: 'number', options: { precision: 0 }},
    { name: 'Issue Category', type: 'multipleSelects', options: { choices: [
      { name: 'Emotional/Mental Health' }, { name: 'Technology/Internet' },
      { name: 'Kedusha' }, { name: 'Learning/Motivation' },
      { name: 'Family/Relationships' }, { name: 'Addiction' }, { name: 'General' }
    ]}},
    { name: 'Summary', type: 'multilineText' },
    { name: 'Outcome', type: 'singleSelect', options: { choices: [
      { name: 'Callback Scheduled' }, { name: 'Caller Will Call Back' },
      { name: 'Resolved' }, { name: 'Transferred' }, { name: 'Left Voicemail' }, { name: 'Referred Out' }
    ]}},
    { name: 'Urgency', type: 'singleSelect', options: { choices: [
      { name: 'Routine' }, { name: 'Soon (24-48hrs)' }, { name: 'Urgent (same day)' }, { name: 'Crisis (immediate)' }
    ]}},
    { name: 'Follow-up Created', type: 'checkbox', options: { icon: 'check', color: 'greenBright' }},
    { name: 'Telebroad Call ID', type: 'singleLineText' }
    // Link fields: Caller, Received By, Mentor for Follow-up - created separately
  ],
  'Follow-ups': [
    // Note: Follow-up ID (Auto Number) must be created manually in UI
    { name: 'Type', type: 'singleSelect', options: { choices: [
      { name: 'Callback' }, { name: 'Check-in' }, { name: 'Scheduled Session' }, { name: 'Internal Task' }
    ]}},
    { name: 'Due Date/Time', type: 'dateTime', options: { 
      dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }, timeZone: 'client' 
    }},
    { name: 'Status', type: 'singleSelect', options: { choices: [
      { name: 'Pending' }, { name: 'Completed' }, { name: 'Rescheduled' }, { name: 'No Answer' }, { name: 'Cancelled' }
    ]}},
    { name: 'Priority', type: 'singleSelect', options: { choices: [
      { name: 'Normal' }, { name: 'High' }, { name: 'Urgent' }
    ]}},
    { name: 'Notes', type: 'multilineText' },
    { name: 'Completed Date', type: 'date', options: { dateFormat: { name: 'us' }}},
    { name: 'Outcome Notes', type: 'multilineText' }
    // Link fields: Related Call, Caller, Assigned To - created separately
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
    // Link field: Team Member - created separately
  ]
};

// Link fields that connect tables
const linkFields = {
  'Callers': [
    { name: 'Assigned Mentor', linkedTableName: 'Team Members' }
  ],
  'Calls': [
    { name: 'Caller', linkedTableName: 'Callers' },
    { name: 'Received By', linkedTableName: 'Team Members' },
    { name: 'Mentor for Follow-up', linkedTableName: 'Team Members' }
  ],
  'Follow-ups': [
    { name: 'Related Call', linkedTableName: 'Calls' },
    { name: 'Caller', linkedTableName: 'Callers' },
    { name: 'Assigned To', linkedTableName: 'Team Members' }
  ],
  'Availability Schedule': [
    { name: 'Team Member', linkedTableName: 'Team Members' }
  ]
};

// Fields that MUST be created manually in Airtable UI
const manualOnlyFields = {
  'Callers': ['Caller ID'],        // Auto Number
  'Calls': ['Call ID'],            // Auto Number
  'Follow-ups': ['Follow-up ID'],  // Auto Number
  'Team Members': []               // Status Last Updated could be Last Modified Time
};

async function getBaseSchema() {
  const response = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    axiosConfig
  );
  return response.data.tables;
}

async function createField(tableId, tableName, fieldDef) {
  try {
    await axios.post(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
      fieldDef,
      axiosConfig
    );
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

async function createLinkField(tableId, tableName, linkDef, tableMap) {
  const linkedTableId = tableMap[linkDef.linkedTableName];
  if (!linkedTableId) {
    return { success: false, error: `Linked table "${linkDef.linkedTableName}" not found` };
  }

  try {
    await axios.post(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
      {
        name: linkDef.name,
        type: 'multipleRecordLinks',
        options: {
          linkedTableId: linkedTableId
        }
      },
      axiosConfig
    );
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
}

async function setupFields() {
  console.log('🔧 Lev Lehazin Helpline - Smart Field Setup\n');
  console.log('='.repeat(60));
  
  // Get current schema
  console.log('\n📖 Reading current Airtable schema...');
  const tables = await getBaseSchema();
  
  const tableMap = {};
  const existingFieldsMap = {};
  
  tables.forEach(table => {
    tableMap[table.name] = table.id;
    existingFieldsMap[table.name] = table.fields.map(f => f.name);
  });

  console.log(`   Found ${tables.length} tables\n`);

  const report = {
    created: [],
    skipped: [],
    failed: [],
    manual: []
  };

  // Process each table
  for (const [tableName, fields] of Object.entries(requiredFields)) {
    console.log(`\n📋 ${tableName}`);
    console.log('-'.repeat(40));
    
    const tableId = tableMap[tableName];
    if (!tableId) {
      console.log(`   ❌ Table not found!`);
      continue;
    }

    const existingFields = existingFieldsMap[tableName] || [];

    // Check basic fields
    for (const field of fields) {
      if (existingFields.includes(field.name)) {
        console.log(`   ✅ ${field.name} (exists)`);
        report.skipped.push(`${tableName}.${field.name}`);
      } else {
        const result = await createField(tableId, tableName, field);
        if (result.success) {
          console.log(`   🆕 ${field.name} (created)`);
          report.created.push(`${tableName}.${field.name}`);
        } else {
          console.log(`   ❌ ${field.name}: ${result.error}`);
          report.failed.push(`${tableName}.${field.name}: ${result.error}`);
        }
      }
    }

    // Check link fields
    const tableLinks = linkFields[tableName] || [];
    for (const link of tableLinks) {
      if (existingFields.includes(link.name)) {
        console.log(`   ✅ ${link.name} → ${link.linkedTableName} (exists)`);
        report.skipped.push(`${tableName}.${link.name}`);
      } else {
        const result = await createLinkField(tableId, tableName, link, tableMap);
        if (result.success) {
          console.log(`   🔗 ${link.name} → ${link.linkedTableName} (created)`);
          report.created.push(`${tableName}.${link.name}`);
        } else {
          console.log(`   ❌ ${link.name}: ${result.error}`);
          report.failed.push(`${tableName}.${link.name}: ${result.error}`);
        }
      }
    }

    // Note manual-only fields
    const manuals = manualOnlyFields[tableName] || [];
    for (const manualField of manuals) {
      if (existingFields.includes(manualField)) {
        console.log(`   ✅ ${manualField} (exists - manual)`);
      } else {
        console.log(`   ⚠️  ${manualField} (needs manual creation in UI)`);
        report.manual.push(`${tableName}.${manualField}`);
      }
    }
  }

  // Final Report
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SETUP REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Created: ${report.created.length} fields`);
  if (report.created.length > 0) {
    report.created.forEach(f => console.log(`   - ${f}`));
  }

  console.log(`\n⏭️  Skipped (already exist): ${report.skipped.length} fields`);

  if (report.failed.length > 0) {
    console.log(`\n❌ Failed: ${report.failed.length} fields`);
    report.failed.forEach(f => console.log(`   - ${f}`));
  }

  if (report.manual.length > 0) {
    console.log(`\n⚠️  MANUAL ACTION REQUIRED:`);
    console.log('   These fields cannot be created via API:');
    report.manual.forEach(f => console.log(`   - ${f} (Auto Number)`));
    console.log('\n   To create Auto Number fields:');
    console.log('   1. Open Airtable in browser');
    console.log('   2. Go to each table');
    console.log('   3. Click "+" to add field');
    console.log('   4. Select "Auto number"');
    console.log('   5. Name it exactly as shown above');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Field setup complete!');
  console.log('\n💡 Next steps:');
  console.log('   node scripts/add-sample-data.js    # Add test data');
  console.log('   node scripts/check-api-permissions.js  # Verify setup');
}

setupFields().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
