const puppeteer = require('puppeteer');
const axios = require('axios');
const http = require('http');

// 建立簡單的 HTTP 伺服器以滿足 Render 的 Health Check (健康檢查埠口綁定)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('放置天堂雲端多角色掛機伺服器運行中！\n');
}).listen(PORT, () => {
  console.log(`📡 健康檢查伺服器已啟動，監聽 Port: ${PORT}`);
});

// 讀取環境變數，或使用預設值
const GAME_URL = process.env.GAME_URL;
const GAS_API_URL = process.env.GAS_API_URL;
// 安全金鑰：必須與 GAS 裡面的 SPREADSHEET_SECRET_TOKEN 一致
const GAME_SECRET = process.env.GAME_SECRET || "candylovema_secret_token_abc123";
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '60000', 10);

if (!GAME_URL || !GAS_API_URL) {
  console.error('❌ 錯誤：請設定 GAME_URL 與 GAS_API_URL 環境變數！');
  process.exit(1);
}

console.log('☁️ 放置天堂雲端多帳號排程器啟動中...');
console.log(`- 遊戲網址: ${GAME_URL}`);
console.log(`- API 網址: ${GAS_API_URL}`);
console.log(`- 同步週期: ${SYNC_INTERVAL_MS / 1000} 秒`);

const sleep = ms => new Promise(res => setTimeout(res, ms));

// 輔助函數：取得特定帳號的 GAS 雲端存檔
async function fetchCloudSave(username, password) {
  try {
    const slotKey = `lineage_idle_save_1`;
    const url = `${GAS_API_URL}?action=load&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&key=${encodeURIComponent(slotKey)}&_cb=${Date.now()}`;
    const response = await axios.get(url);
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    }
  } catch (error) {
    console.error(`⚠️ [${username}] 獲取雲端存檔失敗:`, error.message);
  }
  return null;
}

