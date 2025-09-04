// 處理所有事件監聽器和回呼函式

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, showResult, initCategoriesMapAndRender, updateFilterUI, toggleRadiusEditMode } from './ui.js';
import { initRadiusMap, recenterRadiusMap, flyToMarker, drawRadiusEditor, removeRadiusEditor, getEditorState } from './map.js';

/**
 * 核心渲染函式：根據當前 state 過濾並渲染所有內容
 */
export function applyFiltersAndRender() {
    const { restaurantData, filters } = state;
    
    const allRestaurants = Object.values(restaurantData).flat();
    // 全域過濾器：處理營業、價位、評分
    const globallyFilteredRestaurants = allRestaurants.filter(r => {
        const isOpen = !filters.openNow || r.hours === "營業中";
        const isPriceMatch = filters.priceLevel === 0 || r.price_level === filters.priceLevel;
        const isRatingMatch = filters.rating === 0 || r.rating >= filters.rating;
        return isOpen && isPriceMatch && isRatingMatch;
    });
    const globallyFilteredNames = new Set(globallyFilteredRestaurants.map(r => r.name));

    // 根據過濾後的名單，重建分類資料
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
 * 取得使用者地理位置
 */
export function getUserLocation() {
    const onSuccess = (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        DOMElements.locationStatus.textContent = '拖曳圓心或手把調整範圍';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    const onError = () => {
        // 若失敗，使用預設位置
        state.userLocation = { lat: 24.975, lon: 121.538 };
        DOMElements.locationStatus.textContent = '無法取得位置，將使用預設地點';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError);
}

/**
 * 半徑拖曳時的回呼函式
 * @param {number} newRadius - 新的半徑（公尺）
 */
function handleRadiusChange(newRadius) {
    state.searchRadiusMeters = newRadius;
    updateRadiusLabel(newRadius);
}

/**
 * 執行完整的餐廳搜尋與分類流程
 * @param {object} center - 搜尋中心點 { lat, lng }
 * @param {number} radius - 搜尋半徑（公尺）
 */
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
            if (state.currentPage === 'categories-page') {
                toggleRadiusEditMode(false, handleRadiusChange); // 如果是重新搜尋沒結果，則退出編輯模式
            }
            return false;
        }
        
        showLoading(`找到了 ${restaurantCount} 家潛力店家，正請 AI 大廚協助分類...`);
        
        const categorizedData = await categorizePlaces(rawRestaurantData);
        state.restaurantData = categorizedData;
        
        // 重設篩選與聚焦狀態
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
 * 處理「探索圈頁面」的確認按鈕
 */
export async function handleConfirmRadius() {
    const editorState = getEditorState('radius');
    if (!editorState) {
        alert("無法讀取地圖編輯器狀態，請重試。");
        return;
    }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng }; // 儲存中心點
    
    const success = await performSearch(center, radius);
    if (success) {
        navigateTo('categories-page');
        applyFiltersAndRender();
    }
}

/**
 * 處理「美食地圖頁」的重新搜尋按鈕
 */
export async function handleConfirmRadiusReSearch() {
    const editorState = getEditorState('categories');
     if (!editorState) {
        alert("無法讀取地圖編輯器狀態，請重試。");
        return;
    }
    const { center, radius } = editorState;
    state.searchCenter = { lat: center.lat, lon: center.lng }; // 更新中心點
    
    const success = await performSearch(center, radius);
    if (success) {
        toggleRadiusEditMode(false, handleRadiusChange); // 成功後退出編輯模式
        applyFiltersAndRender();
    }
}


/**
 * 讓探索圈地圖回到中心點
 */
export function handleRecenter() {
    recenterRadiusMap(state.userLocation);
}

/**
 * 處理篩選面板的開關
 */
export function toggleFilterPanel() {
    const isVisible = DOMElements.filterPanel.classList.toggle('visible');
    const eventListenerTarget = DOMElements.categoriesPage;
    if (isVisible) {
        eventListenerTarget.addEventListener('click', handleClickToCloseFilter);
    } else {
        eventListenerTarget.removeEventListener('click', handleClickToCloseFilter);
    }
}

/**
 * 點擊篩選面板外部時，自動關閉
 */
export function handleClickToCloseFilter(e) {
    if (
        DOMElements.filterPanel.classList.contains('visible') &&
        !DOMElements.filterPanel.contains(e.target) &&
        !DOMElements.filterBtn.contains(e.target)
    ) {
        toggleFilterPanel();
    }
}


/**
 * 處理篩選條件變更
 */
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
    applyFiltersAndRender();
}


/**
 * 處理美食類別的點擊互動（單擊聚焦）
 */
export function handleCategoryInteraction(e) {
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem) return;

    const category = categoryItem.dataset.category;

    // 切換聚焦狀態
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

/**
 * 處理「重設檢視」按鈕
 */
export function handleResetView() {
    if (state.focusedCategories.size > 0) {
        state.focusedCategories.clear();
        state.activeCategory = null;
        applyFiltersAndRender();
    }
}

/**
 * 處理「調整範圍」按鈕，切換編輯模式
 */
export function handleToggleRadiusEdit() {
    state.isEditingRadius = !state.isEditingRadius;
    toggleRadiusEditMode(state.isEditingRadius, handleRadiusChange);
}


/**
 * 處理地圖彈出視窗中的按鈕互動
 */
export function handlePopupInteraction(e) {
    const btn = e.target.closest('.add-to-wheel-btn, .details-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.classList.contains('add-to-wheel-btn')) {
        toggleWheelItem(name);
        const isAdded = state.wheelItems.has(name);
        btn.classList.toggle('added', isAdded);
        btn.textContent = isAdded ? '✓' : '+';
    } else if (btn.classList.contains('details-btn')) {
        showDetails(name);
    }
}

function toggleWheelItem(name) {
    if (state.wheelItems.has(name)) {
        state.wheelItems.delete(name);
    } else {
        if (state.wheelItems.size >= 8) {
            alert('候選清單最多8個選項喔！');
            return;
        }
        state.wheelItems.add(name);
    }
    updateWheelCount();
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

/**
 * 處理預覽卡片的互動（滑鼠懸浮或點擊）
 */
export function handlePreviewCardInteraction(e) {
    const card = e.target.closest('.restaurant-preview-card');
    if (!card) return;
    const name = card.dataset.name;
    flyToMarker(name);
}

export function handleAddToWheelFromDetails() {
    if (state.currentRestaurantDetails) {
        const name = state.currentRestaurantDetails.name;
        toggleWheelItem(name);
        const isAdded = state.wheelItems.has(name);
        DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
        DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';
    }
}