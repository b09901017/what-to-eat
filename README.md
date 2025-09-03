今天吃什麼？ What To Eat Today?
一款旨在解決日常「用餐選擇困難症」的 Web App。透過互動式地圖探索、AI 智慧分類與充滿儀式感的命運羅盤，提供充滿質感與樂趣的美食決策體驗。

✨ 核心功能 (Features)
📍 互動式地圖探索: 定位使用者，並在真實地圖上透過拖曳手把，直觀地「畫」出一個圓形的美食探索半徑。

🧠 智慧美食分類: 自動抓取範圍內的所有餐廳，並透過後端 AI 進行智慧分類 (例如：義式風情 🍝, 健康早午餐 🥪)。

🌊 沉浸式探索流程: 在地圖上無縫瀏覽不同分類的店家列表與資訊，過程無須跳轉頁面，提供不中斷的「心流」體驗。

🎡 充滿儀式感的隨機決定: 將感興趣的店家加入「候選清單」，並透過一個設計精良、動畫流暢的「命運羅盤」做出最終決定。

📖 豐富的店家詳情: 查看店家的真實照片、使用者評論、完整營業時間、電話、網站等詳細資訊。

🎨 UI/UX 風格 (UI/UX Style)
高質感與舒適感: 整體風格追求「柔和的美食冒險手冊」，避免廉價感。介面有大量留白，採用溫暖、協調的配色與優雅的字體。

流暢的動畫與微交互: 所有的頁面切換、元件互動都必須有精心設計的過場動畫，提供如原生 App 般順滑的沉浸式體驗。

🚀 技術棧 (Tech Stack)
前端 (Frontend):

HTML5

CSS3 (包含 Flexbox, Grid, Keyframe Animations)

JavaScript (ES6+) (Vanilla JS, 無框架)

Leaflet.js (開源地圖函式庫)

後端 (Backend):

Python 3

Flask (輕量級 Web 框架)

Flask-CORS (處理跨域請求)

🔧 如何運行 (Getting Started)
請依照以下步驟在您的本機端運行此專案。

事前準備
請確認您的電腦已安裝：

Python 3.x

pip (Python 套件安裝程式)

安裝步驟
Clone Repo

Bash

git clone https://github.com/YOUR_USERNAME/what-to-eat.git
cd what-to-eat
設定並啟動後端伺服器

Bash

# 安裝所需的 Python 套件
pip install -r requirements.txt

# 啟動 Flask 伺服器
python app.py
伺服器將會運行在 http://127.0.0.1:5000。請保持此終端機視窗開啟。

開啟前端頁面

直接在您的網頁瀏覽器 (建議使用 Chrome) 中，打開專案根目錄下的 index.html 檔案。

您現在應該可以看到 App 的歡迎畫面，並可以開始互動。

📂 專案結構 (Project Structure)
what-to-eat/
├── 📂 css/
│   └── 📜 style.css         # 主要樣式與動畫
├── 📂 js/
│   └── 📜 app.js           # 核心前端邏輯
├── 📜 app.py                # Flask 後端伺服器
├── 📜 index.html            # App 頁面骨架
├── 📜 requirements.txt      # Python 套件需求
└── 📜 README.md             # 就是這個檔案
🔮 未來方向 (Future Development)
串接真實 API: 後端 app.py 已經預留了呼叫 Google Maps API 和 Gemini API 的程式碼邏輯。下一步的核心任務是申請 API 金鑰，並將模擬數據替換為真實的 API 請求。

數據持久化: 目前的「候選清單」在重新整理頁面後會消失。未來可以考慮使用 localStorage 或引入後端資料庫 (如 SQLite) 來保存使用者的清單。

完善錯誤處理: 增加更多錯誤處理機制，例如當 API 請求失敗、或是在特定區域找不到任何餐廳時，給予使用者更友善的提示。

# 今天吃什麼？ What To Eat Today?

一款旨在解決日常「用餐選擇困難症」的 Web App。透過互動式地圖探索、AI 智慧分類與充滿儀式感的決策工具，提供充滿質感與樂趣的美食探索體驗。

✨ **核心功能 (Features)**
* 📍 **互動式地圖探索**: 定位使用者，並在真實地圖上透過拖曳手把，直觀地「畫」出一個圓形的美食探索半徑。
* 🧠 **AI 智慧分類**: 自動抓取範圍內的所有餐廳，並透過後端 Gemini API 進行智慧分類 (例如：日式, 火鍋, 咖啡廳)。
* 🌊 **沉浸式探索流程**: 在地圖上無縫瀏覽不同分類的店家列表與資訊，過程無須跳轉頁面，提供不中斷的「心流」體驗。
* 🎡 **多樣的決策工具**:
    * **命運羅盤**: 將感興趣的店家加入「候選清單」，透過動畫流暢的羅盤做出最終決定。
    * **地圖隨機選**: 新增「隨機選一家！」功能，透過地圖上所有圖示閃爍跳動的動畫，直接為您決定好今天的命運！
