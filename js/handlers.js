// 處理所有事件監聽器和回呼函式

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { fetchRestaurants } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, showResult, initCategoriesMapAndRender, updateFilterUI } from './ui.js';
import { updateMapMarkers, fitMapToBounds, flyToMarker } from './map.js';

// *** 優化第二點：全新核心函式，負責篩選和觸發渲染 ***
export function applyFiltersAndRender() {
    // 1. 從 state 取得原始資料和篩選條件
    const { restaurantData, filters, activeCategory } = state;
    
    // 2. 執行篩選邏輯
    const allRestaurants = Object.values(restaurantData).flat();
    
    const filteredRestaurants = allRestaurants.filter(r => {
        const isOpen = !filters.openNow || r.hours === "營業中";
        const isPriceMatch = filters.priceLevel === 0 || r.price_level === filters.priceLevel;
        const isRatingMatch = filters.rating === 0 || r.rating >= filters.rating;
        return isOpen && isPriceMatch && isRatingMatch;
    });

    // 3. 將篩選後的結果重新組織成 categories -> [restaurants] 的格式
    const filteredData = {};
    filteredRestaurants.forEach(r => {
        // 找到這個餐廳原屬於哪個分類
        for (const category in restaurantData) {
            if (restaurantData[category].some(originalR => originalR.name === r.name)) {
                if (!filteredData[category]) {
                    filteredData[category] = [];
                }
                filteredData[category].push(r);
                break; // 找到就跳出內層循環
            }
        }
    });

    // 4. 使用篩選後的資料來更新整個頁面
    initCategoriesMapAndRender(filteredData);
    
    // 如果目前有選中分類，也要更新預覽列表
    renderRestaurantPreviewList(activeCategory, filteredData);
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
    showLoading("正在搜尋附近美食...");
    try {
        const data = await fetchRestaurants(state.userLocation.lat, state.userLocation.lon, state.searchRadiusMeters);
        state.restaurantData = data;
        
        showLoading("AI 正在為您分類美食...");
        setTimeout(() => {
            hideLoading();
            navigateTo('categories-page');
            // *** 優化第二點：第一次載入時，直接使用預設篩選條件渲染 ***
            applyFiltersAndRender(); 
        }, 800);

    } catch (error) {
        DOMElements.loadingText.textContent = `搜尋失敗: ${error.message}，請稍後再試`;
        setTimeout(hideLoading, 3000);
    }
}

export function handleRecenter() {
    recenterRadiusMap(state.userLocation);
}

// *** 優化第二點：新增篩選面板的顯示/隱藏處理器 ***
export function toggleFilterPanel() {
    DOMElements.filterPanel.classList.toggle('visible');
}

// *** 優化第二點：新增統一的篩選變更處理器 ***
export function handleFilterChange(e) {
    const target = e.target;
    const filterType = target.dataset.filter || target.closest('[data-filter]').dataset.filter;
    
    if (!filterType) return;

    if (filterType === 'openNow') {
        state.filters.openNow = target.checked;
    } else {
        const button = target.closest('button');
        if (!button) return;
        const value = Number(button.dataset.value);
        state.filters[filterType] = value;
    }

    updateFilterUI();
    applyFiltersAndRender();
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

// *** 優化第二點：改造類別點擊事件 ***
export function handleCategoryInteraction(e) {
    const target = e.target.closest('.category-list-item');
    if (!target) return;
    
    const category = target.dataset.category;

    // 更新 activeCategory 狀態
    if (state.activeCategory === category) {
        state.activeCategory = null;
    } else {
        state.activeCategory = category;
    }

    // 只需呼叫 applyFiltersAndRender，它會處理所有後續渲染
    applyFiltersAndRender();
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
        toggleWheelItem(name);
        const isAdded = state.wheelItems.has(name);
        DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
        DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';
    }
}