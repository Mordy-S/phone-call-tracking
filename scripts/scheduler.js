#!/usr/bin/env node
/**
 * Background Scheduler for Lev Lehazin Helpline Automations
 * 
 * Runs automations on schedule using node-cron:
 *   - Daily digest at 8:00 AM
 *   - Auto-create follow-ups every 15 minutes
 *   - Overdue check every hour
 * 
 * Usage:
 *   node scripts/scheduler.js
 *   npm run scheduler
 */

require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');

// Import services directly for background tasks
const callService = require('../src/services/calls');
const followupService = require('../src/services/followups');
const teamMemberService = require('../src/services/teamMembers');
const callerService = require('../src/services/callers');

// Configuration
const config = {
  // Daily digest time (8:00 AM)
  dailyDigestTime: process.env.DAILY_DIGEST_TIME || '0 8 * * *',
  
  // Follow-up creation interval (every 15 minutes)
  followupInterval: process.env.FOLLOWUP_INTERVAL || '*/15 * * * *',
  
  // Overdue check interval (every hour)
  overdueInterval: process.env.OVERDUE_INTERVAL || '0 * * * *',
  
  // Urgent check interval (every 5 minutes)
  urgentInterval: process.env.URGENT_INTERVAL || '*/5 * * * *',
  
  // Email settings (if configured)
  alertEmail: process.env.ALERT_EMAIL,
  supervisorEmail: process.env.SUPERVISOR_EMAIL,
  smtpHost: process.env.SMTP_HOST,
  
  // Webhook URLs for external notifications
  slackWebhook: process.env.SLACK_WEBHOOK_URL,
  teamsWebhook: process.env.TEAMS_WEBHOOK_URL
};

// Logging utility
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
    urgent: '🚨'
  }[level] || '•';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
  if (data) {
    console.log(`    └─ ${JSON.stringify(data)}`);
  }
}

/**
 * Send notification via webhook (Slack/Teams)
 */
async function sendNotification(title, message, priority = 'normal') {
  const webhookUrl = config.slackWebhook || config.teamsWebhook;
  
  if (!webhookUrl) {
    log('info', 'No webhook configured for notifications');
    return;
  }

  try {
    const color = priority === 'urgent' ? '#FF0000' : priority === 'high' ? '#FFA500' : '#00FF00';
    
    // Slack format
    if (config.slackWebhook) {
      await axios.post(config.slackWebhook, {
        attachments: [{
          color,
          title,
          text: message,
          footer: 'Lev Lehazin Helpline System',
          ts: Math.floor(Date.now() / 1000)
        }]
      });
    }
    
    // Teams format
    if (config.teamsWebhook) {
      await axios.post(config.teamsWebhook, {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: color.replace('#', ''),
        summary: title,
        sections: [{
          activityTitle: title,
          text: message
        }]
      });
    }
    
    log('success', 'Notification sent');
  } catch (error) {
    log('error', `Failed to send notification: ${error.message}`);
  }
}

/**
 * Task 1: Auto-Create Follow-ups from Calls
 */
async function taskCreateFollowups() {
  log('info', 'Running: Auto-create follow-ups');
  
  try {
    const calls = await callService.getCallsNeedingFollowup();
    
    if (calls.length === 0) {
      log('info', 'No calls need follow-up');
      return;
    }

    log('info', `Found ${calls.length} call(s) needing follow-up`);
    
    let created = 0;
    for (const call of calls) {
      try {
        await followupService.createFromCall(call);
        await callService.markFollowupCreated(call.id);
        created++;
      } catch (err) {
        log('error', `Failed to create follow-up for call ${call.id}`, err.message);
      }
    }
    
    if (created > 0) {
      log('success', `Created ${created} follow-up(s)`);
    }
  } catch (error) {
    log('error', 'Follow-up creation task failed', error.message);
  }
}

/**
 * Task 2: Daily Digest
 */
async function taskDailyDigest() {
  log('info', 'Running: Daily digest');
  
  try {
    const digest = await followupService.getDailyDigest();
    
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    console.log('\n' + '═'.repeat(50));
    console.log(`  📊 DAILY DIGEST - ${date}`);
    console.log('═'.repeat(50));
    console.log(`  Due Today:  ${digest.dueToday}`);
    console.log(`  Overdue:    ${digest.overdue}`);
    console.log(`  Urgent:     ${digest.urgent}`);
    console.log(`  Total:      ${digest.total}`);
    console.log('═'.repeat(50) + '\n');
    
    // Send notification if there are items due
    if (digest.dueToday > 0 || digest.overdue > 0) {
      const message = `
📋 **Follow-ups Due Today**: ${digest.dueToday}
⚠️ **Overdue**: ${digest.overdue}
🔴 **Urgent**: ${digest.urgent}
      `.trim();
      
      await sendNotification('Daily Follow-up Digest', message, digest.urgent > 0 ? 'high' : 'normal');
    }
    
    log('success', 'Daily digest complete');
  } catch (error) {
    log('error', 'Daily digest task failed', error.message);
  }
}

