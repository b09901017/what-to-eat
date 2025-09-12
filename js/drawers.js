// js/drawers.js

import { state } from './state.js';
import { applyFiltersAndRender } from './handlers.js';

// --- DOM 元素參照 ---
let container, restaurantDrawer, categoryDrawer, handle, previewList, showAllContainer;

// --- 狀態變數 ---
let isVisible = false;
let isDragging = false;
let startY, initialDrawerY;
const DRAG_THRESHOLD = 50; // 拖曳超過 50px 才算觸發關閉

/**
 * 初始化模組，獲取 DOM 元素並綁定事件
 */
export function init(domElements) {
    container = domElements.drawersContainer;
    restaurantDrawer = domElements.restaurantDrawer;
    categoryDrawer = domElements.categoryDrawer;
    handle = domElements.drawerHandle;
    previewList = domElements.restaurantPreviewList;
    showAllContainer = domElements.showAllBtn.parentElement;

    if (handle) {
        handle.addEventListener('mousedown', onDragStart);
        handle.addEventListener('touchstart', onDragStart, { passive: false });
    }
}

/**
 * 顯示主抽屜容器（分類抽屜）
 */
export function showMainContainer() {
    if (container) {
        container.classList.add('is-active');
    }
}

/**
 * 隱藏主抽屜容器
 */
export function hideMainContainer() {
    if (container) {
        container.classList.remove('is-active');
    }
}


/**
 * 顯示店家預覽抽屜
 * @param {Array} restaurants - 要顯示的店家列表
 */
export function showRestaurants(restaurants) {
    if (!restaurantDrawer || !previewList) return;

    // 填充店家內容
    previewList.innerHTML = '';
    if (restaurants && restaurants.length > 0) {
        restaurants.forEach(restaurant => {
            const card = document.createElement('div');
            card.className = 'restaurant-preview-card';
            card.dataset.name = restaurant.name;
            card.innerHTML = `<h5>${restaurant.name}</h5><p>⭐ ${restaurant.rating} | ${'$'.repeat(restaurant.price_level)}</p>`;
            previewList.appendChild(card);
        });
    }

    // 更新"顯示所有"按鈕的可見性
    const isFocusMode = state.focusedCategories.size > 0;
    showAllContainer.classList.toggle('visible', isFocusMode);

    // 透過 class 觸發 CSS 動畫
    restaurantDrawer.classList.add('is-active');
    isVisible = true;
}

/**
 * 隱藏店家預覽抽屜
 */
export function hideRestaurants() {
    if (!restaurantDrawer) return;

    restaurantDrawer.classList.remove('is-active');
    isVisible = false;
}

// --- 拖曳邏輯 ---

function onDragStart(e) {
    if (!isVisible) return;
    e.preventDefault();
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // 獲取目前的 transformY 值，如果沒有則為 0
    const style = window.getComputedStyle(restaurantDrawer);
    const matrix = new DOMMatrix(style.transform);
    initialDrawerY = matrix.m42;

    restaurantDrawer.classList.add('is-dragging'); // 禁用 transition 以便流暢拖曳

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const diffY = currentY - startY;
    let newY = initialDrawerY + diffY;

    // 限制拖曳，不能向上拖超過原始位置
    newY = Math.max(0, newY);

    // 使用 CSS 變數來更新位置，而不是直接修改 transform
    restaurantDrawer.style.setProperty('--drag-offset', `${newY}px`);
}

function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;

    restaurantDrawer.classList.remove('is-dragging'); // 恢復 transition
    restaurantDrawer.style.removeProperty('--drag-offset'); // 清除 CSS 變數

    const style = window.getComputedStyle(restaurantDrawer);
    const matrix = new DOMMatrix(style.transform);
    const currentTranslateY = matrix.m42;
    
    // 根據拖曳距離決定是關閉還是歸位
    if (currentTranslateY > DRAG_THRESHOLD) {
        if (state.activeCategory) {
            state.activeCategory = null;
            applyFiltersAndRender(); // 透過中央處理器來隱藏抽屜並更新地圖
        }
    } else {
        // 如果距離不夠，CSS 會自動將其動畫還原到 active 狀態
    }

    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
}