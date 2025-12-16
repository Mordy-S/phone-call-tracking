const { callService, contactService } = require('../src/services/airtable');

console.log('🧪 Testing Airtable Service Layer\n');

async function runTests() {
  try {
    // Test 1: Fetch all calls
    console.log('1️⃣ Fetching all calls...');
    const calls = await callService.getAllCalls({ maxRecords: 5 });
    console.log(`   ✅ Found ${calls.length} call(s)`);
    
    // Test 2: Fetch today's calls
    console.log('\n2️⃣ Fetching today\'s calls...');
    const todaysCalls = await callService.getTodaysCalls();
    console.log(`   ✅ Found ${todaysCalls.length} call(s) today`);

    // Test 3: Fetch all contacts
    console.log('\n3️⃣ Fetching all contacts...');
    const contacts = await contactService.getAllContacts({ maxRecords: 5 });
    console.log(`   ✅ Found ${contacts.length} contact(s)`);

    // Test 4: Create a test call (optional - uncomment to test)
    // console.log('\n4️⃣ Creating a test call...');
    // const newCall = await callService.createCall({
    //   callerNumber: '+1234567890',
    //   direction: 'Inbound',
    //   duration: 120,
    //   status: 'Completed',
    //   notes: 'Test call from API'
    // });
    // console.log('   ✅ Created call:', newCall.id);

    // Test 5: Create a test contact (optional - uncomment to test)
    // console.log('\n5️⃣ Creating a test contact...');
    // const newContact = await contactService.createContact({
    //   name: 'Test Contact',
    //   phone: '+1234567890',
    //   email: 'test@example.com',
    //   company: 'Test Company'
    // });
    // console.log('   ✅ Created contact:', newContact.id);

    console.log('\n✨ All service tests passed!\n');
    console.log('💡 Tip: Uncomment the create tests in scripts/test-services.js to test write operations.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
