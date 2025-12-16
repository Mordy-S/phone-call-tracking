const { base, tables, fields } = require('../config/airtable');

const F = fields.calls;

/**
 * Service for managing Calls in Airtable
 * Tracks all call records with details, outcomes, and follow-up needs
 */
class CallService {
  /**
   * Get all calls with optional filtering
   * @param {Object} options - Query options
   */
  async getAllCalls(options = {}) {
    try {
      const selectOptions = {
        maxRecords: options.maxRecords || 100,
        view: options.view || 'Grid view',
        sort: options.sort || [{ field: F.DATE_TIME, direction: 'desc' }]
      };
      
      // Only add filterByFormula if it's provided
      if (options.filterByFormula) {
        selectOptions.filterByFormula = options.filterByFormula;
      }
      
      const query = base(tables.calls).select(selectOptions);

      const records = [];
      await query.eachPage((pageRecords, fetchNextPage) => {
        records.push(...pageRecords.map(r => ({ id: r.id, ...r.fields })));
        fetchNextPage();
      });

      return records;
    } catch (error) {
      throw new Error(`Failed to fetch calls: ${error.message}`);
    }
  }

  /**
   * Get a single call by ID
   */
  async getCallById(recordId) {
    try {
      const record = await base(tables.calls).find(recordId);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to fetch call ${recordId}: ${error.message}`);
    }
  }

  /**
   * Get today's calls
   */
  async getTodaysCalls() {
    return this.getAllCalls({
      filterByFormula: `IS_SAME({${F.DATE_TIME}}, TODAY(), 'day')`,
      sort: [{ field: F.DATE_TIME, direction: 'desc' }]
    });
  }

  /**
   * Get calls from this week
   */
  async getThisWeeksCalls() {
    return this.getAllCalls({
      filterByFormula: `DATETIME_DIFF(TODAY(), {${F.DATE_TIME}}, 'days') <= 7`,
      sort: [{ field: F.DATE_TIME, direction: 'desc' }]
    });
  }

  /**
   * Get calls that need follow-up (callback scheduled but no follow-up created)
   */
  async getCallsNeedingFollowup() {
    return this.getAllCalls({
      filterByFormula: `AND(
        {${F.OUTCOME}} = 'Callback Scheduled',
        {${F.FOLLOWUP_CREATED}} = FALSE()
      )`
    });
  }

  /**
   * Get calls by team member (who received the call)
   * @param {string} teamMemberRecordId - Team member record ID
   */
  async getCallsByTeamMember(teamMemberRecordId) {
    return this.getAllCalls({
      filterByFormula: `FIND('${teamMemberRecordId}', ARRAYJOIN({${F.RECEIVED_BY}}, ',')) > 0`
    });
  }

  /**
   * Get calls by caller
   * @param {string} callerRecordId - Caller record ID
   */
  async getCallsByCaller(callerRecordId) {
    return this.getAllCalls({
      filterByFormula: `FIND('${callerRecordId}', ARRAYJOIN({${F.CALLER}}, ',')) > 0`
    });
  }

  /**
   * Get missed calls
   */
  async getMissedCalls() {
    return this.getAllCalls({
      filterByFormula: `{${F.DIRECTION}} = 'Missed'`,
      sort: [{ field: F.DATE_TIME, direction: 'desc' }]
    });
  }

  /**
   * Get crisis calls (urgent attention needed)
   */
  async getCrisisCalls() {
    return this.getAllCalls({
      filterByFormula: `OR({${F.CALL_TYPE}} = 'Crisis', {${F.URGENCY}} = 'Crisis (immediate)')`,
      sort: [{ field: F.DATE_TIME, direction: 'desc' }]
    });
  }

  /**
   * Get urgent calls (urgent or crisis needing immediate attention)
   * Used by automations to alert for urgent calls
   */
  async getUrgentCalls() {
    return this.getAllCalls({
      filterByFormula: `OR(
        {${F.URGENCY}} = 'Crisis (immediate)',
        {${F.URGENCY}} = 'Urgent (same day)',
        {${F.CALL_TYPE}} = 'Crisis'
      )`,
      sort: [{ field: F.DATE_TIME, direction: 'desc' }]
    });
  }

  /**
   * Get calls by direction (Inbound, Outbound, Missed)
   * @param {string} direction - Call direction
   */
  async getCallsByDirection(direction) {
    return this.getAllCalls({
      filterByFormula: `{${F.DIRECTION}} = '${direction}'`
    });
  }

  /**
   * Get calls by type
   * @param {string} callType - Call type (New Caller, Follow-up, Crisis, Check-in, Voicemail)
   */
  async getCallsByType(callType) {
    return this.getAllCalls({
      filterByFormula: `{${F.CALL_TYPE}} = '${callType}'`
    });
  }

  /**
   * Create a new call record
   * @param {Object} callData - Call data
   */
  async createCall(callData) {
    try {
      const fieldsToCreate = {
        [F.DATE_TIME]: callData.dateTime || new Date().toISOString(),
        [F.DIRECTION]: callData.direction || 'Inbound'
      };

      // Link fields (Airtable requires array format)
      if (callData.caller) fieldsToCreate[F.CALLER] = [callData.caller];
      if (callData.receivedBy) fieldsToCreate[F.RECEIVED_BY] = [callData.receivedBy];
      if (callData.mentorForFollowup) fieldsToCreate[F.MENTOR_FOR_FOLLOWUP] = [callData.mentorForFollowup];

      // Optional fields
      if (callData.callType) fieldsToCreate[F.CALL_TYPE] = callData.callType;
      if (callData.duration !== undefined) fieldsToCreate[F.DURATION] = callData.duration;
      if (callData.issueCategory) fieldsToCreate[F.ISSUE_CATEGORY] = callData.issueCategory;
      if (callData.summary) fieldsToCreate[F.SUMMARY] = callData.summary;
      if (callData.outcome) fieldsToCreate[F.OUTCOME] = callData.outcome;
      if (callData.urgency) fieldsToCreate[F.URGENCY] = callData.urgency;
      if (callData.telebroadCallId) {
        fieldsToCreate[F.TB_CALL_ID] = callData.telebroadCallId;
        // Keep old field for backwards compatibility but it may not work with phoneNumber type
      }
      if (callData.telebroadUniqueId) fieldsToCreate[F.TELEBROAD_UNIQUE_ID] = callData.telebroadUniqueId;
      if (callData.recordingUrl) fieldsToCreate[F.RECORDING_URL] = callData.recordingUrl;
      if (callData.ringStatus) fieldsToCreate[F.RING_STATUS] = callData.ringStatus;
      if (callData.followupCreated !== undefined) fieldsToCreate[F.FOLLOWUP_CREATED] = callData.followupCreated;

      // New Telebroad-specific fields
      if (callData.callerNumber) fieldsToCreate[F.CALLER_NUMBER] = callData.callerNumber;
      if (callData.calledNumber) fieldsToCreate[F.CALLED_NUMBER] = callData.calledNumber;
      if (callData.ivrPath) fieldsToCreate[F.IVR_PATH] = callData.ivrPath;
      if (callData.huntGroup) fieldsToCreate[F.HUNT_GROUP] = callData.huntGroup;
      if (callData.pickedUpByName) fieldsToCreate[F.PICKED_UP_BY_NAME] = callData.pickedUpByName;
      if (callData.pickedUpByExtension) fieldsToCreate[F.PICKED_UP_BY_EXTENSION] = callData.pickedUpByExtension;
      if (callData.finalStatus) fieldsToCreate[F.FINAL_STATUS] = callData.finalStatus;
      if (callData.callStartTime) fieldsToCreate[F.CALL_START_TIME] = callData.callStartTime;
      if (callData.answerTime) fieldsToCreate[F.ANSWER_TIME] = callData.answerTime;
      if (callData.endTime) fieldsToCreate[F.END_TIME] = callData.endTime;
      if (callData.callerName) fieldsToCreate[F.CALLER_NAME] = callData.callerName;
      if (callData.webhookEvents !== undefined) fieldsToCreate[F.WEBHOOK_EVENTS] = callData.webhookEvents;
      if (callData.rawWebhookData) fieldsToCreate[F.RAW_WEBHOOK_DATA] = callData.rawWebhookData;

      const record = await base(tables.calls).create(fieldsToCreate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to create call: ${error.message}`);
    }
  }

  /**
   * Create a call from Telebroad/Zapier webhook
   * This is the auto-log function for incoming webhook data
   * @param {Object} telebroadData - Data from Telebroad via Zapier
   */
  async createFromWebhook(telebroadData) {
    const callData = {
      dateTime: telebroadData.timestamp || telebroadData.callTime || new Date().toISOString(),
      direction: telebroadData.duration === 0 || telebroadData.missed ? 'Missed' : 
                 (telebroadData.direction || 'Inbound'),
      duration: telebroadData.duration || 0,
      telebroadCallId: telebroadData.callId || telebroadData.uniqueId,
      // Note: receivedBy needs to be looked up by extension number
    };

    // If we have extension info, we can look it up later
    if (telebroadData.extension) {
      callData._extension = telebroadData.extension;
    }

    // If we have caller phone number, we can look it up later
    if (telebroadData.callerNumber || telebroadData.phoneNumber) {
      callData._callerPhone = telebroadData.callerNumber || telebroadData.phoneNumber;
    }

    return this.createCall(callData);
  }

  /**
   * Update a call
   * @param {string} recordId - Record ID
   * @param {Object} updateData - Fields to update
   */
  async updateCall(recordId, updateData) {
    try {
      const fieldsToUpdate = {};

      if (updateData.dateTime !== undefined) fieldsToUpdate[F.DATE_TIME] = updateData.dateTime;
      if (updateData.caller !== undefined) fieldsToUpdate[F.CALLER] = updateData.caller ? [updateData.caller] : [];
      if (updateData.receivedBy !== undefined) fieldsToUpdate[F.RECEIVED_BY] = updateData.receivedBy ? [updateData.receivedBy] : [];
      if (updateData.direction !== undefined) fieldsToUpdate[F.DIRECTION] = updateData.direction;
      if (updateData.callType !== undefined) fieldsToUpdate[F.CALL_TYPE] = updateData.callType;
      if (updateData.duration !== undefined) fieldsToUpdate[F.DURATION] = updateData.duration;
      if (updateData.issueCategory !== undefined) fieldsToUpdate[F.ISSUE_CATEGORY] = updateData.issueCategory;
      if (updateData.summary !== undefined) fieldsToUpdate[F.SUMMARY] = updateData.summary;
      if (updateData.outcome !== undefined) fieldsToUpdate[F.OUTCOME] = updateData.outcome;
      if (updateData.mentorForFollowup !== undefined) {
        fieldsToUpdate[F.MENTOR_FOR_FOLLOWUP] = updateData.mentorForFollowup ? [updateData.mentorForFollowup] : [];
      }
      if (updateData.urgency !== undefined) fieldsToUpdate[F.URGENCY] = updateData.urgency;
      if (updateData.followupCreated !== undefined) fieldsToUpdate[F.FOLLOWUP_CREATED] = updateData.followupCreated;
      if (updateData.telebroadCallId !== undefined) fieldsToUpdate[F.TELEBROAD_CALL_ID] = updateData.telebroadCallId;

      // New Telebroad-specific fields
      if (updateData.callerNumber !== undefined) fieldsToUpdate[F.CALLER_NUMBER] = updateData.callerNumber;
      if (updateData.calledNumber !== undefined) fieldsToUpdate[F.CALLED_NUMBER] = updateData.calledNumber;
      if (updateData.ivrPath !== undefined) fieldsToUpdate[F.IVR_PATH] = updateData.ivrPath;
      if (updateData.huntGroup !== undefined) fieldsToUpdate[F.HUNT_GROUP] = updateData.huntGroup;
      if (updateData.pickedUpByName !== undefined) fieldsToUpdate[F.PICKED_UP_BY_NAME] = updateData.pickedUpByName;
      if (updateData.pickedUpByExtension !== undefined) fieldsToUpdate[F.PICKED_UP_BY_EXTENSION] = updateData.pickedUpByExtension;
      if (updateData.finalStatus !== undefined) fieldsToUpdate[F.FINAL_STATUS] = updateData.finalStatus;
      if (updateData.callStartTime !== undefined) fieldsToUpdate[F.CALL_START_TIME] = updateData.callStartTime;
      if (updateData.answerTime !== undefined) fieldsToUpdate[F.ANSWER_TIME] = updateData.answerTime;
      if (updateData.endTime !== undefined) fieldsToUpdate[F.END_TIME] = updateData.endTime;
      if (updateData.callerName !== undefined) fieldsToUpdate[F.CALLER_NAME] = updateData.callerName;
      if (updateData.webhookEvents !== undefined) fieldsToUpdate[F.WEBHOOK_EVENTS] = updateData.webhookEvents;
      if (updateData.rawWebhookData !== undefined) fieldsToUpdate[F.RAW_WEBHOOK_DATA] = updateData.rawWebhookData;

      const record = await base(tables.calls).update(recordId, fieldsToUpdate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to update call ${recordId}: ${error.message}`);
    }
  }

  /**
   * Mark follow-up as created for a call
   * @param {string} recordId - Call record ID
   */
  async markFollowupCreated(recordId) {
    return this.updateCall(recordId, { followupCreated: true });
  }

  /**
   * Link a caller to a call
   * @param {string} callRecordId - Call record ID
   * @param {string} callerRecordId - Caller record ID
   */
  async linkCaller(callRecordId, callerRecordId) {
    return this.updateCall(callRecordId, { caller: callerRecordId });
  }

  /**
   * Complete call details after auto-logging
   * Used by intaker/mentor to fill in details after the call
   * @param {string} recordId - Call record ID
   * @param {Object} details - Call details
   */
  async completeCallDetails(recordId, details) {
    return this.updateCall(recordId, {
      caller: details.caller,
      callType: details.callType,
      issueCategory: details.issueCategory,
      summary: details.summary,
      outcome: details.outcome,
      mentorForFollowup: details.mentorForFollowup,
      urgency: details.urgency
    });
  }

  /**
   * Find call by Telebroad Call ID
   * @param {string} telebroadCallId - Telebroad's unique call ID
   */
  async findByTelebroadId(telebroadCallId) {
    const calls = await this.getAllCalls({
      filterByFormula: `{${F.TB_CALL_ID}} = '${telebroadCallId}'`
    });
    return calls[0] || null;
  }

  /**
   * Find call by Telebroad Call ID (alias for compatibility)
   * @param {string} telebroadCallId - Telebroad's unique call ID
   */
  async findByTelebroadCallId(telebroadCallId) {
    return this.findByTelebroadId(telebroadCallId);
  }

  /**
   * Delete a call record
   * @param {string} recordId - Record ID
   */
  async deleteCall(recordId) {
    try {
      await base(tables.calls).destroy(recordId);
      return { success: true, id: recordId };
    } catch (error) {
      throw new Error(`Failed to delete call ${recordId}: ${error.message}`);
    }
  }
}

module.exports = new CallService();
