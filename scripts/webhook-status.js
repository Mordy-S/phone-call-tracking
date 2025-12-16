/**
 * Webhook Statistics and Status
 * 
 * Shows current status of webhook events and processing
 */

require('dotenv').config();
const webhookEventService = require('../src/services/webhookEvents');

async function showWebhookStatus() {
  console.log('\n���� WEBHOOK EVENTS STATUS\n');
  console.log('='.repeat(60));

  try {
    // Get overall statistics
    const stats = await webhookEventService.getStatistics();

    console.log('\n���� Overall Statistics:');
    console.log(`   Total events: ${stats.total}`);
    console.log(`   Processed: ${stats.processed} (${(stats.processed/stats.total*100).toFixed(1)}%)`);
    console.log(`   Unprocessed: ${stats.unprocessed} (${(stats.unprocessed/stats.total*100).toFixed(1)}%)`);
    console.log(`   Unique calls: ${stats.uniqueCalls}`);
    console.log(`   Avg events per call: ${stats.averageEventsPerCall}`);

    console.log('\n���� Events by Status:');
    Object.entries(stats.statusBreakdown).forEach(([status, count]) => {
      const percentage = (count / stats.total * 100).toFixed(1);
      console.log(`   ${status}: ${count} (${percentage}%)`);
    });

    // Get unprocessed events grouped by call
    const grouped = await webhookEventService.getEventsGroupedByCallId();
    const unprocessedCalls = Object.keys(grouped);

    if (unprocessedCalls.length > 0) {
      console.log('\n������  Unprocessed Calls:');
      unprocessedCalls.forEach((callId, index) => {
        const events = grouped[callId];
        console.log(`   ${index + 1}. ${callId} - ${events.length} events`);
      });
      console.log('\n���� Run: node scripts/merge-webhook-events.js');
    } else {
      console.log('\n��� All events have been processed!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('��� Status check complete\n');

  } catch (error) {
    if (error.message.includes('Could not find table')) {
      console.error('\n��� Error: Webhook Events table not found');
      console.log('\n���� Please create the "Webhook Events" table in Airtable first');
      console.log('   Run: node scripts/create-webhook-staging-table.js');
      console.log('   Then follow the instructions to create the table\n');
    } else {
      console.error('\n��� Error:', error.message);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  showWebhookStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { showWebhookStatus };
