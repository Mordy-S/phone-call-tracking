require('dotenv').config();
const Airtable = require('airtable');

// Validate required environment variables
if (!process.env.AIRTABLE_PAT) {
  throw new Error('AIRTABLE_PAT is not defined in .env file');
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error('AIRTABLE_BASE_ID is not defined in .env file');
}

// Configure Airtable client
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PAT
});

// Get base instance
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// Table names from environment (Lev Lehazin Helpline System)
const tables = {
  teamMembers: process.env.AIRTABLE_TEAM_MEMBERS_TABLE || 'Team Members',
  callers: process.env.AIRTABLE_CALLERS_TABLE || 'Callers',
  calls: process.env.AIRTABLE_CALLS_TABLE || 'Calls',
  followups: process.env.AIRTABLE_FOLLOWUPS_TABLE || 'Follow-ups',
  availability: process.env.AIRTABLE_AVAILABILITY_TABLE || 'Availability Schedule'
};

// Field definitions for each table (matching the document spec)
const fields = {
  teamMembers: {
    NAME: 'Name',
    ROLE: 'Role',
    PHONE_EXTENSION: 'Phone/Extension',
    SPECIALTIES: 'Specialties',
    CURRENT_STATUS: 'Current Status',
    STATUS_LAST_UPDATED: 'Status Last Updated',
    USUAL_HOURS: 'Usual Hours',
    NOTES: 'Notes',
    ACTIVE: 'Active'
  },
  callers: {
    CALLER_ID: 'Caller ID',
    NAME: 'Name',
    PHONE: 'Phone',
    PHONE_TYPE: 'Phone Type',
    CONTACT_PREFERENCE: 'Contact Preference',
    BEST_TIMES: 'Best Times',
    PRIMARY_ISSUE: 'Primary Issue',
    ASSIGNED_MENTOR: 'Assigned Mentor',
    STATUS: 'Status',
    FIRST_CONTACT: 'First Contact',
    BACKGROUND_NOTES: 'Background Notes',
    CALLS: 'Calls',
    FOLLOWUPS: 'Follow-ups'
  },
  calls: {
    CALL_ID: 'Call ID',
    DATE_TIME: 'Date/Time',
    CALLER: 'Caller',
    RECEIVED_BY: 'Received By',
    DIRECTION: 'Direction',
    CALL_TYPE: 'Call Type',
    DURATION: 'Duration',
    ISSUE_CATEGORY: 'Issue Category',
    SUMMARY: 'Summary',
    OUTCOME: 'Outcome',
    MENTOR_FOR_FOLLOWUP: 'Mentor for Follow-up',
    URGENCY: 'Urgency',
    FOLLOWUP_CREATED: 'Follow-up Created',
    TELEBROAD_CALL_ID: 'Telebroad Call ID',
    TB_CALL_ID: 'TB Call ID',
    TELEBROAD_UNIQUE_ID: 'Telebroad Unique ID',
    RECORDING_URL: 'Recording URL',
    RING_STATUS: 'Ring Status',
    // New Telebroad-specific fields
    CALLER_NUMBER: 'Caller Number',
    CALLED_NUMBER: 'Called Number',
    IVR_PATH: 'IVR Path',
    HUNT_GROUP: 'Hunt Group',
    PICKED_UP_BY_NAME: 'Picked Up By Name',
    PICKED_UP_BY_EXTENSION: 'Picked Up By Extension',
    FINAL_STATUS: 'Final Status',
    CALL_START_TIME: 'Call Start Time',
    ANSWER_TIME: 'Answer Time',
    END_TIME: 'End Time',
    CALLER_NAME: 'Caller Name',
    WEBHOOK_EVENTS: 'Webhook Events',
    RAW_WEBHOOK_DATA: 'Raw Webhook Data'
  },
  followups: {
    FOLLOWUP_ID: 'Follow-up ID',
    RELATED_CALL: 'Related Call',
    CALLER: 'Caller',
    ASSIGNED_TO: 'Assigned To',
    TYPE: 'Type',
    DUE_DATE_TIME: 'Due Date/Time',
    STATUS: 'Status',
    PRIORITY: 'Priority',
    NOTES: 'Notes',
    COMPLETED_DATE: 'Completed Date',
    OUTCOME_NOTES: 'Outcome Notes'
  },
  availability: {
    TEAM_MEMBER: 'Team Member',
    DAY: 'Day',
    START_TIME: 'Start Time',
    END_TIME: 'End Time',
    ROLE_THIS_SHIFT: 'Role This Shift'
  }
};

// Select field options (matching the document spec)
const selectOptions = {
  roles: ['Intaker', 'Mentor', 'Both'],
  specialties: [
    'Emotional/Mental Health',
    'Technology/Internet',
    'Kedusha',
    'Learning/Motivation',
    'Family/Relationships',
    'Addiction',
    'General'
  ],
  teamStatus: ['🟢 Available', '🟡 Busy', '🔴 Offline'],
  phoneTypes: ['Cell', 'Home', 'Work', 'Public/Other'],
  contactPreferences: ['Can receive callbacks', 'Will call back only', 'Either'],
  callerStatus: ['New', 'Active', 'Stable', 'Closed', 'Referred Out'],
  callDirection: ['Inbound', 'Outbound', 'Missed'],
  callTypes: ['New Caller', 'Follow-up', 'Crisis', 'Check-in', 'Voicemail', 'Admin'],
  finalStatus: ['Answered', 'Missed', 'Voicemail', 'Abandoned', 'IVR Only'],
  callOutcomes: [
    'Callback Scheduled',
    'Caller Will Call Back',
    'Resolved',
    'Transferred',
    'Left Voicemail',
    'Referred Out'
  ],
  urgency: ['Routine', 'Soon (24-48hrs)', 'Urgent (same day)', 'Crisis (immediate)'],
  followupTypes: ['Callback', 'Check-in', 'Scheduled Session', 'Internal Task'],
  followupStatus: ['Pending', 'Completed', 'Rescheduled', 'No Answer', 'Cancelled'],
  followupPriority: ['Normal', 'High', 'Urgent'],
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Motzei Shabbos'],
  shiftRoles: ['Intaker', 'Mentor On-Call']
};

// Export configuration
module.exports = {
  base,
  tables,
  fields,
  selectOptions
};
