/**
 * Add Telebroad-specific fields to Airtable Calls table
 * Run this once to add the new fields
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

async function getTablesInfo() {
  const response = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    { headers: { 'Authorization': `Bearer ${apiKey}` }}
  );
  return response.data.tables;
}

async function addField(tableId, fieldConfig) {
  try {
    const response = await axios.post(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
      fieldConfig,
      { headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }}
    );
    console.log(`  ✅ Added field: ${fieldConfig.name}`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.error?.message?.includes('already exists')) {
      console.log(`  ⏭️  Field already exists: ${fieldConfig.name}`);
      return null;
    }
    console.error(`  ❌ Error adding ${fieldConfig.name}:`, error.response?.data || error.message);
    return null;
  }
}

async function addTelebroadFields() {
  console.log('🔧 Adding Telebroad-specific fields to Calls table...\n');
  
  // Get tables to find Calls table ID
  const tables = await getTablesInfo();
  const callsTable = tables.find(t => t.name === 'Calls');
  
  if (!callsTable) {
    console.error('❌ Calls table not found!');
    return;
  }
  
  console.log(`📁 Found Calls table: ${callsTable.id}\n`);
  
  // Check existing fields
  const existingFields = callsTable.fields.map(f => f.name);
  console.log('Existing fields:', existingFields.join(', '), '\n');
  
  // New fields to add based on Telebroad webhook data
  const newFields = [
    {
      name: 'Caller Number',
      type: 'phoneNumber',
      description: 'External caller phone number from Telebroad'
    },
    {
      name: 'Called Number',
      type: 'phoneNumber',
      description: 'The number that was dialed (DID)'
    },
    {
      name: 'IVR Path',
      type: 'singleLineText',
      description: 'IVR menu path taken (e.g., Day > discuss something > before connecting)'
    },
    {
      name: 'Hunt Group',
      type: 'singleLineText',
      description: 'Hunt group name if call went to hunt group'
    },
    {
      name: 'Picked Up By Name',
      type: 'singleLineText',
      description: 'Name of person who answered (from Telebroad destinationName)'
    },
    {
      name: 'Picked Up By Extension',
      type: 'singleLineText',
      description: 'Extension that answered the call'
    },
    {
      name: 'Final Status',
      type: 'singleSelect',
      description: 'Final call status from Telebroad',
      options: {
        choices: [
          { name: 'Answered', color: 'greenLight2' },
          { name: 'Missed', color: 'redLight2' },
          { name: 'Voicemail', color: 'yellowLight2' },
          { name: 'Abandoned', color: 'orangeLight2' },
          { name: 'IVR Only', color: 'grayLight2' }
        ]
      }
    },
    {
      name: 'Call Start Time',
      type: 'dateTime',
      description: 'When the call first came in (callStartTime from Telebroad)',
      options: {
        timeZone: 'America/New_York',
        dateFormat: { name: 'local' },
        timeFormat: { name: '12hour' }
      }
    },
    {
      name: 'Answer Time',
      type: 'dateTime',
      description: 'When the call was answered by a live agent',
      options: {
        timeZone: 'America/New_York',
        dateFormat: { name: 'local' },
        timeFormat: { name: '12hour' }
      }
    },
    {
      name: 'End Time',
      type: 'dateTime',
      description: 'When the call ended',
      options: {
        timeZone: 'America/New_York',
        dateFormat: { name: 'local' },
        timeFormat: { name: '12hour' }
      }
    },
    {
      name: 'Caller Name',
      type: 'singleLineText',
      description: 'Caller ID name from phone system (if available)'
    },
    {
      name: 'Webhook Events',
      type: 'number',
      description: 'Number of webhook events received for this call',
      options: {
        precision: 0
      }
    },
    {
      name: 'Raw Webhook Data',
      type: 'multilineText',
      description: 'JSON of last webhook event (for debugging)'
    }
  ];
  
  // Add each field
  for (const field of newFields) {
    if (existingFields.includes(field.name)) {
      console.log(`  ⏭️  Field already exists: ${field.name}`);
      continue;
    }
    await addField(callsTable.id, field);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 250));
  }
  
  console.log('\n✅ Done adding fields!');
  console.log('\n📋 Now run: node scripts/get-schema.js to verify');
}

addTelebroadFields().catch(console.error);
