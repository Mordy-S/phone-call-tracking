const { base, tables } = require('../config/airtable');

// Table name for webhook staging
const WEBHOOK_EVENTS_TABLE = process.env.AIRTABLE_WEBHOOK_EVENTS_TABLE || 'Webhook Events';

/**
 * Service for managing Webhook Events staging table
 * Captures all Telebroad webhook events before merging
 */
class WebhookEventService {
  /**
   * Create a new webhook event record
   * @param {Object} webhookData - Raw webhook data from Telebroad
   */
  async createEvent(webhookData) {
    try {
      const record = await base(WEBHOOK_EVENTS_TABLE).create({
        'Received At': new Date().toISOString(),
        'Call ID': webhookData.callId || '',
        'Unique ID': webhookData.UniqueId || '',
        'Status': webhookData.status || '',
        'Direction': webhookData.direction || '',
        'Send Type': webhookData.sendType || '',
        'Send Name': webhookData.sendName || '',
        'Send Number': webhookData.sendNumber || '',
        'Destination Type': webhookData.destinationType || '',
        'Destination Name': webhookData.destinationName || '',
        'Destination Number': webhookData.destinationNumber || '',
        'Called Type': webhookData.calledType || '',
        'Called Number': webhookData.calledNumber || '',
        'Caller ID Internal': webhookData.callerIdInternal || '',
        'Caller ID External': webhookData.callerIdExternal || '',
        'Caller Name Internal': webhookData.callerNameInternal || '',
        'Caller Name External': webhookData.callerNameExternal || '',
        'Start Time': webhookData.startTime || '',
        'Call Start Time': webhookData.callStartTime || '',
        'Raw JSON': JSON.stringify(webhookData, null, 2),
        'Processed': false
      });

      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to create webhook event: ${error.message}`);
    }
  }

  /**
   * Get all events for a specific callId
   * @param {string} callId - Telebroad call ID
   */
  async getEventsByCallId(callId) {
    try {
      const records = await base(WEBHOOK_EVENTS_TABLE)
        .select({
          filterByFormula: `{Call ID} = '${callId}'`,
          sort: [{ field: 'Received At', direction: 'asc' }]
        })
        .firstPage();

      return records.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Failed to fetch events for callId ${callId}: ${error.message}`);
    }
  }

  /**
   * Get unprocessed events
   */
  async getUnprocessedEvents() {
    try {
      const records = await base(WEBHOOK_EVENTS_TABLE)
        .select({
          filterByFormula: `{Processed} = FALSE()`,
          sort: [{ field: 'Received At', direction: 'asc' }]
        })
        .firstPage();

      return records.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Failed to fetch unprocessed events: ${error.message}`);
    }
  }

  /**
   * Get events grouped by callId
   * Returns an object where keys are callIds and values are arrays of events
   */
  async getEventsGroupedByCallId() {
    try {
      const events = await this.getUnprocessedEvents();
      
      const grouped = {};
      events.forEach(event => {
        const callId = event['Call ID'];
        if (!grouped[callId]) {
          grouped[callId] = [];
        }
        grouped[callId].push(event);
      });

      return grouped;
    } catch (error) {
      throw new Error(`Failed to group events: ${error.message}`);
    }
  }

  /**
   * Mark event as processed
   * @param {string} eventRecordId - Airtable record ID
   * @param {string} mergedCallRecordId - ID of merged call record
   */
  async markAsProcessed(eventRecordId, mergedCallRecordId) {
    try {
      const record = await base(WEBHOOK_EVENTS_TABLE).update(eventRecordId, {
        'Processed': true,
        'Merged Call Record': [mergedCallRecordId]
      });

      return {
        id: record.id,
        ...record.fields
      };
    } catch (error) {
      throw new Error(`Failed to mark event as processed: ${error.message}`);
    }
  }

  /**
   * Mark multiple events as processed
   * @param {Array} eventRecordIds - Array of Airtable record IDs
   * @param {string} mergedCallRecordId - ID of merged call record
   */
  async markMultipleAsProcessed(eventRecordIds, mergedCallRecordId) {
    try {
      const updates = eventRecordIds.map(id => ({
        id: id,
        fields: {
          'Processed': true,
          'Merged Call Record': [mergedCallRecordId]
        }
      }));

      // Airtable allows max 10 records per batch
      const results = [];
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        const updated = await base(WEBHOOK_EVENTS_TABLE).update(batch);
        results.push(...updated);
      }

      return results.map(record => ({
        id: record.id,
        ...record.fields
      }));
    } catch (error) {
      throw new Error(`Failed to mark events as processed: ${error.message}`);
    }
  }

  /**
   * Get statistics about webhook events
   */
  async getStatistics() {
    try {
      const allRecords = await base(WEBHOOK_EVENTS_TABLE)
        .select({ maxRecords: 1000 })
        .firstPage();

      const total = allRecords.length;
      const processed = allRecords.filter(r => r.fields['Processed']).length;
      const unprocessed = total - processed;

      // Count by status
      const statusCounts = {};
      allRecords.forEach(r => {
        const status = r.fields['Status'] || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Count unique callIds
      const uniqueCallIds = new Set(allRecords.map(r => r.fields['Call ID']));

      return {
        total,
        processed,
        unprocessed,
        uniqueCalls: uniqueCallIds.size,
        statusBreakdown: statusCounts,
        averageEventsPerCall: uniqueCallIds.size > 0 ? (total / uniqueCallIds.size).toFixed(2) : 0
      };
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Delete processed events older than X days
   * @param {number} daysOld - Delete events older than this many days
   */
  async cleanupOldEvents(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffIso = cutoffDate.toISOString();

      const oldRecords = await base(WEBHOOK_EVENTS_TABLE)
        .select({
          filterByFormula: `AND(
            {Processed} = TRUE(),
            IS_BEFORE({Received At}, '${cutoffIso}')
          )`
        })
        .firstPage();

      if (oldRecords.length === 0) {
        return { deleted: 0, message: 'No old records to clean up' };
      }

      // Delete in batches of 10
      let deleted = 0;
      for (let i = 0; i < oldRecords.length; i += 10) {
        const batch = oldRecords.slice(i, i + 10).map(r => r.id);
        await base(WEBHOOK_EVENTS_TABLE).destroy(batch);
        deleted += batch.length;
      }

      return {
        deleted,
        message: `Deleted ${deleted} processed events older than ${daysOld} days`
      };
    } catch (error) {
      throw new Error(`Failed to cleanup old events: ${error.message}`);
    }
  }
}

module.exports = new WebhookEventService();
