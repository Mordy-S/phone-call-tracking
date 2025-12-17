/**
 * Lev Lehazin Helpline - Complete Airtable Automation System
 * 
 * FEATURES:
 * 1. Merge webhook events into Calls table
 * 2. Live call tracking (Busy/Available status)
 * 3. Auto-create Follow-ups from Calls
 * 4. Daily reports and digests
 * 5. Overdue follow-up alerts
 * 
 * SETUP: Run setup() once to create all triggers
 */

// ⚙️ CONFIGURATION
const CONFIG = {
  AIRTABLE_PAT: 'REDACTED_FOR_GIT',
  AIRTABLE_BASE_ID: 'apppmUWwmIexHE32N',
  
  // Table names
  TABLES: {
    WEBHOOK_EVENTS: 'Webhook Events',
    CALLS: 'Calls',
    TEAM_MEMBERS: 'Team Members',
    CALLERS: 'Callers',
    FOLLOWUPS: 'Follow-ups'
  },
  
  // Email for reports (update this!)
  REPORT_EMAIL: 'intake@levlehazin.org',
  
  // Timezone
  TIMEZONE: 'America/New_York'
};

// ═══════════════════════════════════════════════════════════════
// 🚀 SETUP - Run this ONCE to configure all triggers
// ═══════════════════════════════════════════════════════════════

function setup() {
  console.log('🔧 Setting up Lev Lehazin Automation System...\n');
  
  // Delete all existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
    console.log(`   Deleted trigger: ${trigger.getHandlerFunction()}`);
  });
  
  // Create new triggers
  
  // 1. Webhook merge - every 1 minute
  ScriptApp.newTrigger('mergeWebhookEvents')
    .timeBased()
    .everyMinutes(1)
    .create();
  console.log('✅ Created: mergeWebhookEvents (every 1 min)');
  
  // 2. Live call status - every 1 minute
  ScriptApp.newTrigger('updateLiveCallStatus')
    .timeBased()
    .everyMinutes(1)
    .create();
  console.log('✅ Created: updateLiveCallStatus (every 1 min)');
  
  // 3. Auto-create follow-ups - every 5 minutes
  ScriptApp.newTrigger('autoCreateFollowups')
    .timeBased()
    .everyMinutes(5)
    .create();
  console.log('✅ Created: autoCreateFollowups (every 5 min)');
  
  // 4. Daily report - 8 AM every day
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
  console.log('✅ Created: sendDailyReport (daily at 8 AM)');
  
  // 5. Overdue alert - every hour
  ScriptApp.newTrigger('checkOverdueFollowups')
    .timeBased()
    .everyHours(1)
    .create();
  console.log('✅ Created: checkOverdueFollowups (every hour)');
  
  console.log('\n🎉 Setup complete! All automations are now running.');
  
  // Run initial tests
  console.log('\n📊 Running initial status check...');
  runAllNow();
}

/**
 * Run all automations now (for testing)
 */
function runAllNow() {
  console.log('\n═══ RUNNING ALL AUTOMATIONS ═══\n');
  mergeWebhookEvents();
  updateLiveCallStatus();
  autoCreateFollowups();
  console.log('\n═══ ALL AUTOMATIONS COMPLETE ═══');
}

// ═══════════════════════════════════════════════════════════════
// 1️⃣ WEBHOOK MERGE - Combine webhook events into Calls
// ═══════════════════════════════════════════════════════════════

function mergeWebhookEvents() {
  console.log('🔄 [MERGE] Starting webhook merge...');
  
  try {
    const unprocessed = getUnprocessedEvents();
    
    if (unprocessed.length === 0) {
      console.log('   ✅ No unprocessed events');
      return;
    }
    
    console.log(`   📊 Found ${unprocessed.length} unprocessed events`);
    
    const grouped = groupByCallId(unprocessed);
    const callIds = Object.keys(grouped);
    
    console.log(`   📞 Processing ${callIds.length} unique calls`);
    
    callIds.forEach(callId => {
      processCallEvents(callId, grouped[callId]);
    });
    
    console.log('   ✅ Merge complete!');
    
  } catch (error) {
    console.error('   ❌ Merge error:', error.message);
  }
}

