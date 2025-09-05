// 處理所有事件監聽器和回呼函式

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, showResult, initCategoriesMapAndRender, updateFilterUI, toggleRadiusEditMode, toggleHub, showCandidateList, hideCandidateList, renderCandidateList } from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, drawRadiusEditor, removeRadiusEditor, getEditorState, updateMapMarkers } from './map.js';

/**
 * 處理懸浮按鈕的展開與收合，並動態綁定外部點擊事件。
 */
export function handleToggleHub() {
    state.isHubExpanded = !state.isHubExpanded;
    toggleHub(state.isHubExpanded);

    const eventListenerTarget = DOMElements.categoriesPage;
    if (state.isHubExpanded) {
        // 按鈕展開時，監聽頁面點擊
        eventListenerTarget.addEventListener('click', handleClickToCloseHub);
    } else {
        // 按鈕收合時，移除監聽
        eventListenerTarget.removeEventListener('click', handleClickToCloseHub);
    }
}

/**
 * 處理頁面點擊事件，如果點擊位置在 Hub 之外，則關閉 Hub。
 * @param {Event} e - 點擊事件物件
 */
function handleClickToCloseHub(e) {
    if (state.isHubExpanded && !DOMElements.floatingActionHub.contains(e.target)) {
        handleToggleHub(); // 直接呼叫 handleToggleHub 來處理收合邏輯
    }
}

// *** 新增：候選清單視窗的事件處理 ***
export function handleShowCandidateList() {
    showCandidateList();
}
export function handleCandidateListInteraction(e) {
    const removeBtn = e.target.closest('.remove-candidate-btn');
    if (removeBtn) {
        const name = removeBtn.dataset.name;
        // 直接調用 toggle 邏輯來移除
        toggleWheelItem(name, false); 
        // 重新渲染列表
        renderCandidateList();
    }
}


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

