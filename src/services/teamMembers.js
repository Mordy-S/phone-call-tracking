const { base, tables, fields } = require('../config/airtable');

const F = fields.teamMembers;

/**
 * Service for managing Team Members in Airtable
 * Handles intakers, mentors, and their availability status
 */
class TeamMemberService {
  /**
   * Get all team members with optional filtering
   * @param {Object} options - Query options
   */
  async getAllMembers(options = {}) {
    try {
      const query = base(tables.teamMembers).select({
        maxRecords: options.maxRecords || 100,
        view: options.view || 'Grid view',
        filterByFormula: options.filterByFormula,
        sort: options.sort || [{ field: F.NAME, direction: 'asc' }]
      });

      const records = [];
      await query.eachPage((pageRecords, fetchNextPage) => {
        records.push(...pageRecords.map(r => ({ id: r.id, ...r.fields })));
        fetchNextPage();
      });

      return records;
    } catch (error) {
      throw new Error(`Failed to fetch team members: ${error.message}`);
    }
  }

  /**
   * Get a single team member by ID
   */
  async getMemberById(recordId) {
    try {
      const record = await base(tables.teamMembers).find(recordId);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to fetch team member ${recordId}: ${error.message}`);
    }
  }

  /**
   * Get active team members only
   */
  async getActiveMembers() {
    return this.getAllMembers({
      filterByFormula: `{${F.ACTIVE}} = TRUE()`
    });
  }

  /**
   * Get available team members (active and status = Available)
   */
  async getAvailableMembers() {
    return this.getAllMembers({
      filterByFormula: `AND({${F.ACTIVE}} = TRUE(), {${F.CURRENT_STATUS}} = '🟢 Available')`
    });
  }

  /**
   * Get members by role (Intaker, Mentor, Both)
   * @param {string} role - Role to filter by
   */
  async getMembersByRole(role) {
    return this.getAllMembers({
      filterByFormula: `AND({${F.ACTIVE}} = TRUE(), OR({${F.ROLE}} = '${role}', {${F.ROLE}} = 'Both'))`
    });
  }

  /**
   * Get available mentors by specialty
   * @param {string} specialty - Specialty to filter by
   */
  async getAvailableMentorsBySpecialty(specialty) {
    return this.getAllMembers({
      filterByFormula: `AND(
        {${F.ACTIVE}} = TRUE(),
        {${F.CURRENT_STATUS}} = '🟢 Available',
        OR({${F.ROLE}} = 'Mentor', {${F.ROLE}} = 'Both'),
        FIND('${specialty}', ARRAYJOIN({${F.SPECIALTIES}}, ',')) > 0
      )`
    });
  }

  /**
   * Get mentors by specialty (regardless of availability)
   * @param {string} specialty - Specialty to filter by
   */
  async getMentorsBySpecialty(specialty) {
    return this.getAllMembers({
      filterByFormula: `AND(
        {${F.ACTIVE}} = TRUE(),
        OR({${F.ROLE}} = 'Mentor', {${F.ROLE}} = 'Both'),
        FIND('${specialty}', ARRAYJOIN({${F.SPECIALTIES}}, ',')) > 0
      )`
    });
  }

  /**
   * Create a new team member
   * @param {Object} memberData - Team member data
   */
  async createMember(memberData) {
    try {
      const record = await base(tables.teamMembers).create({
        [F.NAME]: memberData.name,
        [F.ROLE]: memberData.role,
        [F.PHONE_EXTENSION]: memberData.phoneExtension,
        [F.SPECIALTIES]: memberData.specialties || [],
        [F.CURRENT_STATUS]: memberData.currentStatus || '🔴 Offline',
        [F.USUAL_HOURS]: memberData.usualHours || '',
        [F.NOTES]: memberData.notes || '',
        [F.ACTIVE]: memberData.active !== false // default true
      });

      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to create team member: ${error.message}`);
    }
  }

  /**
   * Update a team member
   * @param {string} recordId - Record ID
   * @param {Object} updateData - Fields to update
   */
  async updateMember(recordId, updateData) {
    try {
      const fieldsToUpdate = {};

      if (updateData.name !== undefined) fieldsToUpdate[F.NAME] = updateData.name;
      if (updateData.role !== undefined) fieldsToUpdate[F.ROLE] = updateData.role;
      if (updateData.phoneExtension !== undefined) fieldsToUpdate[F.PHONE_EXTENSION] = updateData.phoneExtension;
      if (updateData.specialties !== undefined) fieldsToUpdate[F.SPECIALTIES] = updateData.specialties;
      if (updateData.currentStatus !== undefined) fieldsToUpdate[F.CURRENT_STATUS] = updateData.currentStatus;
      if (updateData.usualHours !== undefined) fieldsToUpdate[F.USUAL_HOURS] = updateData.usualHours;
      if (updateData.notes !== undefined) fieldsToUpdate[F.NOTES] = updateData.notes;
      if (updateData.active !== undefined) fieldsToUpdate[F.ACTIVE] = updateData.active;

      const record = await base(tables.teamMembers).update(recordId, fieldsToUpdate);
      return { id: record.id, ...record.fields };
    } catch (error) {
      throw new Error(`Failed to update team member ${recordId}: ${error.message}`);
    }
  }

  /**
   * Update team member status (quick status change)
   * @param {string} recordId - Record ID
   * @param {string} status - New status ('🟢 Available', '🟡 Busy', '🔴 Offline')
   */
  async updateStatus(recordId, status) {
    return this.updateMember(recordId, { currentStatus: status });
  }

  /**
   * Set member as available
   */
  async setAvailable(recordId) {
    return this.updateStatus(recordId, '🟢 Available');
  }

  /**
   * Set member as busy
   */
  async setBusy(recordId) {
    return this.updateStatus(recordId, '🟡 Busy');
  }

  /**
   * Set member as offline
   */
  async setOffline(recordId) {
    return this.updateStatus(recordId, '🔴 Offline');
  }

  /**
   * Deactivate a team member (soft delete)
   */
  async deactivateMember(recordId) {
    return this.updateMember(recordId, { active: false });
  }

  /**
   * Find member by phone/extension
   * @param {string} phoneExtension - Phone or extension number
   */
  async findByPhoneExtension(phoneExtension) {
    const members = await this.getAllMembers({
      filterByFormula: `{${F.PHONE_EXTENSION}} = '${phoneExtension}'`
    });
    return members[0] || null;
  }
}

module.exports = new TeamMemberService();
