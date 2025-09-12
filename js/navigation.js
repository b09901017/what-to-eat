// js/navigation.js

import { state, DOMElements } from './state.js';
import { getUserLocation, applyFiltersAndRender } from './handlers.js';
import { destroyRadiusMap, clearWinnerMarker } from './map.js';
import { renderWheel } from './wheel.js';
import { renderDetailsPage } from './details.js';
import { hideCandidateList } from './candidate.js';
import * as Drawers from './drawers.js'; // *** 匯入新的抽屜模組 ***

/**
 * 設置當前活動頁面，並觸發進入該頁面時應執行的邏輯
 * @param {string} pageId - 目標頁面 ID
 * @private
 */
function _setActivePage(pageId) {
    state.currentPage = pageId;
    
    DOMElements.pages.forEach(page => {
        page.classList.toggle('active', page.id === pageId);
    });

    switch (pageId) {
        case 'map-page':
            getUserLocation();
            Drawers.hideMainContainer(); // 確保從分類頁返回時隱藏抽屜
            break;
        case 'categories-page':
            if (state.isEditingRadius) {
                state.isEditingRadius = false;
            }
             if (state.isHubExpanded) {
                state.isHubExpanded = false;
            }
            clearWinnerMarker();
            hideCandidateList();
            
            // *** 更新抽屜的顯示邏輯 ***
            Drawers.showMainContainer(); // 顯示主抽屜（分類）
            Drawers.hideRestaurants();   // 確保店家抽屜初始為隱藏
            
            applyFiltersAndRender();
            break;
        case 'wheel-page':
            Drawers.hideMainContainer(); // 離開分類頁時隱藏抽屜
            break;
        case 'details-page':
            renderDetailsPage();
            break;
    }
    
    if (pageId !== 'map-page') { 
        destroyRadiusMap(); 
    }
    if (pageId !== 'categories-page') { 
        DOMElements.filterPanel.classList.remove('visible'); 
        Drawers.hideMainContainer(); // 離開分類頁時確保抽屜隱藏
    }
}


/**
 * 導航到指定頁面
 * @param {string} pageId - 目標頁面 ID
 */
export function navigateTo(pageId) {
    if (state.currentPage === pageId) return;

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