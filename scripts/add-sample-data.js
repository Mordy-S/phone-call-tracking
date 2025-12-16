/**
 * Add Sample Data - Lev Lehazin Helpline
 * Creates realistic sample data for testing
 */
const axios = require('axios');
require('dotenv').config();

const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_PAT;

const axiosConfig = {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
};

// Store created record IDs for linking
const createdRecords = {
  teamMembers: [],
  callers: [],
  calls: [],
  followups: []
};

// Sample Team Members (using actual schema values - no emojis)
const sampleTeamMembers = [
  {
    'Name': 'David Cohen',
    'Role': 'Intaker',
    'Phone/Extension': '101',
    'Specialties': ['General', 'Emotional/Mental Health'],
    'Current Status': 'Available',
    'Usual Hours': 'Sun-Thu 7:00 PM - 10:00 PM',
    'Notes': 'Primary evening intaker',
    'Active': true
  },
  {
    'Name': 'Moshe Levy',
    'Role': 'Mentor',
    'Phone/Extension': '102',
    'Specialties': ['Technology/Internet', 'Kedusha'],
    'Current Status': 'Busy',
    'Usual Hours': 'Sun-Thu 8:00 PM - 11:00 PM, Motzei Shabbos',
    'Notes': 'Specialist in technology-related issues',
    'Active': true
  },
  {
    'Name': 'Yosef Goldstein',
    'Role': 'Both',
    'Phone/Extension': '103',
    'Specialties': ['Family/Relationships', 'Learning/Motivation', 'General'],
    'Current Status': 'Available',
    'Usual Hours': 'Mon-Thu 6:00 PM - 9:00 PM',
    'Notes': 'Can do both intake and mentoring. Great with family issues.',
    'Active': true
  },
  {
    'Name': 'Ari Schwartz',
    'Role': 'Mentor',
    'Phone/Extension': '104',
    'Specialties': ['Addiction', 'Emotional/Mental Health'],
    'Current Status': 'Offline',
    'Usual Hours': 'By appointment only',
    'Notes': 'Addiction specialist - schedule through coordinator',
    'Active': true
  },
  {
    'Name': 'Eli Friedman',
    'Role': 'Intaker',
    'Phone/Extension': '105',
    'Specialties': ['General'],
    'Current Status': 'Offline',
    'Usual Hours': 'Motzei Shabbos only',
    'Notes': 'Weekend coverage',
    'Active': true
  }
];

// Sample Callers (Best Times is multilineText, Primary Issue and Assigned Mentor are text)
const sampleCallers = [
  {
    'Name': '', // Anonymous
    'Phone': '555-123-4567',
    'Phone Type': 'Cell',
    'Contact Preference': 'Can receive callbacks',
    'Best Times': 'After 9pm weeknights',
    'Primary Issue': 'Technology/Internet',  // This is singleLineText in actual schema
    'Assigned Mentor': 'Moshe Levy',  // This is singleLineText in actual schema
    'Status': 'New',
    'First Contact': new Date().toISOString().split('T')[0],
    'Background Notes': 'First-time caller, struggling with internet usage. Prefers text before calling back.'
  },
  {
    'Name': 'Caller #2',
    'Phone': '555-234-5678',
    'Phone Type': 'Home',
    'Contact Preference': 'Will call back only',
    'Best Times': 'Lunch break 12-1pm',
    'Primary Issue': 'Family/Relationships',
    'Assigned Mentor': 'Yosef Goldstein',
    'Status': 'Active',
    'First Contact': '2024-11-15',
    'Background Notes': 'Ongoing family situation. Has been calling weekly. Cannot receive calls at home.'
  },
  {
    'Name': '',
    'Phone': '555-345-6789',
    'Phone Type': 'Cell',
    'Contact Preference': 'Either',
    'Best Times': 'Flexible',
    'Primary Issue': 'Emotional/Mental Health',
    'Assigned Mentor': 'Moshe Levy',
    'Status': 'Active',
    'First Contact': '2024-10-20',
    'Background Notes': 'Working with Moshe. Significant progress. Check-ins every 2 weeks.'
  },
  {
    'Name': 'Caller #4',
    'Phone': '555-456-7890',
    'Phone Type': 'Work',
    'Contact Preference': 'Can receive callbacks',
    'Best Times': 'During work hours only 9am-5pm',
    'Primary Issue': 'Learning/Motivation',
    'Assigned Mentor': 'Yosef Goldstein',
    'Status': 'Stable',
    'First Contact': '2024-08-01',
    'Background Notes': 'College student. Completed initial mentoring. Monthly check-ins.'
  }
];

