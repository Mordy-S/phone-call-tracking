/**
 * Create Webhook Events Table via Airtable API
 * Uses Airtable Meta API to programmatically create table and fields
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_PAT;

async function createWebhookEventsTable() {
  console.log('\n📋 CREATING WEBHOOK EVENTS TABLE\n');
  console.log('='.repeat(60));

  try {
    // Create the table with all fields
    const response = await axios.post(
      `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
      {
        name: 'Webhook Events',
        description: 'Staging table for Telebroad webhook events - all events stored here before merging',
        fields: [
          {
            name: 'Received At',
            type: 'dateTime',
            options: {
              dateFormat: { name: 'iso' },
              timeFormat: { name: '24hour' },
              timeZone: 'America/New_York'
            }
          },
          {
            name: 'Call ID',
            type: 'singleLineText'
          },
          {
            name: 'Unique ID',
            type: 'singleLineText'
          },
          {
            name: 'Status',
            type: 'singleSelect',
            options: {
              choices: [
                { name: 'ringing' },
                { name: 'answered' },
                { name: 'ended' }
              ]
            }
          },
          {
            name: 'Direction',
            type: 'singleSelect',
            options: {
              choices: [
                { name: 'incoming' },
                { name: 'outgoing' }
              ]
            }
          },
          {
            name: 'Send Type',
            type: 'singleSelect',
            options: {
              choices: [
                { name: 'external' },
                { name: 'ivr' },
                { name: 'huntgroup' },
                { name: 'phone' }
              ]
            }
          },
          {
            name: 'Send Name',
            type: 'singleLineText'
          },
          {
            name: 'Send Number',
            type: 'singleLineText'
          },
          {
            name: 'Destination Type',
            type: 'singleSelect',
            options: {
              choices: [
                { name: 'external' },
                { name: 'ivr' },
                { name: 'huntgroup' },
                { name: 'phone' }
              ]
            }
          },
          {
            name: 'Destination Name',
            type: 'singleLineText'
          },
          {
            name: 'Destination Number',
            type: 'singleLineText'
          },
          {
            name: 'Called Type',
            type: 'singleLineText'
          },
          {
            name: 'Called Number',
            type: 'singleLineText'
          },
          {
            name: 'Caller ID Internal',
            type: 'singleLineText'
          },
          {
            name: 'Caller ID External',
            type: 'singleLineText'
          },
          {
            name: 'Caller Name Internal',
            type: 'singleLineText'
          },
          {
            name: 'Caller Name External',
            type: 'singleLineText'
          },
          {
            name: 'Start Time',
            type: 'singleLineText'
          },
          {
            name: 'Call Start Time',
            type: 'singleLineText'
          },
          {
            name: 'Raw JSON',
            type: 'multilineText'
          },
          {
            name: 'Processed',
            type: 'checkbox',
            options: {
              icon: 'check',
              color: 'greenBright'
            }
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tableId = response.data.id;
    console.log(`✅ Created table: ${response.data.name}`);
    console.log(`   Table ID: ${tableId}`);
    console.log(`   Fields created: ${response.data.fields.length}`);

    // Now create the link field to Calls table
    console.log('\n🔗 Creating link to Calls table...');
    
    // Get Calls table ID
    const baseMeta = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    );
    
    const callsTable = baseMeta.data.tables.find(t => t.name === 'Calls');
    
    if (callsTable) {
      await axios.post(
        `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`,
        {
          name: 'Merged Call Record',
          type: 'multipleRecordLinks',
          options: {
            linkedTableId: callsTable.id
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Created link field to Calls table');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Webhook Events table created successfully!\n');
    
    // Update .env file
    console.log('📝 Updating .env file...');
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (!envContent.includes('AIRTABLE_WEBHOOK_EVENTS_TABLE')) {
      envContent += '\nAIRTABLE_WEBHOOK_EVENTS_TABLE=Webhook Events\n';
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Added AIRTABLE_WEBHOOK_EVENTS_TABLE to .env\n');
    } else {
      console.log('ℹ️  AIRTABLE_WEBHOOK_EVENTS_TABLE already in .env\n');
    }

    console.log('🎉 Setup complete! Ready to import webhooks.');
    console.log('\nNext steps:');
    console.log('   npm run webhook:import');
    console.log('   npm run webhook:merge');

  } catch (error) {
    console.error('\n❌ Error creating table:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      console.error('\n⚠️  Permission denied. Make sure your API token has schema write permissions.');
    }
    
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createWebhookEventsTable()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createWebhookEventsTable };
