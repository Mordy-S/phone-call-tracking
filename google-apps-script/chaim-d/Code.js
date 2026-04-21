var SHEET_ID = '13xBUFr_ycZ1Om8FL70qLcGPZxFOxQ4R4Dqqz8gN40uI';

// Returns an array of all Active emails from Settings sheet (rows 2+, col B = email, col C = status)
function getActiveEmails() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var settings = ss.getSheetByName('Settings');
  var lastRow = settings.getLastRow();
  if (lastRow < 2) return [];
  var data = settings.getRange(2, 1, lastRow - 1, 3).getValues();
  var emails = [];
  for (var i = 0; i < data.length; i++) {
    var email = data[i][1].toString().trim();
    var status = data[i][2].toString().trim().toLowerCase();
    if (email && status === 'active') {
      emails.push(email);
    }
  }
  return emails;
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'logCallback') return logCallback(e);
  if (action === 'logFromEmail') return logFromEmail(e);
  if (action === 'setupCheckboxes') { setupCheckboxes(); return ContentService.createTextOutput('Checkboxes applied.'); }
  return ContentService.createTextOutput('OK');
}

function setCheckbox(sheet, row, col, value) {
  var range = sheet.getRange(row, col);
  var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  range.setDataValidation(cbRule);
  range.setValue(value);
}

function logCallback(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var date = e.parameter.date || '';
  var time = e.parameter.time || '';
  var phone = e.parameter.phone || 'He will call you';
  var notes = e.parameter.notes || '';
  var subject = e.parameter.subject || '';

  sheet.appendRow([date, time, phone, notes, 'New', false, false, '']);
  var lastRow = sheet.getLastRow();

  var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(lastRow, 6, 1, 2).setDataValidation(cbRule);

  sendApptEmail(date, time, phone, notes, subject);

  sheet.getRange(lastRow, 6).setValue(true);

  return ContentService.createTextOutput('Logged and emailed.');
}

function logFromEmail(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var date = e.parameter.date || '';
  var time = e.parameter.time || '';
  var phone = e.parameter.phone || 'He will call you';
  var notes = e.parameter.notes || '';

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var existDate = data[i][0] || '';
    var existTime = data[i][1] || '';
    var existPhone = data[i][2] || '';
    if (existDate.toString() === date &&
        normalizeTime_(existTime) === normalizeTime_(time) &&
        normalizePhone_(existPhone) === normalizePhone_(phone)) {
      return ContentService.createTextOutput('Duplicate — already logged.');
    }
  }

  sheet.appendRow([date, time, phone, notes, 'New', false, false, '']);
  var lastRow = sheet.getLastRow();

  var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(lastRow, 6, 1, 2).setDataValidation(cbRule);

  sendApptEmail(date, time, phone, notes, '');

  sheet.getRange(lastRow, 6).setValue(true);

  var inputTokens  = parseInt(e.parameter.inputTokens  || '0', 10);
  var outputTokens = parseInt(e.parameter.outputTokens || '0', 10);
  if (inputTokens > 0 || outputTokens > 0) {
    sheet.getRange(lastRow, 9).setValue(inputTokens);
    sheet.getRange(lastRow, 10).setValue(outputTokens);
    var cost = (inputTokens * 3.0 / 1e6) + (outputTokens * 15.0 / 1e6);
    sheet.getRange(lastRow, 11).setValue(parseFloat(cost.toFixed(8)));
  }

  var headerRange = sheet.getRange(1, 9, 1, 3);
  var headers = headerRange.getValues()[0];
  if (headers[0] !== 'Input Tokens') {
    headerRange.setValues([['Input Tokens', 'Output Tokens', 'Cost ($)']]);
    headerRange.setFontWeight('bold');
  }

  return ContentService.createTextOutput('Logged from email scan.');
}

function normalizeTime_(timeVal) {
  if (!timeVal) return '';
  if (timeVal instanceof Date) {
    var h = timeVal.getHours();
    var m = timeVal.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }
  return timeVal.toString().toUpperCase().replace(/\s+/g, ' ').trim();
}

