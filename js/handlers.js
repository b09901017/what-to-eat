// js/handlers.js

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces, getPlaceDetails, geocodeLocation } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, initCategoriesMapAndRender, updateFilterUI, toggleRadiusEditMode, toggleHub, toggleSearchUI, renderSearchResults, clearSearchResults, showResult, renderCategories } from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, getEditorState, startRandomMarkerAnimation, showOnlyCandidateMarkers, fitBoundsToSearchRadius, updateMapMarkers, updateCategorizedMarkers } from './map.js';
import { hideCandidateList } from './candidate.js';


/**
 * ** [重構後] ** 核心搜尋流程，實現非同步分類
 */
async function performSearch(center, radius) {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        alert("無法獲取有效的地理位置，請重試。");
        return false;
    }
    showLoading(); // 顯示隨機載入文字

    try {
        // --- 第一步: 快速獲取未分類的店家 ---
        const unclassifiedPlaces = await findPlaces(center.lat, center.lng, radius);
        
        if (unclassifiedPlaces.length === 0) {
            hideLoading();
            alert("哎呀！這個範圍內似乎沒有找到任何餐廳，試著擴大搜索圈吧！");
            return false;
        }

        state.restaurantData = unclassifiedPlaces;
        state.isCategorizing = true;
        state.detailedRestaurantCache = {}; // 清空舊的詳情快取
        state.focusedCategories.clear();
        state.activeCategory = null;

        hideLoading();
        state.isInitialMapView = true;
        navigateTo('categories-page');
        applyFiltersAndRender(); // 第一次渲染，顯示「待分類」狀態

        // --- 第二步: 發送非同步請求進行 AI 分類 ---
        // 確保這個請求被正確地觸發
        console.log("正在發送請求進行 AI 分類...");
        categorizePlaces(unclassifiedPlaces)
            .then(handleCategorizationResult)
            .catch(error => {
                console.error("AI 分類失敗:", error);
                state.isCategorizing = false;
                // 你可以在此處更新 UI，告訴使用者分類失敗
                const listEl = DOMElements.categoryList;
                listEl.innerHTML = `<p class="empty-state-message">哎呀，AI 大廚罷工了！分類失敗... 😭</p>`;
            });
        
        return true;

    } catch (error) {
        DOMElements.loadingText.textContent = `搜尋失敗: ${error.message}，請稍後再試`;
        setTimeout(hideLoading, 3000);
        return false;
    }
}

/**
 * ** [新增] ** 處理非同步 AI 分類回傳結果的函式
 * @param {object} categorizedData - 後端回傳的已分類店家資料
 */
function handleCategorizationResult(categorizedData) {
    console.log("AI 分類完成！", categorizedData);
    state.isCategorizing = false;
    state.restaurantData = categorizedData;
    
    // 動態更新 UI
    renderCategories(categorizedData);
    updateCategorizedMarkers(categorizedData);
}

/**
 * 根據當前篩選條件過濾餐廳資料並重新渲染地圖和列表
 */
export function applyFiltersAndRender() {
    const { restaurantData } = state;
    
    if (Array.isArray(restaurantData)) { // AI 分類前
        initCategoriesMapAndRender(restaurantData);
        renderRestaurantPreviewList(null, []);
    } else { // AI 分類後
        // 當前版本的篩選邏輯在漸進式載入下作用有限，先不過濾
        const allRestaurants = Object.values(restaurantData).flat();
        const globallyFilteredNames = new Set(allRestaurants.map(r => r.name));
        
        const finalFilteredData = {};
        for (const category in restaurantData) {
            const categoryRestaurants = restaurantData[category].filter(r => globallyFilteredNames.has(r.name));
            if (categoryRestaurants.length > 0) {
                finalFilteredData[category] = categoryRestaurants;
            }
        }
        
        initCategoriesMapAndRender(finalFilteredData);
        renderRestaurantPreviewList(state.activeCategory, finalFilteredData);
    }
}

export async function handleConfirmRadius() {
    const editorState = getEditorState('radius');
    if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng }; 
    await performSearch(center, radius);
}

export async function handleConfirmRadiusReSearch() {
    const editorState = getEditorState('categories');
    if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng };
    await performSearch(center, radius);
}

export function handleCategoryInteraction(e) {
    if (state.isCategorizing) {
        const item = e.target.closest('.category-list-item');
        if (item) {
            item.classList.add('shake');
            setTimeout(() => item.classList.remove('shake'), 500);
        }
        return;
    }
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem) return;

    const category = categoryItem.dataset.category;
    state.activeCategory = state.activeCategory === category ? null : category;
    state.focusedCategories.clear();
    if(state.activeCategory) state.focusedCategories.add(state.activeCategory);
    applyFiltersAndRender();
}

