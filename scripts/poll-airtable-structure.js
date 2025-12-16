/**
 * Poll Airtable Base Structure
 * Fetches and displays current tables, fields, and sample data
 */

require('dotenv').config();
const { base, tables } = require('../src/config/airtable');

async function pollAirtableStructure() {
  console.log('\n📊 POLLING AIRTABLE BASE STRUCTURE\n');
  console.log('='.repeat(60));

  const tableNames = Object.entries(tables);

  for (const [key, tableName] of tableNames) {
    console.log(`\n📋 Table: ${tableName} (${key})`);
    console.log('-'.repeat(60));

    try {
      // Get sample records to determine fields
      const records = await base(tableName)
        .select({ maxRecords: 3 })
        .firstPage();

      if (records.length === 0) {
        console.log('   ⚠️  No records found - table may be empty');
        continue;
      }

      // Get all field names from first record
      const sampleRecord = records[0];
      const fieldNames = Object.keys(sampleRecord.fields);

      console.log(`   Records found: ${records.length}`);
      console.log(`   Fields (${fieldNames.length}):`);
      
      fieldNames.forEach((fieldName, index) => {
        const value = sampleRecord.fields[fieldName];
        const type = Array.isArray(value) ? 'Array' : typeof value;
        console.log(`     ${index + 1}. ${fieldName} (${type})`);
      });

      // Show sample data
      console.log('\n   Sample Record:');
      console.log('   ' + JSON.stringify(sampleRecord.fields, null, 4).replace(/\n/g, '\n   '));

    } catch (error) {
      console.error(`   ❌ Error accessing table: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Polling complete\n');
}

// Run if called directly
if (require.main === module) {
  pollAirtableStructure()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { pollAirtableStructure };
