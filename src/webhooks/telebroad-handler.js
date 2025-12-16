/**
 * Telebroad Webhook Handler
 * 
 * Handles the real Telebroad webhook format which sends multiple events per call.
 * Aggregates all events into a single Airtable record per callId.
 * 
 * Telebroad sends webhooks in this format:
 * {
 *   callId: "1765829443.779816",      // Master call ID (same for all events)
 *   UniqueId: "1765829481.321338",    // Unique leg ID (changes per segment)
 *   direction: "incoming",             // incoming or outgoing
 *   status: "ringing|answered|ended",
 *   sendType: "external|ivr|huntgroup|phone",
 *   sendName: "18455021115",
 *   sendNumber: "18455021115",
 *   destinationType: "ivr|huntgroup|phone",
 *   destinationName: "Day",
 *   destinationNumber: "57880",
 *   calledType: "",
 *   calledNumber: "17186732999",
 *   callerIdInternal: "18455021115",
 *   callerIdExternal: "18455021115",
 *   callerNameInternal: "",
 *   callerNameExternal: "WIRELESS CALLER",
 *   startTime: "2025-12-15T15:10:43-05:00",
 *   callStartTime: "2025-12-15T15:10:43-05:00"
 * }
 */

const callService = require('../services/calls');
const callerService = require('../services/callers');
const teamMemberService = require('../services/teamMembers');
const { fields } = require('../config/airtable');

const F = fields.calls;

// In-memory store for aggregating call events (resets on server restart)
// In production, consider using Redis or database
const callCache = new Map();

// Cache timeout - how long to keep call data before forcing a save
const CACHE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Process incoming Telebroad webhook event
 * Aggregates multiple events per call into one Airtable record
 */
