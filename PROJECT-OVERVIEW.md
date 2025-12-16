# Lev Lehazin Helpline System - Project Overview

## Purpose
Phone call tracking system integrating Telebroad phone system with Airtable database. Handles multiple webhook events per call (IVR routing) and merges them into single call records.

## Airtable Structure

### Tables
- **Team Members** - Mentors/intakers with specialties, status, extensions
- **Callers** - Anonymous caller tracking with phone numbers and issues
- **Calls** - Main call log with IVR paths, durations, outcomes
- **Follow-ups** - Scheduled callbacks and tasks
- **Webhook Events** - Staging table for raw Telebroad webhooks (before merging)

## Webhook Flow

```
Telebroad → /webhooks/telebroad → Webhook Events table (all events saved)
                                         ↓
                                   Merge Script (every 5 min)
                                         ↓
                                   Calls table (1 record per call)
```

**Why?** One call generates 7+ webhooks (External → IVR → IVR → Hunt Group → Phone → Answered → Ended). We save all, then merge by `callId`.

## Key Services

- **webhookEvents.js** - Manages Webhook Events staging table
- **webhookMerger.js** - Merges events by callId into Calls
- **calls.js** - Calls table CRUD operations
- **callers.js** - Callers table operations
- **teamMembers.js** - Team management
- **followups.js** - Follow-up tracking

## Key Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| import-sample-webhooks.js | `npm run webhook:import` | Import test webhooks |
| merge-webhook-events.js | `npm run webhook:merge` | Merge staging → Calls |
| webhook-status.js | `npm run webhook:status` | View statistics |
| poll-airtable-structure.js | `npm run poll:airtable` | Check Airtable structure |
| auto-create-webhook-table.js | - | Creates Webhook Events table |
| add-webhook-fields-to-calls.js | - | Adds fields to Calls table |

## Server Endpoints

- **POST /webhooks/telebroad** - Main webhook receiver (saves to staging)
- **GET /health** - Health check
- Legacy endpoints: /webhooks/call-ended, /webhooks/missed-call, etc.

## Environment Variables (.env)

```
AIRTABLE_PAT=your_token
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_WEBHOOK_EVENTS_TABLE=Webhook Events
AIRTABLE_TEAM_MEMBERS_TABLE=Team Members
AIRTABLE_CALLERS_TABLE=Callers
AIRTABLE_CALLS_TABLE=Calls
AIRTABLE_FOLLOWUPS_TABLE=Follow-ups
```

## Typical Workflow

1. **Setup**
   - Create Airtable tables
   - Configure .env
   - Run `npm install`

2. **Test**
   - `npm run webhook:import` - Import sample webhooks
   - `npm run webhook:merge` - Merge into Calls
   - Check Airtable

3. **Production**
   - `npm start` - Start webhook server
   - `ngrok http 3000` - Expose webhook URL
   - Configure Telebroad webhook URL
   - Schedule merge script (every 5 minutes)

4. **Monitor**
   - `npm run webhook:status` - Check processing status
   - `npm run status` - Full system status

## Call Data Extracted

From multiple webhooks, we extract:
- **IVR Path** - Route through menu system
- **Hunt Group** - Which group handled call
- **Answered By** - Name and extension
- **Duration** - Answer time to end time
- **Final Status** - Answered, Missed, IVR Only, Abandoned
- **Complete Summary** - Auto-generated call summary

## Automation

**Windows Scheduled Task** (runs every 5 minutes):
```powershell
$action = New-ScheduledTaskAction -Execute 'node' -Argument 'scripts\merge-webhook-events.js' -WorkingDirectory 'C:\Users\Computer\Lehazin reports\phone-call-tracking'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "MergeWebhooks"
```

## Tech Stack

- **Node.js** + Express - Webhook server
- **Airtable** - Database
- **Axios** - HTTP client
- **dotenv** - Environment config
- **Telebroad** - Phone system
