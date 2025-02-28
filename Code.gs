function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Job Applications')
    .addItem('Add Fetch Data Buttons', 'addFetchButtons')
    .addToUi();
}

function addFetchButtons() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  // Add a new column for the buttons if it doesn't exist
  let buttonColumn = sheet.getRange("F1");
  buttonColumn.setValue("Actions");
  
  // Remove any existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Add buttons to each row
  for (let row = 2; row <= lastRow; row++) {
    let buttonRange = sheet.getRange(row, 6); // Column F
    if (buttonRange.getValue() !== 'Fetch Data') {
      buttonRange.insertCheckboxes();
      buttonRange.setValue(false);
    }
  }
  
  // Add new trigger
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  
  Logger.log('Edit event triggered');
  Logger.log('Sheet name: ' + sheet.getName());
  Logger.log('Column: ' + range.getColumn());
  Logger.log('Row: ' + range.getRow());
  Logger.log('Value: ' + range.getValue());
  
  // Check if the edit was in the buttons column (F)
  if (range.getColumn() === 6 && range.getValue() === true) {
    Logger.log('Checkbox checked in column F');
    const row = range.getRow();
    const url = sheet.getRange(row, 1).getValue(); // Get URL from column A
    Logger.log('URL found: ' + url);
    
    if (url) {
      try {
        Logger.log('Sending request to server...');
        const response = UrlFetchApp.fetch('https://7176-2a02-1210-78d4-9300-79bb-36df-eaaf-e67a.ngrok-free.app/scrape', {
          'method': 'post',
          'contentType': 'application/json',
          'payload': JSON.stringify({
            url: url,
            row: row
          }),
          'muteHttpExceptions': true
        });
        
        const responseText = response.getContentText();
        Logger.log('Server response: ' + responseText);
        
        // Parse response and update sheet if needed
        const responseData = JSON.parse(responseText);
        if (responseData.success) {
          Logger.log('Request successful');
          // Force refresh the sheet
          SpreadsheetApp.flush();
        } else {
          Logger.log('Request failed: ' + responseData.error);
        }
        
        // Reset checkbox
        range.setValue(false);
        
      } catch (error) {
        Logger.log('Error: ' + error.toString());
        range.setValue(false);
      }
    }
  }
} 