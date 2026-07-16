/**
 * 放置天堂 - Google 試算表存盤同步與使用者認證 API (Google Apps Script)
 * 
 * 使用教學：
 * 1. 打開 Google 雲端硬碟中的「放置天堂試算表」。
 * 2. 點擊選單的「擴充功能」 -> 「Apps Script」。
 * 3. 清空原本的代碼，將此檔案的所有內容貼上。
 * 4. 點擊右上角「儲存」圖示。
 * 5. 點擊右上角「部署」 -> 「管理部署」。
 *    - 點擊作用中部署旁邊的「編輯 (鉛筆圖示)」
 *    - 在「版本」選單選擇「新增版本」
 *    - 點擊「部署」按鈕完成升級。
 */

// 安全金鑰（用於 Render 雲端同步認證，請與 Render 上的 GAME_SECRET 保持一致）
const SPREADSHEET_SECRET_TOKEN = "candylovema_secret_token_abc123";

// 獲取試算表物件
function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    // 您的 Google 試算表 ID
    ss = SpreadsheetApp.openById("12eDJ7_xOWTTf2UJNqtat0_Xe7Zn4fKrXXHNPl7HR6mI");
  }
  return ss;
}

// 獲取或建立工作表
function getOrCreateSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// 驗證使用者帳號密碼是否正確
function verifyUser(usersSheet, username, password) {
  var data = usersSheet.getDataRange().getValues();
  var uStr = String(username).trim();
  var pStr = String(password).trim();
  for (var i = 0; i < data.length; i++) {
    var sheetUser = String(data[i][0]).trim();
    var sheetPass = String(data[i][1]).trim();
    if (sheetUser === uStr) {
      return sheetPass === pStr;
    }
  }
  return false;
}

function doGet(e) {
  var action = e.parameter.action;
  
  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "參數缺失" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    // 1. 給 Render 批次拉取所有需要掛機的帳號清單
    if (action === "get_all_active_bots") {
      var secret = e.parameter.secret;
      if (secret !== SPREADSHEET_SECRET_TOKEN) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "認證失敗" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      var usersSheet = getOrCreateSheet("Users");
      var data = usersSheet.getDataRange().getValues();
      var botList = [];
      
      for (var i = 1; i < data.length; i++) {
        var u = data[i][0];
        var p = data[i][1];
        var isActive = data[i][2]; // is_bot_active 欄位
        
        if (u && p && (isActive === true || isActive === "true" || isActive === "")) {
          botList.push({
            username: u,
            password: p,
            save_key: "lineage_idle_save_1"
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", bots: botList }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. 單一存檔載入動作 (GET)
    var username = e.parameter.username;
    var password = e.parameter.password;
    if (!username || !password) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "帳密參數缺失" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    username = username.trim();
    password = password.trim();
    
    var usersSheet = getOrCreateSheet("Users");
    if (!verifyUser(usersSheet, username, password)) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "帳號或密碼錯誤" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "load") {
      var key = e.parameter.key || "lineage_idle_save_1";
      var savesSheet = getOrCreateSheet("Saves");
      var data = savesSheet.getDataRange().getValues();
      var saveKey = username + "_" + key;
      
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === saveKey) {
          return ContentService.createTextOutput(JSON.stringify({ 
            status: "success", 
            key: key, 
            data: data[i][1] 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "存檔未找到" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "未知動作" }))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var username = payload.username;
    var password = payload.password;
    
    if (!action || !username || !password) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "參數缺失" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    username = username.trim();
    password = password.trim();
    
    var usersSheet = getOrCreateSheet("Users");
    
    // 前端註冊流程 (POST)
    if (action === "register") {
      var data = usersSheet.getDataRange().getValues();
      
      // 如果試算表全新全空，先建立欄位名稱
      if (data.length === 1 && data[0][0] === "") {
        usersSheet.getRange(1, 1).setValue("username");
        usersSheet.getRange(1, 2).setValue("password");
        usersSheet.getRange(1, 3).setValue("is_bot_active");
        usersSheet.getRange(1, 4).setValue("last_login");
        // 寫入第一筆資料，預設開啟雲端掛機 (true)
        usersSheet.appendRow([username, password, true, new Date()]);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "註冊成功！" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      // 檢查帳號是否重複
      var uStr = String(username).trim();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === uStr) {
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "帳號已存在，請使用其它名稱" }))
                               .setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      // 寫入新帳密，預設開啟雲端掛機 (true)
      usersSheet.appendRow([username, password, true, new Date()]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "註冊成功！" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 登入驗證流程 (POST)
    if (action === "login") {
      if (verifyUser(usersSheet, username, password)) {
        // 更新最後登入時間
        var data = usersSheet.getDataRange().getValues();
        var uStr = String(username).trim();
        for (var i = 0; i < data.length; i++) {
          if (String(data[i][0]).trim() === uStr) {
            usersSheet.getRange(i + 1, 4).setValue(new Date());
            break;
          }
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "登入成功！" }))
                             .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "帳號或密碼錯誤" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 存檔同步流程 (POST)
    if (action === "save") {
      var key = payload.key || "lineage_idle_save_1";
      var val = payload.value;
      
      if (!val) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "存檔內容為空" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      // 驗證權限
      if (!verifyUser(usersSheet, username, password)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "身分驗證失敗，無法存取雲端" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      var savesSheet = getOrCreateSheet("Saves");
      var data = savesSheet.getDataRange().getValues();
      var saveKey = username + "_" + key;
      var foundIndex = -1;
      
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === saveKey) {
          foundIndex = i + 1; // 1-based index
          break;
        }
      }
      
      if (foundIndex !== -1) {
        savesSheet.getRange(foundIndex, 2).setValue(val);
      } else {
        if (data.length === 1 && data[0][0] === "") {
          savesSheet.getRange(1, 1).setValue(saveKey);
          savesSheet.getRange(1, 2).setValue(val);
        } else {
          savesSheet.appendRow([saveKey, val]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "雲端存檔成功" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "未知動作" }))
                         .setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
