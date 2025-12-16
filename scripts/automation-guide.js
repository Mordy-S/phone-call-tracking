/**
 * Automation Setup Guide
 * Airtable automations cannot be created via API - this provides step-by-step instructions
 */

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║           LEV LEHAZIN HELPLINE - AUTOMATION SETUP GUIDE                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Airtable automations must be created manually in the Airtable UI.           ║
║  Follow these step-by-step instructions to set up all required automations.  ║
╚══════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 AUTOMATION 1: Auto-Create Follow-up from Call
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE: Automatically create a follow-up task when a call outcome is 
         "Callback Scheduled"

SETUP STEPS:
1. Go to Airtable → Click "Automations" tab (top right)
2. Click "+ Create automation"
3. Name it: "Auto-Create Follow-up"

TRIGGER:
   - Click "Add trigger"
   - Select: "When record matches conditions"
   - Table: "Calls"
   - Conditions:
     • Outcome = "Callback Scheduled"
     • Follow-up Created = unchecked (empty/false)
   - Click "Done"

ACTION 1 - Create Follow-up:
   - Click "Add action"
   - Select: "Create record"
   - Table: "Follow-ups"
   - Fields to set:
     • Related Call → {Record ID from trigger}
     • Caller → {Caller from trigger record}
     • Assigned To → {Mentor for Follow-up from trigger record} 
                     (Note: may need lookup if it's text field)
     • Type → "Callback"
     • Status → "Pending"
     • Priority → "High"
     • Notes → "Auto-created from call on {Date/Time}"
   - Click "Done"

ACTION 2 - Update Original Call:
   - Click "Add action"  
   - Select: "Update record"
   - Table: "Calls"
   - Record: {Record ID from trigger}
   - Fields to update:
     • Follow-up Created → ✓ (checked)
   - Click "Done"

4. Turn ON the automation (toggle at top right)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 AUTOMATION 2: Daily Digest Email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE: Send daily email with pending follow-ups due today

PRE-REQUISITE - Create View First:
1. Go to "Follow-ups" table
2. Create new view: "Due Today"
3. Add filter: Due Date/Time = Today AND Status = "Pending"
4. Save view

SETUP STEPS:
1. Go to Automations → Create automation
2. Name it: "Daily Follow-up Digest"

TRIGGER:
   - Select: "At a scheduled time"
   - Frequency: Daily
   - Time: 8:00 AM (or preferred time)
   - Timezone: Your timezone

CONDITION (Optional but recommended):
   - Click "Add condition"
   - Select: "Records match conditions"
   - Table: "Follow-ups"
   - View: "Due Today"
   - Condition: "When the view has 1 or more records"

ACTION - Send Email:
   - Click "Add action"
   - Select: "Send email"
   - To: team@levlehazin.org (or distribution list)
   - Subject: "📋 Lev Lehazin - Follow-ups Due Today"
   - Body:
     ─────────────────────────────
     Good morning!
     
     Here are today's pending follow-ups:
     
     {List of records from "Due Today" view}
     
     For each record show:
     - Caller (linked field or ID)
     - Assigned To
     - Type
     - Priority
     - Due Date/Time
     - Notes
     
     Please review and complete by end of day.
     ─────────────────────────────

4. Turn ON the automation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 AUTOMATION 3: Overdue Follow-up Alert
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE: Alert supervisor when follow-ups become overdue

PRE-REQUISITE - Create View First:
1. Go to "Follow-ups" table
2. Create new view: "Overdue"
3. Add filter: Due Date/Time < Today AND Status = "Pending"
4. Save view

SETUP STEPS:
1. Go to Automations → Create automation
2. Name it: "Overdue Alert"

TRIGGER:
   - Select: "When record enters view"
   - Table: "Follow-ups"
   - View: "Overdue"

ACTION - Send Email:
   - Click "Add action"
   - Select: "Send email"
   - To: supervisor@levlehazin.org
   - Subject: "🚨 Overdue Follow-up Alert"
   - Body:
     ─────────────────────────────
     A follow-up has become overdue:
     
     Caller: {Caller}
     Assigned To: {Assigned To}
     Was Due: {Due Date/Time}
     Type: {Type}
     Priority: {Priority}
     Notes: {Notes}
     
     Please follow up immediately.
     ─────────────────────────────

4. Turn ON the automation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 AUTOMATION 4: New Call Notification (Optional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE: Notify team when a new call is logged (useful for urgent calls)

SETUP STEPS:
1. Create automation: "Urgent Call Alert"

TRIGGER:
   - Select: "When record matches conditions"
   - Table: "Calls"
   - Condition: Urgency = "Crisis (immediate)" OR Urgency = "Urgent (same day)"

ACTION - Send Email/Slack:
   - Send notification with call details
   - Include: Caller, Summary, Urgency level

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 VIEWS TO CREATE FOR AUTOMATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOLLOW-UPS TABLE:
┌────────────────────────┬────────────────────────────────────────────────┐
│ View Name              │ Filter Conditions                              │
├────────────────────────┼────────────────────────────────────────────────┤
│ Due Today              │ Due Date/Time = Today AND Status = "Pending"   │
│ Overdue                │ Due Date/Time < Today AND Status = "Pending"   │
│ This Week              │ Due Date/Time within past/next 7 days          │
│ By Mentor              │ Group by: Assigned To                          │
│ Completed This Week    │ Completed Date within past 7 days              │
└────────────────────────┴────────────────────────────────────────────────┘

CALLS TABLE:
┌────────────────────────┬────────────────────────────────────────────────┐
│ View Name              │ Filter Conditions                              │
├────────────────────────┼────────────────────────────────────────────────┤
│ Today's Calls          │ Date/Time = Today                              │
│ Needs Follow-up        │ Outcome = "Callback Scheduled" AND             │
│                        │ Follow-up Created = unchecked                  │
│ By Team Member         │ Group by: Received By                          │
│ This Week              │ Date/Time within past 7 days                   │
└────────────────────────┴────────────────────────────────────────────────┘

TEAM MEMBERS TABLE:
┌────────────────────────┬────────────────────────────────────────────────┐
│ View Name              │ Filter Conditions                              │
├────────────────────────┼────────────────────────────────────────────────┤
│ Who's Available        │ Active = ✓, Group by: Current Status           │
│ Mentors by Specialty   │ Role = "Mentor" or "Both", Group by Specialties│
└────────────────────────┴────────────────────────────────────────────────┘

CALLERS TABLE:
┌────────────────────────┬────────────────────────────────────────────────┐
│ View Name              │ Filter Conditions                              │
├────────────────────────┼────────────────────────────────────────────────┤
│ Active Callers         │ Status = "Active"                              │
│ New - Needs Assignment │ Assigned Mentor is empty AND Status = "New"    │
│ By Mentor              │ Group by: Assigned Mentor                      │
└────────────────────────┴────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ESTIMATED TIME: 45-60 minutes for all automations and views
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Open Airtable to start: https://airtable.com/appJwIYEKexkvYS8D

`);
