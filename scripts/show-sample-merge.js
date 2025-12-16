require('dotenv').config();
const { base } = require('../src/config/airtable');

async function showSampleMerge() {
  console.log('\n📊 WEBHOOK MERGING EXAMPLE');
  console.log('='.repeat(80));

  // Get a sample callId
  const webhookEvents = await base('Webhook Events')
    .select({ maxRecords: 1 })
    .firstPage();

  if (webhookEvents.length === 0) {
    console.log('❌ No webhook events found');
    return;
  }

  const sampleCallId = webhookEvents[0].fields['Call ID'];

  // Get all events for this call
  const events = await base('Webhook Events')
    .select({
      filterByFormula: `{Call ID} = '${sampleCallId}'`,
      sort: [{ field: 'Received At', direction: 'asc' }]
    })
    .firstPage();

  console.log(`\n🔍 Sample Call ID: ${sampleCallId}`);
  console.log(`📞 Total Webhook Events: ${events.length}\n`);
  console.log('Webhook Event Flow:');
  console.log('-'.repeat(80));

  events.forEach((record, index) => {
    const fields = record.fields;
    console.log(`\n${index + 1}. Status: ${fields['Status']}`);
    console.log(`   From: ${fields['Send Type']} (${fields['Send Name'] || 'N/A'})`);
    console.log(`   To: ${fields['Destination Type']} (${fields['Destination Name'] || 'N/A'})`);
    console.log(`   Time: ${fields['Start Time']}`);
    console.log(`   Processed: ${fields['Processed'] ? '✅ Yes' : '❌ No'}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n📝 HOW THE MERGE WORKS:\n');
  
  console.log('1️⃣  GROUP BY CALL ID');
  console.log('   All events with the same Call ID are grouped together\n');

  console.log('2️⃣  EXTRACT INFORMATION FROM DIFFERENT EVENTS');
  console.log('   • IVR Path: From events where Destination Type = "ivr"');
  console.log('   • Hunt Group: From events where Destination Type = "huntgroup"');
  console.log('   • Answered By: From events where Status = "answered" & Dest Type = "phone"');
  console.log('   • Duration: Time between "answered" and "ended" events');
  console.log('   • Caller Info: From the first event (external caller)\n');

  console.log('3️⃣  CREATE ONE CALL RECORD');
  console.log('   All extracted data is merged into a single record in the Calls table\n');

  console.log('4️⃣  MARK AS PROCESSED');
  console.log('   All webhook events are marked as processed and linked to the Call record\n');

  console.log('='.repeat(80));

  // Check if this call exists in Calls table
  const calls = await base('Calls')
    .select({
      filterByFormula: `{Telebroad Unique ID} = '${sampleCallId}'`
    })
    .firstPage();

  if (calls.length > 0) {
    console.log('\n✅ MERGED CALL RECORD FOUND:\n');
    const call = calls[0].fields;
    console.log(`   Direction: ${call['Direction']}`);
    console.log(`   Date/Time: ${call['Date/Time']}`);
    console.log(`   Duration: ${call['Duration']} seconds`);
    console.log(`   Summary: ${call['Summary']}`);
  } else {
    console.log('\n⚠️  No merged call record found yet (events may be processed but not showing)');
  }

  console.log('\n' + '='.repeat(80));
}

showSampleMerge().catch(console.error);