/**
 * ** [修正後] ** 根據 place_id 顯示詳情頁
 * @param {string} placeId - Google Place ID
 */
async function showDetails(placeId) {
    if (!placeId) {
        alert("店家資料不完整，無法查看詳情。");
        return;
    }
    showLoading("正在取得店家獨家情報...");
    try {
        let details = state.detailedRestaurantCache[placeId];
        if (!details) {
            details = await getPlaceDetails(placeId);
            state.detailedRestaurantCache[placeId] = details;
        }

        if (details) {
            state.currentRestaurantDetails = details;
            navigateTo('details-page');
        } else {
            throw new Error("無法載入店家詳細資訊。");
        }
    } catch (error) {
        alert(error.message);
    } finally {
        hideLoading();
    }
}

export function handlePopupInteraction(e) {
    const btn = e.target.closest('.add-to-wheel-btn, .details-btn');
    if (!btn) return;
    const { name, placeId } = btn.dataset;
    if (btn.classList.contains('add-to-wheel-btn')) {
        const isAdded = toggleWheelItem(name);
        btn.classList.toggle('added', isAdded);
        btn.textContent = isAdded ? '✓' : '+';
    } else if (btn.classList.contains('details-btn')) {
        showDetails(placeId);
    }
}

export function handlePreviewCardInteraction(e) {
    const card = e.target.closest('.restaurant-preview-card');
    if (!card) return;
    const { name } = card.dataset;
    flyToMarker(name);
}

// --- 以下是其他未變動的函式，為確保完整性，全部提供 ---

export function handleUITestMode() {
    // 測試模式的邏輯暫時維持原樣
}

export function handleToggleHub() {
    state.isHubExpanded = !state.isHubExpanded;
    toggleHub(state.isHubExpanded);
    const eventListenerTarget = DOMElements.categoriesPage.querySelector('.map-ui-overlay');
    const closeHubHandler = (e) => {
        if (!DOMElements.floatingActionHub.contains(e.target)) {
            state.isHubExpanded = false;
            toggleHub(false);
            eventListenerTarget.removeEventListener('click', closeHubHandler, true);
        }
    };
    if (state.isHubExpanded) {
        setTimeout(() => {
            eventListenerTarget.addEventListener('click', closeHubHandler, true);
        }, 0);
    } else {
        eventListenerTarget.removeEventListener('click', closeHubHandler, true);
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
        state.userLocation = { lat: 24.975, lon: 121.538 };
        DOMElements.locationStatus.textContent = err.code === 1 ? '無法取得位置，請允許定位權限' : '無法取得位置，將使用預設地點';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

function handleRadiusChange(newRadius) {
    state.searchRadiusMeters = newRadius;
    updateRadiusLabel(newRadius);
}

export function handleRecenter() {
    recenterRadiusMap('radius', state.userLocation);
}

export function handleReturnToCenter() {
    fitBoundsToSearchRadius();
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
    alert("篩選功能將在您查看店家詳情時生效。");
}

export function handleResetView() {
    if (state.focusedCategories.size > 0) {
        state.focusedCategories.clear();
        state.activeCategory = null;
        applyFiltersAndRender();
    }
}

export function handleToggleRadiusEdit() {
    state.isEditingRadius = !state.isEditingRadius;
    toggleRadiusEditMode(state.isEditingRadius, handleRadiusChange);
}

export function toggleWheelItem(name, shouldAdd = true) {
    let isAdded;
    if (state.wheelItems.has(name)) {
        state.wheelItems.delete(name);
        isAdded = false;
    } else if (shouldAdd) {
        if (state.wheelItems.size >= 8) {
            alert('候選清單最多8個選項喔！');
            return state.wheelItems.has(name);
        }
        state.wheelItems.add(name);
        isAdded = true;
    }
    updateWheelCount();
    // 僅在分類完成後才重繪地圖，避免不必要的刷新
    if (!state.isCategorizing) {
        applyFiltersAndRender();
    }
    return isAdded;
}

export async function handleRandomDecisionOnMap() {
    if (state.isDecidingOnMap || state.wheelItems.size < 2) return;
    state.isDecidingOnMap = true;
    hideCandidateList();
    const candidates = [...state.wheelItems];
    // 確保地圖上顯示的是最新狀態
    updateMapMarkers(state.restaurantData, state.userLocation, state.searchCenter, new Set(), null);
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
    if (!query) { clearSearchResults(); return; }
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