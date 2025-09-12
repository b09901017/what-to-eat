// js/restaurantDrawer.js

import { state, DOMElements } from './state.js';
import { applyFiltersAndRender } from './handlers.js';

const drawer = DOMElements.restaurantDrawer;
const handleArea = drawer.querySelector('.drawer-handle-area');
const previewList = DOMElements.restaurantPreviewList;
const showAllContainer = DOMElements.showAllBtn.parentElement;

let startY;
let currentY;
let initialDrawerY;
let isVisible = false;

const DRAWER_HEIGHT = 160; 

function setDrawerPosition(y) {
    // *** 修改：拖曳時移除動畫 ***
    drawer.style.transition = 'none';
    drawer.style.transform = `translateY(${y}px)`;
}

function snapToPosition(y) {
    // *** 修改：吸附時恢復動畫 ***
    drawer.style.transition = ''; 
    drawer.style.transform = `translateY(${y}px)`;
}

function startDrag(e) {
    if (!isVisible) return;
    e.preventDefault();
    state.isDrawerDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const style = window.getComputedStyle(drawer);
    const matrix = new DOMMatrix(style.transform);
    initialDrawerY = matrix.m42;
    
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
}

function onDrag(e) {
    if (!state.isDrawerDragging) return;
    e.preventDefault();
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const diffY = currentY - startY;
    let newY = initialDrawerY + diffY;

    newY = Math.max(0, newY);
    
    setDrawerPosition(newY);
}

function endDrag() {
    if (!state.isDrawerDragging) return;
    state.isDrawerDragging = false;
    
    // *** 新增：恢復動畫 ***
    drawer.style.transition = '';

    const currentTranslateY = getTranslateY(drawer);
    
    if (currentTranslateY > DRAWER_HEIGHT / 3) {
        hide();
    } else {
        snapToPosition(0);
    }
    
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', onDrag);
    window.removeEventListener('touchend', endDrag);
}

function getTranslateY(element) {
    const style = window.getComputedStyle(element);
    const matrix = new DOMMatrix(style.transform);
    return matrix.m42;
}

function renderContent(restaurants) {
    previewList.innerHTML = '';
    if (!restaurants || restaurants.length === 0) {
        return;
    }

    restaurants.forEach(restaurant => {
        const card = document.createElement('div');
        card.className = 'restaurant-preview-card';
        card.dataset.name = restaurant.name;
        card.innerHTML = `<h5>${restaurant.name}</h5><p>⭐ ${restaurant.rating} | ${'$'.repeat(restaurant.price_level)}</p>`;
        previewList.appendChild(card);
    });
}

export function show(restaurants) {
    if (!drawer) return;
    renderContent(restaurants);
    
    const isFocusMode = state.focusedCategories.size > 0;
    showAllContainer.classList.toggle('visible', isFocusMode);

    drawer.classList.add('is-visible');
    isVisible = true;
}

export function hide() {
    if (!drawer) return;
    drawer.classList.remove('is-visible');
    isVisible = false;

    if (state.activeCategory) {
        state.activeCategory = null;
        applyFiltersAndRender();
    }
}

export function initRestaurantDrawer() {
    if (handleArea) {
        handleArea.addEventListener('mousedown', startDrag);
        handleArea.addEventListener('touchstart', startDrag, { passive: false });
    }
}