function normalizePhone_(phone) {
  if (!phone) return '';
  return phone.toString().replace(/[\s.\-()]/g, '');
}

function isAfter5pm() {
  var now = new Date();
  var hours = now.getHours();
  return hours >= 17;
}

function sendApptEmail(date, time, phone, notes, subject) {
  var emails = getActiveEmails();
  if (emails.length === 0) {
    Logger.log('sendApptEmail: no active recipients found in Settings sheet.');
    return;
  }
  if (!subject) subject = formatSubject(date, time);
  var phoneLine = (phone && phone !== 'He will call you') ? phone : 'He will call you';
  var body = 'Please call - ' + phoneLine + '\n' + notes;
  var options = {};
  if (isAfter5pm()) {
    options.replyTo = '8019563@gmail.com';
  }
  for (var i = 0; i < emails.length; i++) {
    MailApp.sendEmail(emails[i], subject, body, options);
    Logger.log('Sent appt email to: ' + emails[i]);
  }
}

function formatSubject(dateStr, timeStr) {
  var today = new Date();
  today.setHours(0,0,0,0);
  var apptDate = new Date(dateStr);
  apptDate.setHours(0,0,0,0);
  var diffDays = Math.round((apptDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today @ ' + timeStr;
  if (diffDays === 1) return 'Tomorrow @ ' + timeStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[apptDate.getDay()] + ', ' + months[apptDate.getMonth()] + ' ' + apptDate.getDate() + ' @ ' + timeStr;
}

function formatTimeFromDate(d) {
  if (typeof d === 'string') return d;
  var hours = d.getHours();
  var minutes = d.getMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ' ' + ampm;
}

function formatReminderDate(dateStr) {
  var today = new Date();
  today.setHours(0,0,0,0);
  var apptDate = new Date(dateStr);
  apptDate.setHours(0,0,0,0);
  var diffDays = Math.round((apptDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return months[apptDate.getMonth()] + ' ' + apptDate.getDate();
}

function checkReminders() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    var dateStr = data[i][0];
    var timeStr = data[i][1];
    var phone = data[i][2];
    var notes = data[i][3];
    var reminderSent = data[i][6];
    if (reminderSent === true) continue;
    if (!dateStr || !timeStr) continue;
    try {
      var apptDateTime = new Date(dateStr);
      apptDateTime.setHours(timeStr.getHours(), timeStr.getMinutes(), timeStr.getSeconds(), 0);
      var diffMin = (apptDateTime - now) / (1000 * 60);
      if (diffMin > 0 && diffMin <= 10) {
        sendReminderEmail(dateStr, timeStr, phone, notes);
        setCheckbox(sheet, i + 1, 7, true);
        sheet.getRange(i + 1, 5).setValue('Reminded');
      }
    } catch(err) {}
  }
}

function setupCheckboxes() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(2, 6, lastRow - 1, 2).setDataValidation(cbRule);
}

function sendReminderEmail(dateStr, timeStr, phone, notes) {
  var emails = getActiveEmails();
  if (emails.length === 0) {
    Logger.log('sendReminderEmail: no active recipients found in Settings sheet.');
    return;
  }
  var subject = 'LL Reminder';
  var formattedTime = formatTimeFromDate(timeStr);
  var formattedDate = formatReminderDate(dateStr);
  var phoneLine = (phone && phone !== 'He will call you') ? 'Phone: ' + phone : 'He will call you';
  var body = formattedDate + ' @ ' + formattedTime + '\n' + phoneLine + '\nNotes: ' + notes;
  for (var i = 0; i < emails.length; i++) {
    MailApp.sendEmail(emails[i], subject, body);
    Logger.log('Sent reminder to: ' + emails[i]);
  }
}

function setupReminderTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkReminders').timeBased().everyMinutes(1).create();
}

function testEmails() {
  var emails = getActiveEmails();
  Logger.log('Active emails found: ' + emails.length);
  for (var i = 0; i < emails.length; i++) {
    Logger.log(emails[i]);
  }
}
