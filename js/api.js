// js/api.js

import { API_BASE_URL } from './config.js';

export async function findPlaces(lat, lon, radius) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/find_places`, {
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

export async function categorizePlaces(places) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/categorize_places`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(places)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("非同步分類餐廳失敗:", error);
        throw error;
    }
}

export async function getPlaceDetails(placeId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/place_details?place_id=${encodeURIComponent(placeId)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("獲取店家詳情失敗:", error);
        throw error;
    }
}

export async function geocodeLocation(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/geocode?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("地理編碼失敗:", error);
        throw error;
    }
}