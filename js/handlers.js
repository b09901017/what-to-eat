// js/handlers.js

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces, geocodeLocation } from './api.js';
import { 
    showLoading, 
    hideLoading, 
    updateRadiusLabel, 
    renderRestaurantPreviewList, 
    updateWheelCount, 
    initCategoriesMapAndRender, 
    updateFilterUI, 
    toggleRadiusEditMode, 
    toggleHub, 
    toggleSearchUI, 
    renderSearchResults, 
    clearSearchResults, 
    showResult,
    showRestaurantDrawer,
    hideRestaurantDrawer,
    showCategoryDrawer
} from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, getEditorState, startRandomMarkerAnimation, showOnlyCandidateMarkers, flyToCoords } from './map.js';
import { hideCandidateList } from './candidate.js';

/**
 * 新增：載入假資料並進入測試模式
 */
export async function handleUITestMode() {
    try {
        showLoading("載入測試資料中...");
        
        // 載入假資料
        const response = await fetch('./fake-data.json');
        if (!response.ok) {
            throw new Error('無法載入測試資料');
        }
        const fakeData = await response.json();
        
        // 設定測試模式狀態
        state.isTestMode = true;
        state.restaurantData = fakeData;
        state.userLocation = { lat: 25.0330, lon: 121.5654 }; // 台北市中心
        state.searchCenter = { lat: 25.0330, lon: 121.5654 };
        state.searchRadiusMeters = 800;
        
        // 重設篩選和焦點狀態
        state.focusedCategories.clear();
        state.activeCategory = null;
        state.filters = {
            openNow: true,
            priceLevel: 0,
            rating: 0,
        };
        
        hideLoading();
        
        // 直接進入美食地圖頁面
        navigateTo('categories-page');
        applyFiltersAndRender();
        
    } catch (error) {
        console.error('載入測試資料失敗:', error);
        hideLoading();
        alert('載入測試資料失敗，請確認 fake-data.json 檔案存在');
    }
}

/**
 * 處理懸浮按鈕的展開與收合，並動態綁定外部點擊事件。
 */
export function handleToggleHub() {
    state.isHubExpanded = !state.isHubExpanded;
    toggleHub(state.isHubExpanded);

    // Click-away to close logic
    const eventListenerTarget = DOMElements.categoriesPage.querySelector('.map-ui-overlay');
    const closeHubHandler = (e) => {
        if (!DOMElements.floatingActionHub.contains(e.target)) {
            state.isHubExpanded = false;
            toggleHub(false);
            eventListenerTarget.removeEventListener('click', closeHubHandler);
        }
    };

    if (state.isHubExpanded) {
        // Use a timeout to prevent the same click event that opened the hub from closing it immediately
        setTimeout(() => {
            eventListenerTarget.addEventListener('click', closeHubHandler);
        }, 0);
    } else {
        eventListenerTarget.removeEventListener('click', closeHubHandler);
    }
}


/**
 * 根據當前篩選條件過濾餐廳資料並重新渲染地圖和列表
 */
export function applyFiltersAndRender() {
    const { restaurantData, filters } = state;
    const allRestaurants = Object.values(restaurantData).flat();
    
    // 根據全局篩選器過濾出符合條件的餐廳名稱
    const globallyFilteredRestaurants = allRestaurants.filter(r => {
        const isOpen = !filters.openNow || r.hours === "營業中";
        const isPriceMatch = filters.priceLevel === 0 || r.price_level === filters.priceLevel;
        const isRatingMatch = filters.rating === 0 || r.rating >= filters.rating;
        return isOpen && isPriceMatch && isRatingMatch;
    });
    const globallyFilteredNames = new Set(globallyFilteredRestaurants.map(r => r.name));
    
    // 建立一個只包含符合條件餐廳的新資料結構
    const finalFilteredData = {};
    for (const category in restaurantData) {
        const categoryRestaurants = restaurantData[category].filter(r => globallyFilteredNames.has(r.name));
        if (categoryRestaurants.length > 0) {
            finalFilteredData[category] = categoryRestaurants;
        }
    }
    
    initCategoriesMapAndRender(finalFilteredData);
    
    // *** 新增：如果店家抽屜正開啟且有活動類別，渲染店家預覽 ***
    if (state.isRestaurantDrawerOpen && state.activeCategory) {
        renderRestaurantPreviewList(state.activeCategory, finalFilteredData);
    }
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
 * *** 新增：處理「回到探索中心」按鈕點擊事件 ***
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
 * *** 重構：處理點擊美食類別的互動邏輯（雙抽屜系統）***
 * @param {Event} e - 點擊事件
 */
export function handleCategoryInteraction(e) {
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem) return;
    const category = categoryItem.dataset.category;

    // 更新選中狀態
    if (state.focusedCategories.has(category)) {
        state.focusedCategories.delete(category);
        if (state.activeCategory === category) {
            state.activeCategory = null;
            // 隱藏店家抽屜
            hideRestaurantDrawer();
        }
    } else {
        state.focusedCategories.add(category);
        state.activeCategory = category;
        // 顯示店家抽屜並載入店家列表
        showRestaurantDrawer(category);
    }
    
    applyFiltersAndRender();
}