/**
 * Task 3: Overdue Follow-up Alerts
 */
async function taskOverdueAlerts() {
  log('info', 'Running: Overdue check');
  
  try {
    const overdueFollowups = await followupService.getOverdue();
    
    if (overdueFollowups.length === 0) {
      log('info', 'No overdue follow-ups');
      return;
    }
    
    log('warning', `${overdueFollowups.length} overdue follow-up(s) found`);
    
    // Build alert message
    const alerts = overdueFollowups.map(f => {
      const id = f['Follow-up ID'] || f.id;
      const assignedTo = f['Assigned To'] || 'Unassigned';
      const dueDate = f['Due Date/Time'] ? new Date(f['Due Date/Time']).toLocaleDateString() : 'Unknown';
      return `• #${id} - ${assignedTo} (was due: ${dueDate})`;
    }).join('\n');
    
    console.log('\n  🔴 OVERDUE FOLLOW-UPS:');
    console.log('  ' + alerts.split('\n').join('\n  '));
    console.log('');
    
    // Send notification
    await sendNotification(
      '⚠️ Overdue Follow-ups Alert',
      `${overdueFollowups.length} follow-up(s) are overdue:\n\n${alerts}`,
      'high'
    );
    
  } catch (error) {
    log('error', 'Overdue check task failed', error.message);
  }
}

/**
 * Task 4: Urgent Calls Check
 */
async function taskUrgentCheck() {
  try {
    const urgentCalls = await callService.getUrgentCalls();
    
    if (urgentCalls.length === 0) {
      return; // Silent when no urgent calls
    }
    
    log('urgent', `${urgentCalls.length} URGENT CALL(S) NEED ATTENTION!`);
    
    for (const call of urgentCalls) {
      const id = call['Call ID'] || call.id;
      const urgency = call['Urgency'] || 'Unknown';
      const summary = call['Summary'] || 'No summary';
      
      console.log(`  🚨 Call #${id} - ${urgency}`);
      console.log(`     ${summary.substring(0, 60)}...`);
    }
    
    // Send urgent notification
    await sendNotification(
      '🚨 URGENT CALLS ALERT',
      `${urgentCalls.length} urgent call(s) require immediate attention!`,
      'urgent'
    );
    
  } catch (error) {
    // Silent error for urgent check to not spam logs
  }
}

/**
 * Start the scheduler
 */
function startScheduler() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        LEV LEHAZIN HELPLINE - BACKGROUND SCHEDULER               ║
║                                                                  ║
║  Automations will run on schedule. Keep this window open.        ║
╚══════════════════════════════════════════════════════════════════╝

  Started at: ${new Date().toLocaleString()}
  
  Scheduled Tasks:
  ─────────────────────────────────────────────────────────────────
  📋 Follow-up Creation:  Every 15 minutes
  📊 Daily Digest:        8:00 AM daily
  ⏰ Overdue Check:       Every hour
  🚨 Urgent Check:        Every 5 minutes
  ─────────────────────────────────────────────────────────────────

  Press Ctrl+C to stop the scheduler.
`);

  // Schedule: Follow-up creation (every 15 minutes)
  cron.schedule(config.followupInterval, () => {
    taskCreateFollowups();
  });
  log('success', 'Scheduled: Follow-up creation (every 15 min)');

  // Schedule: Daily digest (8:00 AM)
  cron.schedule(config.dailyDigestTime, () => {
    taskDailyDigest();
  });
  log('success', 'Scheduled: Daily digest (8:00 AM)');

  // Schedule: Overdue check (every hour)
  cron.schedule(config.overdueInterval, () => {
    taskOverdueAlerts();
  });
  log('success', 'Scheduled: Overdue alerts (hourly)');

  // Schedule: Urgent check (every 5 minutes)
  cron.schedule(config.urgentInterval, () => {
    taskUrgentCheck();
  });
  log('success', 'Scheduled: Urgent check (every 5 min)');

  // Run initial checks on startup
  log('info', '\nRunning initial checks...\n');
  setTimeout(async () => {
    await taskCreateFollowups();
    await taskOverdueAlerts();
    await taskUrgentCheck();
    log('success', '\nScheduler is now running. Waiting for scheduled tasks...\n');
  }, 2000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down scheduler...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down scheduler...');
  process.exit(0);
});

// Start
startScheduler();
