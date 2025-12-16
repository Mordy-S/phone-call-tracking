/**
 * Create TB Call ID field for storing Telebroad call IDs
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

async function createTBCallIDField() {
  console.log('🔧 Creating TB Call ID field...\n');
  
  const tables = (await axios.get(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    { headers: { 'Authorization': `Bearer ${apiKey}` }}
  )).data.tables;
  
  const callsTable = tables.find(t => t.name === 'Calls');
  
  // Check if TB Call ID already exists
  const existing = callsTable.fields.find(f => f.name === 'TB Call ID');
  if (existing) {
    console.log('✅ TB Call ID field already exists');
    return;
  }
  
  console.log('Creating new field...');
  await axios.post(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${callsTable.id}/fields`,
    {
      name: 'TB Call ID',
      type: 'singleLineText',
      description: 'Telebroad master call ID (use this for lookups)'
    },
    { headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }}
  );
  console.log('✅ Created TB Call ID field');
}

createTBCallIDField().catch(e => console.error(e.response?.data || e.message));
