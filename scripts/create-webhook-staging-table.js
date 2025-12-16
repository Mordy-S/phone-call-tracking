/**
 * Create Webhook Events Staging Table
 * 
 * This table captures ALL Telebroad webhook events.
 * Each route/leg of a call generates a new webhook, so one callId
 * can have multiple events (IVR → Hunt Group → Extension → Answered/Ended)
 * 
 * An Airtable automation will then merge these events by callId
 * into a single record in the Calls table
 */

require('dotenv').config();
const { base } = require('../src/config/airtable');

const STAGING_TABLE_NAME = 'Webhook Events';

async function createWebhookStagingTable() {
  console.log('\n📋 CREATING WEBHOOK EVENTS STAGING TABLE\n');
  console.log('This table will capture all incoming Telebroad webhooks');
  console.log('One call may generate multiple webhook events (each route/leg)');
  console.log('='.repeat(70));

  console.log('\n⚠️  MANUAL STEP REQUIRED:');
  console.log('\nYou need to create this table manually in Airtable with these fields:');
  console.log('\n' + '─'.repeat(70));
  
  const fields = [
    { name: 'Event ID', type: 'Auto Number', desc: 'Unique event identifier' },
    { name: 'Received At', type: 'Date & Time', desc: 'When webhook was received' },
    { name: 'Call ID', type: 'Text', desc: 'Telebroad callId (same for all events in one call)' },
    { name: 'Unique ID', type: 'Text', desc: 'Telebroad UniqueId (different per leg/route)' },
    { name: 'Status', type: 'Single Select', desc: 'Options: ringing, answered, ended' },
    { name: 'Direction', type: 'Single Select', desc: 'Options: incoming, outgoing' },
    { name: 'Send Type', type: 'Single Select', desc: 'Options: external, ivr, huntgroup, phone' },
    { name: 'Send Name', type: 'Text', desc: 'Name of sending party' },
    { name: 'Send Number', type: 'Text', desc: 'Number of sending party' },
    { name: 'Destination Type', type: 'Single Select', desc: 'Options: external, ivr, huntgroup, phone' },
    { name: 'Destination Name', type: 'Text', desc: 'Name of destination' },
    { name: 'Destination Number', type: 'Text', desc: 'Number of destination' },
    { name: 'Called Type', type: 'Text', desc: 'Type of called party' },
    { name: 'Called Number', type: 'Text', desc: 'The number that was dialed' },
    { name: 'Caller ID Internal', type: 'Text', desc: 'Internal caller ID' },
    { name: 'Caller ID External', type: 'Text', desc: 'External caller ID (actual caller number)' },
    { name: 'Caller Name Internal', type: 'Text', desc: 'Internal caller name' },
    { name: 'Caller Name External', type: 'Text', desc: 'External caller name from carrier' },
    { name: 'Start Time', type: 'Text', desc: 'ISO timestamp for this event' },
    { name: 'Call Start Time', type: 'Text', desc: 'ISO timestamp when call first started' },
    { name: 'Raw JSON', type: 'Long Text', desc: 'Complete webhook payload for debugging' },
    { name: 'Processed', type: 'Checkbox', desc: 'Checked when merged into Calls table' },
    { name: 'Merged Call Record', type: 'Link to Calls', desc: 'Link to final merged call record' }
  ];

  console.log('\n📝 Field List:\n');
  fields.forEach((field, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${field.name.padEnd(25)} | ${field.type.padEnd(20)} | ${field.desc}`);
  });

  console.log('\n' + '─'.repeat(70));
  console.log('\n💡 SINGLE SELECT OPTIONS:');
  console.log('\nStatus field options:');
  console.log('   • ringing');
  console.log('   • answered');
  console.log('   • ended');
  
  console.log('\nDirection field options:');
  console.log('   • incoming');
  console.log('   • outgoing');
  
  console.log('\nSend Type & Destination Type field options:');
  console.log('   • external');
  console.log('   • ivr');
  console.log('   • huntgroup');
  console.log('   • phone');

  console.log('\n' + '─'.repeat(70));
  console.log('\n🔄 NEXT STEPS:');
  console.log('\n1. Go to your Airtable base');
  console.log(`2. Create a new table named: "${STAGING_TABLE_NAME}"`);
  console.log('3. Add all the fields listed above with correct types');
  console.log('4. Set up the Single Select options as shown');
  console.log('5. Update your .env file with:');
  console.log(`   AIRTABLE_WEBHOOK_EVENTS_TABLE="${STAGING_TABLE_NAME}"`);
  console.log('6. Run the automation setup to create merging logic');

  console.log('\n' + '='.repeat(70));
  console.log('✅ Instructions complete\n');

  return {
    tableName: STAGING_TABLE_NAME,
    fields
  };
}

// Run if called directly
if (require.main === module) {
  createWebhookStagingTable()
    .then(() => {
      console.log('\n✨ Ready for next step: Setting up Airtable automation');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { createWebhookStagingTable };
