const { base, tables } = require('../src/config/airtable');

console.log('🔍 Auditing Airtable Base...\n');

const requiredTables = {
  'Team Members': 'teamMembers',
  'Callers': 'callers',
  'Calls': 'calls',
  'Follow-ups': 'followups',
  'Availability Schedule': 'availability'
};

async function auditTables() {
  console.log('📋 Required Tables per Document:');
  Object.keys(requiredTables).forEach(name => {
    console.log(`  - ${name}`);
  });
  console.log('\n🔎 Checking current tables...\n');

  const results = {
    found: [],
    missing: [],
    extra: []
  };

  // Check each required table
  for (const [tableName, tableKey] of Object.entries(requiredTables)) {
    try {
      const records = await base(tables[tableKey])
        .select({ maxRecords: 1 })
        .firstPage();
      
      console.log(`✅ "${tableName}" - EXISTS (${records.length > 0 ? 'has data' : 'empty'})`);
      results.found.push(tableName);
    } catch (error) {
      console.log(`❌ "${tableName}" - NOT FOUND`);
      console.log(`   Error: ${error.message}`);
      results.missing.push(tableName);
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`  ✅ Found: ${results.found.length}/${Object.keys(requiredTables).length}`);
  console.log(`  ❌ Missing: ${results.missing.length}`);

  if (results.missing.length > 0) {
    console.log('\n⚠️  Missing Tables:');
    results.missing.forEach(name => console.log(`  - ${name}`));
    console.log('\n💡 Run "node scripts/create-missing-tables.js" to create them');
  } else {
    console.log('\n✨ All required tables exist!');
  }

  // Check for extra tables (would need manual deletion in Airtable UI)
  console.log('\n⚠️  Note: To delete extra tables not in the spec, you must:');
  console.log('   1. Go to your Airtable base in the browser');
  console.log('   2. Right-click on table tabs and select "Delete table"');
  console.log('   3. Only keep: Team Members, Callers, Calls, Follow-ups, Availability Schedule');
}

auditTables().catch(console.error);
