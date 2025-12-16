/**
 * Add missing fields to Calls table for webhook integration
 */

require('dotenv').config();
const axios = require('axios');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_PAT;

async function addFieldsToCallsTable() {
  console.log('\n📋 ADDING FIELDS TO CALLS TABLE\n');
  console.log('='.repeat(60));

  try {
    // Get Calls table ID
    const baseMeta = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    );
    
    const callsTable = baseMeta.data.tables.find(t => t.name === 'Calls');
    
    if (!callsTable) {
      console.error('❌ Calls table not found');
      return;
    }

    console.log(`Found Calls table: ${callsTable.id}\n`);

    const fieldsToAdd = [
      { name: 'TB Call ID', type: 'singleLineText', description: 'Telebroad Call ID' },
      { name: 'Caller Number', type: 'singleLineText', description: 'Caller phone number' },
      { name: 'Called Number', type: 'singleLineText', description: 'Number that was called' },
      { name: 'Caller Name', type: 'singleLineText', description: 'Caller name from carrier' },
      { name: 'IVR Path', type: 'singleLineText', description: 'Path through IVR system' },
      { name: 'Hunt Group', type: 'singleLineText', description: 'Hunt group name' },
      { name: 'Picked Up By Name', type: 'singleLineText', description: 'Who answered the call' },
      { name: 'Picked Up By Extension', type: 'singleLineText', description: 'Extension that answered' },
      {
        name: 'Final Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Answered' },
            { name: 'Missed' },
            { name: 'Voicemail' },
            { name: 'Abandoned' },
            { name: 'IVR Only' }
          ]
        },
        description: 'Final call status'
      },
      { name: 'Call Start Time', type: 'singleLineText', description: 'When call started' },
      { name: 'Answer Time', type: 'singleLineText', description: 'When call was answered' },
      { name: 'End Time', type: 'singleLineText', description: 'When call ended' },
      { name: 'Webhook Events', type: 'number', options: { precision: 0 }, description: 'Number of webhook events received' },
      { name: 'Raw Webhook Data', type: 'multilineText', description: 'Complete webhook data' }
    ];

    console.log(`Adding ${fieldsToAdd.length} fields...\n`);

    for (const field of fieldsToAdd) {
      try {
        await axios.post(
          `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${callsTable.id}/fields`,
          field,
          {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log(`   ✅ Added: ${field.name}`);
      } catch (error) {
        if (error.response?.data?.error?.type === 'DUPLICATE_FIELD_NAME') {
          console.log(`   ℹ️  Skipped (already exists): ${field.name}`);
        } else {
          console.error(`   ❌ Error adding ${field.name}: ${error.response?.data?.error?.message || error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Fields update complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addFieldsToCallsTable()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { addFieldsToCallsTable };
