/**
 * Webhook Handlers for Telebroad/Zapier Integration
 * These handle incoming webhook calls from Zapier to auto-log calls
 */

const callService = require('../services/calls');
const callerService = require('../services/callers');
const teamMemberService = require('../services/teamMembers');
const followupService = require('../services/followups');

/**
 * Handler for Live Call Tracking
 * Triggered when a call starts/connects in Telebroad
 * Updates team member status to show they're on a call
 * 
 * Expected payload from Telebroad:
 * {
 *   event: "call.started" | "call.answered",
 *   callId: string,
 *   uniqueid: string,
 *   timestamp: string,
 *   direction: "inbound" | "outbound",
 *   callerNumber: string,
 *   caller_number: string,
 *   extension: string,
 *   extensionName?: string,
 *   status: "ringing" | "connected"
 * }
 */
async function handleCallLive(webhookData) {
  try {
    console.log('📞 LIVE CALL:', webhookData);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      callId: webhookData.callId || webhookData.uniqueid || webhookData.call_id,
      status: webhookData.status || 'active'
    };

    // Find team member by extension
    if (webhookData.extension) {
      const teamMember = await teamMemberService.findByPhoneExtension(webhookData.extension);
      
      if (teamMember) {
        // Update team member status to "Busy"
        await teamMemberService.updateStatus(teamMember.id, '🟡 Busy');
        console.log(`  ✅ Updated ${teamMember.Name} status to Busy`);
        
        result.teamMember = {
          id: teamMember.id,
          name: teamMember.Name,
          extension: webhookData.extension,
          statusUpdated: true
        };
      } else {
        console.log(`  ⚠️ No team member found for extension ${webhookData.extension}`);
        result.teamMember = { found: false, extension: webhookData.extension };
      }
    }

    // Try to identify caller
    const phone = webhookData.callerNumber || webhookData.caller_number || webhookData.from;
    if (phone) {
      const existingCaller = await callerService.findByPhone(phone);
      
      if (existingCaller) {
        result.caller = {
          id: existingCaller.id,
          callerId: existingCaller['Caller ID'],
          name: existingCaller.Name || 'Anonymous',
          isKnown: true
        };
        console.log(`  📋 Known caller: ${existingCaller['Caller ID']}`);
      } else {
        result.caller = {
          phone,
          isKnown: false,
          isNew: true
        };
        console.log(`  🆕 New caller: ${phone}`);
      }
    }

    result.direction = webhookData.direction || 'inbound';
    
    return result;
  } catch (error) {
    console.error('❌ Error processing live call webhook:', error);
    throw error;
  }
}

/**
 * Handler for Zap 1: Auto-Log Completed Calls
 * Triggered when a call ends in Telebroad
 * 
 * Expected payload from Zapier/Telebroad:
 * {
 *   callId: string,        // Telebroad unique call ID
 *   timestamp: string,     // ISO timestamp or call time
 *   direction: string,     // 'inbound' or 'outbound'
 *   duration: number,      // Call duration in seconds or minutes
 *   callerNumber: string,  // Caller's phone number
 *   extension: string,     // Extension that handled the call
 *   recordingUrl?: string  // Optional recording URL
 * }
 */
