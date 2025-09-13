# 今天吃什麼？ What To Eat Today?

一款旨在解決日常「用餐選擇困難症」的 Web App。透過互動式地圖探索、AI 智慧分類與充滿儀式感的決策工具，提供充滿質感與樂趣的美食探索體驗。

✨ **核心功能 (Features)**

* **📍 互動式地圖探索**: 定位使用者，並在真實地圖上透過拖曳圓心或手把，直觀地「畫」出一個圓形的美食探索半徑。
* **🧠 AI 智慧分類**: 自動抓取範圍內的所有餐廳，並透過後端 Gemini API 進行智慧分類，更能動態產生最貼切的 Emoji 圖示！
* **🗺️ 地圖整合決策**: 除了傳統的命運羅盤，更提供了直接在地圖上，透過候選店家圖標隨機閃爍、聚焦的動畫方式，充滿驚喜地做出決定。
* **🎡 充滿儀式感的決策工具**: 將感興趣的店家加入「候選清單」，並透過一個設計精良、動畫流暢的「命運羅盤」做出最終決定。
* **📖 豐富的店家詳情**: 查看店家的真實照片、使用者評論、完整營業時間、電話、網站等詳細資訊。
* **🚀 極速非同步體驗**: 採用「漸進式載入」與「非同步 AI 分類」架構，使用者幾乎可以立即看到地圖結果，告別漫長等待。

---

### 🚀 **技術棧 (Tech Stack)**

* **前端 (Frontend)**:
    * HTML5 / CSS3 (Flexbox, Grid, Keyframe Animations)
    * JavaScript (ES6+, 模組化, 無框架)
    * Leaflet.js (開源地圖函式庫)
* **後端 (Backend)**:
    * Python 3 / Flask
    * Google Maps Platform API: 用於地理定位與餐廳資料搜尋。
    * Google Gemini API: 用於餐廳智慧分類與 Emoji 生成。
    * Gunicorn (WSGI Server)
    * Geopy: 用於精準計算地理距離。

---

### 🔧 **如何運行 (Getting Started)**

1.  **Clone Repo**

    ```bash
    git clone [https://github.com/YOUR_USERNAME/what-to-eat.git](https://github.com/YOUR_USERNAME/what-to-eat.git)
    cd what-to-eat
    ```

2.  **取得 API 金鑰**
    * 前往 [Google Cloud Console](https://console.cloud.google.com/) 申請 API 金鑰，並啟用 **Places API**。
    * 前往 [Google AI Studio](https://aistudio.google.com/) 取得 Gemini API 金鑰。

3.  **設定環境變數**

    在專案根目錄下，建立一個名為 `.env` 的檔案，並填入您的金鑰：

    ```
    GOOGLE_MAPS_API_KEY="你的Google地圖API金鑰"
    GEMINI_API_KEY="你的Gemini API金鑰"
    ```

4.  **安裝與啟動伺服器**

    ```bash
    # 安裝所需的 Python 套件
    pip install -r requirements.txt

    # 啟動整合後的前後端伺服器
    python app.py
    ```

5.  **開啟 App**
    * 伺服器將會運行在 `http://127.0.0.1:5000`。
    * 請打開您的網頁瀏覽器 (建議使用 Chrome)，並直接訪問 `http://127.0.0.1:5000`。

    > **注意**：由於已改為模組化架構，請不要再直接點開 `index.html` 檔案，否則會因 CORS 策略而無法運行。

---

### **版本演進 (Version History)**

* **v1-v13**: 奠定核心功能與多次 UI/UX 迭代的基礎。
* **v14 (美食獻禮)**:
    * **核心架構重構 - 漸進式載入**: 徹底改造前後端 API 流程，使用者搜尋後可**立即**看到未分類的地圖結果，大幅縮短初始等待時間超過 90%。
    * **非同步 AI 分類**: AI 分類現在於背景執行，完成後會以動畫效果「動態揭曉」在地圖與分類列表中，將等待過程轉化為驚喜體驗。
    * **沉浸式 UI/UX 升級**:
        * 新增可愛的「AI 大廚」CSS 動畫，取代靜態的載入文字。
        * 優化分類按鈕互動，解決閃爍問題，點擊反應更即時。
        * 新增 AI 分類失敗時的「重試」機制，提升 App 穩固性。
        * 優化地圖 Popup 提示文字，使其能根據 AI 分類狀態顯示不同內容。

詳細的開發歷程請參考 `開發現況總結.md`。