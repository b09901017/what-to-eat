// 處理所有事件監聽器和回呼函式

import { state, DOMElements } from './state.js';
import { navigateTo } from './navigation.js';
import { fetchRestaurants } from './api.js';
import { showLoading, hideLoading, updateRadiusLabel, renderRestaurantPreviewList, updateWheelCount, showResult } from './ui.js';
import { initRadiusMap, recenterRadiusMap, updateMapMarkers, fitMapToBounds, flyToMarker } from './map.js';

export function getUserLocation() {
    const onSuccess = (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        DOMElements.locationStatus.textContent = '拖曳手把或縮放地圖調整範圍';
        DOMElements.confirmRadiusBtn.disabled = false;
        initRadiusMap(state.userLocation, state.searchRadiusMeters, handleRadiusChange);
    };

    const onError = () => {
        // 使用備用位置
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
        }, 800);

    } catch (error) {
        DOMElements.loadingText.textContent = `搜尋失敗: ${error.message}，請稍後再試`;
        setTimeout(hideLoading, 3000);
    }
}

export function handleRecenter() {
    recenterRadiusMap(state.userLocation);
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
    
    // 複雜的動畫邏輯
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

export function handleCategoryInteraction(e) {
    const target = e.target.closest('.category-list-item');
    if (!target) return;
    
    const category = target.dataset.category;
    const allItems = DOMElements.categoryList.querySelectorAll('.category-list-item');

    if (state.activeCategory === category) {
        state.activeCategory = null;
        target.classList.remove('active');
    } else {
        state.activeCategory = category;
        allItems.forEach(item => item.classList.remove('active'));
        target.classList.add('active');
    }

    updateMapMarkers(state.restaurantData, state.userLocation, state.activeCategory);
    renderRestaurantPreviewList(state.activeCategory);

    let coordsToFit = (state.activeCategory === null)
        ? Object.values(state.restaurantData).flat().map(r => [r.lat, r.lon])
        : state.restaurantData[state.activeCategory].map(r => [r.lat, r.lon]);
    
    if (state.userLocation) {
        coordsToFit.push([state.userLocation.lat, state.userLocation.lon]);
    }
    
    fitMapToBounds(coordsToFit);
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