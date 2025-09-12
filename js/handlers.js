// js/handlers.js

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces, geocodeLocation } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, initCategoriesMapAndRender, updateFilterUI, toggleRadiusEditMode, toggleHub, toggleSearchUI, renderSearchResults, clearSearchResults, showResult } from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, getEditorState, startRandomMarkerAnimation, showOnlyCandidateMarkers, flyToCoords } from './map.js';
import { hideCandidateList } from './candidate.js';
import * as Drawers from './drawers.js'; // *** 匯入新的抽屜模組 ***
import { addCandidate, removeCandidate, hasCandidate } from './store.js';


// --- UI 測試模式處理函式 ---
export async function handleUITestMode() {
    showLoading("載入測試資料...");
    try {
        const response = await fetch('./fake_data.json');
        if (!response.ok) {
            throw new Error(`無法讀取 fake_data.json: ${response.statusText}`);
        }
        const fakeData = await response.json();
        
        state.restaurantData = fakeData;
        state.userLocation = { lat: 24.975, lon: 121.538 };
        state.searchCenter = { lat: 24.975, lon: 121.538 };
        state.focusedCategories.clear();
        state.activeCategory = null;

        hideLoading();
        navigateTo('categories-page');

    } catch (error) {
        console.error("UI 測試模式失敗:", error);
        DOMElements.loadingText.textContent = `載入失敗: ${error.message}`;
        setTimeout(hideLoading, 3000);
    }
}

function managePageOverlayClickListener(shouldListen, handler) {
    const overlay = DOMElements.categoriesPage.querySelector('.map-ui-overlay');
    const existingHandler = window._pageOverlayClickHandler;
    if (existingHandler) {
        overlay.removeEventListener('click', existingHandler);
    }

    if (shouldListen) {
        window._pageOverlayClickHandler = handler;
        setTimeout(() => overlay.addEventListener('click', handler), 0);
        overlay.classList.add('click-interceptor-active');
    } else {
        window._pageOverlayClickHandler = null;
        overlay.classList.remove('click-interceptor-active');
    }
}

export function handleToggleHub() {
    state.isHubExpanded = !state.isHubExpanded;
    toggleHub(state.isHubExpanded);

    const closeHubHandler = (e) => {
        if (!DOMElements.floatingActionHub.contains(e.target)) {
            state.isHubExpanded = false;
            toggleHub(false);
            managePageOverlayClickListener(false);
        }
    };
    
    managePageOverlayClickListener(state.isHubExpanded, closeHubHandler);
}


/**
 * 根據當前篩選條件過濾餐廳資料並重新渲染地圖和列表
 */
export function applyFiltersAndRender() {
    const { restaurantData, filters } = state;
    const allRestaurants = Object.values(restaurantData).flat();
    
    const globallyFilteredRestaurants = allRestaurants.filter(r => {
        const isOpen = !filters.openNow || r.hours === "營業中";
        const isPriceMatch = filters.priceLevel === 0 || r.price_level === filters.priceLevel;
        const isRatingMatch = filters.rating === 0 || r.rating >= filters.rating;
        return isOpen && isPriceMatch && isRatingMatch;
    });
    const globallyFilteredNames = new Set(globallyFilteredRestaurants.map(r => r.name));
    
    const finalFilteredData = {};
    for (const category in restaurantData) {
        const categoryRestaurants = restaurantData[category].filter(r => globallyFilteredNames.has(r.name));
        if (categoryRestaurants.length > 0) {
            finalFilteredData[category] = categoryRestaurants;
        }
    }
    
    initCategoriesMapAndRender(finalFilteredData);

    // *** 更新抽屜的顯示邏輯 ***
    if (state.activeCategory && finalFilteredData[state.activeCategory]) {
        Drawers.showRestaurants(finalFilteredData[state.activeCategory]);
    } else {
        Drawers.hideRestaurants();
    }
}

export function getUserLocation() {
    const onSuccess = (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        DOMElements.locationStatus.textContent = '拖曳圓心或手把調整範圍';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };
    const onError = (err) => {
        state.userLocation = { lat: 24.975, lon: 121.538 }; // 預設位置
        if (err.code === 1) { 
            DOMElements.locationStatus.textContent = '無法取得位置，請允許定位權限';
        } else {
            DOMElements.locationStatus.textContent = '無法取得位置，將使用預設地點';
        }
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
}

function handleRadiusChange(newRadius) {
    state.searchRadiusMeters = newRadius;
    updateRadiusLabel(newRadius);
}

async function performSearch(center, radius) {
    if (!center || typeof center.lat !== 'number' || typeof (center.lng ?? center.lon) !== 'number') {
        alert("無法獲取有效的地理位置，請重試。");
        return false;
    }
    const lon = center.lng ?? center.lon;

    showLoading("正在大海撈針，尋找美食...");
    try {
        const rawRestaurantData = await findPlaces(center.lat, lon, radius);
        const restaurantCount = Object.keys(rawRestaurantData).length;
        if (restaurantCount === 0) {
            hideLoading();
            alert("哎呀！這個範圍內似乎沒有找到任何餐廳，試著擴大搜索圈吧！");
            if (state.currentPage === 'categories-page') { toggleRadiusEditMode(false, handleRadiusChange); }
            return false;
        }
        showLoading(`找到了 ${restaurantCount} 家潛力店家，正請 AI 大廚協助分類...`);
        const categorizedData = await categorizePlaces(rawRestaurantData);
        state.restaurantData = categorizedData;
        state.focusedCategories.clear();
        state.activeCategory = null;
        hideLoading();
        return true;
    } catch (error) {
        DOMElements.loadingText.textContent = `搜尋失敗: ${error.message}，請稍後再試`;
        setTimeout(hideLoading, 3000);
        return false;
    }
}

export async function handleConfirmRadius() {
    const editorState = getEditorState('radius');
    if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng }; 
    const success = await performSearch(center, radius);
    if (success) { 
        navigateTo('categories-page'); 
    }
}

