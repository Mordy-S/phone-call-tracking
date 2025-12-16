/**
 * Telebroad Webhook Receiver (Simplified Approach)
 * 
 * This handler saves ALL incoming Telebroad webhooks directly to the
 * "Webhook Events" staging table without any processing.
 * 
 * An Airtable automation then merges events by callId into the Calls table.
 * 
 * Benefits:
 * - Never lose webhook data
 * - Can reprocess/merge at any time
 * - Audit trail of all webhook events
 * - Simpler webhook endpoint (just save and acknowledge)
 */

const webhookEventService = require('../services/webhookEvents');

/**
 * Handle incoming Telebroad webhook
 * Simply saves to staging table and returns success
 * 
 * @param {Object} webhookData - Raw webhook from Telebroad
 * @returns {Object} Result with success status
 */
async function handleTelebroadWebhook(webhookData) {
  try {
    console.log('\n📥 TELEBROAD WEBHOOK RECEIVED');
    console.log(`   Call ID: ${webhookData.callId}`);
    console.log(`   Status: ${webhookData.status}`);
    console.log(`   ${webhookData.sendType}(${webhookData.sendName}) → ${webhookData.destinationType}(${webhookData.destinationName})`);

    // Save to staging table
    const savedEvent = await webhookEventService.createEvent(webhookData);

    console.log(`   ✅ Saved to Webhook Events table: ${savedEvent.id}`);

    return {
      success: true,
      eventId: savedEvent.id,
      callId: webhookData.callId,
      status: webhookData.status,
      message: 'Webhook received and saved to staging table'
    };

  } catch (error) {
    console.error('   ❌ Error saving webhook:', error.message);
    
    return {
      success: false,
      error: error.message,
      callId: webhookData.callId || 'unknown'
    };
  }
}

/**
 * Validate Telebroad webhook data
 * Checks if required fields are present
 */
function validateWebhookData(webhookData) {
  const errors = [];

  if (!webhookData.callId) {
    errors.push('Missing callId');
  }

  if (!webhookData.status) {
    errors.push('Missing status');
  }

  if (!webhookData.direction) {
    errors.push('Missing direction');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true
  };
}

/**
 * Handle webhook with validation
 * This is the main entry point for the webhook endpoint
 */
async function handleWebhookWithValidation(webhookData) {
  // Validate
  const validation = validateWebhookData(webhookData);
  
  if (!validation.valid) {
    console.error('❌ Invalid webhook data:', validation.errors);
    return {
      success: false,
      errors: validation.errors
    };
  }

  // Process
  return handleTelebroadWebhook(webhookData);
}

module.exports = {
  handleTelebroadWebhook,
  handleWebhookWithValidation,
  validateWebhookData
};
