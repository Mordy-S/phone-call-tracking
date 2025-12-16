# Webhook Merging Process - Complete Guide

## Current Airtable Structure

### **Webhook Events Table** (Staging)
Stores ALL webhook events before merging. Each call generates 5-10 events.

**Fields:**
- `Call ID` - Telebroad unique identifier (same for all events in one call)
- `Status` - ringing, answered, ended
- `Direction` - incoming, outgoing
- `Send Type` - external, ivr, huntgroup, phone
- `Send Name` - Name of sender
- `Send Number` - Number of sender
- `Destination Type` - ivr, huntgroup, phone
- `Destination Name` - Name of destination
- `Destination Number` - Number of destination
- `Start Time` - Event timestamp
- `Received At` - When webhook was received
- `Processed` - Boolean (false until merged)
- `Merged Call Record` - Link to Calls table record
- `Raw JSON` - Complete webhook payload

### **Calls Table** (Final)
One record per call after merging.

**Current Fields:**
- `Date/Time` - Call start time
- `Direction` - Inbound, Outbound, Missed
- `Duration` - Call length in seconds
- `Summary` - Auto-generated call summary
- `Telebroad Unique ID` - Links to Call ID from webhooks

## How the Merge Works

### Example: One Call = 7 Webhook Events

From your Airtable data, here's a real call flow:

```
Call ID: 1765829443.779816

Event 1: ringing    | external      → ivr (Day)
Event 2: ringing    | ivr (Day)     → ivr (discuss something)
Event 3: ringing    | ivr (discuss) → ivr (before connecting)
Event 4: ringing    | ivr (before)  → huntgroup (talk to Madrech)
Event 5: answered   | ivr (before)  → huntgroup (talk to Madrech)
Event 6: answered   | huntgroup     → phone (Chaim David Klein) ✅
Event 7: ended      | external      → ivr (Day)

Result: ONE call record in Calls table
```

### Extraction Logic (from webhookMerger.js)

The merge script analyzes all 7 events and extracts:

#### 1. **IVR Path** 
```javascript
// Events where Destination Type = "ivr"
Event 2: Day
Event 3: discuss something  
Event 4: before connecting
→ IVR Path: "Day → discuss something → before connecting"
```

#### 2. **Hunt Group**
```javascript
// Event where Destination Type = "huntgroup"
Event 4: talk to Madrech
→ Hunt Group: "talk to Madrech"
```

#### 3. **Answered By**
```javascript
// Event where Status = "answered" AND Destination Type = "phone"
Event 6: Chaim David Klein (Extension: 200)
→ Answered By: "Chaim David Klein"
→ Extension: 200
```

#### 4. **Duration**
```javascript
// Time between answered (Event 6) and ended (Event 7)
Answer Time: 2025-12-15T15:11:21
End Time:    2025-12-15T15:10:43
→ Duration: Calculate seconds
```

#### 5. **Caller Information**
```javascript
// First event (Event 1)
Caller Number: 18455021115
Caller Name: (if available)
```

#### 6. **Final Status**
```javascript
Logic:
- If answered by phone → "Answered"
- If reached hunt group but not answered → "Missed"
- If only IVR navigation → "IVR Only"
- If hung up before anything → "Abandoned"
```

#### 7. **Summary** (Auto-generated)
```
From: 18455021115 | IVR: Day → discuss something → before connecting | 
Hunt Group: talk to Madrech | Answered by: Chaim David Klein | Duration: 2m 15s
```

## Code Flow

### File: `src/services/webhookMerger.js`

```javascript
// STEP 1: Get unprocessed events grouped by Call ID
async processUnprocessedEvents() {
  const groupedEvents = await webhookEventService.getEventsGroupedByCallId();
  // Returns: { "1765829443.779816": [event1, event2, ...] }
}

// STEP 2: Merge each Call ID
async mergeCallEvents(callId, events) {
  // Sort events by time
  events.sort((a, b) => new Date(a['Start Time']) - new Date(b['Start Time']));
  
  // Extract all data
  const callData = this.extractCallData(events);
  
  // Check if call already exists
  const existingCall = await callService.findByTelebroadCallId(callId);
  
  if (existingCall) {
    return await callService.updateCall(existingCall.id, callData);
  } else {
    return await callService.createCall(callData);
  }
}

// STEP 3: Extract merged data
extractCallData(events) {
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  
  // Find answered event
  const answeredEvent = events.find(e => 
    e['Status'] === 'answered' && 
    e['Destination Type'] === 'phone'
  );
  
  // Build IVR path
  const ivrPath = [];
  events.forEach(event => {
    if (event['Destination Type'] === 'ivr') {
      ivrPath.push(event['Destination Name']);
    }
  });
  
  // Build hunt group
  const huntGroupEvent = events.find(e => 
    e['Destination Type'] === 'huntgroup'
  );
  
  // ... extract all other fields
  
  return {
    telebroadCallId: callId,
    direction: "Inbound",
    dateTime: firstEvent['Start Time'],
    callerNumber: firstEvent['Send Number'],
    ivrPath: ivrPath.join(' → '),
    huntGroup: huntGroupEvent ? huntGroupEvent['Destination Name'] : null,
    pickedUpByName: answeredEvent ? answeredEvent['Destination Name'] : null,
    duration: calculateDuration(answeredEvent, lastEvent),
    summary: generateSummary(...)
  };
}
```