// 輔助函數：更新特定帳號的 GAS 雲端存檔
async function updateCloudSave(username, password, saveString) {
  try {
    const slotKey = `lineage_idle_save_1`;
    const response = await axios.post(GAS_API_URL, {
      action: 'save',
      username: username,
      password: password,
      key: slotKey,
      value: saveString
    }, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    if (response.data && response.data.status === 'success') {
      return true;
    }
  } catch (error) {
    console.error(`⚠️ [${username}] 上傳存檔失敗:`, error.message);
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

// 帳號登入與初始化流程
async function loginAndPlay(page, bot, cloudSave) {
  console.log(`🎮 [${bot.username}] 正在開啟遊戲網址...`);
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });

  console.log(`🔑 [${bot.username}] 正在寫入帳密快取...`);
  await page.evaluate((user, pass) => {
    localStorage.setItem('lineage_idle_username', user);
    localStorage.setItem('lineage_idle_password', pass);
  }, bot.username, bot.password);

  console.log(`🔄 [${bot.username}] 重新載入以自動登入...`);
  await page.reload({ waitUntil: 'networkidle2' });

  console.log(`🔑 [${bot.username}] 正在等待自動登入驗證...`);
  await page.waitForSelector('#game-login-modal', { timeout: 20000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('game-login-modal');
    return el && el.style.display === 'none';
  }, { timeout: 20000 });
  console.log(`✅ [${bot.username}] 自動登入驗證成功！`);

  console.log(`💾 [${bot.username}] 正在注入 Slot 1 存檔並初始化遊戲...`);
  const slotKey = `lineage_idle_save_1`;
  await page.evaluate((save, key) => {
    localStorage.setItem(key, save);
    localStorage.setItem('lineage_idle_cloud_auto_sync', 'true');
  }, cloudSave, slotKey);

  // 執行進入遊戲
  await page.evaluate(() => {
    _loadSelectedSlot = 1;
    loadEnterSelected();
  });
  console.log(`🚀 [${bot.username}] 進入遊戲成功，掛機正式開始！`);

  // 等待遊戲加載就緒後，若身在城鎮則自動點擊「出發」練功
  await sleep(3000);
  const inTown = await page.evaluate(() => {
    if (typeof mapState !== 'undefined' && mapState.current && mapState.current.startsWith('town_')) {
      if (typeof departToLastBattle === 'function') {
        departToLastBattle();
        return true;
      }
    }
    return false;
  });
  if (inTown) {
    console.log(`✈️ [${bot.username}] 偵測到身處村莊，已自動呼叫 [出發] 前往最後戰鬥地圖！`);
  }
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

  const activeTabs = new Map(); // username -> Page
  const botStates = new Map();  // username -> { currentLastSaveTime: number }

  // 獨立帳號的同步 loop 函式
  async function runBotLoop(page, bot) {
    const slotKey = `lineage_idle_save_1`;
    
    while (activeTabs.has(bot.username)) {
      try {
        await sleep(SYNC_INTERVAL_MS);
        if (!activeTabs.has(bot.username)) break;
        
        console.log(`🔄 [${bot.username}] 開始同步檢查...`);
        
        // A. 撈取雲端最新存檔，檢查手機是否搶登
        const latestCloudSave = await fetchCloudSave(bot.username, bot.password);
        const state = botStates.get(bot.username);
        
        if (latestCloudSave && state) {
          const cloudLastSaveTime = parseLastSaveTime(latestCloudSave);
          
          if (cloudLastSaveTime > state.currentLastSaveTime) {
            console.log(`✨ [${bot.username}] 偵測到雲端有新進度 (手機上傳時間: ${new Date(cloudLastSaveTime).toLocaleString()})`);
            await loginAndPlay(page, bot, latestCloudSave);
            state.currentLastSaveTime = cloudLastSaveTime;
            continue;
          }
        }
        
        // B. 若因為死亡或補給回到了村莊，自動點擊「出發」重返戰場
        const inTown = await page.evaluate(() => {
          if (typeof mapState !== 'undefined' && mapState.current && mapState.current.startsWith('town_')) {
            if (typeof departToLastBattle === 'function') {
              departToLastBattle();
              return true;
            }
          }
          return false;
        });
        if (inTown) {
          console.log(`✈️ [${bot.username}] 偵測到身處村莊，已自動呼叫 [出發] 重返戰場！`);
          await sleep(2000); // 等待地圖切換
        }
        
        // C. 定時存檔並上傳雲端
        await page.evaluate(() => {
          if (typeof saveGame === 'function') {
            saveGame();
          }
        });
        
        const localSave = await page.evaluate((key) => {
          return localStorage.getItem(key);
        }, slotKey);
        
        if (localSave && state) {
          const localLastSaveTime = parseLastSaveTime(localSave);
          console.log(`📤 [${bot.username}] 正在上傳最新掛機進度...`);
          const success = await updateCloudSave(bot.username, bot.password, localSave);
          if (success) {
            state.currentLastSaveTime = localLastSaveTime;
          }
        }
        
        // 輸出日誌
        const playerInfo = await page.evaluate(() => {
          if (typeof player !== 'undefined' && player && player.cls) {
            return {
              name: player.name || '未命名',
              cls: player.cls,
              lv: player.lv,
              gold: player.gold,
              exp: (player.exp / 100).toFixed(4) + '%',
              map: mapState.current
            };
          }
          return null;
        });
        if (playerInfo) {
          console.log(`📊 [${bot.username}] 當前狀態: [${playerInfo.cls}] Lv.${playerInfo.lv} | 金幣: ${playerInfo.gold.toLocaleString()} | 經驗: ${playerInfo.exp} | 地圖: ${playerInfo.map}`);
        }
        
      } catch (err) {
        console.error(`❌ [${bot.username}] 同步迴圈異常:`, err.message);
      }
    }
  }

  // 同步活躍掛機帳號名單的排程任務
  const syncBotsList = async () => {
    try {
      console.log('🔄 [排程器] 正在從 GAS 撈取雲端掛機帳號清單...');
      const response = await axios.get(`${GAS_API_URL}?action=get_all_active_bots&secret=${encodeURIComponent(GAME_SECRET)}&_cb=${Date.now()}`);
      
      if (response.data && response.data.status === 'success') {
        const bots = response.data.bots || [];
        const fetchedUsernames = new Set(bots.map(b => b.username));
        
        // 1. 關閉已不再需要掛機的帳號分頁
        for (const [username, page] of activeTabs.entries()) {
          if (!fetchedUsernames.has(username)) {
            console.log(`🛑 [排程器] 帳號 ${username} 已不再名單中，正在停止掛機並關閉分頁...`);
            try {
              await page.close();
            } catch (e) {}
            activeTabs.delete(username);
            botStates.delete(username);
          }
        }
        
        // 2. 啟動新註冊的掛機帳號分頁
        for (const bot of bots) {
          if (!activeTabs.has(bot.username)) {
            console.log(`🚀 [排程器] 發現新掛機帳號 ${bot.username}，正在啟動掛機...`);
            try {
              // 獲取初始存檔
              const cloudSave = await fetchCloudSave(bot.username, bot.password);
              if (!cloudSave) {
                console.log(`⚠️ [排程器] 帳號 ${bot.username} 雲端尚無存檔，將於下次掃描再試。`);
                continue;
              }
              
              const page = await browser.newPage();
              page.setDefaultNavigationTimeout(90000);
              
              // 先記錄狀態
              activeTabs.set(bot.username, page);
              botStates.set(bot.username, { currentLastSaveTime: parseLastSaveTime(cloudSave) });
              
              // 執行登入與遊戲開始
              await loginAndPlay(page, bot, cloudSave);
              
              // 啟動此帳號分頁的獨立同步循環
              runBotLoop(page, bot);
              
            } catch (e) {
              console.error(`❌ [排程器] 啟動帳號 ${bot.username} 失敗:`, e.message);
              activeTabs.delete(bot.username);
              botStates.delete(bot.username);
            }
          }
        }
      } else {
        console.error('❌ [排程器] 獲取掛機帳號清單失敗:', response.data.message);
      }
    } catch (e) {
      console.error('❌ [排程器] 獲取掛機帳號清單異常:', e.message);
    }
  };

  // 每 5 分鐘與試算表同步一次帳號清單
  setInterval(syncBotsList, 5 * 60 * 1000);
  // 啟動時立刻執行一次
  await syncBotsList();
}

run().catch(err => {
  console.error('🚨 雲端掛機排程器崩潰:', err);
  process.exit(1);
});
