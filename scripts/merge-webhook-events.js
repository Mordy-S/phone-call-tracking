/**
 * Merge Webhook Events Script
 * 
 * Processes unprocessed webhook events from the staging table
 * and merges them by callId into the Calls table
 */

require('dotenv').config();
const webhookMerger = require('../src/services/webhookMerger');
const webhookEventService = require('../src/services/webhookEvents');

async function mergeWebhookEvents() {
  console.log('\n🔄 WEBHOOK EVENT MERGER\n');
  console.log('This script processes unprocessed webhook events');
  console.log('and merges them by callId into the Calls table');
  console.log('='.repeat(60));

  try {
    // First, show preview
    console.log('\n📊 PREVIEW - What will be merged:\n');
    const preview = await webhookMerger.previewMerge();
    
    if (preview.totalCalls === 0) {
      console.log('✅ No unprocessed events to merge');
      return;
    }

    console.log(`Found ${preview.totalCalls} calls to process:\n`);
    
    preview.calls.forEach((call, index) => {
      console.log(`${index + 1}. Call ID: ${call.callId}`);
      console.log(`   Events: ${call.eventCount}`);
      console.log(`   Direction: ${call.direction}`);
      console.log(`   Status: ${call.finalStatus}`);
      console.log(`   From: ${call.callerNumber}`);
      console.log(`   Answered By: ${call.answeredBy}`);
      if (call.duration > 0) {
        const mins = Math.floor(call.duration / 60);
        const secs = call.duration % 60;
        console.log(`   Duration: ${mins}m ${secs}s`);
      }
      if (call.ivrPath) {
        console.log(`   IVR Path: ${call.ivrPath}`);
      }
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('\n🚀 STARTING MERGE PROCESS\n');

    // Process all unprocessed events
    const result = await webhookMerger.processUnprocessedEvents();

    console.log('\n✨ MERGE COMPLETE!');
    console.log(`   Calls processed: ${result.processed}`);
    console.log(`   New calls created: ${result.created}`);
    console.log(`   Existing calls updated: ${result.updated}`);

    // Show statistics
    console.log('\n📊 WEBHOOK EVENTS STATISTICS:\n');
    const stats = await webhookEventService.getStatistics();
    console.log(`   Total events: ${stats.total}`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Unprocessed: ${stats.unprocessed}`);
    console.log(`   Unique calls: ${stats.uniqueCalls}`);
    console.log(`   Avg events per call: ${stats.averageEventsPerCall}`);
    console.log('\n   Events by status:');
    Object.entries(stats.statusBreakdown).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });

  } catch (error) {
    console.error('\n❌ Error during merge:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  mergeWebhookEvents()
    .then(() => {
      console.log('\n✅ Script complete\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { mergeWebhookEvents };
