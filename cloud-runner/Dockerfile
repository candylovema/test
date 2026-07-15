FROM node:20-slim

# 安裝 Chromium 及其所需的依賴套件（包含中文字型，防止網頁中文字元亂碼）
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 設定 Puppeteer 使用系統內建的 Chromium，不下載內建瀏覽器以減小映像檔體積
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# 複製套件定義檔並安裝依賴
COPY package.json ./
RUN npm install

# 複製掛機執行主腳本
COPY runner.js ./

# 授權工作目錄（Hugging Face 預設以 non-root 使用者 UID 1000 執行，需要確保目錄可讀寫）
RUN chmod -R 777 /app

# 執行雲端掛機
CMD ["node", "runner.js"]