async function handleCallEnded(webhookData) {
  try {
    console.log('📞 Processing call webhook:', webhookData);

    // Determine call direction
    let direction = 'Inbound';
    if (webhookData.duration === 0 || webhookData.missed) {
      direction = 'Missed';
    } else if (webhookData.direction?.toLowerCase() === 'outbound') {
      direction = 'Outbound';
    }

    // Prepare call data
    const callData = {
      dateTime: webhookData.timestamp || webhookData.callTime || new Date().toISOString(),
      direction,
      duration: webhookData.duration || 0,
      telebroadCallId: webhookData.callId || webhookData.call_id,
      telebroadUniqueId: webhookData.uniqueid || webhookData.uniqueId || webhookData.unique_id
    };

    // Add recording URL if available
    if (webhookData.recordingUrl || webhookData.recording_url || webhookData.recordingURL) {
      const recordingUrl = webhookData.recordingUrl || webhookData.recording_url || webhookData.recordingURL;
      callData.recordingUrl = recordingUrl;
      callData.summary = `Recording: ${recordingUrl}`;
      console.log(`  🎙️ Recording available: ${recordingUrl}`);
    }

    // Try to find team member by extension
    if (webhookData.extension) {
      const teamMember = await teamMemberService.findByPhoneExtension(webhookData.extension);
      if (teamMember) {
        callData.receivedBy = teamMember.id;
        console.log(`  Found team member: ${teamMember.Name}`);
      }
    }

    // Try to find or create caller by phone number
    if (webhookData.callerNumber || webhookData.phoneNumber) {
      const phone = webhookData.callerNumber || webhookData.phoneNumber;
      const { caller, isNew } = await callerService.findOrCreateByPhone({ phone });
      callData.caller = caller.id;
      console.log(`  ${isNew ? 'Created new' : 'Found existing'} caller: ${caller['Caller ID'] || caller.id}`);
    }

    // Create the call record
    const call = await callService.createCall(callData);
    console.log(`  ✅ Created call record: ${call.id}`);

    // Update team member status back to Available (if we know who handled it)
    if (callData.receivedBy) {
      try {
        await teamMemberService.updateStatus(callData.receivedBy, '🟢 Available');
        console.log(`  ✅ Updated team member status back to Available`);
      } catch (error) {
        console.warn('  ⚠️ Could not update team member status:', error.message);
      }
    }

    return {
      success: true,
      callId: call.id,
      message: 'Call logged successfully',
      details: {
        direction,
        duration: callData.duration,
        callerLinked: !!callData.caller,
        receivedByLinked: !!callData.receivedBy
      }
    };
  } catch (error) {
    console.error('❌ Error processing call webhook:', error);
    throw error;
  }
}

/**
 * Handler for Zap 2: Missed Call Alert
 * Triggered when a call is missed (duration = 0)
 * Creates a call record and returns alert info
 * 
 * Expected payload:
 * {
 *   callId: string,
 *   timestamp: string,
 *   callerNumber: string,
 *   extension?: string
 * }
 */
async function handleMissedCall(webhookData) {
  try {
    console.log('📵 Processing missed call webhook:', webhookData);

    // Create call record with Missed direction
    const callData = {
      dateTime: webhookData.timestamp || new Date().toISOString(),
      direction: 'Missed',
      duration: 0,
      telebroadCallId: webhookData.callId || webhookData.uniqueId
    };

    // Try to find existing caller
    if (webhookData.callerNumber || webhookData.phoneNumber) {
      const phone = webhookData.callerNumber || webhookData.phoneNumber;
      const existingCaller = await callerService.findByPhone(phone);
      if (existingCaller) {
        callData.caller = existingCaller.id;
        console.log(`  Found existing caller: ${existingCaller['Caller ID'] || existingCaller.id}`);
      }
    }

    const call = await callService.createCall(callData);
    console.log(`  ✅ Created missed call record: ${call.id}`);

    // Prepare alert info
    const alertInfo = {
      success: true,
      callId: call.id,
      type: 'missed_call',
      callerNumber: webhookData.callerNumber || webhookData.phoneNumber || 'Unknown',
      time: callData.dateTime,
      isKnownCaller: !!callData.caller,
      message: `Missed call from ${webhookData.callerNumber || 'Unknown'} at ${new Date(callData.dateTime).toLocaleTimeString()}`
    };

    return alertInfo;
  } catch (error) {
    console.error('❌ Error processing missed call webhook:', error);
    throw error;
  }
}

/**
 * Handler for creating follow-up from call
 * This can be triggered by Airtable automation or manually
 * 
 * @param {string} callRecordId - The call record ID
 */