* 📖 **豐富的店家詳情**: 查看店家的真實照片、使用者評論、完整營業時間、電話、網站等詳細資訊。

🎨 **UI/UX 風格 (UI/UX Style)**
* **高質感與舒適感**: 整體風格追求「柔和的美食冒險手冊」，避免廉價感。介面有大量留白，採用溫暖、協調的配色與優雅的字體。
* **流暢的動畫與微交互**: 精心設計的過場動畫、物理慣性旋轉羅盤、地圖隨機選動畫，提供如原生 App 般順滑的沉浸式體驗。
* **直觀的圖示系統**: 地圖上的餐廳標記從單色圓點升級為更具辨識度的 SVG 圖示，讓美食分類一目了然。

---

### **v2.0 主要更新 (Recent Updates)**

此版本已從一個使用模擬數據 (Mock Data) 的原型，進化為一個**完整串接真實世界 API 的 Web App**。

* **真實數據串接**:
    * 後端已全面改寫，串接 **Google Maps Platform API**，可即時獲取使用者周邊的真實餐廳、店家詳情、照片與評論。
    * 餐廳分類由 **Google Gemini API (`gemini-1.5-flash`)** 驅動，能根據餐廳類型智慧生成簡潔、直觀的分類。
* **全新功能「地圖隨機選」**:
    * 在美食地圖頁面新增「隨機選一家！」按鈕。
    * 點擊後，地圖上所有店家圖示會開始隨機閃爍跳動，動畫效果充滿趣味，最終會選出一家餐廳作為結果。
* **UI/UX 全面優化**:
    * **地圖圖示升級**: 將原有的多色圓點標記，替換為一套專門設計的 SVG 線條圖示，讓地圖資訊更清晰、更具質感。
    * **探索圈體驗改善**: 在「畫出你的探索圈」頁面，明確標示出使用者的所在位置，並優化了 UI 圖層，解決了先前拖曳點與按鈕不靈敏的問題。
* **開發流程優化**:
    * **API 金鑰管理**: 引入 `.env` 檔案來管理 Google Maps 與 Gemini 的 API 金鑰，將敏感資訊與程式碼分離，提升安全性。
    * **程式碼健壯性**: 增強了前後端的錯誤處理機制，並針對 API 沒有回傳資料的邊界情況做了 UI 適配。

---

🚀 **技術棧 (Tech Stack)**
* **前端 (Frontend)**:
    * HTML5 / CSS3 (包含 Flexbox, Keyframe Animations)
    * JavaScript (ES6+) (Vanilla JS, 無框架)
    * Leaflet.js (開源地圖函式庫)
* **後端 (Backend)**:
    * Python 3 / Flask
    * **Google Maps Platform API**: 用於地理定位與餐廳資料搜尋。
    * **Google Gemini API**: 用於餐廳智慧分類。
    * `python-dotenv`: 用於管理環境變數。

🔧 **如何運行 (Getting Started)**

1.  **Clone Repo**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/what-to-eat.git](https://github.com/YOUR_USERNAME/what-to-eat.git)
    cd what-to-eat
    ```

2.  **取得 API 金鑰**
    * 前往 [Google Cloud Console](https://console.cloud.google.com/) 申請 API 金鑰，並啟用 `Places API`。
    * 前往 [Google AI Studio](https://aistudio.google.com/) 取得 Gemini API 金鑰。

3.  **設定環境變數**
    * 在專案根目錄下，建立一個名為 `.gitignore` 的檔案，並加入一行 `.env` 以確保安全。
    * 在專案根目錄下，建立一個名為 `.env` 的檔案，並填入您的金鑰：
        ```
        GOOGLE_MAPS_API_KEY="你的Google地圖API金鑰"
        GEMINI_API_KEY="你的Gemini API金鑰"
        ```

4.  **設定並啟動後端伺服器**
    ```bash
    # 安裝所需的 Python 套件
    pip install -r requirements.txt

    # 啟動 Flask 伺服器
    python app.py
    ```
    伺服器將會運行在 `http://127.0.0.1:5000`。請保持此終端機視窗開啟。

5.  **開啟前端頁面**
    * 直接在您的網頁瀏覽器 (建議使用 Chrome) 中，打開專案根目錄下的 `index.html` 檔案。

📂 **專案結構 (Project Structure)**
what-to-eat/
├── 📂 css/
│   └── 📜 style.css
├── 📂 js/
│   └── 📜 app.js
├── 📜 app.py
├── 📜 index.html
├── 📜 requirements.txt
├── 📜 .gitignore      # 新增
├── 📜 .env            # (本地端，不應上傳)
└── 📜 README.md