/**
 * 處理點擊「重設檢視」按鈕的事件
 */
export function handleResetView() {
    if (state.focusedCategories.size > 0) {
        state.focusedCategories.clear();
        state.activeCategory = null;
        hideRestaurantDrawer(); // 隱藏店家抽屜
        applyFiltersAndRender();
    }
}

/**
 * 開關半徑編輯模式
 */
export function handleToggleRadiusEdit() {
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

// === 新增：雙抽屜系統的拖曳處理邏輯 ===

/**
 * 處理店家抽屜拖曳開始事件
 * @param {Event} e - 觸摸或滑鼠事件
 */
export function handleRestaurantDrawerDragStart(e) {
    if (!state.isRestaurantDrawerOpen) return;
    
    state.restaurantDrawerDragState.isDragging = true;
    state.restaurantDrawerDragState.startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    state.restaurantDrawerDragState.currentY = state.restaurantDrawerDragState.startY;
    state.restaurantDrawerDragState.startTransform = 0; // 抽屜開啟時的初始位置
    
    // 禁用過渡效果以便流暢拖曳
    DOMElements.restaurantDrawer.style.transition = 'none';
    
    // 綁定移動和結束事件
    const moveEvent = e.type === 'touchstart' ? 'touchmove' : 'mousemove';
    const endEvent = e.type === 'touchstart' ? 'touchend' : 'mouseup';
    
    document.addEventListener(moveEvent, handleRestaurantDrawerDragMove);
    document.addEventListener(endEvent, handleRestaurantDrawerDragEnd);
    
    e.preventDefault();
}

/**
 * 處理店家抽屜拖曳移動事件
 * @param {Event} e - 觸摸或滑鼠事件
 */
export function handleRestaurantDrawerDragMove(e) {
    if (!state.restaurantDrawerDragState.isDragging) return;
    
    const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - state.restaurantDrawerDragState.startY;
    
    // 只允許向下拖曳（正值）
    if (deltaY > 0) {
        const transformValue = state.restaurantDrawerDragState.startTransform + deltaY;
        DOMElements.restaurantDrawer.style.transform = `translateY(${transformValue}px)`;
        state.restaurantDrawerDragState.currentY = currentY;
    }
    
    e.preventDefault();
}

/**
 * 處理店家抽屜拖曳結束事件
 * @param {Event} e - 觸摸或滑鼠事件
 */
export function handleRestaurantDrawerDragEnd(e) {
    if (!state.restaurantDrawerDragState.isDragging) return;
    
    // 恢復過渡效果
    DOMElements.restaurantDrawer.style.transition = '';
    
    const deltaY = state.restaurantDrawerDragState.currentY - state.restaurantDrawerDragState.startY;
    const threshold = 80; // 拖曳超過80px就關閉抽屜
    
    if (deltaY > threshold) {
        // 關閉抽屜
        hideRestaurantDrawer();
        // 清除活動類別但保持選中狀態
        state.activeCategory = null;
        applyFiltersAndRender();
    } else {
        // 回彈到原位
        DOMElements.restaurantDrawer.style.transform = 'translateY(0)';
    }
    
    // 清理狀態和事件監聽器
    state.restaurantDrawerDragState.isDragging = false;
    const moveEvent = e.type === 'touchend' ? 'touchmove' : 'mousemove';
    const endEvent = e.type === 'touchend' ? 'touchend' : 'mouseup';
    
    document.removeEventListener(moveEvent, handleRestaurantDrawerDragMove);
    document.removeEventListener(endEvent, handleRestaurantDrawerDragEnd);
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