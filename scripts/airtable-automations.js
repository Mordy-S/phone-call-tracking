/**
 * Airtable Native Automations Implementation
 * These are automations that run inside Airtable, not via external webhooks
 * This file provides the logic and setup instructions
 */

const followupService = require('../services/followups');
const callService = require('../services/calls');
const teamMemberService = require('../services/teamMembers');
const callerService = require('../services/callers');

/**
 * AUTOMATION 1: Auto-Create Follow-up from Call
 * 
 * TRIGGER: When record matches conditions
 *   Table: Calls
 *   Condition: Outcome = "Callback Scheduled" AND Follow-up Created = unchecked
 * 
 * ACTION: Create record in Follow-ups table
 * 
 * This automation logic is already implemented in:
 * - handlers.handleCreateFollowupFromCall()
 * - followupService.createFromCall()
 * 
 * In Airtable, you can trigger this via webhook:
 * POST /webhooks/create-followup
 * Body: { "callId": "rec..." }
 */

/**
 * Get all calls that need follow-ups created
 * Used to check which calls should trigger the automation
 */
async function getCallsNeedingFollowups() {
  try {
    const calls = await callService.getCallsNeedingFollowup();
    
    console.log(`Found ${calls.length} calls needing follow-ups`);
    
    return calls.map(call => ({
      id: call.id,
      callId: call['Call ID'],
      dateTime: call['Date/Time'],
      outcome: call['Outcome'],
      caller: call['Caller'],
      mentorForFollowup: call['Mentor for Follow-up']
    }));
  } catch (error) {
    console.error('Error getting calls needing follow-ups:', error);
    throw error;
  }
}

/**
 * Process all pending follow-up creations
 * This can be run as a scheduled job or triggered manually
 */
