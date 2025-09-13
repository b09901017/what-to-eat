// js/config.js

/**
 * 後端 API 的基礎網址。
 * 在本地開發時，請使用第一個 'http://127.0.0.1:5000'。
 * 當您將後端部署到 Render 後，請將 Render 提供的網址填入下方的變數，
 * 並註解掉本地開發的網址，然後重新部署或刷新您的前端。
 */

// --- 開發環境 ---
export const API_BASE_URL = 'http://127.0.0.1:5000';

// --- 生產環境 (部署後使用) ---
// export const API_BASE_URL = 'https://what-to-eat-93pq.onrender.com'; // <-- 部署後請取消註解並替換成您的 Render 網址