/**
 * Get Actual Schema - See exact field options in Airtable
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

async function getSchema() {
  const response = await axios.get(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    { headers: { 'Authorization': `Bearer ${apiKey}` }}
  );
  
  console.log('📋 AIRTABLE SCHEMA - Field Details\n');
  
  for (const table of response.data.tables) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📁 TABLE: ${table.name}`);
    console.log('='.repeat(60));
    
    for (const field of table.fields) {
      console.log(`\n  📌 ${field.name} (${field.type})`);
      
      if (field.options?.choices) {
        console.log('     Options:');
        field.options.choices.forEach(c => {
          console.log(`       - "${c.name}"`);
        });
      }
      
      if (field.options?.linkedTableId) {
        const linkedTable = response.data.tables.find(t => t.id === field.options.linkedTableId);
        console.log(`     Links to: ${linkedTable?.name || field.options.linkedTableId}`);
      }
    }
  }
}

getSchema().catch(console.error);