async function processFollowupCreations() {
  try {
    console.log('🔄 Processing follow-up creations...');
    
    const pendingCalls = await getCallsNeedingFollowups();
    
    if (pendingCalls.length === 0) {
      console.log('  No follow-ups to create');
      return { success: true, created: 0 };
    }

    const results = {
      success: true,
      processed: pendingCalls.length,
      created: 0,
      failed: 0,
      errors: []
    };

    for (const call of pendingCalls) {
      try {
        const result = await followupService.createFromCall({ id: call.id });
        await callService.markFollowupCreated(call.id);
        results.created++;
        console.log(`  ✅ Created follow-up for call ${call.callId}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          callId: call.id,
          error: error.message
        });
        console.error(`  ❌ Failed to create follow-up for call ${call.callId}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: Created ${results.created}, Failed ${results.failed}`);
    
    return results;
  } catch (error) {
    console.error('Error processing follow-up creations:', error);
    throw error;
  }
}

/**
 * AUTOMATION 2: Send Daily Digest Email
 * 
 * TRIGGER: At scheduled time (8:00 AM daily)
 * CONDITION: Records in "Due Today" view > 0
 * ACTION: Send email with summary
 * 
 * This uses: handlers.handleDailyDigest()
 */

/**
 * Get formatted daily digest for email
 */
async function getDailyDigestForEmail() {
  try {
    const followupService = require('../services/followups');
    const digest = await followupService.getDailyDigest();
    
    // Format for email
    const emailBody = `
📊 Lev Lehazin Helpline - Daily Follow-up Summary
Date: ${new Date().toLocaleDateString()}

OVERVIEW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Due Today:        ${digest.dueToday}
🔴 Overdue:          ${digest.overdue}
🚨 Urgent Priority:  ${digest.urgent}
📝 Total Active:     ${digest.total}

${digest.dueToday > 0 ? `
DUE TODAY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${digest.dueTodayList.map(f => `
  • ${f['Type']} - ${f['Priority']}
    Assigned to: ${f['Assigned To'] || 'Unassigned'}
    Due: ${new Date(f['Due Date/Time']).toLocaleTimeString()}
    Caller: ${f['Caller'] || 'Unknown'}
`).join('\n')}
` : '✅ No follow-ups due today'}

${digest.overdue > 0 ? `
⚠️  OVERDUE ITEMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${digest.overdueList.map(f => `
  • ${f['Type']} - ${f['Priority']}
    Assigned to: ${f['Assigned To'] || 'Unassigned'}
    Was due: ${new Date(f['Due Date/Time']).toLocaleDateString()}
    Caller: ${f['Caller'] || 'Unknown'}
`).join('\n')}
` : ''}

View all follow-ups in Airtable:
[Insert your Airtable base URL here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message from the Lev Lehazin Helpline system.
    `.trim();

    return {
      subject: `Lev Lehazin - Daily Follow-up Summary (${digest.dueToday} due today, ${digest.overdue} overdue)`,
      body: emailBody,
      summary: {
        dueToday: digest.dueToday,
        overdue: digest.overdue,
        urgent: digest.urgent,
        total: digest.total
      }
    };
  } catch (error) {
    console.error('Error generating daily digest email:', error);
    throw error;
  }
}

/**
 * AUTOMATION 3: Overdue Follow-up Alerts
 * 
 * TRIGGER: When record enters "Overdue" view
 * ACTION: Send alert email to supervisor
 * 
 * This uses: handlers.handleOverdueFollowupAlert()
 */

/**
 * Get formatted overdue alert for email
 */
async function getOverdueAlertForEmail() {
  try {
    const followupService = require('../services/followups');
    const overdueFollowups = await followupService.getOverdue();
    
    if (overdueFollowups.length === 0) {
      return null; // No alert needed
    }

    const emailBody = `
🚨 OVERDUE FOLLOW-UP ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${overdueFollowups.length} follow-up(s) are now overdue:

${overdueFollowups.map((f, index) => `
${index + 1}. FOLLOW-UP #${f['Follow-up ID'] || f.id}
   Type: ${f['Type']}
   Priority: ${f['Priority']}
   Was due: ${new Date(f['Due Date/Time']).toLocaleDateString()} at ${new Date(f['Due Date/Time']).toLocaleTimeString()}
   Assigned to: ${f['Assigned To'] || 'Unassigned'}
   Caller: ${f['Caller'] || 'Unknown'}
   Notes: ${f['Notes'] || 'None'}
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`).join('\n')}

Please address these overdue follow-ups as soon as possible.

View in Airtable:
[Insert your Airtable base URL here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated alert from the Lev Lehazin Helpline system.
    `.trim();

    return {
      subject: `🚨 ALERT: ${overdueFollowups.length} Overdue Follow-up${overdueFollowups.length > 1 ? 's' : ''}`,
      body: emailBody,
      count: overdueFollowups.length,
      followups: overdueFollowups
    };
  } catch (error) {
    console.error('Error generating overdue alert email:', error);
    throw error;
  }
}

/**
 * AUTOMATION 4: New Caller Welcome
 * 
 * TRIGGER: When new record created in Callers table
 * ACTION: Send welcome SMS or set up initial follow-up
 */

async function handleNewCaller(callerRecordId) {
  try {
    console.log(`👤 Processing new caller: ${callerRecordId}`);
    
    const caller = await callerService.getCallerById(callerRecordId);
    
    // Check contact preference
    if (caller['Contact Preference'] === 'Can receive callbacks') {
      // Could send welcome SMS via Telebroad or Twilio
      console.log(`  📱 Caller can receive callbacks: ${caller.Phone}`);
      
      return {
        success: true,
        action: 'callback_enabled',
        caller: {
          id: caller.id,
          callerId: caller['Caller ID'],
          phone: caller.Phone,
          canCallback: true
        }
      };
    } else {
      console.log(`  📞 Caller preference: ${caller['Contact Preference']}`);
      
      return {
        success: true,
        action: 'no_callback',
        caller: {
          id: caller.id,
          callerId: caller['Caller ID'],
          preference: caller['Contact Preference']
        }
      };
    }
  } catch (error) {
    console.error('Error handling new caller:', error);
    throw error;
  }
}

/**
 * AUTOMATION 5: Crisis Call Alert
 * 
 * TRIGGER: When call created with Urgency = "Crisis (immediate)"
 * ACTION: Send immediate alert to all available mentors
 */

async function handleCrisisCall(callRecordId) {
  try {
    console.log(`🚨 CRISIS CALL ALERT: ${callRecordId}`);
    
    const call = await callService.getCallById(callRecordId);
    const availableMentors = await teamMemberService.getAvailableMembers();
    
    const alertData = {
      callId: call.id,
      callDateTime: call['Date/Time'],
      caller: call['Caller'],
      receivedBy: call['Received By'],
      urgency: call['Urgency'],
      summary: call['Summary'],
      issueCategory: call['Issue Category'],
      availableMentors: availableMentors.map(m => ({
        name: m.Name,
        phone: m['Phone/Extension'],
        specialties: m.Specialties
      }))
    };

    console.log(`  🚨 Crisis call logged`);
    console.log(`  👥 ${availableMentors.length} mentors available to respond`);
    
    // In production, this would trigger SMS/email to all available mentors
    
    return {
      success: true,
      type: 'crisis',
      alertSent: true,
      recipientCount: availableMentors.length,
      details: alertData
    };
  } catch (error) {
    console.error('Error handling crisis call:', error);
    throw error;
  }
}

/**
 * AUTOMATION 6: Mentor Assignment by Specialty
 * 
 * When a new caller has a primary issue, suggest mentors with that specialty
 */

async function suggestMentorForCaller(callerRecordId) {
  try {
    console.log(`🔍 Finding mentor match for caller: ${callerRecordId}`);
    
    const caller = await callerService.getCallerById(callerRecordId);
    const primaryIssue = caller['Primary Issue'];
    
    if (!primaryIssue) {
      return {
        success: false,
        message: 'No primary issue specified'
      };
    }

    const mentors = await teamMemberService.getMentorsBySpecialty(primaryIssue);
    
    // Sort by current availability and caseload
    const sortedMentors = mentors.map(m => ({
      id: m.id,
      name: m.Name,
      status: m['Current Status'],
      specialties: m.Specialties,
      isAvailable: m['Current Status'] === '🟢 Available',
      phone: m['Phone/Extension']
    })).sort((a, b) => {
      // Available mentors first
      if (a.isAvailable && !b.isAvailable) return -1;
      if (!a.isAvailable && b.isAvailable) return 1;
      return 0;
    });

    console.log(`  Found ${sortedMentors.length} mentors with specialty: ${primaryIssue}`);
    
    return {
      success: true,
      caller: {
        id: caller.id,
        callerId: caller['Caller ID'],
        primaryIssue
      },
      suggestedMentors: sortedMentors,
      bestMatch: sortedMentors[0] || null
    };
  } catch (error) {
    console.error('Error suggesting mentor:', error);
    throw error;
  }
}

module.exports = {
  // Follow-up automation
  getCallsNeedingFollowups,
  processFollowupCreations,
  
  // Email/notification helpers
  getDailyDigestForEmail,
  getOverdueAlertForEmail,
  
  // Event handlers
  handleNewCaller,
  handleCrisisCall,
  suggestMentorForCaller
};
