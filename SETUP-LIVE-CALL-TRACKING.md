# Live Call Tracking Setup (100% Free Airtable)

## Fields Needed in Team Members Table

Add these fields:
- `Current Status` (Single select): 🟢 Available, 🔴 On Call, 🟡 Busy, ⚫ Offline
- `Current Call ID` (Single line text): Stores active call ID
- `Current Caller Number` (Single line text): Shows who's calling
- `Call Started At` (Date with time): When current call started
- `Phone/Extension` (Single line text): MUST match Telebroad extension

---

## Automation 1: Receive Webhooks ✅

(You already have this)

---

## Automation 2: Agent Answers Call (INSTANT UPDATE)

**Name:** "Live Status - Call Answered"

### Trigger:
- Type: When record created
- Table: Webhook Events

### Conditions:
Add 2 conditions (both must be true):
1. Status = "answered"
2. Destination Type = "phone"

### Action 1: Find Agent Record
- Type: Find records
- Table: Team Members
- Conditions: Where Phone/Extension = [Destination Number from trigger]
- Maximum records: 1

### Action 2: Update Agent Status
- Type: Update record
- Record: [First record from Find records]
- Fields:
  - Current Status → 🔴 On Call
  - Current Call ID → [Call ID from trigger]
  - Current Caller Number → [Caller ID External from trigger]
  - Call Started At → [Start Time from trigger]

---

## Automation 3: Call Ends (INSTANT UPDATE)

**Name:** "Live Status - Call Ended"

### Trigger:
- Type: When record created
- Table: Webhook Events

### Conditions:
1. Status = "ended"

### Action 1: Find Agent on This Call
- Type: Find records
- Table: Team Members
- Conditions: Where Current Call ID = [Call ID from trigger]
- Maximum records: 1

### Action 2: Clear Agent Status
- Type: Update record
- Record: [First record from Find records]
- Fields:
  - Current Status → 🟢 Available
  - Current Call ID → (leave blank)
  - Current Caller Number → (leave blank)
  - Call Started At → (leave blank)

---

## Automation 4: Historical Merge (Optional - Run on Your PC)

Use your existing merge script for complete call history:
```bash
node scripts/merge-webhook-events.js
```

Run this every 5-10 minutes with Windows Task Scheduler (or whenever).

---

## Dashboard View in Airtable

Create a view in Team Members:
- **Name:** "Live Call Dashboard"
- **Filter:** Active = true
- **Sort:** Current Status (On Call first)
- **Group by:** Current Status

You'll see:
```
🔴 On Call
  └─ Chaim David Klein - Talking to 18455021115 (started 2:30 PM)

🟢 Available  
  └─ Moshe Cohen
  └─ Yitzy Schwartz

🟡 Busy
  └─ Sarah Goldberg

⚫ Offline
  └─ David Weiss
```

---

## Benefits

✅ **Instant updates** (no delay)
✅ **100% free** (no paid features)
✅ **Always running** (Airtable cloud)
✅ **Live dashboard** (see who's on call now)
✅ **No server needed** (all Airtable automations)

---

## Testing

1. Create a test webhook event in Webhook Events:
   - Call ID: TEST123
   - Status: answered
   - Destination Type: phone
   - Destination Number: 200 (your agent's extension)
   - Caller ID External: 18005551234

2. Check Team Members - agent should show "🔴 On Call"

3. Create another webhook event:
   - Call ID: TEST123
   - Status: ended

4. Check Team Members - agent should show "🟢 Available"

---

## Important Notes

- **Extension matching:** Phone/Extension field MUST exactly match Telebroad's Destination Number
- **Multiple calls:** If agent gets another call before ending first, Current Call ID updates to newest
- **Missed calls:** Won't update agent status (only answered calls)
- **Call history:** Use merge script separately for complete call records in Calls table
