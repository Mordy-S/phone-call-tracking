const Airtable = require('airtable');
require('dotenv').config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

console.log('🔍 Checking field structure in all tables...\n');

const expectedFields = {
  'Team Members': [
    'Name', 'Role', 'Phone/Extension', 'Specialties', 'Current Status',
    'Status Last Updated', 'Usual Hours', 'Notes', 'Active'
  ],
  'Callers': [
    'Caller ID', 'Name', 'Phone', 'Phone Type', 'Contact Preference',
    'Best Times', 'Primary Issue', 'Assigned Mentor', 'Status',
    'First Contact', 'Background Notes', 'Calls', 'Follow-ups'
  ],
  'Calls': [
    'Call ID', 'Date/Time', 'Caller', 'Received By', 'Direction',
    'Call Type', 'Duration', 'Issue Category', 'Summary', 'Outcome',
    'Mentor for Follow-up', 'Urgency', 'Follow-up Created', 'Telebroad Call ID'
  ],
  'Follow-ups': [
    'Follow-up ID', 'Related Call', 'Caller', 'Assigned To', 'Type',
    'Due Date/Time', 'Status', 'Priority', 'Notes', 'Completed Date', 'Outcome Notes'
  ],
  'Availability Schedule': [
    'Team Member', 'Day', 'Start Time', 'End Time', 'Role This Shift'
  ]
};

async function checkFields() {
  for (const [tableName, expectedFieldList] of Object.entries(expectedFields)) {
    console.log(`\n📋 Table: "${tableName}"`);
    console.log(`   Expected fields: ${expectedFieldList.length}`);
    
    try {
      // Get table schema by trying to read a record (fields will be visible)
      const records = await base(tableName).select({ maxRecords: 1 }).firstPage();
      
      if (records.length > 0) {
        const actualFields = Object.keys(records[0].fields);
        console.log(`   Actual fields: ${actualFields.length}`);
        console.log(`   Fields: ${actualFields.join(', ')}`);
        
        // Check for missing fields
        const missing = expectedFieldList.filter(f => !actualFields.includes(f));
        if (missing.length > 0) {
          console.log(`   ❌ Missing: ${missing.join(', ')}`);
        } else {
          console.log(`   ✅ All expected fields present`);
        }
      } else {
        console.log(`   ⚠️  Table is empty - cannot verify fields`);
        console.log(`   Expected: ${expectedFieldList.join(', ')}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n\n📝 NOTES:');
  console.log('   • Empty tables cannot show field structure via API');
  console.log('   • Fields must be created manually in Airtable UI or via REST API');
  console.log('   • Link fields (e.g., "Assigned Mentor") connect to other tables');
  console.log('   • Auto-number fields (e.g., "Caller ID") auto-increment');
  console.log('\n💡 To create fields:');
  console.log('   1. Open your Airtable base in browser');
  console.log('   2. Click "+" in each table to add fields');
  console.log('   3. Match field names and types from the specification document');
}

checkFields().catch(console.error);