function getUnprocessedEvents() {
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.TABLES.WEBHOOK_EVENTS)}`;
  const formula = encodeURIComponent('NOT({Processed})');
  
  const response = airtableFetch(`${url}?filterByFormula=${formula}&maxRecords=500`);
  return response.records || [];
}

function groupByCallId(events) {
  const grouped = {};
  events.forEach(event => {
    const callId = event.fields['Call ID'];
    if (callId) {
      if (!grouped[callId]) grouped[callId] = [];
      grouped[callId].push(event);
    }
  });
  return grouped;
}

function processCallEvents(callId, events) {
  const firstEvent = events[0].fields;
  const callerNumber = firstEvent['Caller ID External'] || 
                        firstEvent['Caller ID Internal'] || 
                        firstEvent['Send Number'] || 'Unknown';
  const callerName = firstEvent['Caller Name External'] || 
                     firstEvent['Caller Name Internal'] || '';
  
  console.log(`      📞 ${callerName || callerNumber} (${events.length} events)`);
  
  // Sort by time
  events.sort((a, b) => {
    const tA = new Date(a.fields['Start Time'] || a.fields['Call Start Time'] || 0);
    const tB = new Date(b.fields['Start Time'] || b.fields['Call Start Time'] || 0);
    return tA - tB;
  });
  
  const first = events[0].fields;
  const last = events[events.length - 1].fields;
  
  // Find answered event
  const answeredEvent = events.find(e => 
    e.fields['Status'] === 'answered' && 
    e.fields['Destination Type'] === 'phone'
  );
  
  // Build IVR path
  const ivrPath = [];
  events.forEach(e => {
    const dt = e.fields['Destination Type'];
    const dn = e.fields['Destination Name'];
    if (dt === 'ivr' && dn && !ivrPath.includes(dn)) {
      ivrPath.push(dn);
    }
  });
  
  // Find hunt group
  const hgEvent = events.find(e => 
    e.fields['Destination Type'] === 'huntgroup' ||
    e.fields['Send Type'] === 'huntgroup'
  );
  const huntGroup = hgEvent ? 
    (hgEvent.fields['Destination Name'] || hgEvent.fields['Send Name']) : null;
  
  // Determine status and direction
  let finalStatus = 'IVR Only';
  let direction = 'Inbound';
  
  if (answeredEvent) {
    finalStatus = 'Answered';
  } else if (huntGroup) {
    finalStatus = 'Missed';
    direction = 'Missed';
  } else if (ivrPath.length > 0) {
    finalStatus = 'IVR Only';
    direction = 'Missed';
  } else {
    finalStatus = 'Abandoned';
    direction = 'Missed';
  }
  
  // Times
  const startTime = first['Call Start Time'] || first['Start Time'];
  const endTime = last['Start Time'];
  const answerTime = answeredEvent ? answeredEvent.fields['Start Time'] : null;
  
  // Calculate duration
  let totalDuration = 0;
  if (startTime && endTime) {
    const startT = new Date(startTime);
    const endT = new Date(endTime);
    totalDuration = Math.round((endT - startT) / 1000);
  }
  
  // Build summary
  const parts = [];
  parts.push(callerName ? `From: ${callerName} (${callerNumber})` : `From: ${callerNumber}`);
  if (ivrPath.length > 0) parts.push(`IVR: ${ivrPath.join(' → ')}`);
  if (huntGroup) parts.push(`Hunt Group: ${huntGroup}`);
  if (answeredEvent) {
    parts.push(`Answered by: ${answeredEvent.fields['Destination Name']}`);
    if (totalDuration > 0) parts.push(`Duration: ${formatDuration(totalDuration)}`);
  } else {
    parts.push(`Status: ${finalStatus}`);
  }
  
  const callData = {
    'TB Call ID': callId,
    'Direction': direction,
    'Final Status': finalStatus,
    'Date/Time': startTime,
    'Call Start Time': startTime,
    'End Time': endTime,
    'Answer Time': answerTime,
    'Duration': totalDuration,
    'Summary': parts.join(' | '),
    'IVR Path': ivrPath.join(' → ') || null,
    'Hunt Group': huntGroup,
    'Caller Number': callerNumber,
    'Caller Name': callerName || null,
    'Called Number': first['Called Number'],
    'Picked Up By Name': answeredEvent ? answeredEvent.fields['Destination Name'] : null,
    'Picked Up By Extension': answeredEvent ? answeredEvent.fields['Destination Number'] : null,
    'Webhook Events': events.length,
    'Webhook Events 2': events.map(e => e.id)
  };
  
  // Create or update call
  const existingCall = findCallByTBId(callId);
  if (existingCall) {
    updateRecord(CONFIG.TABLES.CALLS, existingCall.id, callData);
  } else {
    createRecord(CONFIG.TABLES.CALLS, callData);
  }
  
  // Mark events as processed
  events.forEach(e => {
    updateRecord(CONFIG.TABLES.WEBHOOK_EVENTS, e.id, { 'Processed': true });
  });
}

// ═══════════════════════════════════════════════════════════════
// 2️⃣ LIVE CALL STATUS - Update Team Member Busy/Available
// ═══════════════════════════════════════════════════════════════

function updateLiveCallStatus() {
  console.log('📞 [LIVE STATUS] Checking active calls...');
  
  try {
    // Get recent webhook events (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recentEvents = getRecentWebhookEvents();
    
    if (recentEvents.length === 0) {
      console.log('   No recent call activity');
      // Set all team members to Available if no recent activity
      setAllTeamMembersAvailable();
      return;
    }
    
    // Group by current call state
    const activeCallsByExtension = {};
    const endedCallsByExtension = {};
    
    recentEvents.forEach(event => {
      const status = event.fields['Status'];
      const destType = event.fields['Destination Type'];
      const destNumber = event.fields['Destination Number'];
      const destName = event.fields['Destination Name'];
      const callId = event.fields['Call ID'];
      const startTime = new Date(event.fields['Start Time'] || event.fields['Call Start Time']);
      
      // Only track phone destinations (actual team members)
      if (destType === 'phone' && destNumber) {
        if (status === 'answered' || status === 'ringing') {
          // Track active calls
          if (!activeCallsByExtension[destNumber] || 
              startTime > new Date(activeCallsByExtension[destNumber].time)) {
            activeCallsByExtension[destNumber] = {
              callId: callId,
              status: status,
              name: destName,
              time: startTime.toISOString()
            };
          }
        } else if (status === 'ended') {
          // Track ended calls
          if (!endedCallsByExtension[destNumber] || 
              startTime > new Date(endedCallsByExtension[destNumber].time)) {
            endedCallsByExtension[destNumber] = {
              callId: callId,
              time: startTime.toISOString()
            };
          }
        }
      }
    });
    
    // Get all team members
    const teamMembers = getAllRecords(CONFIG.TABLES.TEAM_MEMBERS);
    
    teamMembers.forEach(member => {
      const extension = member.fields['Phone/Extension'];
      const name = member.fields['Name'];
      const currentStatus = member.fields['Current Status'];
      
      if (!extension) return;
      
      // Clean extension for matching
      const cleanExt = String(extension).replace(/\D/g, '');
      
      // Check if this extension has active or ended calls
      const activeCall = Object.keys(activeCallsByExtension).find(ext => 
        ext.includes(cleanExt) || cleanExt.includes(ext)
      );
      const endedCall = Object.keys(endedCallsByExtension).find(ext => 
        ext.includes(cleanExt) || cleanExt.includes(ext)
      );
      
      if (activeCall) {
        const callInfo = activeCallsByExtension[activeCall];
        // Check if ended call is more recent
        if (endedCall) {
          const endedInfo = endedCallsByExtension[endedCall];
          if (new Date(endedInfo.time) > new Date(callInfo.time)) {
            // Call ended more recently - set to Available
            if (currentStatus !== '🟢 Available') {
              console.log(`   ✅ ${name}: Setting to Available (call ended)`);
              updateRecord(CONFIG.TABLES.TEAM_MEMBERS, member.id, {
                'Current Status': '🟢 Available',
                'Current Call ID': null,
                'Current Caller Number': null,
                'Call Started At': null
              });
            }
            return;
          }
        }
        
        // Active call - set to Busy
        if (currentStatus !== '🟡 Busy') {
          console.log(`   📞 ${name}: Setting to BUSY (on call: ${callInfo.callId})`);
          updateRecord(CONFIG.TABLES.TEAM_MEMBERS, member.id, {
            'Current Status': '🟡 Busy',
            'Current Call ID': callInfo.callId,
            'Call Started At': callInfo.time
          });
        }
      } else if (endedCall && currentStatus === '🟡 Busy') {
        // No active call but was busy - set to Available
        console.log(`   ✅ ${name}: Setting to Available (call ended)`);
        updateRecord(CONFIG.TABLES.TEAM_MEMBERS, member.id, {
          'Current Status': '🟢 Available',
          'Current Call ID': null,
          'Current Caller Number': null,
          'Call Started At': null
        });
      }
    });
    
    console.log('   ✅ Live status check complete');
    
  } catch (error) {
    console.error('   ❌ Live status error:', error.message);
  }
}

function getRecentWebhookEvents() {
  // Get events from last 10 minutes
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.TABLES.WEBHOOK_EVENTS)}`;
  const response = airtableFetch(`${url}?maxRecords=100&sort[0][field]=Start Time&sort[0][direction]=desc`);
  
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  
  return (response.records || []).filter(r => {
    const eventTime = new Date(r.fields['Start Time'] || r.fields['Call Start Time'] || 0);
    return eventTime.getTime() > tenMinutesAgo;
  });
}