async function handleCreateFollowupFromCall(callRecordId) {
  try {
    console.log('📋 Creating follow-up from call:', callRecordId);

    // Get the call record
    const call = await callService.getCallById(callRecordId);
    
    // Check if follow-up already created
    if (call['Follow-up Created']) {
      console.log('  Follow-up already exists for this call');
      return { success: false, message: 'Follow-up already created' };
    }

    // Create the follow-up
    const followup = await followupService.createFromCall(call);
    console.log(`  ✅ Created follow-up: ${followup.id}`);

    // Mark the call as having follow-up created
    await callService.markFollowupCreated(callRecordId);
    console.log('  ✅ Marked call as follow-up created');

    return {
      success: true,
      followupId: followup.id,
      callId: callRecordId,
      message: 'Follow-up created successfully'
    };
  } catch (error) {
    console.error('❌ Error creating follow-up from call:', error);
    throw error;
  }
}

/**
 * Handler for overdue follow-up alerts
 * Returns list of overdue follow-ups for notification
 */
async function handleOverdueFollowupAlert() {
  try {
    console.log('⏰ Checking for overdue follow-ups');

    const overdueFollowups = await followupService.getOverdue();
    
    if (overdueFollowups.length === 0) {
      console.log('  No overdue follow-ups found');
      return { success: true, count: 0, followups: [] };
    }

    console.log(`  Found ${overdueFollowups.length} overdue follow-ups`);

    // Format for notification
    const alerts = overdueFollowups.map(f => ({
      id: f.id,
      followupId: f['Follow-up ID'],
      dueDate: f['Due Date/Time'],
      type: f['Type'],
      priority: f['Priority'],
      assignedTo: f['Assigned To'],
      caller: f['Caller']
    }));

    return {
      success: true,
      count: overdueFollowups.length,
      followups: alerts,
      message: `${overdueFollowups.length} follow-up(s) are overdue`
    };
  } catch (error) {
    console.error('❌ Error checking overdue follow-ups:', error);
    throw error;
  }
}

/**
 * Handler for daily digest
 * Returns summary of follow-ups due today and overdue
 */
async function handleDailyDigest() {
  try {
    console.log('📊 Generating daily digest');

    const digest = await followupService.getDailyDigest();
    
    console.log(`  Due today: ${digest.dueToday}`);
    console.log(`  Overdue: ${digest.overdue}`);
    console.log(`  Urgent: ${digest.urgent}`);

    return {
      success: true,
      date: new Date().toISOString().split('T')[0],
      summary: {
        dueToday: digest.dueToday,
        overdue: digest.overdue,
        urgent: digest.urgent,
        total: digest.total
      },
      dueTodayList: digest.dueTodayList.map(f => ({
        id: f.id,
        type: f['Type'],
        priority: f['Priority'],
        assignedTo: f['Assigned To'],
        dueTime: f['Due Date/Time']
      })),
      overdueList: digest.overdueList.map(f => ({
        id: f.id,
        type: f['Type'],
        priority: f['Priority'],
        assignedTo: f['Assigned To'],
        dueDate: f['Due Date/Time']
      }))
    };
  } catch (error) {
    console.error('❌ Error generating daily digest:', error);
    throw error;
  }
}

/**
 * Handler for Voicemail Created
 * Triggered when someone leaves a voicemail
 * Creates a call record marked as "Voicemail" with recording URL
 * 
 * Expected payload from Telebroad:
 * {
 *   event: "voicemail.created",
 *   voicemailId: string,
 *   messageId: string,
 *   timestamp: string,
 *   callerNumber: string,
 *   extension: string,
 *   duration: number,
 *   recordingUrl: string,
 *   transcription?: string
 * }
 */