async function handleTelebroadWebhook(webhookData) {
  const callId = webhookData.callId;
  
  if (!callId) {
    console.error('❌ No callId in webhook data');
    return { success: false, error: 'Missing callId' };
  }

  console.log(`\n📞 TELEBROAD WEBHOOK [${webhookData.status}]`);
  console.log(`   CallID: ${callId}`);
  console.log(`   ${webhookData.sendType}(${webhookData.sendName}) → ${webhookData.destinationType}(${webhookData.destinationName})`);

  // Get or create cache entry for this call
  let callData = callCache.get(callId);
  
  if (!callData) {
    callData = createInitialCallData(webhookData);
    callCache.set(callId, callData);
    console.log(`   📝 New call started`);
  }

  // Update call data based on this event
  updateCallData(callData, webhookData);

  // Check if call has ended
  if (webhookData.status === 'ended' && webhookData.sendType === 'external') {
    // This is the final "ended" event - save to Airtable
    console.log(`   🏁 Call ended - saving to Airtable`);
    
    try {
      const result = await saveCallToAirtable(callData);
      callCache.delete(callId); // Clean up cache
      return result;
    } catch (error) {
      console.error('   ❌ Error saving call:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update team member status based on events
  await updateTeamMemberStatus(webhookData);

  return {
    success: true,
    callId,
    status: 'processing',
    eventsReceived: callData.webhookEvents,
    currentStatus: webhookData.status
  };
}

/**
 * Create initial call data structure from first webhook event
 */
function createInitialCallData(webhookData) {
  return {
    callId: webhookData.callId,
    direction: webhookData.direction === 'incoming' ? 'Inbound' : 'Outbound',
    callerNumber: webhookData.callerIdExternal || webhookData.sendNumber,
    callerName: webhookData.callerNameExternal || '',
    calledNumber: webhookData.calledNumber,
    callStartTime: webhookData.callStartTime || webhookData.startTime,
    ivrPath: [],
    huntGroup: null,
    answeredBy: null,
    answeredByExtension: null,
    answerTime: null,
    endTime: null,
    finalStatus: 'IVR Only', // Default, will be updated
    wasAnswered: false,
    webhookEvents: 0,
    uniqueIds: new Set(),
    lastWebhook: null
  };
}

/**
 * Update call data based on new webhook event
 */
function updateCallData(callData, webhookData) {
  callData.webhookEvents++;
  callData.uniqueIds.add(webhookData.UniqueId);
  callData.lastWebhook = JSON.stringify(webhookData);

  // Track IVR path
  if (webhookData.destinationType === 'ivr' && webhookData.destinationName) {
    if (!callData.ivrPath.includes(webhookData.destinationName)) {
      callData.ivrPath.push(webhookData.destinationName);
    }
  }

  // Track hunt group
  if (webhookData.destinationType === 'huntgroup' || webhookData.sendType === 'huntgroup') {
    callData.huntGroup = webhookData.destinationName || webhookData.sendName;
  }

  // Track if answered by a live person
  if (webhookData.status === 'answered' && webhookData.destinationType === 'phone') {
    callData.wasAnswered = true;
    callData.answeredBy = webhookData.destinationName;
    callData.answeredByExtension = webhookData.destinationNumber;
    callData.answerTime = webhookData.startTime;
    callData.finalStatus = 'Answered';
  }

  // Track end time
  if (webhookData.status === 'ended') {
    // Update end time - use the latest ended event time
    if (!callData.endTime || new Date(webhookData.startTime) > new Date(callData.endTime)) {
      callData.endTime = webhookData.startTime;
    }
    
    // Determine final status
    if (!callData.wasAnswered) {
      // Check if it went to IVR only or was abandoned
      if (callData.huntGroup && !callData.answeredBy) {
        callData.finalStatus = 'Missed'; // Went to hunt group but no one answered
      } else if (callData.ivrPath.length > 0 && !callData.huntGroup) {
        callData.finalStatus = 'IVR Only'; // Only went through IVR
      } else {
        callData.finalStatus = 'Abandoned';
      }
    }
  }
}

/**
 * Save aggregated call data to Airtable
 */
async function saveCallToAirtable(callData) {
  console.log(`\n   💾 Saving call ${callData.callId} to Airtable`);
  console.log(`      Direction: ${callData.direction}`);
  console.log(`      Final Status: ${callData.finalStatus}`);
  console.log(`      IVR Path: ${callData.ivrPath.join(' → ') || 'None'}`);
  console.log(`      Hunt Group: ${callData.huntGroup || 'None'}`);
  console.log(`      Answered By: ${callData.answeredBy || 'No one'}`);

  // Check if call already exists in Airtable
  const existingCall = await callService.findByTelebroadCallId(callData.callId);
  
  // Prepare Airtable record data
  const airtableData = {
    telebroadCallId: callData.callId,
    direction: callData.finalStatus === 'Missed' ? 'Missed' : callData.direction,
    dateTime: callData.callStartTime,
    callerNumber: callData.callerNumber,
    calledNumber: callData.calledNumber,
    callerName: callData.callerName,
    ivrPath: callData.ivrPath.join(' → '),
    huntGroup: callData.huntGroup,
    pickedUpByName: callData.answeredBy,
    pickedUpByExtension: callData.answeredByExtension,
    finalStatus: callData.finalStatus,
    callStartTime: callData.callStartTime,
    answerTime: callData.answerTime,
    endTime: callData.endTime,
    webhookEvents: callData.webhookEvents,
    rawWebhookData: callData.lastWebhook
  };

  // Calculate duration if we have both times
  if (callData.answerTime && callData.endTime) {
    const answerDate = new Date(callData.answerTime);
    const endDate = new Date(callData.endTime);
    airtableData.duration = Math.round((endDate - answerDate) / 1000); // in seconds
  }

  // Try to link to Caller record
  if (callData.callerNumber) {
    const existingCaller = await callerService.findByPhone(callData.callerNumber);
    if (existingCaller) {
      airtableData.caller = existingCaller.id;
      console.log(`      📋 Linked to caller: ${existingCaller['Caller ID'] || existingCaller.Name}`);
    }
  }

  // Try to link to Team Member who answered
  if (callData.answeredByExtension) {
    const teamMember = await teamMemberService.findByPhoneExtension(callData.answeredByExtension);
    if (teamMember) {
      airtableData.receivedBy = teamMember.id;
      console.log(`      👤 Linked to team member: ${teamMember.Name}`);
    }
  }

  let result;
  if (existingCall) {
    // Update existing record
    result = await callService.updateCall(existingCall.id, airtableData);
    console.log(`      ✅ Updated call record: ${existingCall.id}`);
  } else {
    // Create new record
    result = await callService.createCall(airtableData);
    console.log(`      ✅ Created call record: ${result.id}`);
  }

  return {
    success: true,
    callId: result.id,
    telebroadCallId: callData.callId,
    finalStatus: callData.finalStatus,
    answeredBy: callData.answeredBy,
    duration: airtableData.duration,
    ivrPath: callData.ivrPath.join(' → ')
  };
}

/**
 * Update team member status based on call events
 */
async function updateTeamMemberStatus(webhookData) {
  // When a phone starts ringing or is answered, set to Busy
  if ((webhookData.status === 'ringing' || webhookData.status === 'answered') && 
      webhookData.destinationType === 'phone') {
    const teamMember = await teamMemberService.findByPhoneExtension(webhookData.destinationNumber);
    if (teamMember) {
      await teamMemberService.updateStatus(teamMember.id, '🟡 Busy');
      console.log(`      📱 ${teamMember.Name} → Busy`);
    }
  }

  // When a call ends and this was the answered party, set back to Available
  if (webhookData.status === 'ended' && webhookData.sendType === 'phone') {
    const teamMember = await teamMemberService.findByPhoneExtension(webhookData.sendNumber);
    if (teamMember) {
      await teamMemberService.updateStatus(teamMember.id, '🟢 Available');
      console.log(`      📱 ${teamMember.Name} → Available`);
    }
  }
}

/**
 * Force save any cached calls older than timeout
 * Call this periodically to handle cases where "ended" webhook is missed
 */
async function flushStaleCalls() {
  const now = Date.now();
  
  for (const [callId, callData] of callCache.entries()) {
    const callStart = new Date(callData.callStartTime).getTime();
    
    if (now - callStart > CACHE_TIMEOUT_MS) {
      console.log(`⏰ Flushing stale call: ${callId}`);
      callData.finalStatus = callData.wasAnswered ? 'Answered' : 'Abandoned';
      
      try {
        await saveCallToAirtable(callData);
        callCache.delete(callId);
      } catch (error) {
        console.error(`Error flushing call ${callId}:`, error.message);
      }
    }
  }
}

/**
 * Get current cache status (for debugging)
 */
function getCacheStatus() {
  const calls = [];
  for (const [callId, data] of callCache.entries()) {
    calls.push({
      callId,
      events: data.webhookEvents,
      status: data.finalStatus,
      answeredBy: data.answeredBy
    });
  }
  return { activeCalls: calls.length, calls };
}

module.exports = {
  handleTelebroadWebhook,
  flushStaleCalls,
  getCacheStatus
};
