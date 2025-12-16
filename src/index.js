require('dotenv').config();
const express = require('express');

// Import services
const teamMemberService = require('./services/teamMembers');
const callerService = require('./services/callers');
const callService = require('./services/calls');
const followupService = require('./services/followups');

// Import webhook handlers
const webhookHandlers = require('./webhooks/handlers');
const telebroadHandler = require('./webhooks/telebroad-handler');
const telebroadWebhookReceiver = require('./webhooks/telebroad-webhook-receiver');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Webhook Endpoints (for Zapier/Telebroad)
// ============================================

/**
 * POST /webhooks/call-live
 * Track live/active calls as they happen
 * Updates team member status to "Busy"
 */
app.post('/webhooks/call-live', async (req, res) => {
  try {
    console.log('📞 Received live call webhook:', req.body);
    const result = await webhookHandlers.handleCallLive(req.body);
    res.json(result);
  } catch (error) {
    console.error('Live call webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/telebroad
 * NEW: Main Telebroad webhook endpoint
 * Receives ALL Telebroad events and saves to staging table
 * This replaces the old call-ended, call-ringing, etc. endpoints
 */
app.post('/webhooks/telebroad', async (req, res) => {
  try {
    console.log('📞 Telebroad webhook:', JSON.stringify(req.body, null, 2));
    const result = await telebroadWebhookReceiver.handleWebhookWithValidation(req.body);
    res.json(result);
  } catch (error) {
    console.error('Telebroad webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/call-ended
 * Zap 1: Auto-log completed calls from Telebroad
 */
app.post('/webhooks/call-ended', async (req, res) => {
  try {
    const result = await webhookHandlers.handleCallEnded(req.body);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/missed-call
 * Zap 2: Missed call alerts
 */
app.post('/webhooks/missed-call', async (req, res) => {
  try {
    const result = await webhookHandlers.handleMissedCall(req.body);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/create-followup
 * Create follow-up from call (can be triggered by Airtable automation)
 */
app.post('/webhooks/create-followup', async (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }
    const result = await webhookHandlers.handleCreateFollowupFromCall(callId);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /webhooks/overdue-alerts
 * Zap 4: Get overdue follow-ups for alerting
 */
app.get('/webhooks/overdue-alerts', async (req, res) => {
  try {
    const result = await webhookHandlers.handleOverdueFollowupAlert();
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /webhooks/daily-digest
 * Daily digest of follow-ups
 */
app.get('/webhooks/daily-digest', async (req, res) => {
  try {
    const result = await webhookHandlers.handleDailyDigest();
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/voicemail
 * Handle voicemail notifications from Telebroad
 */
app.post('/webhooks/voicemail', async (req, res) => {
  try {
    console.log('📧 Received voicemail webhook:', req.body);
    const result = await webhookHandlers.handleVoicemail(req.body);
    res.json(result);
  } catch (error) {
    console.error('Voicemail webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/call-ringing
 * Track when phones start ringing (before answered)
 */
app.post('/webhooks/call-ringing', async (req, res) => {
  try {
    console.log('📳 Received ringing webhook:', req.body);
    const result = await webhookHandlers.handleCallRinging(req.body);
    res.json(result);
  } catch (error) {
    console.error('Ringing webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/call-transferred
 * Handle call transfer notifications
 */
app.post('/webhooks/call-transferred', async (req, res) => {
  try {
    console.log('🔄 Received transfer webhook:', req.body);
    const result = await webhookHandlers.handleCallTransferred(req.body);
    res.json(result);
  } catch (error) {
    console.error('Transfer webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/call-answered
 * Track when calls are answered
 */
app.post('/webhooks/call-answered', async (req, res) => {
  try {
    console.log('✅ Received answered webhook:', req.body);
    const result = await webhookHandlers.handleCallAnswered(req.body);
    res.json(result);
  } catch (error) {
    console.error('Answered webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/telebroad
 * MAIN ENDPOINT - Receives ALL Telebroad webhook events
 * Aggregates multiple events per call into one Airtable record
 * 
 * Telebroad sends multiple webhooks per call with these statuses:
 * - ringing: Call is incoming
 * - answered: Call was picked up
 * - ended: Call finished
 * 
 * This handler aggregates them into ONE record per callId
 */
app.post('/webhooks/telebroad', async (req, res) => {
  try {
    console.log('\n🌐 TELEBROAD WEBHOOK RECEIVED');
    const result = await telebroadHandler.handleTelebroadWebhook(req.body);
    res.json(result);
  } catch (error) {
    console.error('Telebroad webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /webhooks/telebroad/status
 * Debug endpoint to see calls currently being processed
 */
app.get('/webhooks/telebroad/status', (req, res) => {
  const status = telebroadHandler.getCacheStatus();
  res.json(status);
});

// ============================================
// Team Members API
// ============================================

app.get('/api/team-members', async (req, res) => {
  try {
    const members = await teamMemberService.getActiveMembers();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/team-members/available', async (req, res) => {
  try {
    const members = await teamMemberService.getAvailableMembers();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/team-members/mentors', async (req, res) => {
  try {
    const { specialty } = req.query;
    let members;
    if (specialty) {
      members = await teamMemberService.getMentorsBySpecialty(specialty);
    } else {
      members = await teamMemberService.getMembersByRole('Mentor');
    }
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/team-members/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const member = await teamMemberService.updateStatus(req.params.id, status);
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Callers API
// ============================================

app.get('/api/callers', async (req, res) => {
  try {
    const { status } = req.query;
    let callers;
    if (status) {
      callers = await callerService.getCallersByStatus(status);
    } else {
      callers = await callerService.getActiveCallers();
    }
    res.json(callers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/callers/unassigned', async (req, res) => {
  try {
    const callers = await callerService.getUnassignedCallers();
    res.json(callers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/callers/:id', async (req, res) => {
  try {
    const caller = await callerService.getCallerById(req.params.id);
    res.json(caller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/callers', async (req, res) => {
  try {
    const caller = await callerService.createCaller(req.body);
    res.status(201).json(caller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/callers/:id', async (req, res) => {
  try {
    const caller = await callerService.updateCaller(req.params.id, req.body);
    res.json(caller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/callers/:id/assign-mentor', async (req, res) => {
  try {
    const { mentorId } = req.body;
    const caller = await callerService.assignMentor(req.params.id, mentorId);
    res.json(caller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Calls API
// ============================================

app.get('/api/calls', async (req, res) => {
  try {
    const calls = await callService.getAllCalls({ maxRecords: 50 });
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls/today', async (req, res) => {
  try {
    const calls = await callService.getTodaysCalls();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls/needs-followup', async (req, res) => {
  try {
    const calls = await callService.getCallsNeedingFollowup();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls/missed', async (req, res) => {
  try {
    const calls = await callService.getMissedCalls();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calls/:id', async (req, res) => {
  try {
    const call = await callService.getCallById(req.params.id);
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calls', async (req, res) => {
  try {
    const call = await callService.createCall(req.body);
    res.status(201).json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/calls/:id', async (req, res) => {
  try {
    const call = await callService.updateCall(req.params.id, req.body);
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calls/:id/complete-details', async (req, res) => {
  try {
    const call = await callService.completeCallDetails(req.params.id, req.body);
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Follow-ups API
// ============================================

app.get('/api/followups', async (req, res) => {
  try {
    const followups = await followupService.getPending();
    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/followups/due-today', async (req, res) => {
  try {
    const followups = await followupService.getDueToday();
    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/followups/overdue', async (req, res) => {
  try {
    const followups = await followupService.getOverdue();
    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/followups/urgent', async (req, res) => {
  try {
    const followups = await followupService.getUrgent();
    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/followups/:id', async (req, res) => {
  try {
    const followup = await followupService.getFollowupById(req.params.id);
    res.json(followup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/followups', async (req, res) => {
  try {
    const followup = await followupService.createFollowup(req.body);
    res.status(201).json(followup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/followups/:id', async (req, res) => {
  try {
    const followup = await followupService.updateFollowup(req.params.id, req.body);
    res.json(followup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/followups/:id/complete', async (req, res) => {
  try {
    const { outcomeNotes } = req.body;
    const followup = await followupService.complete(req.params.id, outcomeNotes);
    res.json(followup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/followups/:id/reschedule', async (req, res) => {
  try {
    const { dueDateTime, notes } = req.body;
    const followup = await followupService.reschedule(req.params.id, dueDateTime, notes);
    res.json(followup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Start Server
// ============================================

// Only start server if running directly (not when testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
🏥 Lev Lehazin Helpline System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on port ${PORT}

Webhook Endpoints (for Telebroad):
  POST /webhooks/call-live       - Track live calls (real-time)
  POST /webhooks/call-ended      - Auto-log completed calls
  POST /webhooks/missed-call     - Handle missed calls
  POST /webhooks/create-followup - Create follow-up from call
  GET  /webhooks/overdue-alerts  - Get overdue follow-ups
  GET  /webhooks/daily-digest    - Daily follow-up digest

API Endpoints:
  /api/team-members   - Team member management
  /api/callers        - Caller management
  /api/calls          - Call records
  /api/followups      - Follow-up tracking
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

// Export for testing
module.exports = {
  app,
  services: {
    teamMemberService,
    callerService,
    callService,
    followupService
  }
};