function setAllTeamMembersAvailable() {
  const teamMembers = getAllRecords(CONFIG.TABLES.TEAM_MEMBERS);
  
  teamMembers.forEach(member => {
    if (member.fields['Current Status'] === '🟡 Busy') {
      console.log(`   ✅ ${member.fields['Name']}: Setting to Available (no activity)`);
      updateRecord(CONFIG.TABLES.TEAM_MEMBERS, member.id, {
        'Current Status': '🟢 Available',
        'Current Call ID': null,
        'Current Caller Number': null,
        'Call Started At': null
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// 3️⃣ AUTO-CREATE FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════

function autoCreateFollowups() {
  console.log('📋 [FOLLOW-UPS] Checking for calls needing follow-ups...');
  
  try {
    // Find calls with Outcome = "Callback Scheduled" and Follow-up Created = false
    const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.TABLES.CALLS)}`;
    const formula = encodeURIComponent('AND({Outcome}="Callback Scheduled", NOT({Follow-up Created}))');
    
    const response = airtableFetch(`${url}?filterByFormula=${formula}`);
    const calls = response.records || [];
    
    if (calls.length === 0) {
      console.log('   ✅ No calls needing follow-ups');
      return;
    }
    
    console.log(`   📊 Found ${calls.length} calls needing follow-ups`);
    
    calls.forEach(call => {
      const callFields = call.fields;
      const callerNumber = callFields['Caller Number'] || 'Unknown';
      
      // Calculate due date (next business day, or 24 hours)
      const urgency = callFields['Urgency'] || 'Routine';
      let dueDate = new Date();
      
      switch (urgency) {
        case 'Crisis (immediate)':
          dueDate.setHours(dueDate.getHours() + 1);
          break;
        case 'Urgent (same day)':
          dueDate.setHours(dueDate.getHours() + 4);
          break;
        case 'Soon (24-48hrs)':
          dueDate.setDate(dueDate.getDate() + 1);
          break;
        default: // Routine
          dueDate.setDate(dueDate.getDate() + 2);
      }
      
      // Create follow-up record
      const followupData = {
        'Type': 'Callback',
        'Status': 'Pending',
        'Priority': urgency === 'Crisis (immediate)' ? 'Urgent' : 
                   urgency === 'Urgent (same day)' ? 'High' : 'Normal',
        'Due Date/Time': dueDate.toISOString(),
        'Notes': `Auto-created from call. Caller: ${callerNumber}. ${callFields['Summary'] || ''}`,
        'Related Call': [call.id]
      };
      
      // Link to caller if exists
      if (callFields['Caller'] && callFields['Caller'].length > 0) {
        followupData['Caller'] = callFields['Caller'];
      }
      
      // Link to assigned mentor if specified
      if (callFields['Mentor for Follow-up']) {
        // Try to find team member by name
        const mentor = findTeamMemberByName(callFields['Mentor for Follow-up']);
        if (mentor) {
          followupData['Assigned To'] = [mentor.id];
        }
      }
      
      createRecord(CONFIG.TABLES.FOLLOWUPS, followupData);
      console.log(`      ✅ Created follow-up for ${callerNumber}`);
      
      // Mark call as having follow-up created
      updateRecord(CONFIG.TABLES.CALLS, call.id, { 'Follow-up Created': true });
    });
    
    console.log('   ✅ Follow-up creation complete');
    
  } catch (error) {
    console.error('   ❌ Follow-up error:', error.message);
  }
}

function findTeamMemberByName(name) {
  if (!name) return null;
  
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.TABLES.TEAM_MEMBERS)}`;
  const formula = encodeURIComponent(`FIND("${name}", {Name})`);
  
  const response = airtableFetch(`${url}?filterByFormula=${formula}&maxRecords=1`);
  return response.records && response.records.length > 0 ? response.records[0] : null;
}

// ═══════════════════════════════════════════════════════════════
// 4️⃣ DAILY REPORTS
// ═══════════════════════════════════════════════════════════════

function sendDailyReport() {
  console.log('📊 [DAILY REPORT] Generating report...');
  
  try {
    const report = generateDailyReport();
    
    // Log to console
    console.log(report.text);
    
    // Send email if configured
    if (CONFIG.REPORT_EMAIL && CONFIG.REPORT_EMAIL !== 'your-email@example.com') {
      MailApp.sendEmail({
        to: CONFIG.REPORT_EMAIL,
        subject: `📞 Lev Lehazin Daily Report - ${new Date().toLocaleDateString()}`,
        htmlBody: report.html
      });
      console.log(`   ✅ Email sent to ${CONFIG.REPORT_EMAIL}`);
    } else {
      console.log('   ⚠️ No email configured - set CONFIG.REPORT_EMAIL');
    }
    
  } catch (error) {
    console.error('   ❌ Report error:', error.message);
  }
}

function generateDailyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  // Get yesterday's date for comparison
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Get today's calls
  const calls = getAllRecords(CONFIG.TABLES.CALLS);
  const todaysCalls = calls.filter(c => {
    const callDate = c.fields['Date/Time'] || c.fields['Call Start Time'];
    return callDate && callDate.startsWith(todayStr);
  });
  
  // Get pending follow-ups
  const followups = getAllRecords(CONFIG.TABLES.FOLLOWUPS);
  const pendingFollowups = followups.filter(f => f.fields['Status'] === 'Pending');
  const overdueFollowups = pendingFollowups.filter(f => {
    const dueDate = new Date(f.fields['Due Date/Time']);
    return dueDate < today;
  });
  const dueTodayFollowups = pendingFollowups.filter(f => {
    const dueDate = f.fields['Due Date/Time'];
    return dueDate && dueDate.startsWith(todayStr);
  });
  
  // Get team status
  const teamMembers = getAllRecords(CONFIG.TABLES.TEAM_MEMBERS);
  const activeTeam = teamMembers.filter(t => t.fields['Active']);
  
  // Call statistics
  const answeredCalls = todaysCalls.filter(c => c.fields['Final Status'] === 'Answered');
  const missedCalls = todaysCalls.filter(c => c.fields['Final Status'] === 'Missed');
  const voicemails = todaysCalls.filter(c => c.fields['Final Status'] === 'Voicemail');
  
  // Calculate total talk time
  let totalTalkTime = 0;
  answeredCalls.forEach(c => {
    totalTalkTime += (c.fields['Duration'] || 0);
  });
  
  const text = `
═══════════════════════════════════════════════════════════════
📞 LEV LEHAZIN DAILY REPORT - ${today.toLocaleDateString()}
═══════════════════════════════════════════════════════════════

📊 TODAY'S CALLS
   Total Calls: ${todaysCalls.length}
   ✅ Answered: ${answeredCalls.length}
   ❌ Missed: ${missedCalls.length}
   📧 Voicemails: ${voicemails.length}
   ⏱️ Total Talk Time: ${formatDuration(totalTalkTime)}

📋 FOLLOW-UPS
   ⚠️ Due Today: ${dueTodayFollowups.length}
   🔴 Overdue: ${overdueFollowups.length}
   📊 Total Pending: ${pendingFollowups.length}

👥 TEAM
   Active Members: ${activeTeam.length}

═══════════════════════════════════════════════════════════════
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c5aa0; border-bottom: 2px solid #2c5aa0; padding-bottom: 10px; }
    .section { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .section h2 { margin-top: 0; color: #333; }
    .stat { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-value { font-size: 24px; font-weight: bold; color: #2c5aa0; }
    .stat-label { font-size: 12px; color: #666; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
    .danger { background: #f8d7da; border-left: 4px solid #dc3545; }
  </style>
</head>
<body>
  <h1>📞 Lev Lehazin Daily Report</h1>
  <p><strong>Date:</strong> ${today.toLocaleDateString()}</p>
  
  <div class="section">
    <h2>📊 Today's Calls</h2>
    <div class="stat">
      <div class="stat-value">${todaysCalls.length}</div>
      <div class="stat-label">Total Calls</div>
    </div>
    <div class="stat">
      <div class="stat-value">${answeredCalls.length}</div>
      <div class="stat-label">Answered</div>
    </div>
    <div class="stat">
      <div class="stat-value">${missedCalls.length}</div>
      <div class="stat-label">Missed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${formatDuration(totalTalkTime)}</div>
      <div class="stat-label">Talk Time</div>
    </div>
  </div>
  
  <div class="section">
    <h2>📋 Follow-ups</h2>
    ${dueTodayFollowups.length > 0 ? `<div class="alert">⚠️ <strong>${dueTodayFollowups.length}</strong> follow-ups due today</div>` : ''}
    ${overdueFollowups.length > 0 ? `<div class="alert danger">🔴 <strong>${overdueFollowups.length}</strong> overdue follow-ups!</div>` : ''}
    <p>Total Pending: ${pendingFollowups.length}</p>
  </div>
  
  <div class="section">
    <h2>👥 Team Status</h2>
    <p>Active Team Members: ${activeTeam.length}</p>
  </div>
  
  <hr>
  <p style="color: #999; font-size: 12px;">Generated automatically by Lev Lehazin Automation System</p>
</body>
</html>
`;

  return { text, html };
}

/**
 * Generate a weekly summary report
 */
function sendWeeklyReport() {
  console.log('📊 [WEEKLY REPORT] Generating weekly summary...');
  
  try {
    const report = generateWeeklyReport();
    console.log(report.text);
    
    if (CONFIG.REPORT_EMAIL && CONFIG.REPORT_EMAIL !== 'your-email@example.com') {
      MailApp.sendEmail({
        to: CONFIG.REPORT_EMAIL,
        subject: `📊 Lev Lehazin Weekly Summary - Week of ${new Date().toLocaleDateString()}`,
        htmlBody: report.html
      });
    }
  } catch (error) {
    console.error('   ❌ Weekly report error:', error.message);
  }
}

function generateWeeklyReport() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const calls = getAllRecords(CONFIG.TABLES.CALLS);
  const weekCalls = calls.filter(c => {
    const callDate = new Date(c.fields['Date/Time'] || c.fields['Call Start Time']);
    return callDate >= weekAgo && callDate <= today;
  });
  
  const answered = weekCalls.filter(c => c.fields['Final Status'] === 'Answered').length;
  const missed = weekCalls.filter(c => c.fields['Final Status'] === 'Missed').length;
  
  const text = `
═══════════════════════════════════════════════════════════════
📊 LEV LEHAZIN WEEKLY SUMMARY
   Week ending: ${today.toLocaleDateString()}
═══════════════════════════════════════════════════════════════

📞 CALL VOLUME
   Total Calls: ${weekCalls.length}
   Answered: ${answered} (${weekCalls.length > 0 ? Math.round(answered/weekCalls.length*100) : 0}%)
   Missed: ${missed} (${weekCalls.length > 0 ? Math.round(missed/weekCalls.length*100) : 0}%)

═══════════════════════════════════════════════════════════════
`;

  const html = `<html><body><h1>Weekly Summary</h1><p>Total calls: ${weekCalls.length}</p></body></html>`;
  
  return { text, html };
}

// ═══════════════════════════════════════════════════════════════
// 5️⃣ OVERDUE FOLLOW-UP ALERTS
// ═══════════════════════════════════════════════════════════════

function checkOverdueFollowups() {
  console.log('⏰ [OVERDUE] Checking for overdue follow-ups...');
  
  try {
    const now = new Date();
    const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.TABLES.FOLLOWUPS)}`;
    const formula = encodeURIComponent('AND({Status}="Pending", IS_BEFORE({Due Date/Time}, NOW()))');
    
    const response = airtableFetch(`${url}?filterByFormula=${formula}`);
    const overdue = response.records || [];
    
    if (overdue.length === 0) {
      console.log('   ✅ No overdue follow-ups');
      return;
    }
    
    console.log(`   ⚠️ Found ${overdue.length} overdue follow-ups!`);
    
    // Group by assigned person
    const byAssignee = {};
    overdue.forEach(f => {
      const assignee = f.fields['Assigned To'] ? 'Assigned' : 'Unassigned';
      if (!byAssignee[assignee]) byAssignee[assignee] = [];
      byAssignee[assignee].push(f);
    });
    
    // Log details
    overdue.forEach(f => {
      const dueDate = new Date(f.fields['Due Date/Time']);
      const hoursOverdue = Math.round((now - dueDate) / (1000 * 60 * 60));
      console.log(`      🔴 ${f.fields['Type'] || 'Follow-up'} - ${hoursOverdue}h overdue`);
    });
    
    // Send alert email if configured
    if (CONFIG.REPORT_EMAIL && CONFIG.REPORT_EMAIL !== 'your-email@example.com' && overdue.length > 0) {
      const subject = `⚠️ ${overdue.length} Overdue Follow-ups - Lev Lehazin`;
      const body = `
        <h2>⚠️ Overdue Follow-ups Alert</h2>
        <p>There are <strong>${overdue.length}</strong> overdue follow-ups that need attention.</p>
        <p><a href="https://airtable.com/${CONFIG.AIRTABLE_BASE_ID}">Open Airtable to review</a></p>
      `;
      
      // Only send max once per hour (check script properties)
      const props = PropertiesService.getScriptProperties();
      const lastAlert = props.getProperty('lastOverdueAlert');
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      
      if (!lastAlert || parseInt(lastAlert) < oneHourAgo) {
        MailApp.sendEmail({
          to: CONFIG.REPORT_EMAIL,
          subject: subject,
          htmlBody: body
        });
        props.setProperty('lastOverdueAlert', Date.now().toString());
        console.log('   📧 Alert email sent');
      }
    }
    
  } catch (error) {
    console.error('   ❌ Overdue check error:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function airtableFetch(url, options = {}) {
  const defaultOptions = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${CONFIG.AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  if (options.headers) {
    mergedOptions.headers = { ...defaultOptions.headers, ...options.headers };
  }
  
  const response = UrlFetchApp.fetch(url, mergedOptions);
  const data = JSON.parse(response.getContentText());
  
  if (data.error) {
    throw new Error(`Airtable API error: ${data.error.message}`);
  }
  
  return data;
}

function getAllRecords(tableName) {
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
  let allRecords = [];
  let offset = null;
  
  do {
    const pageUrl = offset ? `${url}?offset=${offset}` : url;
    const response = airtableFetch(pageUrl);
    allRecords = allRecords.concat(response.records || []);
    offset = response.offset;
  } while (offset);
  
  return allRecords;
}

function findCallByTBId(tbCallId) {
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.TABLES.CALLS)}`;
  const formula = encodeURIComponent(`{TB Call ID}="${tbCallId}"`);
  
  const response = airtableFetch(`${url}?filterByFormula=${formula}&maxRecords=1`);
  return response.records && response.records.length > 0 ? response.records[0] : null;
}

function createRecord(tableName, fields) {
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
  
  // Clean null/undefined values
  const cleanFields = {};
  Object.keys(fields).forEach(key => {
    if (fields[key] !== null && fields[key] !== undefined && fields[key] !== '') {
      cleanFields[key] = fields[key];
    }
  });
  
  return airtableFetch(url, {
    method: 'post',
    payload: JSON.stringify({ fields: cleanFields })
  });
}

function updateRecord(tableName, recordId, fields) {
  const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
  
  // Clean null/undefined values (but allow explicit null to clear fields)
  const cleanFields = {};
  Object.keys(fields).forEach(key => {
    if (fields[key] !== undefined && fields[key] !== '') {
      cleanFields[key] = fields[key];
    }
  });
  
  return airtableFetch(url, {
    method: 'patch',
    payload: JSON.stringify({ fields: cleanFields })
  });
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TEST FUNCTIONS - Run these manually to test
// ═══════════════════════════════════════════════════════════════

function testMerge() {
  console.log('🧪 Testing merge...');
  mergeWebhookEvents();
}

function testLiveStatus() {
  console.log('🧪 Testing live status...');
  updateLiveCallStatus();
}

function testFollowups() {
  console.log('🧪 Testing follow-up creation...');
  autoCreateFollowups();
}

function testDailyReport() {
  console.log('🧪 Testing daily report...');
  sendDailyReport();
}

function testOverdue() {
  console.log('🧪 Testing overdue check...');
  checkOverdueFollowups();
}

function viewTriggers() {
  console.log('📋 Current triggers:');
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    console.log('   No triggers configured. Run setup() first.');
  } else {
    triggers.forEach(t => {
      console.log(`   - ${t.getHandlerFunction()}`);
    });
  }
}

function deleteTriggers() {
  console.log('🗑️ Deleting all triggers...');
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    ScriptApp.deleteTrigger(t);
    console.log(`   Deleted: ${t.getHandlerFunction()}`);
  });
  console.log('✅ All triggers deleted');
}