export async function handleConfirmRadiusReSearch() {
    const editorState = getEditorState('categories');
     if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng };
    const success = await performSearch(center, radius);
    if (success) { 
        toggleRadiusEditMode(false, handleRadiusChange); 
    }
}

export function handleRecenter() {
    recenterRadiusMap('radius', state.userLocation);
}

export function handleReturnToCenter() {
    if (state.searchCenter) {
        flyToCoords([[state.searchCenter.lat, state.searchCenter.lon]]);
    }
}

export function toggleFilterPanel() {
    const isVisible = DOMElements.filterPanel.classList.toggle('visible');
    const eventListenerTarget = DOMElements.categoriesPage.querySelector('.map-ui-overlay'); 
    
    const handleClickToCloseFilter = (e) => {
        if (!DOMElements.filterPanel.contains(e.target) && !e.target.closest('.floating-action-hub')) {
            DOMElements.filterPanel.classList.remove('visible');
            eventListenerTarget.removeEventListener('click', handleClickToCloseFilter);
        }
    };

    if (isVisible) { 
        setTimeout(() => eventListenerTarget.addEventListener('click', handleClickToCloseFilter), 0);
    } else { 
        eventListenerTarget.removeEventListener('click', handleClickToCloseFilter); 
    }
}

export function handleFilterChange(e) {
    e.stopPropagation(); 
    const target = e.target;
    const filterType = target.dataset.filter || target.closest('[data-filter]').dataset.filter;
    if (!filterType) return;
    if (filterType === 'openNow') { state.filters.openNow = target.checked; } 
    else {
        const button = target.closest('button');
        if (!button) return;
        state.filters[filterType] = Number(button.dataset.value);
    }
    updateFilterUI();
    applyFiltersAndRender();
}

export function handleCategoryInteraction(e) {
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem) return;
    const category = categoryItem.dataset.category;

    if (state.focusedCategories.has(category)) {
        state.focusedCategories.delete(category);
        if (state.activeCategory === category) {
            state.activeCategory = null;
        }
    } else {
        state.focusedCategories.add(category);
        state.activeCategory = category;
    }
    
    applyFiltersAndRender();
}

export function handleResetView() {
    if (state.focusedCategories.size > 0) {
        state.focusedCategories.clear();
        state.activeCategory = null;
        applyFiltersAndRender();
    }
}

export function handleToggleRadiusEdit() {
    managePageOverlayClickListener(false);
    state.isEditingRadius = !state.isEditingRadius;
    toggleRadiusEditMode(state.isEditingRadius, handleRadiusChange);
}

export function handlePopupInteraction(e) {
    const btn = e.target.closest('.add-to-wheel-btn, .details-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.classList.contains('add-to-wheel-btn')) {
        const isCurrentlyAdded = hasCandidate(name);
        if (isCurrentlyAdded) {
            removeCandidate(name);
        } else {
            addCandidate(name);
        }
    } else if (btn.classList.contains('details-btn')) {
        showDetails(name);
    }
}

function showDetails(name) {
    const restaurant = Object.values(state.restaurantData).flat().find(r => r.name === name);
    if (restaurant) {
        state.currentRestaurantDetails = restaurant;
        navigateTo('details-page');
    }
}

export function handlePreviewCardInteraction(e) {
    const card = e.target.closest('.restaurant-preview-card');
    if (!card) return;
    const name = card.dataset.name;
    flyToMarker(name);
}

export async function handleRandomDecisionOnMap() {
    if (state.isDecidingOnMap || state.wheelItems.size < 2) return;

    state.isDecidingOnMap = true;
    hideCandidateList();
    
    const candidates = [...state.wheelItems];
    showOnlyCandidateMarkers(candidates);

    try {
        const winner = await startRandomMarkerAnimation(candidates);
        state.lastWinner = winner;
        setTimeout(() => {
            showResult(winner);
            state.isDecidingOnMap = false;
        }, 500);
    } catch (error) {
        console.error("地圖決定動畫出錯:", error);
        state.isDecidingOnMap = false;
        applyFiltersAndRender();
    }
}

export function handleSearchIconClick() {
    state.isSearchActive = !state.isSearchActive;
    toggleSearchUI(state.isSearchActive);
}

export function handleSearchInput(e) {
    const query = e.target.value;
    const mapKey = e.target.closest('.location-search-container').dataset.mapKey;

    clearTimeout(state.searchTimeoutId);
    if (!query) {
        clearSearchResults();
        return;
    }

    state.searchTimeoutId = setTimeout(async () => {
        DOMElements.locationSearchResults.innerHTML = '<li class="loading">搜尋中...</li>';
        DOMElements.locationSearchResults.classList.add('visible');
        const results = await geocodeLocation(query);
        renderSearchResults(results, mapKey);
    }, 300);
}

export function handleSearchResultClick(e) {
    const item = e.target.closest('li');
    if (!item || item.classList.contains('loading')) return;

    const { lat, lon, mapKey } = item.dataset;
    const newLocation = { lat: parseFloat(lat), lon: parseFloat(lon) };
    
    recenterRadiusMap(mapKey, newLocation);

    state.isSearchActive = false;
    toggleSearchUI(false);
}