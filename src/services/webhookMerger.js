const webhookEventService = require('./webhookEvents');
const callService = require('./calls');
const callerService = require('./callers');
const teamMemberService = require('./teamMembers');

/**
 * Webhook Merger Service
 * 
 * Merges multiple Telebroad webhook events (by callId) into a single Call record
 * 
 * Call Flow Example:
 * 1. External → IVR (ringing)
 * 2. IVR → IVR (ringing) - navigating menu
 * 3. IVR → Hunt Group (ringing)
 * 4. Hunt Group → Phone (answered)
 * 5. External → IVR (ended)
 */
class WebhookMergerService {
  /**
   * Process all unprocessed webhook events and merge by callId
   */
  async processUnprocessedEvents() {
    console.log('\n🔄 MERGING WEBHOOK EVENTS');
    console.log('='.repeat(60));

    try {
      // Get events grouped by callId
      const groupedEvents = await webhookEventService.getEventsGroupedByCallId();
      const callIds = Object.keys(groupedEvents);

      if (callIds.length === 0) {
        console.log('✅ No unprocessed events to merge');
        return { processed: 0, created: 0, updated: 0 };
      }

      console.log(`📊 Found ${callIds.length} unique calls to process`);

      let created = 0;
      let updated = 0;

      // Process each call
      for (const callId of callIds) {
        const events = groupedEvents[callId];
        console.log(`\n📞 Processing Call ID: ${callId}`);
        console.log(`   Events: ${events.length}`);

        try {
          const result = await this.mergeCallEvents(callId, events);
          
          if (result.action === 'created') {
            created++;
            console.log(`   ✅ Created new call record: ${result.callRecordId}`);
          } else if (result.action === 'updated') {
            updated++;
            console.log(`   ✅ Updated call record: ${result.callRecordId}`);
          }

          // Mark all events as processed
          const eventIds = events.map(e => e.id);
          await webhookEventService.markMultipleAsProcessed(eventIds, result.callRecordId);
          console.log(`   ✅ Marked ${eventIds.length} events as processed`);

        } catch (error) {
          console.error(`   ❌ Error processing call ${callId}: ${error.message}`);
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log(`✅ Merge complete: ${created} created, ${updated} updated`);

      return {
        processed: callIds.length,
        created,
        updated
      };

    } catch (error) {
      console.error('❌ Error in processUnprocessedEvents:', error.message);
      throw error;
    }
  }

  /**
   * Merge multiple webhook events for a single call into one Call record
   * @param {string} callId - Telebroad call ID
   * @param {Array} events - Array of webhook events for this call
   */
  async mergeCallEvents(callId, events) {
    // Sort events by time
    events.sort((a, b) => {
      const timeA = new Date(a['Start Time'] || a['Received At']);
      const timeB = new Date(b['Start Time'] || b['Received At']);
      return timeA - timeB;
    });

    // Extract call information from events
    const callData = this.extractCallData(events);

    // Check if call already exists
    const existingCall = await callService.findByTelebroadCallId(callId);

    let callRecord;
    if (existingCall) {
      // Update existing
      callRecord = await callService.updateCall(existingCall.id, callData);
      return {
        action: 'updated',
        callRecordId: existingCall.id,
        callData
      };
    } else {
      // Create new
      callRecord = await callService.createCall(callData);
      return {
        action: 'created',
        callRecordId: callRecord.id,
        callData
      };
    }
  }

  /**
   * Extract merged call data from multiple webhook events
   * @param {Array} events - Webhook events for one call
   */
  extractCallData(events) {
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    // Find answered event (if any)
    const answeredEvent = events.find(e => 
      e['Status'] === 'answered' && 
      e['Destination Type'] === 'phone'
    );

    // Find ended event from external
    const endedEvent = events.find(e => 
      e['Status'] === 'ended' && 
      e['Send Type'] === 'external'
    );

    // Build IVR path
    const ivrPath = [];
    events.forEach(event => {
      if (event['Destination Type'] === 'ivr' && event['Destination Name']) {
        if (!ivrPath.includes(event['Destination Name'])) {
          ivrPath.push(event['Destination Name']);
        }
      }
    });

    // Find hunt group
    const huntGroupEvent = events.find(e => 
      e['Destination Type'] === 'huntgroup' || 
      e['Send Type'] === 'huntgroup'
    );
    const huntGroup = huntGroupEvent ? 
      (huntGroupEvent['Destination Name'] || huntGroupEvent['Send Name']) : 
      null;

    // Determine final status and direction
    const wasAnswered = !!answeredEvent;
    const direction = firstEvent['Direction'] === 'incoming' ? 'Inbound' : 'Outbound';
    
    let finalStatus = 'IVR Only';
    let callDirection = direction;
    
    if (wasAnswered) {
      finalStatus = 'Answered';
    } else if (huntGroup) {
      finalStatus = 'Missed';
      callDirection = 'Missed';
    } else if (ivrPath.length > 0) {
      finalStatus = 'IVR Only';
      callDirection = 'Missed';
    } else {
      finalStatus = 'Abandoned';
      callDirection = 'Missed';
    }

    // Calculate duration
    let duration = 0;
    if (answeredEvent && endedEvent) {
      const answerTime = new Date(answeredEvent['Start Time']);
      const endTime = new Date(endedEvent['Start Time']);
      duration = Math.round((endTime - answerTime) / 1000); // seconds
    }

    // Build call data
    const callData = {
      telebroadCallId: firstEvent['Call ID'],
      direction: callDirection,
      dateTime: firstEvent['Call Start Time'] || firstEvent['Start Time'],
      callerNumber: firstEvent['Caller ID External'] || firstEvent['Send Number'],
      callerName: firstEvent['Caller Name External'] || '',
      calledNumber: firstEvent['Called Number'],
      ivrPath: ivrPath.join(' → '),
      huntGroup: huntGroup,
      finalStatus: finalStatus,
      callStartTime: firstEvent['Call Start Time'],
      endTime: endedEvent ? endedEvent['Start Time'] : null,
      duration: duration,
      webhookEvents: events.length,
      rawWebhookData: JSON.stringify(events, null, 2)
    };

    // Add answered by info
    if (answeredEvent) {
      callData.pickedUpByName = answeredEvent['Destination Name'];
      callData.pickedUpByExtension = answeredEvent['Destination Number'];
      callData.answerTime = answeredEvent['Start Time'];
    }

    // Add summary
    const summaryParts = [];
    if (callData.callerName) {
      summaryParts.push(`From: ${callData.callerName} (${callData.callerNumber})`);
    } else {
      summaryParts.push(`From: ${callData.callerNumber}`);
    }
    
    if (ivrPath.length > 0) {
      summaryParts.push(`IVR: ${ivrPath.join(' → ')}`);
    }
    
    if (huntGroup) {
      summaryParts.push(`Hunt Group: ${huntGroup}`);
    }
    
    if (answeredEvent) {
      summaryParts.push(`Answered by: ${callData.pickedUpByName}`);
      if (duration > 0) {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        summaryParts.push(`Duration: ${mins}m ${secs}s`);
      }
    } else {
      summaryParts.push(`Status: ${finalStatus}`);
    }

    callData.summary = summaryParts.join(' | ');

    return callData;
  }

  /**
   * Process a single callId (useful for testing or manual processing)
   * @param {string} callId - Telebroad call ID
   */
  async processSingleCall(callId) {
    console.log(`\n🔍 Processing single call: ${callId}`);
    
    const events = await webhookEventService.getEventsByCallId(callId);
    
    if (events.length === 0) {
      console.log('❌ No events found for this call ID');
      return null;
    }

    console.log(`📊 Found ${events.length} events`);
    
    const result = await this.mergeCallEvents(callId, events);
    
    // Mark events as processed
    const eventIds = events.map(e => e.id);
    await webhookEventService.markMultipleAsProcessed(eventIds, result.callRecordId);
    
    console.log(`✅ ${result.action} call record: ${result.callRecordId}`);
    
    return result;
  }

  /**
   * Get statistics about what would be merged (dry run)
   */
  async previewMerge() {
    const groupedEvents = await webhookEventService.getEventsGroupedByCallId();
    const callIds = Object.keys(groupedEvents);

    const preview = [];
    
    for (const callId of callIds) {
      const events = groupedEvents[callId];
      const callData = this.extractCallData(events);
      
      preview.push({
        callId,
        eventCount: events.length,
        direction: callData.direction,
        finalStatus: callData.finalStatus,
        callerNumber: callData.callerNumber,
        answeredBy: callData.pickedUpByName || 'N/A',
        duration: callData.duration,
        ivrPath: callData.ivrPath || 'None'
      });
    }

    return {
      totalCalls: preview.length,
      calls: preview
    };
  }
}

module.exports = new WebhookMergerService();
