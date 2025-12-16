/**
 * Test Telebroad Webhook Handler
 * Simulates the real webhook events from your sample data
 */
require('dotenv').config();
const telebroadHandler = require('../src/webhooks/telebroad-handler');

// Sample webhook events from your data (ordered chronologically)
const sampleEvents = [
  // Call 1: 1765829422.447440 - Short call that ended quickly
  {"callId":"1765829422.447440","UniqueId":"1765829422.447440","direction":"incoming","status":"ringing","sendType":"external","sendName":"18455021115","sendNumber":"18455021115","destinationType":"ivr","destinationName":"Day","destinationNumber":"57880","calledType":"","calledNumber":"17186732999","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"WIRELESS CALLER","callerNameExternal":"WIRELESS CALLER","startTime":"2025-12-15T15:10:22-05:00","callStartTime":"2025-12-15T15:10:22-05:00"},
  {"callId":"1765829422.447440","UniqueId":"1765829422.447440","direction":"incoming","status":"ended","sendType":"external","sendName":"18455021115","sendNumber":"18455021115","destinationType":"ivr","destinationName":"Day","destinationNumber":"57880","calledType":"","calledNumber":"17186732999","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"WIRELESS CALLER","callerNameExternal":"WIRELESS CALLER","startTime":"2025-12-15T15:10:22-05:00","callStartTime":"2025-12-15T15:10:22-05:00"},

  // Call 2: 1765829443.779816 - Full call with IVR path ending with answered by Chaim David Klein
  {"callId":"1765829443.779816","UniqueId":"1765829443.779816","direction":"incoming","status":"ringing","sendType":"external","sendName":"18455021115","sendNumber":"18455021115","destinationType":"ivr","destinationName":"Day","destinationNumber":"57880","calledType":"","calledNumber":"17186732999","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:10:43-05:00","callStartTime":"2025-12-15T15:10:43-05:00"},
  {"callId":"1765829443.779816","UniqueId":"1765829457.286920","direction":"incoming","status":"ringing","sendType":"ivr","sendName":"Day","sendNumber":"57880","destinationType":"ivr","destinationName":"discuss something","destinationNumber":"57882","calledType":"ivr","calledNumber":"57882","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:10:57-05:00","callStartTime":"2025-12-15T15:10:43-05:00"},
  {"callId":"1765829443.779816","UniqueId":"1765829467.273306","direction":"incoming","status":"ringing","sendType":"ivr","sendName":"discuss something","sendNumber":"57882","destinationType":"ivr","destinationName":"before connecting","destinationNumber":"57964","calledType":"ivr","calledNumber":"57964","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:11:07-05:00","callStartTime":"2025-12-15T15:10:43-05:00"},
  {"callId":"1765829443.779816","UniqueId":"1765829481.247063","direction":"incoming","status":"ringing","sendType":"ivr","sendName":"before connecting","sendNumber":"57964","destinationType":"huntgroup","destinationName":"talk to Madrech","destinationNumber":"44070","calledType":"huntgroup","calledNumber":"44070","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:11:21-05:00","callStartTime":"2025-12-15T15:10:43-05:00"},
  {"callId":"1765829443.779816","UniqueId":"1765829481.247063","direction":"incoming","status":"answered","sendType":"ivr","sendName":"before xxxxxcting","sendNumber":"57964","destinationType":"huntgroup","destinationName":"talk to Madrech","destinationNumber":"44070","calledType":"huntgroup","calledNumber":"44070","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:11:21-05:00","callStartTime":"2025-12-15T15:10:43-05:00"},
  {"callId":"1765829443.779816","UniqueId":"1765829481.321338","direction":"incoming","status":"answered","sendType":"huntgroup","sendName":"talk to Madrech","sendNumber":"44070","destinationType":"phone","destinationName":"Chaim David Klein","destinationNumber":"2845869","calledType":"phone","calledNumber":"2845869","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:11:21-05:00","callStartTime":"2025-12-15T15:10:43-05:00"},
  {"callId":"1765829443.779816","UniqueId":"1765829443.779816","direction":"incoming","status":"ended","sendType":"external","sendName":"18455021115","sendNumber":"18455021115","destinationType":"ivr","destinationName":"Day","destinationNumber":"57880","calledType":"","calledNumber":"17186732999","callerIdInternal":"18455021115","callerIdExternal":"18455021115","callerNameInternal":"","callerNameExternal":"","startTime":"2025-12-15T15:10:43-05:00","callStartTime":"2025-12-15T15:10:43-05:00"}
];

async function runTest() {
  console.log('🧪 TELEBROAD WEBHOOK TEST\n');
  console.log('='.repeat(60));
  console.log('This simulates the webhook events from your sample data');
  console.log('='.repeat(60));

  for (const event of sampleEvents) {
    console.log(`\n${'─'.repeat(60)}`);
    await telebroadHandler.handleTelebroadWebhook(event);
    // Small delay to simulate real-time events
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL CACHE STATUS:');
  console.log(JSON.stringify(telebroadHandler.getCacheStatus(), null, 2));
  console.log('='.repeat(60));
}

// Run specific test
const testArg = process.argv[2];

if (testArg === 'single') {
  // Test single webhook
  const singleEvent = {"callId":"TEST123","UniqueId":"TEST123","direction":"incoming","status":"answered","sendType":"huntgroup","sendName":"talk to Madrech","sendNumber":"44070","destinationType":"phone","destinationName":"Test Agent","destinationNumber":"1234","calledType":"phone","calledNumber":"1234","callerIdInternal":"5551234567","callerIdExternal":"5551234567","callerNameInternal":"","callerNameExternal":"TEST CALLER","startTime":"2025-12-15T16:00:00-05:00","callStartTime":"2025-12-15T16:00:00-05:00"};
  
  telebroadHandler.handleTelebroadWebhook(singleEvent)
    .then(result => {
      console.log('\n📋 Result:', JSON.stringify(result, null, 2));
    })
    .catch(console.error);
} else {
  runTest().catch(console.error);
}