## Running the Merge

### Manual Merge
```bash
cd "c:\Users\Computer\Lehazin reports\phone-call-tracking"
node scripts/merge-webhook-events.js
```

### Automated Merge (Every 5 minutes)
```powershell
# Windows Scheduled Task
$action = New-ScheduledTaskAction `
  -Execute 'node' `
  -Argument 'scripts\merge-webhook-events.js' `
  -WorkingDirectory 'C:\Users\Computer\Lehazin reports\phone-call-tracking'

$trigger = New-ScheduledTaskTrigger `
  -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -Action $action `
  -Trigger $trigger `
  -TaskName "MergeWebhooks"
```

### Check Status
```bash
npm run webhook:status
# Shows:
# - Total events
# - Processed/Unprocessed
# - Unique calls
# - Events per call
```

## Key Points

### ✅ What Happens During Merge
1. **Group** - All webhook events with same Call ID are grouped
2. **Analyze** - Extract info from different event types
3. **Create/Update** - One record created in Calls table
4. **Mark Processed** - All webhook events marked as processed
5. **Link** - Webhook events linked to Call record

### ❌ What Does NOT Happen
- Webhook events are **NOT deleted** (kept for audit trail)
- Multiple call records are **NOT created** (only one per Call ID)
- Previously processed events are **NOT reprocessed**

### 🔑 The Key Field: `Call ID`
```
All webhook events with the SAME Call ID = ONE call
Different Call IDs = Different calls
```

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Telebroad Phone System                                  │
│ (Generates 7 webhook events for one call)               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ POST /webhooks/telebroad                                │
│ (Receives each event immediately)                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Webhook Events Table (Airtable)                         │
│ • Event 1: ringing, external → ivr                      │
│ • Event 2: ringing, ivr → ivr                           │
│ • Event 3: ringing, ivr → huntgroup                     │
│ • Event 4: answered, huntgroup → phone                  │
│ • Event 5: ended, external → ivr                        │
│ • ... (all events saved with same Call ID)             │
│ • Processed: FALSE                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ (Every 5 minutes)
                      ▼
┌─────────────────────────────────────────────────────────┐
│ merge-webhook-events.js                                 │
│ 1. Group events by Call ID                              │
│ 2. Extract data from each event type                    │
│ 3. Merge into single call record                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Calls Table (Airtable)                                  │
│ ONE RECORD:                                             │
│ • Call ID: 1765829443.779816                            │
│ • IVR Path: Day → discuss → before connecting           │
│ • Hunt Group: talk to Madrech                           │
│ • Answered By: Chaim David Klein                        │
│ • Duration: 135 seconds                                 │
│ • Summary: Complete call summary                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Webhook Events (Updated)                                │
│ • All 7 events: Processed = TRUE                        │
│ • All 7 events: Linked to Call record                   │
└─────────────────────────────────────────────────────────┘
```

## Testing

### Import Sample Webhooks
```bash
npm run webhook:import
```

### Merge Them
```bash
npm run webhook:merge
```

### Check Results
```bash
npm run webhook:status
```

### View in Airtable
1. **Webhook Events** - Should show Processed = TRUE
2. **Calls** - Should show one merged record
3. **Webhook Events** - Should have "Merged Call Record" linked

## Troubleshooting

### Problem: Events Not Merging
**Check:**
- Do all events have the same `Call ID`?
- Are events marked as `Processed = false`?
- Run: `npm run webhook:status`

### Problem: Multiple Call Records for One Call
**Cause:** Script ran multiple times before marking as processed
**Fix:** Delete duplicates, ensure automation runs properly

### Problem: Missing Data in Call Record
**Check which events exist:**
```bash
node scripts/show-sample-merge.js
```
- No answered event? → Won't have "Answered By"
- No IVR events? → Won't have IVR path
- No huntgroup event? → Won't have Hunt Group

## Additional Fields You Can Extract

The merge script can extract these additional fields (need to add to Calls table):

- **Answer Time** - When call was answered
- **End Time** - When call ended
- **Caller Name** - If provided by Telebroad
- **Called Number** - Number that was dialed
- **IVR Selections** - Menu choices made
- **Wait Time** - Time from ringing to answered
- **Ring Duration** - How long it rang
- **Complete Event Count** - Number of webhook events
- **Raw Webhook Data** - Full JSON of all events

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/webhookMerger.js` | Main merge logic |
| `src/services/webhookEvents.js` | Webhook Events table operations |
| `src/services/calls.js` | Calls table operations |
| `scripts/merge-webhook-events.js` | CLI script to run merge |
| `scripts/webhook-status.js` | View merge status |
| `scripts/show-sample-merge.js` | Visualize merge process |

---

**Last Updated:** December 16, 2025