export function getUserLocation() {
    const onSuccess = (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        DOMElements.locationStatus.textContent = '拖曳圓心或手把調整範圍';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };
    const onError = (err) => {
        state.userLocation = { lat: 24.975, lon: 121.538 };
        // 根據錯誤代碼提供更具體的錯誤訊息
        if (err.code === 1) { // PERMISSION_DENIED
            DOMElements.locationStatus.textContent = '無法取得位置，請允許定位權限';
        } else {
            DOMElements.locationStatus.textContent = '無法取得位置，將使用預設地點';
        }
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    // --- 修改：增加高精確度定位選項 ---
    const options = {
        enableHighAccuracy: true, // 啟用高精確度模式
        timeout: 10000,           // 設置 10 秒超時
        maximumAge: 0             // 不使用快取的位置
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
}

function handleRadiusChange(newRadius) {
    state.searchRadiusMeters = newRadius;
    updateRadiusLabel(newRadius);
}

async function performSearch(center, radius) {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        alert("無法獲取有效的地理位置，請重試。");
        console.error("performSearch 收到無效的 center 物件:", center);
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

export async function handleConfirmRadius() {
    const editorState = getEditorState('radius');
    if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng }; 
    const success = await performSearch(center, radius);
    if (success) { navigateTo('categories-page'); applyFiltersAndRender(); }
}

export async function handleConfirmRadiusReSearch() {
    const editorState = getEditorState('categories');
     if (!editorState) { alert("無法讀取地圖編輯器狀態，請重試。"); return; }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng };
    const success = await performSearch(center, radius);
    if (success) { toggleRadiusEditMode(false, handleRadiusChange); applyFiltersAndRender(); }
}

export function handleRecenter() {
    recenterRadiusMap(state.userLocation);
}

export function toggleFilterPanel() {
    const isVisible = DOMElements.filterPanel.classList.toggle('visible');
    const eventListenerTarget = DOMElements.categoriesPage; 
    if (isVisible) { eventListenerTarget.addEventListener('click', handleClickToCloseFilter); } 
    else { eventListenerTarget.removeEventListener('click', handleClickToCloseFilter); }
}

export function handleClickToCloseFilter(e) {
    if ( DOMElements.filterPanel.classList.contains('visible') && !DOMElements.filterPanel.contains(e.target) && !e.target.closest('.floating-action-hub') ) {
        toggleFilterPanel();
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

// --- 修正：恢復並優化類別互動邏輯 ---
export function handleCategoryInteraction(e) {
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem) return;
    const category = categoryItem.dataset.category;

    // 檢查點擊的類別是否已在聚焦清單中
    if (state.focusedCategories.has(category)) {
        // 如果已在清單中，再次點擊則將其從清單移除
        state.focusedCategories.delete(category);
        // 如果被移除的剛好是當前活躍的類別，則清空活躍類別，隱藏預覽
        if (state.activeCategory === category) {
            state.activeCategory = null;
        }
    } else {
        // 如果是新點擊的類別，則將其加入聚焦清單
        state.focusedCategories.add(category);
        // 並將其設為當前活躍的類別，以顯示預覽
        state.activeCategory = category;
    }
    
    // 每次互動後都重新渲染畫面
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
 * @param {string} name - The name of the restaurant.
 * @param {boolean} [shouldAdd=true] - Optional. If false, it will only remove the item.
 * @returns {boolean} - Returns true if the item is now in the set, false otherwise.
 */
function toggleWheelItem(name, shouldAdd = true) {
    let isAdded;
    if (state.wheelItems.has(name)) {
        state.wheelItems.delete(name);
        isAdded = false;
    } else if (shouldAdd) {
        if (state.wheelItems.size >= 8) {
            alert('候選清單最多8個選項喔！');
            return state.wheelItems.has(name); // return current state
        }
        state.wheelItems.add(name);
        isAdded = true;
    }
    updateWheelCount();
    // Force re-render of map markers to update popup content
    applyFiltersAndRender();
    return isAdded;
}

function showDetails(name) {
    const restaurant = Object.values(state.restaurantData).flat().find(r => r.name === name);
    if (restaurant) {
        state.currentRestaurantDetails = restaurant;
        navigateTo('details-page');
    }
}

export function handleSpinWheel() {
    if (state.isSpinning) return;
    state.isSpinning = true;
    DOMElements.spinBtn.disabled = true;
    const items = [...state.wheelItems];
    const sliceAngle = 360 / items.length;
    const randomIndex = Math.floor(Math.random() * items.length);
    const winner = items[randomIndex];
    const randomOffset = (Math.random() * 0.8 - 0.4) * sliceAngle;
    const targetRotation = 360 * 5 + (360 - (randomIndex * sliceAngle)) - (sliceAngle / 2) + randomOffset;
    let start = null;
    const duration = 5000;
    const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
    const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const t = Math.min(progress / duration, 1);
        const easedT = easeOutQuint(t);
        const rotation = state.currentWheelRotation + easedT * (targetRotation - state.currentWheelRotation);
        DOMElements.wheelContainer.style.transform = `rotate(${rotation}deg)`;
        if (progress < duration) {
            state.animationFrameId = requestAnimationFrame(step);
        } else {
            state.currentWheelRotation = rotation % 360;
            state.isSpinning = false;
            DOMElements.spinBtn.disabled = false;
            const winnerSlice = DOMElements.wheelContainer.querySelector(`.wheel-slice[data-name="${winner}"]`);
            if (winnerSlice) winnerSlice.classList.add('winner-glow');
            setTimeout(() => showResult(winner), 500);
        }
    };
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = requestAnimationFrame(step);
}

export function handlePreviewCardInteraction(e) {
    const card = e.target.closest('.restaurant-preview-card');
    if (!card) return;
    const name = card.dataset.name;
    flyToMarker(name);
}

export function handleAddToWheelFromDetails() {
    if (state.currentRestaurantDetails) {
        const name = state.currentRestaurantDetails.name;
        const isAdded = toggleWheelItem(name);
        DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
        DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';
    }
}