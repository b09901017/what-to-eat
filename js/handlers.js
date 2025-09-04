// 處理所有事件監聽器和回呼函式

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { findPlaces, categorizePlaces } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, showResult, initCategoriesMapAndRender, updateFilterUI } from './ui.js';
import { initRadiusMap, recenterRadiusMap, fitMapToBounds, flyToMarker } from './map.js';


export function applyFiltersAndRender() {
    const { restaurantData, filters, focusedCategories, activeCategory } = state;
    
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
    // *** 恢復：呼叫預覽列表渲染函式 ***
    renderRestaurantPreviewList(activeCategory, finalFilteredData);
}

export function getUserLocation() {
    const onSuccess = (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        DOMElements.locationStatus.textContent = '拖曳手把或縮放地圖調整範圍';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    const onError = () => {
        state.userLocation = { lat: 24.975, lon: 121.538 };
        DOMElements.locationStatus.textContent = '無法取得位置，將使用預設地點';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError);
}

function handleRadiusChange(newRadius) {
    state.searchRadiusMeters = newRadius;
    updateRadiusLabel(newRadius);
}

export async function handleConfirmRadius() {
    showLoading("正在大海撈針，尋找美食...");
    try {
        const rawRestaurantData = await findPlaces(state.userLocation.lat, state.userLocation.lon, state.searchRadiusMeters);
        const restaurantCount = Object.keys(rawRestaurantData).length;

        if (restaurantCount === 0) {
            hideLoading();
            alert("哎呀！這個範圍內似乎沒有找到任何餐廳，試著擴大搜索圈吧！");
            return;
        }
        
        showLoading(`找到了 ${restaurantCount} 家潛力店家，正請 AI 大廚協助分類...`);
        
        const categorizedData = await categorizePlaces(rawRestaurantData);
        state.restaurantData = categorizedData;
        state.focusedCategories.clear();
        state.activeCategory = null;
        
        hideLoading();
        navigateTo('categories-page');
        applyFiltersAndRender();

    } catch (error) {
        DOMElements.loadingText.textContent = `搜尋失敗: ${error.message}，請稍後再試`;
        setTimeout(hideLoading, 3000);
    }
}

export function handleRecenter() {
    recenterRadiusMap(state.userLocation);
}

export function handleClickToCloseFilter(e) {
    if (
        DOMElements.filterPanel.classList.contains('visible') &&
        !DOMElements.filterPanel.contains(e.target) &&
        !DOMElements.filterBtn.contains(e.target)
    ) {
        toggleFilterPanel();
    }
}

export function toggleFilterPanel() {
    const isVisible = DOMElements.filterPanel.classList.toggle('visible');
    if (isVisible) {
        DOMElements.categoriesPage.addEventListener('click', handleClickToCloseFilter);
    } else {
        DOMElements.categoriesPage.removeEventListener('click', handleClickToCloseFilter);
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
    applyFiltersAndRender();
}

// *** 重構：全新的單擊互動邏輯 ***
export function handleCategoryInteraction(e) {
    const categoryItem = e.target.closest('.category-list-item');
    if (!categoryItem) return;

    const category = categoryItem.dataset.category;

    // 1. 切換聚焦狀態
    if (state.focusedCategories.has(category)) {
        state.focusedCategories.delete(category);
        // 如果取消的是當前高亮的類別，則同時取消高亮
        if (state.activeCategory === category) {
            state.activeCategory = null;
        }
    } else {
        state.focusedCategories.add(category);
        // 新增聚焦時，將其設為高亮
        state.activeCategory = category;
    }
    
    // 2. 重新渲染
    applyFiltersAndRender();
}

// *** 新增：重設按鈕的處理函式 ***
export function handleResetView() {
    if (state.focusedCategories.size > 0) {
        state.focusedCategories.clear();
        state.activeCategory = null;
        applyFiltersAndRender();
    }
}

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

// *** 恢復：預覽卡片的處理函式 ***
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