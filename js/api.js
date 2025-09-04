// 處理 API 請求

/**
 * 根據經緯度和半徑搜尋附近的餐廳
 * @param {number} lat - 緯度
 * @param {number} lon - 經度
 * @param {number} radius - 搜尋半徑（公尺）
 * @returns {Promise<Object>} - 包含未分類餐廳詳細資訊的物件
 */
export async function findPlaces(lat, lon, radius) {
    try {
        const response = await fetch('/api/find_places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon, radius })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error("尋找餐廳失敗:", error);
        throw error;
    }
}

/**
 * 將餐廳資料傳送給後端進行 AI 分類
 * @param {Object} restaurants - 從 findPlaces 獲取的餐廳資料物件
 * @returns {Promise<Object>} - 包含已分類餐廳資訊的物件
 */
export async function categorizePlaces(restaurants) {
    try {
        const response = await fetch('/api/categorize_places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restaurants)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error("分類餐廳失敗:", error);
        throw error;
    }
}