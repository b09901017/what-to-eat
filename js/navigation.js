// js/navigation.js

import { state, DOMElements } from './state.js';
import { getUserLocation, applyFiltersAndRender } from './handlers.js';
import { destroyRadiusMap, clearWinnerMarker } from './map.js';
import { renderWheel } from './wheel.js';
import { renderDetailsPage } from './details.js';
import { hideCandidateList } from './candidate.js';
import { show as showCategoryDrawer } from './categoryDrawer.js';
import { hide as hideRestaurantDrawer } from './restaurantDrawer.js';

/**
 * 設置當前活動頁面，並觸發進入該頁面時應執行的邏輯
 * @param {string} pageId - 目標頁面 ID
 * @private
 */
function _setActivePage(pageId) {
    state.currentPage = pageId;
    
    // 切換頁面 class
    DOMElements.pages.forEach(page => {
        page.classList.toggle('active', page.id === pageId);
    });

    // --- 核心修改：將原本在 ui.js 的邏輯移至此處 ---
    // 根據新頁面的 ID，執行對應的初始化或渲染函式
    switch (pageId) {
        case 'map-page':
            getUserLocation(); // 進入範圍選擇頁時，開始獲取用戶位置
            break;
        case 'categories-page':
            // 確保從編輯模式返回時，UI 狀態被重置
            if (state.isEditingRadius) {
                state.isEditingRadius = false;
                // 注意：toggleRadiusEditMode 在 ui.js 中，這裡不直接呼叫
            }
             if (state.isHubExpanded) {
                state.isHubExpanded = false;
                // 注意：toggleHub 在 ui.js 中，這裡不直接呼叫
            }
            clearWinnerMarker(); // 清除地圖上可能存在的獲勝者標記
            hideCandidateList(); // 隱藏候選清單
            hideRestaurantDrawer(); // 隱藏店家抽屜
            showCategoryDrawer(); // 顯示分類抽屜
            applyFiltersAndRender(); // 根據當前篩選條件渲染地圖
            break;
        case 'wheel-page':
            renderWheel(); // 渲染命運羅盤
            break;
        case 'details-page':
            renderDetailsPage(); // 渲染店家詳情
            break;
    }
    
    // --- 清理邏輯 ---
    // 如果離開了範圍選擇頁，銷毀對應的地圖實例以釋放資源
    if (pageId !== 'map-page') { 
        destroyRadiusMap(); 
    }
    // 如果離開了美食地圖頁，隱藏篩選面板
    if (pageId !== 'categories-page') { 
        DOMElements.filterPanel.classList.remove('visible'); 
    }
}


/**
 * 導航到指定頁面
 * @param {string} pageId - 目標頁面 ID
 */
export function navigateTo(pageId) {
    if (state.currentPage === pageId) return;

    // 將當前頁面推入堆疊，以便之後可以返回
    state.navigationStack.push(state.currentPage);
    _setActivePage(pageId);
}

/**
 * 返回到堆疊中的上一個頁面
 */
export function navigateBack() {
    const previousPage = state.navigationStack.pop();
    if (previousPage) {
        _setActivePage(previousPage);
    }
}