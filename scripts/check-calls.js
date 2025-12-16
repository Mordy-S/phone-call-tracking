/**
 * Check what calls are in Airtable
 */
require('dotenv').config();
const callService = require('../src/services/calls');

async function checkCalls() {
  console.log('📋 Checking recent calls in Airtable...\n');
  
  const calls = await callService.getAllCalls({ maxRecords: 10 });
  
  console.log(`Found ${calls.length} calls\n`);
  
  calls.forEach((call, i) => {
    console.log(`${i+1}. Call ${call.id}`);
    console.log(`   Telebroad ID: ${call['Telebroad Call ID'] || 'N/A'}`);
    console.log(`   Direction: ${call['Direction'] || 'N/A'}`);
    console.log(`   Final Status: ${call['Final Status'] || 'N/A'}`);
    console.log(`   Caller Number: ${call['Caller Number'] || 'N/A'}`);
    console.log(`   Called Number: ${call['Called Number'] || 'N/A'}`);
    console.log(`   IVR Path: ${call['IVR Path'] || 'N/A'}`);
    console.log(`   Hunt Group: ${call['Hunt Group'] || 'N/A'}`);
    console.log(`   Picked Up By: ${call['Picked Up By Name'] || 'N/A'}`);
    console.log(`   Extension: ${call['Picked Up By Extension'] || 'N/A'}`);
    console.log(`   Call Start: ${call['Call Start Time'] || 'N/A'}`);
    console.log(`   Answer Time: ${call['Answer Time'] || 'N/A'}`);
    console.log(`   End Time: ${call['End Time'] || 'N/A'}`);
    console.log(`   Duration: ${call['Duration'] || 'N/A'}`);
    console.log(`   Webhook Events: ${call['Webhook Events'] || 'N/A'}`);
    console.log('');
  });
}

checkCalls().catch(console.error);
