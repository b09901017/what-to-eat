// 處理 API 請求

const API_URL = 'http://127.0.0.1:5000/api/search';

export async function fetchRestaurants(lat, lon, radius) {
    try {
        const response = await fetch(API_URL, {
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
        console.error("搜尋餐廳失敗:", error);
        // 向上拋出錯誤，讓呼叫者可以處理 UI
        throw error;
    }
}