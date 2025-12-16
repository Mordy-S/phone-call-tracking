const { base, tables, fields } = require('../config/airtable');

const F = fields.followups;

/**
 * Service for managing Follow-ups in Airtable
 * Tracks callbacks, check-ins, scheduled sessions, and internal tasks
 */
class FollowupService {
  /**
   * Get all follow-ups with optional filtering
   * @param {Object} options - Query options
   */
  async getAllFollowups(options = {}) {
    try {
      const query = base(tables.followups).select({
        maxRecords: options.maxRecords || 100,
        view: options.view || 'Grid view',
        filterByFormula: options.filterByFormula,
        sort: options.sort || [{ field: F.DUE_DATE_TIME, direction: 'asc' }]
      });

      const records = [];
      await query.eachPage((pageRecords, fetchNextPage) => {
        records.push(...pageRecords.map(r => ({ id: r.id, ...r.fields })));
        fetchNextPage();
      });

      return records;
    } catch (error) {
      throw new Error(`Failed to fetch follow-ups: ${error.message}`);
    }
  }

  /**
   * Get a single follow-up by ID
   */
  async getFollowupById(recordId) {
    try {
      const record = await base(tables.followups).find(recordId);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to fetch follow-up ${recordId}: ${error.message}`);
    }
  }

  /**
   * Get follow-ups due today
   */
  async getDueToday() {
    return this.getAllFollowups({
      filterByFormula: `AND(
        IS_SAME({${F.DUE_DATE_TIME}}, TODAY(), 'day'),
        {${F.STATUS}} = 'Pending'
      )`,
      sort: [{ field: F.DUE_DATE_TIME, direction: 'asc' }]
    });
  }

  /**
   * Get overdue follow-ups
   */
  async getOverdue() {
    return this.getAllFollowups({
      filterByFormula: `AND(
        IS_BEFORE({${F.DUE_DATE_TIME}}, TODAY()),
        {${F.STATUS}} = 'Pending'
      )`,
      sort: [{ field: F.DUE_DATE_TIME, direction: 'asc' }]
    });
  }

  /**
   * Get pending follow-ups (not completed)
   */
  async getPending() {
    return this.getAllFollowups({
      filterByFormula: `{${F.STATUS}} = 'Pending'`,
      sort: [{ field: F.DUE_DATE_TIME, direction: 'asc' }]
    });
  }

  /**
   * Get urgent follow-ups
   */
  async getUrgent() {
    return this.getAllFollowups({
      filterByFormula: `AND({${F.PRIORITY}} = 'Urgent', {${F.STATUS}} = 'Pending')`
    });
  }

  /**
   * Get follow-ups by assigned team member
   * @param {string} teamMemberRecordId - Team member record ID
   */
  async getByAssignee(teamMemberRecordId) {
    return this.getAllFollowups({
      filterByFormula: `AND(
        FIND('${teamMemberRecordId}', ARRAYJOIN({${F.ASSIGNED_TO}}, ',')) > 0,
        {${F.STATUS}} = 'Pending'
      )`
    });
  }

  /**
   * Get follow-ups for a specific caller
   * @param {string} callerRecordId - Caller record ID
   */
  async getByCaller(callerRecordId) {
    return this.getAllFollowups({
      filterByFormula: `FIND('${callerRecordId}', ARRAYJOIN({${F.CALLER}}, ',')) > 0`
    });
  }

  /**
   * Get follow-ups completed this week
   */
  async getCompletedThisWeek() {
    return this.getAllFollowups({
      filterByFormula: `AND(
        {${F.STATUS}} = 'Completed',
        DATETIME_DIFF(TODAY(), {${F.COMPLETED_DATE}}, 'days') <= 7
      )`
    });
  }

  /**
   * Create a new follow-up
   * @param {Object} followupData - Follow-up data
   */
  async createFollowup(followupData) {
    try {
      const fieldsToCreate = {
        [F.STATUS]: followupData.status || 'Pending',
        [F.TYPE]: followupData.type || 'Callback',
        [F.PRIORITY]: followupData.priority || 'Normal'
      };

      // Link fields (Airtable requires array format)
      if (followupData.relatedCall) fieldsToCreate[F.RELATED_CALL] = [followupData.relatedCall];
      if (followupData.caller) fieldsToCreate[F.CALLER] = [followupData.caller];
      if (followupData.assignedTo) fieldsToCreate[F.ASSIGNED_TO] = [followupData.assignedTo];

      // Other fields
      if (followupData.dueDateTime) fieldsToCreate[F.DUE_DATE_TIME] = followupData.dueDateTime;
      if (followupData.notes) fieldsToCreate[F.NOTES] = followupData.notes;
      if (followupData.completedDate) fieldsToCreate[F.COMPLETED_DATE] = followupData.completedDate;
      if (followupData.outcomeNotes) fieldsToCreate[F.OUTCOME_NOTES] = followupData.outcomeNotes;

      const record = await base(tables.followups).create(fieldsToCreate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to create follow-up: ${error.message}`);
    }
  }

  /**
   * Create a follow-up from a call (automation trigger)
   * This mimics the Airtable automation: auto-create follow-up when call outcome is "Callback Scheduled"
   * @param {Object} callRecord - The call record that triggered this
   */
  async createFromCall(callRecord) {
    // Handle "Mentor for Follow-up" - could be text or link field
    let assignedTo = null;
    const mentorField = callRecord['Mentor for Follow-up'];
    if (mentorField) {
      // If it's an array (link field), use first ID
      if (Array.isArray(mentorField) && mentorField[0]?.startsWith('rec')) {
        assignedTo = mentorField[0];
      }
      // If it's a string that looks like a record ID, use it
      else if (typeof mentorField === 'string' && mentorField.startsWith('rec')) {
        assignedTo = mentorField;
      }
      // Otherwise it's probably a text name - skip linking for now
      // (user can manually assign in Airtable)
    }

    // Handle "Caller" field - should be link field
    let caller = null;
    const callerField = callRecord['Caller'];
    if (callerField) {
      if (Array.isArray(callerField) && callerField[0]?.startsWith('rec')) {
        caller = callerField[0];
      } else if (typeof callerField === 'string' && callerField.startsWith('rec')) {
        caller = callerField;
      }
    }

    const followupData = {
      relatedCall: callRecord.id,
      caller: caller,
      assignedTo: assignedTo,
      type: 'Callback',
      status: 'Pending',
      notes: `Follow-up for call on ${callRecord['Date/Time'] || 'unknown date'}`
    };

    // Set priority based on urgency
    if (callRecord['Urgency'] === 'Crisis (immediate)') {
      followupData.priority = 'Urgent';
    } else if (callRecord['Urgency'] === 'Urgent (same day)') {
      followupData.priority = 'High';
    } else {
      followupData.priority = 'Normal';
    }

    return this.createFollowup(followupData);
  }

  /**
   * Update a follow-up
   * @param {string} recordId - Record ID
   * @param {Object} updateData - Fields to update
   */
  async updateFollowup(recordId, updateData) {
    try {
      const fieldsToUpdate = {};

      // Link fields
      if (updateData.relatedCall !== undefined) {
        fieldsToUpdate[F.RELATED_CALL] = updateData.relatedCall ? [updateData.relatedCall] : [];
      }
      if (updateData.caller !== undefined) {
        fieldsToUpdate[F.CALLER] = updateData.caller ? [updateData.caller] : [];
      }
      if (updateData.assignedTo !== undefined) {
        fieldsToUpdate[F.ASSIGNED_TO] = updateData.assignedTo ? [updateData.assignedTo] : [];
      }

      // Other fields
      if (updateData.type !== undefined) fieldsToUpdate[F.TYPE] = updateData.type;
      if (updateData.dueDateTime !== undefined) fieldsToUpdate[F.DUE_DATE_TIME] = updateData.dueDateTime;
      if (updateData.status !== undefined) fieldsToUpdate[F.STATUS] = updateData.status;
      if (updateData.priority !== undefined) fieldsToUpdate[F.PRIORITY] = updateData.priority;
      if (updateData.notes !== undefined) fieldsToUpdate[F.NOTES] = updateData.notes;
      if (updateData.completedDate !== undefined) fieldsToUpdate[F.COMPLETED_DATE] = updateData.completedDate;
      if (updateData.outcomeNotes !== undefined) fieldsToUpdate[F.OUTCOME_NOTES] = updateData.outcomeNotes;

      const record = await base(tables.followups).update(recordId, fieldsToUpdate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to update follow-up ${recordId}: ${error.message}`);
    }
  }

  /**
   * Mark follow-up as completed
   * @param {string} recordId - Follow-up record ID
   * @param {string} outcomeNotes - Notes about what happened
   */
  async complete(recordId, outcomeNotes = '') {
    return this.updateFollowup(recordId, {
      status: 'Completed',
      completedDate: new Date().toISOString().split('T')[0],
      outcomeNotes
    });
  }

  /**
   * Reschedule a follow-up
   * @param {string} recordId - Follow-up record ID
   * @param {string} newDueDateTime - New due date/time
   * @param {string} notes - Optional notes about rescheduling
   */
  async reschedule(recordId, newDueDateTime, notes = '') {
    const currentFollowup = await this.getFollowupById(recordId);
    const updatedNotes = currentFollowup[F.NOTES] 
      ? `${currentFollowup[F.NOTES]}\n\nRescheduled: ${notes}`
      : `Rescheduled: ${notes}`;

    return this.updateFollowup(recordId, {
      status: 'Rescheduled',
      dueDateTime: newDueDateTime,
      notes: updatedNotes
    });
  }

  /**
   * Mark as no answer (attempted but couldn't reach)
   * @param {string} recordId - Follow-up record ID
   * @param {string} notes - Notes about the attempt
   */
  async markNoAnswer(recordId, notes = '') {
    return this.updateFollowup(recordId, {
      status: 'No Answer',
      outcomeNotes: notes
    });
  }

  /**
   * Cancel a follow-up
   * @param {string} recordId - Follow-up record ID
   * @param {string} reason - Reason for cancellation
   */
  async cancel(recordId, reason = '') {
    return this.updateFollowup(recordId, {
      status: 'Cancelled',
      outcomeNotes: reason
    });
  }

  /**
   * Reassign a follow-up to a different team member
   * @param {string} recordId - Follow-up record ID
   * @param {string} newAssigneeId - New team member record ID
   */
  async reassign(recordId, newAssigneeId) {
    return this.updateFollowup(recordId, {
      assignedTo: newAssigneeId
    });
  }

  /**
   * Get daily digest data (for automation email)
   * Returns counts and lists for reporting
   */
  async getDailyDigest() {
    const [dueToday, overdue, urgent] = await Promise.all([
      this.getDueToday(),
      this.getOverdue(),
      this.getUrgent()
    ]);

    return {
      dueToday: dueToday.length,
      dueTodayList: dueToday,
      overdue: overdue.length,
      overdueList: overdue,
      urgent: urgent.length,
      urgentList: urgent,
      total: dueToday.length + overdue.length
    };
  }

  /**
   * Delete a follow-up record
   * @param {string} recordId - Record ID
   */
  async deleteFollowup(recordId) {
    try {
      await base(tables.followups).destroy(recordId);
      return { success: true, id: recordId };
    } catch (error) {
      throw new Error(`Failed to delete follow-up ${recordId}: ${error.message}`);
    }
  }
}

module.exports = new FollowupService();
