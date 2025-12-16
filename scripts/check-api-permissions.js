/**
 * Check Airtable API Token Permissions
 * This script verifies what your current token can do
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

console.log('🔑 Checking Airtable API Token Permissions...\n');
console.log(`Base ID: ${baseId}`);
console.log(`Token: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}\n`);

const axiosConfig = {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
};

async function checkPermissions() {
  const results = {
    readSchema: false,
    readRecords: false,
    writeRecords: false,
    writeSchema: false
  };

  // Test 1: Read Schema (schema.bases:read)
  console.log('1️⃣ Testing schema.bases:read (read table structure)...');
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      axiosConfig
    );
    results.readSchema = true;
    console.log(`   ✅ Can read schema - Found ${response.data.tables.length} tables`);
    
    // Show existing fields in Team Members table
    const teamMembersTable = response.data.tables.find(t => t.name === 'Team Members');
    if (teamMembersTable) {
      console.log('\n   📋 Team Members table fields:');
      teamMembersTable.fields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Cannot read schema: ${error.response?.data?.error?.message || error.message}`);
  }

  // Test 2: Read Records (data.records:read)
  console.log('\n2️⃣ Testing data.records:read (read data)...');
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/${baseId}/Team%20Members?maxRecords=1`,
      axiosConfig
    );
    results.readRecords = true;
    console.log(`   ✅ Can read records - Found ${response.data.records.length} record(s)`);
  } catch (error) {
    console.log(`   ❌ Cannot read records: ${error.response?.data?.error?.message || error.message}`);
  }

  // Test 3: Write Records (data.records:write) - Create then delete test record
  console.log('\n3️⃣ Testing data.records:write (create/update data)...');
  try {
    // Create a test record
    const createResponse = await axios.post(
      `https://api.airtable.com/v0/${baseId}/Team%20Members`,
      { 
        records: [{ 
          fields: { 
            'Name': '__TEST_RECORD_DELETE_ME__' 
          } 
        }] 
      },
      axiosConfig
    );
    
    const testRecordId = createResponse.data.records[0].id;
    console.log(`   ✅ Can create records (created test record: ${testRecordId})`);
    
    // Delete the test record
    await axios.delete(
      `https://api.airtable.com/v0/${baseId}/Team%20Members/${testRecordId}`,
      axiosConfig
    );
    console.log(`   ✅ Can delete records (test record deleted)`);
    
    results.writeRecords = true;
  } catch (error) {
    console.log(`   ❌ Cannot write records: ${error.response?.data?.error?.message || error.message}`);
  }

  // Test 4: Write Schema (schema.bases:write) - Try to create a test field
  console.log('\n4️⃣ Testing schema.bases:write (create fields/tables)...');
  try {
    // Get table ID for Callers
    const tablesResponse = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      axiosConfig
    );
    const callersTable = tablesResponse.data.tables.find(t => t.name === 'Callers');
    
    if (callersTable) {
      // Try to create a test field
      const response = await axios.post(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${callersTable.id}/fields`,
        {
          name: '__TEST_FIELD__',
          type: 'singleLineText',
          description: 'Test field - safe to delete'
        },
        axiosConfig
      );
      console.log(`   ✅ Can create fields! Created test field: ${response.data.id}`);
      console.log(`   ⚠️  Please delete "__TEST_FIELD__" from Callers table in Airtable UI`);
      results.writeSchema = true;
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.log(`   ❌ Cannot create fields: ${errorMsg}`);
    
    if (errorMsg.includes('NOT_AUTHORIZED') || errorMsg.includes('permission') || error.response?.status === 403) {
      console.log('\n   💡 Your token needs "schema.bases:write" permission!');
      console.log('   To fix:');
      console.log('   1. Go to: https://airtable.com/create/tokens');
      console.log('   2. Find your "Phone Call Tracking API" token');
      console.log('   3. Click "Edit" and add scope: schema.bases:write');
      console.log('   4. Save and update your .env file with the new token');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERMISSION SUMMARY:');
  console.log('='.repeat(60));
  console.log(`  Read Schema (table structure):     ${results.readSchema ? '✅ YES' : '❌ NO'}`);
  console.log(`  Read Records (data):               ${results.readRecords ? '✅ YES' : '❌ NO'}`);
  console.log(`  Write Records (create/update):     ${results.writeRecords ? '✅ YES' : '❌ NO'}`);
  console.log(`  Write Schema (create fields):      ${results.writeSchema ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n📝 WHAT YOU CAN DO VIA CLI:');
  if (results.writeSchema) {
    console.log('  ✅ Create fields programmatically');
    console.log('  ✅ Create link fields between tables');
  } else {
    console.log('  ❌ Cannot create fields (need schema.bases:write permission)');
  }
  
  if (results.writeRecords) {
    console.log('  ✅ Add sample data');
    console.log('  ✅ Create/update/delete records');
  }
  
  console.log('\n⚠️  WHAT REQUIRES MANUAL AIRTABLE UI:');
  console.log('  - Auto Number fields (Caller ID, Call ID, Follow-up ID)');
  console.log('  - Last Modified Time fields');
  console.log('  - Views (filtered/grouped views)');
  console.log('  - Automations (triggers and actions)');
  
  return results;
}

checkPermissions().catch(console.error);
