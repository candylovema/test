const puppeteer = require('puppeteer');
const axios = require('axios');
const http = require('http');

// 建立簡單的 HTTP 伺服器以滿足 Render 的 Health Check (健康檢查埠口綁定)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('放置天堂雲端掛機程式運行中！\n');
}).listen(PORT, () => {
  console.log(`📡 健康檢查伺服器已啟動，監聽 Port: ${PORT}`);
});

// 讀取環境變數，或使用預設值
const GAME_URL = process.env.GAME_URL;
const GAS_API_URL = process.env.GAS_API_URL;
const GAME_USERNAME = process.env.GAME_USERNAME;
const GAME_PASSWORD = process.env.GAME_PASSWORD;
const SLOT = parseInt(process.env.SLOT || '1', 10);
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '60000', 10);

const SLOT_KEY = `lineage_idle_save_${SLOT}`;

if (!GAME_URL || !GAS_API_URL || !GAME_USERNAME || !GAME_PASSWORD) {
  console.error('❌ 錯誤：請設定 GAME_URL, GAS_API_URL, GAME_USERNAME, GAME_PASSWORD 環境變數！');
  process.exit(1);
}

console.log('☁️ 放置天堂雲端掛機程式啟動中...');
console.log(`- 遊戲網址: ${GAME_URL}`);
console.log(`- API 網址: ${GAS_API_URL}`);
console.log(`- 掛機帳號: ${GAME_USERNAME}`);
console.log(`- 掛機存檔欄位: Slot ${SLOT}`);
console.log(`- 同步週期: ${SYNC_INTERVAL_MS / 1000} 秒`);

// 輔助函數：取得 GAS 雲端存檔
async function fetchCloudSave() {
  try {
    const url = `${GAS_API_URL}?action=load&username=${encodeURIComponent(GAME_USERNAME)}&password=${encodeURIComponent(GAME_PASSWORD)}&key=${encodeURIComponent(SLOT_KEY)}`;
    const response = await axios.get(url);
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    } else {
      console.error('⚠️ 從 Google Apps Script 獲取雲端存檔失敗:', response.data.message);
    }
  } catch (error) {
    console.error('⚠️ 無法從 Google Apps Script 獲取雲端存檔:', error.message);
  }
  return null;
}

