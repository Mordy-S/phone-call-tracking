require('dotenv').config();
const { base } = require('../src/config/airtable');

async function showCurrentData() {
  console.log('\n📊 YOUR CURRENT AIRTABLE DATA');
  console.log('='.repeat(80));

  const webhooks = await base('Webhook Events').select().all();
  const calls = await base('Calls').select().all();

  console.log(`\n📥 Webhook Events Table: ${webhooks.length} records`);
  const callIds = [...new Set(webhooks.map(w => w.fields['Call ID']).filter(id => id))];
  console.log(`   Unique Call IDs: ${callIds.length}`);
  console.log(`   Processed: ${webhooks.filter(w => w.fields.Processed).length}`);
  console.log(`   Unprocessed: ${webhooks.filter(w => !w.fields.Processed).length}`);

  console.log(`\n📞 Calls Table: ${calls.length} records`);

  console.log('\n' + '='.repeat(80));
  console.log('\n🔍 BREAKDOWN BY CALL ID:\n');

  callIds.forEach((id, i) => {
    const events = webhooks.filter(w => w.fields['Call ID'] === id);
    const processed = events.filter(e => e.fields.Processed).length;
    const call = calls.find(c => c.fields['Telebroad Unique ID'] === id);
    
    console.log(`${i + 1}. Call ID: ${id}`);
    console.log(`   Webhook Events: ${events.length} (${processed} processed)`);
    console.log(`   Merged to Calls: ${call ? '✅ Yes' : '❌ No'}`);
    if (call) {
      console.log(`   Direction: ${call.fields['Direction']}`);
      console.log(`   Summary: ${call.fields['Summary']}`);
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\n💡 KEY INSIGHT:');
  console.log(`   One Call ID → Multiple Webhook Events → ONE Call Record`);
  console.log(`   Your system has ${callIds.length} unique calls`);
  if (callIds.length > 0) {
    console.log(`   Each generated ${(webhooks.length / callIds.length).toFixed(1)} webhook events on average`);
  }
  console.log('\n='.repeat(80));
}

showCurrentData().catch(console.error);
