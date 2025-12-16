/**
 * Fix Telebroad Call ID field type from phoneNumber to singleLineText
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

async function getTablesInfo() {
  const response = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    { headers: { 'Authorization': `Bearer ${apiKey}` }}
  );
  return response.data.tables;
}

async function updateField(tableId, fieldId, newConfig) {
  try {
    const response = await axios.patch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
      newConfig,
      { headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }}
    );
    console.log(`  ✅ Updated field`);
    return response.data;
  } catch (error) {
    console.error(`  ❌ Error:`, error.response?.data || error.message);
    return null;
  }
}

async function fixTelebroadField() {
  console.log('🔧 Fixing Telebroad Call ID field type...\n');
  
  const tables = await getTablesInfo();
  const callsTable = tables.find(t => t.name === 'Calls');
  
  if (!callsTable) {
    console.error('❌ Calls table not found!');
    return;
  }
  
  const telebroadField = callsTable.fields.find(f => f.name === 'Telebroad Call ID');
  
  if (!telebroadField) {
    console.error('❌ Telebroad Call ID field not found!');
    return;
  }
  
  console.log(`Found field: ${telebroadField.name}`);
  console.log(`Current type: ${telebroadField.type}`);
  console.log(`Field ID: ${telebroadField.id}\n`);
  
  if (telebroadField.type === 'phoneNumber') {
    console.log('Converting to singleLineText...\n');
    await updateField(callsTable.id, telebroadField.id, {
      type: 'singleLineText',
      description: 'Telebroad unique call ID (master callId from webhook)'
    });
  } else {
    console.log('✅ Field type is already correct!');
  }
}

fixTelebroadField().catch(console.error);