// 輔助函數：更新 GAS 雲端存檔
async function updateCloudSave(saveString) {
  try {
    const response = await axios.post(GAS_API_URL, {
      action: 'save',
      username: GAME_USERNAME,
      password: GAME_PASSWORD,
      key: SLOT_KEY,
      value: saveString
    }, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    if (response.data && response.data.status === 'success') {
      console.log('✅ 雲端存檔同步成功 (已存入 Google 試算表)');
      return true;
    } else {
      console.error('⚠️ 雲端存檔同步回傳失敗:', response.data.message);
    }
  } catch (error) {
    console.error('⚠️ 無法上傳存檔到 Google Apps Script:', error.message);
  }
  return false;
}

// 解析存檔中的 lastSaveTime
function parseLastSaveTime(saveString) {
  try {
    let payload = saveString;
    if (saveString.startsWith('SIG1:')) {
      const idx = saveString.indexOf(':', 5);
      if (idx !== -1) {
        payload = saveString.substring(idx + 1);
      }
    }
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed && parsed.p && parsed.p.lastSaveTime) {
      return parsed.p.lastSaveTime;
    }
  } catch (e) {
    // 忽略解析錯誤
  }
  return 0;
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);

  // 1. 首次載入雲端存檔
  console.log('📥 正在下載初始雲端存檔...');
  let cloudSave = await fetchCloudSave();
  
  if (!cloudSave) {
    console.log('⚠️ 雲端無此 Slot 存檔，請先在手機或電腦上手動上傳存檔！');
    console.log('將於 30 秒後重新嘗試...');
    await browser.close();
    setTimeout(run, 30000);
    return;
  }

  console.log('🎮 正在開啟遊戲網址...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });

  console.log('🔑 正在寫入帳密快取至瀏覽器...');
  await page.evaluate((user, pass) => {
    localStorage.setItem('lineage_idle_username', user);
    localStorage.setItem('lineage_idle_password', pass);
  }, GAME_USERNAME, GAME_PASSWORD);

  console.log('🔄 重新載入以觸發自動登入...');
  await page.reload({ waitUntil: 'networkidle2' });

  console.log('🔑 正在等待自動登入驗證...');
  await page.waitForSelector('#game-login-modal.hidden', { timeout: 20000 });
  console.log('✅ 自動登入驗證成功！');

  // 2. 注入存檔並進入遊戲
  console.log(`💾 正在注入 Slot ${SLOT} 存檔並初始化遊戲...`);
  await page.evaluate((save, key) => {
    localStorage.setItem(key, save);
    localStorage.setItem('lineage_idle_cloud_auto_sync', 'true');
  }, cloudSave, SLOT_KEY);

  // 執行進入遊戲
  await page.evaluate((slot) => {
    _loadSelectedSlot = slot;
    loadEnterSelected();
  }, SLOT);

  console.log('🚀 進入遊戲成功，掛機正式開始！');
  
  let currentLastSaveTime = parseLastSaveTime(cloudSave);

  // 定期迴圈：同步與檢查更新
  setInterval(async () => {
    try {
      console.log('🔄 開始例行同步檢查...');
      
      // A. 向 GAS 拉取最新存檔，檢查是否有手機操作的更新
      const latestCloudSave = await fetchCloudSave();
      if (latestCloudSave) {
        const cloudLastSaveTime = parseLastSaveTime(latestCloudSave);
        
        if (cloudLastSaveTime > currentLastSaveTime) {
          console.log(`✨ 偵測到雲端有新進度 (手機上傳時間: ${new Date(cloudLastSaveTime).toLocaleString()})`);
          console.log('📥 正在套用新存檔並重整遊戲網頁...');
          
          await page.evaluate((save, key) => {
            localStorage.setItem(key, save);
          }, latestCloudSave, SLOT_KEY);
          
          await page.reload({ waitUntil: 'networkidle2' });
          
          console.log('🔑 正在等待重新登入驗證...');
          await page.waitForSelector('#game-login-modal.hidden', { timeout: 20000 });
          
          await page.evaluate((slot) => {
            _loadSelectedSlot = slot;
            loadEnterSelected();
          }, SLOT);
          
          currentLastSaveTime = cloudLastSaveTime;
          console.log('✅ 成功切換為手機同步之新存檔！');
          return;
        }
      }

      // B. 如果雲端沒有更晚的存檔，則 Puppeteer 將自己目前的進度上傳
      await page.evaluate(() => {
        if (typeof saveGame === 'function') {
          saveGame();
        }
      });

      const localSave = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, SLOT_KEY);

      if (localSave) {
        const localLastSaveTime = parseLastSaveTime(localSave);
        console.log('📤 正在上傳最新掛機進度...');
        const success = await updateCloudSave(localSave);
        if (success) {
          currentLastSaveTime = localLastSaveTime;
        }
      }

      const playerInfo = await page.evaluate(() => {
        if (typeof player !== 'undefined' && player && player.cls) {
          return {
            name: player.name || '未命名',
            cls: player.cls,
            lv: player.lv,
            gold: player.gold,
            exp: (player.exp / 100).toFixed(4) + '%'
          };
        }
        return null;
      });

      if (playerInfo) {
        console.log(`📊 當前狀態: [${playerInfo.cls}] Lv.${playerInfo.lv} ${playerInfo.name} | 金幣: ${playerInfo.gold.toLocaleString()}`);
      }

    } catch (err) {
      console.error('❌ 同步迴圈中發生異常:', err);
    }
  }, SYNC_INTERVAL_MS);
}

run().catch(err => {
  console.error('🚨 雲端掛機程式崩潰:', err);
  process.exit(1);
});
