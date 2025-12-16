// Airtable Automation Script
// Trigger: When record created in Webhook Events
// Condition: Status = "ended"
// This script merges all webhook events for a call into Calls table

let config = input.config();
let endedEventId = config.endedEventId; // The record that triggered this

// Get tables
let webhookEventsTable = base.getTable('Webhook Events');
let callsTable = base.getTable('Calls');

// Get the ended event record
let endedEvent = await webhookEventsTable.selectRecordAsync(endedEventId);
if (!endedEvent) {
    console.log('❌ Ended event not found');
    return;
}

let callId = endedEvent.getCellValue('Call ID');
console.log(`🔄 Processing Call ID: ${callId}`);

// Get ALL events for this Call ID
let queryResult = await webhookEventsTable.selectRecordsAsync({
    fields: [
        'Call ID', 'Status', 'Direction', 'Send Type', 'Send Name', 'Send Number',
        'Destination Type', 'Destination Name', 'Destination Number',
        'Start Time', 'Call Start Time', 'Caller ID External', 'Caller Name External',
        'Called Number', 'Processed'
    ]
});

let allEvents = queryResult.records.filter(r => 
    r.getCellValue('Call ID') === callId &&
    r.getCellValue('Processed') !== true
);

if (allEvents.length === 0) {
    console.log('✅ Already processed or no events found');
    return;
}

console.log(`📊 Found ${allEvents.length} events to merge`);

// Sort by time
allEvents.sort((a, b) => {
    let timeA = new Date(a.getCellValue('Start Time') || a.getCellValue('Call Start Time'));
    let timeB = new Date(b.getCellValue('Start Time') || b.getCellValue('Call Start Time'));
    return timeA - timeB;
});

// Extract data from events
let firstEvent = allEvents[0];
let lastEvent = allEvents[allEvents.length - 1];

// Find answered event
let answeredEvent = allEvents.find(e => 
    e.getCellValue('Status') === 'answered' && 
    e.getCellValue('Destination Type') === 'phone'
);

// Build IVR path
let ivrPath = [];
allEvents.forEach(event => {
    let destType = event.getCellValue('Destination Type');
    let destName = event.getCellValue('Destination Name');
    if (destType === 'ivr' && destName && !ivrPath.includes(destName)) {
        ivrPath.push(destName);
    }
});

// Find hunt group
let huntGroupEvent = allEvents.find(e => 
    e.getCellValue('Destination Type') === 'huntgroup' ||
    e.getCellValue('Send Type') === 'huntgroup'
);
let huntGroup = huntGroupEvent ? 
    (huntGroupEvent.getCellValue('Destination Name') || huntGroupEvent.getCellValue('Send Name')) : 
    null;

// Determine status
let wasAnswered = !!answeredEvent;
let finalStatus = 'IVR Only';
let direction = 'Inbound';

if (wasAnswered) {
    finalStatus = 'Answered';
    direction = 'Inbound';
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

// Calculate duration
let duration = 0;
if (answeredEvent && lastEvent) {
    let answerTime = new Date(answeredEvent.getCellValue('Start Time'));
    let endTime = new Date(lastEvent.getCellValue('Start Time'));
    duration = Math.round((endTime - answerTime) / 1000); // seconds
}

// Build summary
let callerNumber = firstEvent.getCellValue('Caller ID External') || firstEvent.getCellValue('Send Number');
let callerName = firstEvent.getCellValue('Caller Name External');
let summaryParts = [];

if (callerName) {
    summaryParts.push(`From: ${callerName} (${callerNumber})`);
} else {
    summaryParts.push(`From: ${callerNumber}`);
}

if (ivrPath.length > 0) {
    summaryParts.push(`IVR: ${ivrPath.join(' → ')}`);
}

if (huntGroup) {
    summaryParts.push(`Hunt Group: ${huntGroup}`);
}

if (answeredEvent) {
    summaryParts.push(`Answered by: ${answeredEvent.getCellValue('Destination Name')}`);
    if (duration > 0) {
        let mins = Math.floor(duration / 60);
        let secs = duration % 60;
        summaryParts.push(`Duration: ${mins}m ${secs}s`);
    }
} else {
    summaryParts.push(`Status: ${finalStatus}`);
}

let summary = summaryParts.join(' | ');

// Check if call already exists
let existingCallQuery = await callsTable.selectRecordsAsync({
    fields: ['Telebroad Unique ID']
});
let existingCall = existingCallQuery.records.find(r => 
    r.getCellValue('Telebroad Unique ID') === callId
);

// Create or update call record
if (existingCall) {
    console.log(`✏️ Updating existing call record`);
    await callsTable.updateRecordAsync(existingCall.id, {
        'Direction': direction,
        'Date/Time': firstEvent.getCellValue('Call Start Time') || firstEvent.getCellValue('Start Time'),
        'Duration': duration,
        'Summary': summary
    });
} else {
    console.log(`➕ Creating new call record`);
    await callsTable.createRecordAsync({
        'Telebroad Unique ID': callId,
        'Direction': direction,
        'Date/Time': firstEvent.getCellValue('Call Start Time') || firstEvent.getCellValue('Start Time'),
        'Duration': duration,
        'Summary': summary
    });
}

// Mark all events as processed
console.log(`✅ Marking ${allEvents.length} events as processed`);
for (let event of allEvents) {
    await webhookEventsTable.updateRecordAsync(event.id, {
        'Processed': true
    });
}

console.log(`✅ Merge complete for Call ID: ${callId}`);