async function handleVoicemail(webhookData) {
  try {
    console.log('📧 Processing voicemail webhook:', webhookData);

    // Prepare call data for voicemail
    const callData = {
      dateTime: webhookData.timestamp || new Date().toISOString(),
      direction: 'Inbound',
      duration: webhookData.duration || 0,
      telebroadCallId: webhookData.voicemailId || webhookData.messageId || webhookData.callId,
      callType: 'Voicemail',
      outcome: 'Left Voicemail',
      urgency: 'Soon (24-48hrs)' // Default urgency for voicemails
    };

    // Add recording URL if available
    if (webhookData.recordingUrl || webhookData.recording_url) {
      callData.summary = `Voicemail Recording: ${webhookData.recordingUrl || webhookData.recording_url}`;
      if (webhookData.transcription) {
        callData.summary += `\n\nTranscription: ${webhookData.transcription}`;
      }
    }

    // Try to find team member by extension (mailbox)
    if (webhookData.extension) {
      const teamMember = await teamMemberService.findByPhoneExtension(webhookData.extension);
      if (teamMember) {
        callData.receivedBy = teamMember.id;
        callData.mentorForFollowup = teamMember.id; // Auto-assign follow-up to mailbox owner
        console.log(`  Voicemail for: ${teamMember.Name}`);
      }
    }

    // Try to find or create caller by phone number
    if (webhookData.callerNumber || webhookData.caller_number) {
      const phone = webhookData.callerNumber || webhookData.caller_number;
      const { caller, isNew } = await callerService.findOrCreateByPhone({ phone });
      callData.caller = caller.id;
      console.log(`  ${isNew ? 'Created new' : 'Found existing'} caller: ${caller['Caller ID'] || caller.id}`);
    }

    // Create the call record
    const call = await callService.createCall(callData);
    console.log(`  ✅ Created voicemail record: ${call.id}`);

    return {
      success: true,
      callId: call.id,
      type: 'voicemail',
      message: 'Voicemail logged successfully',
      details: {
        duration: callData.duration,
        recordingUrl: webhookData.recordingUrl || webhookData.recording_url,
        callerLinked: !!callData.caller,
        assignedTo: callData.receivedBy,
        requiresFollowup: true
      }
    };
  } catch (error) {
    console.error('❌ Error processing voicemail webhook:', error);
    throw error;
  }
}

/**
 * Handler for Call Ringing
 * Triggered when phone starts ringing (before answered)
 * Can be used for real-time caller ID display or notification
 * 
 * Expected payload from Telebroad:
 * {
 *   event: "call.ringing",
 *   callId: string,
 *   timestamp: string,
 *   callerNumber: string,
 *   extension: string,
 *   extensionName?: string
 * }
 */
