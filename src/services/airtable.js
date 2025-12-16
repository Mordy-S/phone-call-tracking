const { base, tables } = require('../config/airtable');

/**
 * Service for managing Call records in Airtable
 */
class CallService {
  /**
   * Get all calls with optional filtering and sorting
   * @param {Object} options - Query options
   * @param {number} options.maxRecords - Maximum number of records to return
   * @param {string} options.view - View name in Airtable
   * @param {Array} options.sort - Sort configuration [{field: 'Date/Time', direction: 'desc'}]
   * @param {string} options.filterByFormula - Airtable formula for filtering
   */
  async getAllCalls(options = {}) {
    try {
      const query = base(tables.calls).select({
        maxRecords: options.maxRecords || 100,
        view: options.view || 'Grid view',
        ...options
      });

      const records = await query.firstPage();
      return records.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Failed to fetch calls: ${error.message}`);
    }
  }

  /**
   * Get a single call by ID
   * @param {string} recordId - Airtable record ID
   */
  async getCallById(recordId) {
    try {
      const record = await base(tables.calls).find(recordId);
      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to fetch call ${recordId}: ${error.message}`);
    }
  }

  /**
   * Create a new call record
   * @param {Object} callData - Call data to create
   */
  async createCall(callData) {
    try {
      const record = await base(tables.calls).create({
        'Caller Number': callData.callerNumber,
        'Direction': callData.direction, // 'Inbound' or 'Outbound'
        'Duration': callData.duration, // in seconds
        'Date/Time': callData.dateTime || new Date().toISOString(),
        'Status': callData.status, // 'Completed', 'Missed', 'Voicemail'
        'Notes': callData.notes || '',
        'Recording URL': callData.recordingUrl || '',
        'Summary': callData.summary || ''
      });

      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to create call: ${error.message}`);
    }
  }

  /**
   * Update an existing call record
   * @param {string} recordId - Airtable record ID
   * @param {Object} updateData - Fields to update
   */
  async updateCall(recordId, updateData) {
    try {
      const fields = {};
      
      if (updateData.callerNumber) fields['Caller Number'] = updateData.callerNumber;
      if (updateData.direction) fields['Direction'] = updateData.direction;
      if (updateData.duration !== undefined) fields['Duration'] = updateData.duration;
      if (updateData.dateTime) fields['Date/Time'] = updateData.dateTime;
      if (updateData.status) fields['Status'] = updateData.status;
      if (updateData.notes !== undefined) fields['Notes'] = updateData.notes;
      if (updateData.recordingUrl !== undefined) fields['Recording URL'] = updateData.recordingUrl;
      if (updateData.summary !== undefined) fields['Summary'] = updateData.summary;

      const record = await base(tables.calls).update(recordId, fields);
      
      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to update call ${recordId}: ${error.message}`);
    }
  }

  /**
   * Delete a call record
   * @param {string} recordId - Airtable record ID
   */
  async deleteCall(recordId) {
    try {
      await base(tables.calls).destroy(recordId);
      return { success: true, id: recordId };
    } catch (error) {
      throw new Error(`Failed to delete call ${recordId}: ${error.message}`);
    }
  }

  /**
   * Get calls for today
   */
  async getTodaysCalls() {
    try {
      return await this.getAllCalls({
        filterByFormula: "IS_SAME({Date/Time}, TODAY(), 'day')",
        sort: [{ field: 'Date/Time', direction: 'desc' }]
      });
    } catch (error) {
      throw new Error(`Failed to fetch today's calls: ${error.message}`);
    }
  }

  /**
   * Get calls by phone number
   * @param {string} phoneNumber - Phone number to search
   */
  async getCallsByNumber(phoneNumber) {
    try {
      return await this.getAllCalls({
        filterByFormula: `{Caller Number} = '${phoneNumber}'`,
        sort: [{ field: 'Date/Time', direction: 'desc' }]
      });
    } catch (error) {
      throw new Error(`Failed to fetch calls for ${phoneNumber}: ${error.message}`);
    }
  }

  /**
   * Batch create multiple call records
   * @param {Array} callsArray - Array of call data objects
   */
  async batchCreateCalls(callsArray) {
    try {
      const records = callsArray.map(callData => ({
        fields: {
          'Caller Number': callData.callerNumber,
          'Direction': callData.direction,
          'Duration': callData.duration,
          'Date/Time': callData.dateTime || new Date().toISOString(),
          'Status': callData.status,
          'Notes': callData.notes || '',
          'Recording URL': callData.recordingUrl || '',
          'Summary': callData.summary || ''
        }
      }));

      // Airtable allows max 10 records per batch
      const batches = [];
      for (let i = 0; i < records.length; i += 10) {
        const batch = records.slice(i, i + 10);
        const created = await base(tables.calls).create(batch);
        batches.push(...created);
      }

      return batches.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Failed to batch create calls: ${error.message}`);
    }
  }
}

/**
 * Service for managing Contact records in Airtable
 */
class ContactService {
  /**
   * Get all contacts (callers)
   */
  async getAllContacts(options = {}) {
    try {
      const query = base(tables.callers).select({
        maxRecords: options.maxRecords || 100,
        view: options.view || 'Grid view',
        ...options
      });

      const records = await query.firstPage();
      return records.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }
  }

  /**
   * Get contact by ID
   */
  async getContactById(recordId) {
    try {
      const record = await base(tables.callers).find(recordId);
      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to fetch contact ${recordId}: ${error.message}`);
    }
  }

  /**
   * Create a new contact
   */
  async createContact(contactData) {
    try {
      const record = await base(tables.callers).create({
        'Name': contactData.name,
        'Phone': contactData.phone,
        'Email': contactData.email || '',
        'Company': contactData.company || ''
      });

      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }
  }

  /**
   * Update contact
   */
  async updateContact(recordId, updateData) {
    try {
      const fields = {};
      
      if (updateData.name) fields['Name'] = updateData.name;
      if (updateData.phone) fields['Phone'] = updateData.phone;
      if (updateData.email !== undefined) fields['Email'] = updateData.email;
      if (updateData.company !== undefined) fields['Company'] = updateData.company;

      const record = await base(tables.callers).update(recordId, fields);
      
      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to update contact ${recordId}: ${error.message}`);
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(recordId) {
    try {
      await base(tables.callers).destroy(recordId);
      return { success: true, id: recordId };
    } catch (error) {
      throw new Error(`Failed to delete contact ${recordId}: ${error.message}`);
    }
  }

  /**
   * Find contact by phone number
   */
  async findByPhone(phoneNumber) {
    try {
      const records = await this.getAllContacts({
        filterByFormula: `{Phone} = '${phoneNumber}'`,
        maxRecords: 1
      });
      
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      throw new Error(`Failed to find contact by phone: ${error.message}`);
    }
  }

  /**
   * Search contacts by name
   */
  async searchByName(searchTerm) {
    try {
      return await this.getAllContacts({
        filterByFormula: `SEARCH('${searchTerm}', {Name}) > 0`
      });
    } catch (error) {
      throw new Error(`Failed to search contacts: ${error.message}`);
    }
  }
}

// Export service instances
module.exports = {
  callService: new CallService(),
  contactService: new ContactService()
};
