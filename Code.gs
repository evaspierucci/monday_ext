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
  Logger.log(`Sheet: ${sheet.getName()}, Column: ${range.getColumn()}, Row: ${range.getRow()}, Value: ${range.getValue()}`);
  
  // Only process edits in the main sheet
  if (sheet.getName() !== 'Job Data') {
    Logger.log('Ignoring edit in non-job sheet');
    return;
  }
  
  // Check if the edit was in the buttons column (F)
  if (range.getColumn() === 6 && range.getValue() === true) {
    Logger.log('Checkbox checked in column F');
    const row = range.getRow();
    const url = sheet.getRange(row, 1).getValue(); // Get URL from column A
    Logger.log(`Processing row ${row} with URL: ${url}`);
    
    if (!url) {
      Logger.log('No URL found in row ' + row);
      range.setValue(false);
      return;
    }
    
    try {
      const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
      if (!configSheet) {
        throw new Error('Config sheet not found. Please create a sheet named "Config" with the server URL in cell A1');
      }
      
      const serverUrl = configSheet.getRange('A1').getValue();
      if (!serverUrl) {
        throw new Error('Server URL not found in Config sheet cell A1');
      }
      
      Logger.log('Using server URL: ' + serverUrl);
      
      const response = UrlFetchApp.fetch(serverUrl + '/scrape', {
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
      
      const responseData = JSON.parse(responseText);
      if (responseData.success) {
        Logger.log('Request successful');
        SpreadsheetApp.flush();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
      
    } catch (error) {
      Logger.log('Error: ' + error.toString());
      SpreadsheetApp.getUi().alert('Error: ' + error.message);
    } finally {
      range.setValue(false);
    }
  }
}

// Test function - don't use this for actual scraping
function testServerConnection() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const serverUrl = configSheet ? configSheet.getRange('A1').getValue() : '';
  
  if (!serverUrl) {
    Logger.log('No server URL found in Config sheet');
    return;
  }
  
  try {
    const response = UrlFetchApp.fetch(serverUrl + '/test', {
      'method': 'get',
      'muteHttpExceptions': true
    });
    
    Logger.log('Test response: ' + response.getContentText());
  } catch (error) {
    Logger.log('Test error: ' + error.toString());
  }
} 