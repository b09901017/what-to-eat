// js/handlers.js

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces, geocodeLocation } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, initCategoriesMapAndRender, updateFilterUI, toggleRadiusEditMode, toggleHub, toggleSearchUI, renderSearchResults, clearSearchResults, showResult } from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, getEditorState, startRandomMarkerAnimation, showOnlyCandidateMarkers, flyToCoords } from './map.js';
import { hideCandidateList } from './candidate.js';


/**
 * 統一管理頁面覆蓋層的點擊事件監聽器，用於實現「點擊外部關閉」功能
 * @param {boolean} shouldListen - 是否應該開始監聽
 * @param {function} handler - 點擊時要執行的處理函式
 */
function managePageOverlayClickListener(shouldListen, handler) {
    const overlay = DOMElements.categoriesPage.querySelector('.map-ui-overlay');
    
    // 移除舊的監聽器以防重複綁定
    const existingHandler = window._pageOverlayClickHandler;
    if (existingHandler) {
        overlay.removeEventListener('click', existingHandler);
    }

    if (shouldListen) {
        window._pageOverlayClickHandler = handler; // 將當前處理函式存到 window，以便後續移除
        // 使用 setTimeout 確保當前點擊事件不會立即觸發監聽器
        setTimeout(() => overlay.addEventListener('click', handler), 0);
        overlay.classList.add('click-interceptor-active');
    } else {
        window._pageOverlayClickHandler = null;
        overlay.classList.remove('click-interceptor-active');
    }
}


/**
 * 處理懸浮按鈕的展開與收合，並動態綁定外部點擊事件。
 */
export function handleToggleHub() {
    state.isHubExpanded = !state.isHubExpanded;
    toggleHub(state.isHubExpanded);

    const closeHubHandler = (e) => {
        if (!DOMElements.floatingActionHub.contains(e.target)) {
            state.isHubExpanded = false;
            toggleHub(false);
            managePageOverlayClickListener(false); // 關閉 Hub 時，移除監聽
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
    renderRestaurantPreviewList(state.activeCategory, finalFilteredData);
}

/**
 * 獲取使用者地理位置
 */
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

/**
 * 當半徑在地圖上被改變時的回呼函式
 * @param {number} newRadius - 新的半徑（公尺）
 */
function handleRadiusChange(newRadius) {
    state.searchRadiusMeters = newRadius;
    updateRadiusLabel(newRadius);
}

/**
 * 執行搜尋流程（呼叫 API -> 分類 -> 更新狀態）
 * @param {object} center - 中心點經緯度 {lat, lng}
 * @param {number} radius - 半徑（公尺）
 * @returns {Promise<boolean>} - 回傳搜尋是否成功並找到店家
 */
async function performSearch(center, radius) {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        alert("無法獲取有效的地理位置，請重試。");
        return false;
    }
    showLoading("正在大海撈針，尋找美食...");
    try {
        const rawRestaurantData = await findPlaces(center.lat, center.lng, radius);
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

/**
 * 處理在初始地圖頁點擊「確認範圍」的事件
 */
export async function handleConfirmRadius() {
    const editorState = getEditorState('radius');
    if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng }; 
    const success = await performSearch(center, radius);
    if (success) { navigateTo('categories-page'); applyFiltersAndRender(); }
}

/**
 * 處理在美食地圖頁的編輯模式下點擊「重新搜尋」的事件
 */
export async function handleConfirmRadiusReSearch() {
    const editorState = getEditorState('categories');
     if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng };
    const success = await performSearch(center, radius);
    if (success) { toggleRadiusEditMode(false, handleRadiusChange); applyFiltersAndRender(); }
}

/**
 * 處理「回到中心」按鈕點擊事件
 */
export function handleRecenter() {
    recenterRadiusMap('radius', state.userLocation);
}

/**
 * 處理「回到探索中心」按鈕點擊事件
 */
export function handleReturnToCenter() {
    if (state.searchCenter) {
        flyToCoords([[state.searchCenter.lat, state.searchCenter.lon]]);
    }
}

/**
 * 開關篩選面板
 */
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


/**
 * 處理篩選條件變更的事件
 * @param {Event} e - 變更或點擊事件
 */
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

/**
 * 處理點擊美食類別的互動邏輯
 * @param {Event} e - 點擊事件
 */
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
    
    // 定義點擊外部關閉店家列表的處理邏輯
    const closeDrawerHandler = (event) => {
        // 如果點擊的不是抽屜、Hub或地圖標記，就重設視圖
        if (!event.target.closest('.map-bottom-drawer') && !event.target.closest('.floating-action-hub') && !event.target.closest('.leaflet-marker-icon')) {
            handleResetView();
        }
    };

    // 如果有 activeCategory（即店家列表是展開的），就開始監聽
    managePageOverlayClickListener(!!state.activeCategory, closeDrawerHandler);
    
    applyFiltersAndRender();
}

/**
 * 處理點擊「顯示所有店家」按鈕的事件
 */
export function handleResetView() {
    // 移除監聽器，因為店家列表要被收起來了
    managePageOverlayClickListener(false);

    if (state.focusedCategories.size > 0) {
        state.focusedCategories.clear();
        state.activeCategory = null;
        applyFiltersAndRender();
    }
}

/**
 * 開關半徑編輯模式
 */
export function handleToggleRadiusEdit() {
    // 進入編輯模式前，確保外部點擊監聽器是關閉的
    managePageOverlayClickListener(false);
    state.isEditingRadius = !state.isEditingRadius;
    toggleRadiusEditMode(state.isEditingRadius, handleRadiusChange);
}

/**
 * 處理在地圖 popup 上的互動（加入候選、查看詳情）
 * @param {Event} e - 點擊事件
 */
export function handlePopupInteraction(e) {
    const btn = e.target.closest('.add-to-wheel-btn, .details-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.classList.contains('add-to-wheel-btn')) {
        const isAdded = toggleWheelItem(name);
        btn.classList.toggle('added', isAdded);
        btn.textContent = isAdded ? '✓' : '+';
    } else if (btn.classList.contains('details-btn')) {
        showDetails(name);
    }
}

/**
 * 新增或移除候選清單中的項目，是個核心共用邏輯
 * @param {string} name - 餐廳名稱
 * @param {boolean} [shouldAdd=true] - 是否執行新增操作
 * @returns {boolean} - 回傳該項目最終是否存在於候選清單中
 */
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
    applyFiltersAndRender(); // 強制重繪地圖標記來更新 popup
    return isAdded;
}

/**
 * 導航至詳情頁
 * @param {string} name - 餐廳名稱
 */
function showDetails(name) {
    const restaurant = Object.values(state.restaurantData).flat().find(r => r.name === name);
    if (restaurant) {
        state.currentRestaurantDetails = restaurant;
        navigateTo('details-page');
    }
}

/**
 * 處理點擊店家預覽卡片的事件
 * @param {Event} e - 點擊事件
 */
export function handlePreviewCardInteraction(e) {
    const card = e.target.closest('.restaurant-preview-card');
    if (!card) return;
    const name = card.dataset.name;
    flyToMarker(name);
}

/**
 * 處理在地圖上隨機決定的按鈕點擊事件
 */
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


// --- Location Search Handlers ---
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
    }, 300); // Debounce delay
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