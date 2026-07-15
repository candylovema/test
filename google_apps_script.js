/**
 * 放置天堂 - Google 試算表存盤同步 API (Google Apps Script)
 * 
 * 使用教學：
 * 1. 打開 Google 雲端硬碟，建立一個新的「Google 試算表」。
 * 2. 點擊選單的「擴充功能」 -> 「Apps Script」。
 * 3. 清空原本的代碼，將此檔案的所有內容貼上。
 * 4. 點擊右上角「部署」 -> 「新增部署」。
 * 5. 選擇部署類型為「網頁應用程式 (Web App)」。
 *    - 說明：可填入 "放置天堂存檔同步"
 *    - 誰可以存取：選擇「所有人 (Anyone)」 (請務必選 Anyone，否則 Puppeteer 和遊戲網頁會因為權限無法存取)。
 * 6. 點擊「部署」，並授予必要的 Google 權限。
 * 7. 部署成功後，複製畫面上顯示的「網頁應用程式 URL」 (例如 https://script.google.com/macros/s/.../exec)，
 *    將此網址貼回遊戲前端的雲端同步設定欄位中。
 */

function doGet(e) {
  var key = e.parameter.key || "lineage_idle_save_1";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  // 尋找指定的 Key (例如存檔欄位名)
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        key: key, 
        data: data[i][1] 
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "error", 
    message: "存檔未找到 (Key: " + key + ")" 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  try {
    var payload = JSON.parse(e.postData.contents);
    var key = payload.key || "lineage_idle_save_1";
    var val = payload.value;
    
    if (!val) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "存檔內容為空" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var foundIndex = -1;
    
    // 檢查 Key 是否已存在
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        foundIndex = i + 1; // 1-based index
        break;
      }
    }
    
    // 如果存在就更新，否則新增一行
    if (foundIndex !== -1) {
      sheet.getRange(foundIndex, 2).setValue(val);
    } else {
      // 若是全新空白試算表，第一行可能為空，安全起見先檢查
      if (data.length === 1 && data[0][0] === "") {
        sheet.getRange(1, 1).setValue(key);
        sheet.getRange(1, 2).setValue(val);
      } else {
        sheet.appendRow([key, val]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
