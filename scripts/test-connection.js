const { base, tables } = require('../src/config/airtable');

console.log('🔌 Testing Airtable connection...\n');

async function testConnection() {
  try {
    // Test 1: Fetch first 3 records from Calls table
    console.log(`📞 Fetching records from "${tables.calls}" table...`);
    
    const records = await base(tables.calls)
      .select({
        maxRecords: 3,
        view: 'Grid view' // Default view name
      })
      .firstPage();

    if (records.length > 0) {
      console.log(`✅ Successfullx xxxxxcted! Found ${records.length} record(s):`);
      records.forEach((record, index) => {
        console.log(`\n  Record ${index + 1}:`);
        console.log(`  ID: ${record.id}`);
        console.log(`  Fields:`, JSON.stringify(record.fields, null, 4));
      });
    } else {
      console.log('⚠️  Connection successful, but no records found in table.');
      console.log('   This is normal for a new table. You can now add records!');
    }

    // Test 2: Try to access Callers table
    console.log(`\n👥 Testing "${tables.callers}" table...`);
    const callerRecords = await base(tables.callers)
      .select({ maxRecords: 1 })
      .firstPage();
    
    console.log(`✅ "${tables.callers}" table accessible (${callerRecords.length} record(s) found)`);

    // Test 3: Try to access Team Members table
    console.log(`\n👥 Testing "${tables.teamMembers}" table...`);
    const teamRecords = await base(tables.teamMembers)
      .select({ maxRecords: 1 })
      .firstPage();
    
    console.log(`✅ "${tables.teamMembers}" table accessible (${teamRecords.length} record(s) found)`);

    console.log('\n✨ All tests passed! Your Airtable integration is ready.\n');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nTroubleshooting steps:');
    console.error('1. Check your .env file has correct AIRTABLE_PAT and AIRTABLE_BASE_ID');
    console.error('2. Verify your token at: https://airtable.com/create/tokens');
    console.error('3. Make sure table names match exactly (case-sensitive)');
    console.error('4. Ensure your token has data.records:read permission\n');
    process.exit(1);
  }
}

testConnection();
