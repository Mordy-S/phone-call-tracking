const { base, tables, fields } = require('../config/airtable');

const F = fields.callers;

/**
 * Service for managing Callers in Airtable
 * Tracks caller information, preferences, and relationships with mentors
 */
class CallerService {
  /**
   * Get all callers with optional filtering
   * @param {Object} options - Query options
   */
  async getAllCallers(options = {}) {
    try {
      const queryOptions = {
        maxRecords: options.maxRecords || 100,
        view: options.view || 'Grid view',
        filterByFormula: options.filterByFormula
      };
      
      // Only add sort if explicitly provided (Caller ID might not exist)
      if (options.sort) {
        queryOptions.sort = options.sort;
      }
      
      const query = base(tables.callers).select(queryOptions);

      const records = [];
      await query.eachPage((pageRecords, fetchNextPage) => {
        records.push(...pageRecords.map(r => ({ id: r.id, ...r.fields })));
        fetchNextPage();
      });

      return records;
    } catch (error) {
      throw new Error(`Failed to fetch callers: ${error.message}`);
    }
  }

  /**
   * Get a single caller by ID
   */
  async getCallerById(recordId) {
    try {
      const record = await base(tables.callers).find(recordId);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to fetch caller ${recordId}: ${error.message}`);
    }
  }

  /**
   * Find caller by phone number
   * @param {string} phone - Phone number to search
   */
  async findByPhone(phone) {
    // Normalize phone number for search (remove common formatting)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    const callers = await this.getAllCallers({
      filterByFormula: `OR(
        {${F.PHONE}} = '${phone}',
        {${F.PHONE}} = '${normalizedPhone}'
      )`
    });
    return callers[0] || null;
  }

  /**
   * Get active callers
   */
  async getActiveCallers() {
    return this.getAllCallers({
      filterByFormula: `{${F.STATUS}} = 'Active'`
    });
  }

  /**
   * Get new callers that need assignment
   */
  async getUnassignedCallers() {
    return this.getAllCallers({
      filterByFormula: `AND({${F.STATUS}} = 'New', {${F.ASSIGNED_MENTOR}} = BLANK())`
    });
  }

  /**
   * Get callers by assigned mentor
   * @param {string} mentorRecordId - Mentor's Airtable record ID
   */
  async getCallersByMentor(mentorRecordId) {
    return this.getAllCallers({
      filterByFormula: `FIND('${mentorRecordId}', ARRAYJOIN({${F.ASSIGNED_MENTOR}}, ',')) > 0`
    });
  }

  /**
   * Get callers by status
   * @param {string} status - Caller status (New, Active, Stable, Closed, Referred Out)
   */
  async getCallersByStatus(status) {
    return this.getAllCallers({
      filterByFormula: `{${F.STATUS}} = '${status}'`
    });
  }

  /**
   * Get callers by primary issue
   * @param {string} issue - Primary issue category
   */
  async getCallersByIssue(issue) {
    return this.getAllCallers({
      filterByFormula: `{${F.PRIMARY_ISSUE}} = '${issue}'`
    });
  }

  /**
   * Create a new caller
   * @param {Object} callerData - Caller data
   */
  async createCaller(callerData) {
    try {
      const fieldsToCreate = {
        [F.PHONE]: callerData.phone,
        [F.STATUS]: callerData.status || 'New',
        [F.FIRST_CONTACT]: callerData.firstContact || new Date().toISOString().split('T')[0]
      };

      // Optional fields
      if (callerData.name) fieldsToCreate[F.NAME] = callerData.name;
      if (callerData.phoneType) fieldsToCreate[F.PHONE_TYPE] = callerData.phoneType;
      if (callerData.contactPreference) fieldsToCreate[F.CONTACT_PREFERENCE] = callerData.contactPreference;
      if (callerData.bestTimes) fieldsToCreate[F.BEST_TIMES] = callerData.bestTimes;
      if (callerData.primaryIssue) fieldsToCreate[F.PRIMARY_ISSUE] = callerData.primaryIssue;
      if (callerData.assignedMentor) fieldsToCreate[F.ASSIGNED_MENTOR] = [callerData.assignedMentor];
      if (callerData.backgroundNotes) fieldsToCreate[F.BACKGROUND_NOTES] = callerData.backgroundNotes;

      const record = await base(tables.callers).create(fieldsToCreate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to create caller: ${error.message}`);
    }
  }

  /**
   * Create or find caller by phone number
   * If caller exists, return existing record; otherwise create new
   * @param {Object} callerData - Caller data (must include phone)
   */
  async findOrCreateByPhone(callerData) {
    const existing = await this.findByPhone(callerData.phone);
    if (existing) {
      return { caller: existing, isNew: false };
    }
    const newCaller = await this.createCaller(callerData);
    return { caller: newCaller, isNew: true };
  }

  /**
   * Update a caller
   * @param {string} recordId - Record ID
   * @param {Object} updateData - Fields to update
   */
  async updateCaller(recordId, updateData) {
    try {
      const fieldsToUpdate = {};

      if (updateData.name !== undefined) fieldsToUpdate[F.NAME] = updateData.name;
      if (updateData.phone !== undefined) fieldsToUpdate[F.PHONE] = updateData.phone;
      if (updateData.phoneType !== undefined) fieldsToUpdate[F.PHONE_TYPE] = updateData.phoneType;
      if (updateData.contactPreference !== undefined) fieldsToUpdate[F.CONTACT_PREFERENCE] = updateData.contactPreference;
      if (updateData.bestTimes !== undefined) fieldsToUpdate[F.BEST_TIMES] = updateData.bestTimes;
      if (updateData.primaryIssue !== undefined) fieldsToUpdate[F.PRIMARY_ISSUE] = updateData.primaryIssue;
      if (updateData.assignedMentor !== undefined) {
        fieldsToUpdate[F.ASSIGNED_MENTOR] = updateData.assignedMentor ? [updateData.assignedMentor] : [];
      }
      if (updateData.status !== undefined) fieldsToUpdate[F.STATUS] = updateData.status;
      if (updateData.backgroundNotes !== undefined) fieldsToUpdate[F.BACKGROUND_NOTES] = updateData.backgroundNotes;

      const record = await base(tables.callers).update(recordId, fieldsToUpdate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to update caller ${recordId}: ${error.message}`);
    }
  }

  /**
   * Assign a mentor to a caller
   * @param {string} callerRecordId - Caller record ID
   * @param {string} mentorRecordId - Mentor record ID
   */
  async assignMentor(callerRecordId, mentorRecordId) {
    return this.updateCaller(callerRecordId, {
      assignedMentor: mentorRecordId,
      status: 'Active' // Move from New to Active when mentor is assigned
    });
  }

  /**
   * Update caller status
   * @param {string} recordId - Caller record ID
   * @param {string} status - New status
   */
  async updateStatus(recordId, status) {
    return this.updateCaller(recordId, { status });
  }

  /**
   * Close a caller case
   * @param {string} recordId - Caller record ID
   */
  async closeCaller(recordId) {
    return this.updateStatus(recordId, 'Closed');
  }

  /**
   * Mark caller as referred out
   * @param {string} recordId - Caller record ID
   */
  async referOut(recordId) {
    return this.updateStatus(recordId, 'Referred Out');
  }
}

module.exports = new CallerService();