// Helper: Get today's date in various formats
function getRelativeDate(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

async function createRecords(tableName, records) {
  const response = await axios.post(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
    { records: records.map(fields => ({ fields })) },
    axiosConfig
  );
  return response.data.records;
}

async function getAllRecords(tableName) {
  const response = await axios.get(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
    axiosConfig
  );
  return response.data.records;
}

async function addSampleData() {
  console.log('📦 Adding Sample Data to Lev Lehazin Helpline\n');
  console.log('='.repeat(60));

  try {
    // Check if data already exists
    console.log('\n🔍 Checking for existing data...');
    const existingTeam = await getAllRecords('Team Members');
    const existingCallers = await getAllRecords('Callers');
    
    if (existingTeam.length > 1 || existingCallers.length > 0) {
      console.log(`\n⚠️  Data already exists:`);
      console.log(`   - Team Members: ${existingTeam.length} records`);
      console.log(`   - Callers: ${existingCallers.length} records`);
      console.log('\n   To avoid duplicates, this script will only add missing sample data.');
    }

    // 1. Create Team Members (if less than 5)
    console.log('\n\n👥 TEAM MEMBERS');
    console.log('-'.repeat(40));
    
    if (existingTeam.length < 5) {
      const toAdd = sampleTeamMembers.slice(existingTeam.length);
      if (toAdd.length > 0) {
        const created = await createRecords('Team Members', toAdd);
        createdRecords.teamMembers = [...existingTeam, ...created];
        console.log(`   ✅ Created ${created.length} team members`);
        created.forEach(r => console.log(`      - ${r.fields.Name} (${r.fields.Role})`));
      }
    } else {
      createdRecords.teamMembers = existingTeam;
      console.log(`   ⏭️  Skipped (${existingTeam.length} already exist)`);
    }

    // Get all team member IDs for linking
    const allTeamMembers = await getAllRecords('Team Members');
    const teamMemberMap = {};
    allTeamMembers.forEach(r => {
      teamMemberMap[r.fields.Name] = r.id;
    });

    // 2. Create Callers (if less than 4)
    console.log('\n\n📞 CALLERS');
    console.log('-'.repeat(40));
    
    const existingCallersNow = await getAllRecords('Callers');
    if (existingCallersNow.length < 4) {
      // Note: Assigned Mentor is a text field in actual schema, not a link
      const callersToAdd = sampleCallers.slice(existingCallersNow.length);
      
      const created = await createRecords('Callers', callersToAdd);
      createdRecords.callers = [...existingCallersNow, ...created];
      console.log(`   ✅ Created ${created.length} callers`);
      created.forEach(r => console.log(`      - ${r.fields.Name || 'Anonymous'} (${r.fields['Primary Issue']})`));
    } else {
      createdRecords.callers = existingCallersNow;
      console.log(`   ⏭️  Skipped (${existingCallersNow.length} already exist)`);
    }

    // Get caller IDs for linking
    const allCallers = await getAllRecords('Callers');
    const callerByPhone = {};
    allCallers.forEach(r => {
      callerByPhone[r.fields.Phone] = r.id;
    });

    // 3. Create Sample Calls
    console.log('\n\n📱 CALLS');
    console.log('-'.repeat(40));
    
    const existingCalls = await getAllRecords('Calls');
    if (existingCalls.length < 5) {
      // Note: Issue Category and Mentor for Follow-up are TEXT fields in actual schema
      const sampleCalls = [
        {
          'Date/Time': getRelativeDate(-2), // 2 days ago
          'Direction': 'Inbound',
          'Call Type': 'New Caller',
          'Duration': 15,
          'Issue Category': 'Technology/Internet',  // Text field
          'Summary': 'First-time caller struggling with internet addiction. Spent time understanding the situation. Caller open to working with a mentor.',
          'Outcome': 'Callback Scheduled',
          'Urgency': 'Soon (24-48hrs)',
          'Follow-up Created': false,
          'Mentor for Follow-up': 'Moshe Levy',  // Text field
          'Caller': callerByPhone['555-123-4567'] ? [callerByPhone['555-123-4567']] : undefined,
          'Received By': teamMemberMap['David Cohen'] ? [teamMemberMap['David Cohen']] : undefined
        },
        {
          'Date/Time': getRelativeDate(-1), // Yesterday
          'Direction': 'Inbound',
          'Call Type': 'Follow-up',
          'Duration': 25,
          'Issue Category': 'Family/Relationships',
          'Summary': 'Weekly check-in. Situation at home improving. Discussed communication strategies.',
          'Outcome': 'Caller Will Call Back',
          'Urgency': 'Routine',
          'Follow-up Created': false,
          'Caller': callerByPhone['555-234-5678'] ? [callerByPhone['555-234-5678']] : undefined,
          'Received By': teamMemberMap['Yosef Goldstein'] ? [teamMemberMap['Yosef Goldstein']] : undefined
        },
        {
          'Date/Time': getRelativeDate(0), // Today
          'Direction': 'Missed',
          'Call Type': 'New Caller',
          'Duration': 0,
          'Summary': 'Missed call - no voicemail left',
          'Outcome': 'Left Voicemail',
          'Urgency': 'Routine',
          'Follow-up Created': false,
          'Received By': teamMemberMap['David Cohen'] ? [teamMemberMap['David Cohen']] : undefined
        },
        {
          'Date/Time': getRelativeDate(0), // Today
          'Direction': 'Outbound',
          'Call Type': 'Check-in',
          'Duration': 10,
          'Issue Category': 'Emotional/Mental Health',
          'Summary': 'Scheduled check-in. Caller doing well. Will check in again in 2 weeks.',
          'Outcome': 'Resolved',
          'Urgency': 'Routine',
          'Follow-up Created': true,
          'Caller': callerByPhone['555-345-6789'] ? [callerByPhone['555-345-6789']] : undefined,
          'Received By': teamMemberMap['Moshe Levy'] ? [teamMemberMap['Moshe Levy']] : undefined
        }
      ];

      const toAddCalls = sampleCalls.slice(existingCalls.length);
      if (toAddCalls.length > 0) {
        const created = await createRecords('Calls', toAddCalls);
        createdRecords.calls = created;
        console.log(`   ✅ Created ${created.length} call records`);
        created.forEach(r => console.log(`      - ${r.fields.Direction} ${r.fields['Call Type']} (${r.fields.Outcome})`));
      }
    } else {
      createdRecords.calls = existingCalls;
      console.log(`   ⏭️  Skipped (${existingCalls.length} already exist)`);
    }

    // Get call IDs for follow-ups
    const allCalls = await getAllRecords('Calls');

    // 4. Create Sample Follow-ups
    console.log('\n\n📋 FOLLOW-UPS');
    console.log('-'.repeat(40));
    
    const existingFollowups = await getAllRecords('Follow-ups');
    if (existingFollowups.length < 3) {
      const sampleFollowups = [
        {
          'Type': 'Callback',
          'Due Date/Time': getRelativeDate(1), // Tomorrow
          'Status': 'Pending',
          'Priority': 'High',
          'Notes': 'Follow up on internet addiction discussion. Caller expecting call around 9pm.',
          'Caller': callerByPhone['555-123-4567'] ? [callerByPhone['555-123-4567']] : undefined,
          'Assigned To': teamMemberMap['Moshe Levy'] ? [teamMemberMap['Moshe Levy']] : undefined,
          'Related Call': allCalls.length > 0 ? [allCalls[0].id] : undefined
        },
        {
          'Type': 'Check-in',
          'Due Date/Time': getRelativeDate(14), // 2 weeks
          'Status': 'Pending',
          'Priority': 'Normal',
          'Notes': 'Scheduled 2-week check-in per last conversation.',
          'Caller': callerByPhone['555-345-6789'] ? [callerByPhone['555-345-6789']] : undefined,
          'Assigned To': teamMemberMap['Moshe Levy'] ? [teamMemberMap['Moshe Levy']] : undefined
        },
        {
          'Type': 'Internal Task',
          'Due Date/Time': getRelativeDate(0), // Today
          'Status': 'Pending',
          'Priority': 'Urgent',
          'Notes': 'Review missed call from this morning. Try to identify caller if possible.',
          'Assigned To': teamMemberMap['David Cohen'] ? [teamMemberMap['David Cohen']] : undefined
        }
      ];

      const toAddFollowups = sampleFollowups.slice(existingFollowups.length);
      if (toAddFollowups.length > 0) {
        const created = await createRecords('Follow-ups', toAddFollowups);
        console.log(`   ✅ Created ${created.length} follow-up tasks`);
        created.forEach(r => console.log(`      - ${r.fields.Type}: ${r.fields.Priority} priority`));
      }
    } else {
      console.log(`   ⏭️  Skipped (${existingFollowups.length} already exist)`);
    }

    // 5. Create Sample Availability Schedule
    console.log('\n\n📅 AVAILABILITY SCHEDULE');
    console.log('-'.repeat(40));
    
    const existingSchedule = await getAllRecords('Availability Schedule');
    if (existingSchedule.length < 5) {
      const sampleSchedule = [
        {
          'Day': 'Sunday',
          'Start Time': '7:00 PM',
          'End Time': '10:00 PM',
          'Role This Shift': 'Intaker',
          'Team Member': teamMemberMap['David Cohen'] ? [teamMemberMap['David Cohen']] : undefined
        },
        {
          'Day': 'Monday',
          'Start Time': '8:00 PM',
          'End Time': '11:00 PM',
          'Role This Shift': 'Mentor On-Call',
          'Team Member': teamMemberMap['Moshe Levy'] ? [teamMemberMap['Moshe Levy']] : undefined
        },
        {
          'Day': 'Tuesday',
          'Start Time': '6:00 PM',
          'End Time': '9:00 PM',
          'Role This Shift': 'Intaker',
          'Team Member': teamMemberMap['Yosef Goldstein'] ? [teamMemberMap['Yosef Goldstein']] : undefined
        },
        {
          'Day': 'Wednesday',
          'Start Time': '7:00 PM',
          'End Time': '10:00 PM',
          'Role This Shift': 'Intaker',
          'Team Member': teamMemberMap['David Cohen'] ? [teamMemberMap['David Cohen']] : undefined
        },
        {
          'Day': 'Motzei Shabbos',
          'Start Time': '9:00 PM',
          'End Time': '12:00 AM',
          'Role This Shift': 'Intaker',
          'Team Member': teamMemberMap['Eli Friedman'] ? [teamMemberMap['Eli Friedman']] : undefined
        }
      ];

      const toAddSchedule = sampleSchedule.slice(existingSchedule.length);
      if (toAddSchedule.length > 0) {
        const created = await createRecords('Availability Schedule', toAddSchedule);
        console.log(`   ✅ Created ${created.length} schedule entries`);
        created.forEach(r => console.log(`      - ${r.fields.Day}: ${r.fields['Start Time']} - ${r.fields['End Time']}`));
      }
    } else {
      console.log(`   ⏭️  Skipped (${existingSchedule.length} already exist)`);
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('✨ SAMPLE DATA SETUP COMPLETE!');
    console.log('='.repeat(60));
    
    const finalCounts = {
      teamMembers: (await getAllRecords('Team Members')).length,
      callers: (await getAllRecords('Callers')).length,
      calls: (await getAllRecords('Calls')).length,
      followups: (await getAllRecords('Follow-ups')).length,
      schedule: (await getAllRecords('Availability Schedule')).length
    };

    console.log('\n📊 Current Record Counts:');
    console.log(`   Team Members:        ${finalCounts.teamMembers}`);
    console.log(`   Callers:             ${finalCounts.callers}`);
    console.log(`   Calls:               ${finalCounts.calls}`);
    console.log(`   Follow-ups:          ${finalCounts.followups}`);
    console.log(`   Availability:        ${finalCounts.schedule}`);

    console.log('\n🔗 Open your Airtable base to see the data!');
    console.log('   https://airtable.com/' + baseId);

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

addSampleData();