async function handleCallRinging(webhookData) {
  try {
    console.log('📳 RINGING:', webhookData);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      callId: webhookData.callId || webhookData.uniqueid,
      status: 'ringing'
    };

    // Identify who's being called
    if (webhookData.extension) {
      const teamMember = await teamMemberService.findByPhoneExtension(webhookData.extension);
      if (teamMember) {
        result.ringingFor = {
          id: teamMember.id,
          name: teamMember.Name,
          extension: webhookData.extension
        };
        console.log(`  📞 Ringing for: ${teamMember.Name}`);
      }
    }

    // Check if caller is known
    const phone = webhookData.callerNumber || webhookData.caller_number;
    if (phone) {
      const existingCaller = await callerService.findByPhone(phone);
      
      if (existingCaller) {
        result.caller = {
          id: existingCaller.id,
          callerId: existingCaller['Caller ID'],
          name: existingCaller.Name || 'Anonymous',
          isKnown: true,
          primaryIssue: existingCaller['Primary Issue'],
          assignedMentor: existingCaller['Assigned Mentor']
        };
        console.log(`  📋 Known caller: ${existingCaller['Caller ID']}`);
      } else {
        result.caller = {
          phone,
          isKnown: false,
          isNew: true
        };
        console.log(`  🆕 New caller: ${phone}`);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error processing ringing webhook:', error);
    throw error;
  }
}

/**
 * Handler for Call Transferred
 * Triggered when a call is transferred from one extension to another
 * Updates call record with transfer information
 * 
 * Expected payload from Telebroad:
 * {
 *   event: "call.transferred",
 *   callId: string,
 *   timestamp: string,
 *   fromExtension: string,
 *   toExtension: string,
 *   callerNumber: string,
 *   transferType: "blind" | "attended"
 * }
 */
async function handleCallTransferred(webhookData) {
  try {
    console.log('🔄 Processing call transfer webhook:', webhookData);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      callId: webhookData.callId || webhookData.uniqueid,
      transferType: webhookData.transferType || 'blind'
    };

    // Find who transferred the call
    if (webhookData.fromExtension || webhookData.from_extension) {
      const fromExt = webhookData.fromExtension || webhookData.from_extension;
      const fromMember = await teamMemberService.findByPhoneExtension(fromExt);
      if (fromMember) {
        result.transferredFrom = {
          id: fromMember.id,
          name: fromMember.Name,
          extension: fromExt
        };
        console.log(`  📤 Transferred from: ${fromMember.Name}`);
      }
    }

    // Find who received the transfer
    if (webhookData.toExtension || webhookData.to_extension) {
      const toExt = webhookData.toExtension || webhookData.to_extension;
      const toMember = await teamMemberService.findByPhoneExtension(toExt);
      if (toMember) {
        result.transferredTo = {
          id: toMember.id,
          name: toMember.Name,
          extension: toExt,
          role: toMember.Role,
          specialties: toMember.Specialties
        };
        console.log(`  📥 Transferred to: ${toMember.Name}`);
        
        // Update their status to Busy
        await teamMemberService.updateStatus(toMember.id, '🟡 Busy');
        console.log(`  ✅ Updated ${toMember.Name} status to Busy`);
      }
    }

    // If we have a Telebroad call ID, we could update the existing call record
    // to note that it was transferred (optional enhancement)
    if (webhookData.callId || webhookData.call_id) {
      result.notes = `Call transferred from ${result.transferredFrom?.name || webhookData.fromExtension} to ${result.transferredTo?.name || webhookData.toExtension}`;
    }

    return result;
  } catch (error) {
    console.error('❌ Error processing transfer webhook:', error);
    throw error;
  }
}

/**
 * Handler for Call Answered
 * Triggered when a call is actually answered (vs just ringing)
 * Updates team member status and can log the answer time
 * 
 * Expected payload from Telebroad:
 * {
 *   event: "call.answered",
 *   callId: string,
 *   timestamp: string,
 *   answerTime: string,
 *   extension: string,
 *   callerNumber: string
 * }
 */
async function handleCallAnswered(webhookData) {
  try {
    console.log('✅ Call answered:', webhookData);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      callId: webhookData.callId || webhookData.uniqueid,
      status: 'connected'
    };

    // Find who answered
    if (webhookData.extension) {
      const teamMember = await teamMemberService.findByPhoneExtension(webhookData.extension);
      
      if (teamMember) {
        // Update team member status to "Busy"
        await teamMemberService.updateStatus(teamMember.id, '🟡 Busy');
        console.log(`  ✅ ${teamMember.Name} answered call - status updated to Busy`);
        
        result.answeredBy = {
          id: teamMember.id,
          name: teamMember.Name,
          extension: webhookData.extension,
          role: teamMember.Role,
          statusUpdated: true
        };
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error processing call answered webhook:', error);
    throw error;
  }
}

module.exports = {
  handleCallLive,
  handleCallEnded,
  handleMissedCall,
  handleCreateFollowupFromCall,
  handleOverdueFollowupAlert,
  handleDailyDigest,
  handleVoicemail,
  handleCallRinging,
  handleCallTransferred,
  handleCallAnswered
};
