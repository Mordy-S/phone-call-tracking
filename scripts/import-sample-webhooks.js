/**
 * Test Script: Import Sample Webhooks
 * 
 * Imports webhook events from the provided sample file
 * to test the staging table and merging process
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const webhookEventService = require('../src/services/webhookEvents');

async function importSampleWebhooks() {
  console.log('\n📥 IMPORTING SAMPLE WEBHOOK DATA\n');
  console.log('='.repeat(60));

  // Read the sample webhook file
  const sampleFilePath = path.join('C:\\Users\\Computer\\Documents', 'Webhook.txt');
  
  if (!fs.existsSync(sampleFilePath)) {
    console.error(`❌ Sample file not found: ${sampleFilePath}`);
    console.log('\n💡 Please create a file with webhook data at:');
    console.log('   C:\\Users\\Computer\\Documents\\Webhook.txt');
    return;
  }

  const fileContent = fs.readFileSync(sampleFilePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  console.log(`📄 Found ${lines.length} webhook events in file\n`);

  let imported = 0;
  let errors = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const webhookData = JSON.parse(line);
      
      console.log(`${i + 1}. Processing: ${webhookData.callId} - ${webhookData.status} - ${webhookData.sendType} → ${webhookData.destinationType}`);
      
      const result = await webhookEventService.createEvent(webhookData);
      console.log(`   ✅ Saved: ${result.id}`);
      
      imported++;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Import complete: ${imported} imported, ${errors} errors`);
  
  // Get unique call IDs
  const callIds = new Set();
  for (const line of lines) {
    try {
      const data = JSON.parse(line.trim());
      if (data.callId) callIds.add(data.callId);
    } catch (e) {}
  }
  
  console.log(`📊 Unique calls: ${callIds.size}`);
  console.log('\n💡 Next step: Run merge script to process these events');
  console.log('   node scripts/merge-webhook-events.js');
}

// Run if called directly
if (require.main === module) {
  importSampleWebhooks()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { importSampleWebhooks };
