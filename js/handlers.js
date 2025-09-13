// js/handlers.js

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces, getPlaceDetails, geocodeLocation } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, initCategoriesMapAndRender, updateFilterUI, toggleRadiusEditMode, toggleHub, toggleSearchUI, renderSearchResults, clearSearchResults, showResult, renderCategories, updateCategoryStyles } from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, getEditorState, startRandomMarkerAnimation, showOnlyCandidateMarkers, fitBoundsToSearchRadius, updateMapMarkers, updateCategorizedMarkers, updateOpenPopups } from './map.js';
import { hideCandidateList } from './candidate.js';

async function performSearch(center, radius, isRetry = false) {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        alert("無法獲取有效的地理位置，請重試。");
        return false;
    }
    showLoading();

    try {
        let unclassifiedPlaces;
        if (isRetry && Array.isArray(state.restaurantData) && state.restaurantData.length > 0) {
            unclassifiedPlaces = state.restaurantData;
        } else {
            unclassifiedPlaces = await findPlaces(center.lat, center.lng, radius);
            if (unclassifiedPlaces.length === 0) {
                hideLoading();
                alert("哎呀！這個範圍內似乎沒有找到任何餐廳，試著擴大搜索圈吧！");
                return false;
            }
        }
        
        state.restaurantData = unclassifiedPlaces;
        state.isCategorizing = true;
        state.detailedRestaurantCache = {};
        state.focusedCategories.clear();
        state.activeCategory = null;

        if (!isRetry) {
            hideLoading();
            state.isInitialMapView = true;
            navigateTo('categories-page');
        }
        applyFiltersAndRender();

        console.log("正在發送請求進行 AI 分類...");
        categorizePlaces(unclassifiedPlaces)
            .then(handleCategorizationResult)
            .catch(error => {
                console.error("AI 分類失敗:", error);
                state.isCategorizing = false;
                renderCategories(null);
            });
        
        return true;

    } catch (error) {
        DOMElements.loadingText.textContent = `搜尋失敗: ${error.message}，請稍後再試`;
        setTimeout(hideLoading, 3000);
        return false;
    }
}

function handleCategorizationResult(categorizedData) {
    console.log("AI 分類完成！", categorizedData);
    state.isCategorizing = false;
    state.restaurantData = categorizedData;
    
    // 分類完成後，觸發一次完整的渲染
    applyFiltersAndRender();
    
    // 更新地圖標記和已打開的 Popup
    updateCategorizedMarkers(categorizedData);
    updateOpenPopups();
}

export function handleRetryCategorization(e) {
    // ** [修改] ** 優化重試機制
    const retryBtn = e.target.closest('.retry-btn');
    if (retryBtn) {
        retryBtn.disabled = true; // 立刻禁用按鈕
        retryBtn.textContent = '重試中...';
    }

    if (Array.isArray(state.restaurantData) && state.restaurantData.length > 0) {
        console.log("正在重試 AI 分類...");
        state.isCategorizing = true;
        renderCategories(null, true); // 立刻重新渲染為 "AI大廚" 畫面
        
        categorizePlaces(state.restaurantData)
            .then(handleCategorizationResult)
            .catch(error => {
                console.error("AI 分類重試失敗:", error);
                state.isCategorizing = false;
                renderCategories(null); // 再次顯示錯誤訊息和重試按鈕
            });
    }
}

// ** [新增] ** 核心篩選邏輯
function getFilteredRestaurants() {
    const { restaurantData, filters } = state;
    
    // 如果沒有任何資料或篩選器關閉，則返回原始資料
    if (!restaurantData || !filters.openNow) {
        return restaurantData;
    }

    // 當資料是未分類的陣列時
    if (Array.isArray(restaurantData)) {
        return restaurantData.filter(place => place.is_open);
    } 
    // 當資料是已分類的物件時
    else {
        const filteredCategorizedData = {};
        for (const category in restaurantData) {
            const openPlaces = restaurantData[category].filter(place => place.is_open);
            // 只保留那些篩選後仍然有店家的類別
            if (openPlaces.length > 0) {
                filteredCategorizedData[category] = openPlaces;
            }
        }
        return filteredCategorizedData;
    }
}


export function applyFiltersAndRender() {
    // ** [修改] ** 在所有渲染之前，先獲取經過篩選的資料
    const filteredData = getFilteredRestaurants();

    initCategoriesMapAndRender(filteredData); 

    // ** [修改] ** 使用篩選後的資料來渲染預覽列表
    if (typeof filteredData === 'object' && !Array.isArray(filteredData)) {
        renderRestaurantPreviewList(state.activeCategory, filteredData);
    } else {
        renderRestaurantPreviewList(null, []);
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
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem || state.isCategorizing) {
        if (state.isCategorizing && categoryItem) {
            categoryItem.classList.add('shake');
            setTimeout(() => categoryItem.classList.remove('shake'), 500);
        }
        return;
    }

    const category = categoryItem.dataset.category;
    state.activeCategory = state.activeCategory === category ? null : category;
    
    state.focusedCategories.clear();
    if (state.activeCategory) {
        state.focusedCategories.add(state.activeCategory);
    }
    
    // ** [修改] ** 維持呼叫 applyFiltersAndRender，但其內部的 renderCategories 已被優化，不會閃爍
    applyFiltersAndRender();
}

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

export function handleUITestMode() {
    // This function can be implemented later if needed
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
        setTimeout(() => eventListenerTarget.addEventListener('click', closeHubHandler, true), 0);
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

    if (filterType === 'openNow') { 
        state.filters.openNow = target.checked; 
    } else {
        const button = target.closest('button');
        if (!button) return;
        state.filters[filterType] = Number(button.dataset.value);
    }
    
    updateFilterUI();

    // ** [修改] ** 移除 alert，改為直接觸發重新渲染
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
    
    // ** [修改] ** 移除 applyFiltersAndRender()，解決點擊 "+" 時的閃爍問題
    
    return isAdded;
}

export async function handleRandomDecisionOnMap() {
    if (state.isDecidingOnMap || state.wheelItems.size < 2) return;
    state.isDecidingOnMap = true;
    hideCandidateList();
    const candidates = [...state.wheelItems];
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