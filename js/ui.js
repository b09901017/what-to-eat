// js/ui.js

import { state, DOMElements } from './state.js';
import { getUserLocation, applyFiltersAndRender } from './handlers.js';
import { initCategoriesMap, updateMapMarkers, fitMapToBounds, destroyRadiusMap, drawRadiusEditor, removeRadiusEditor, setRadiusMapCenter, flyToCoords, getEditorState, mapInstances } from './map.js';
import { renderWheel } from './wheel.js';
import { renderDetailsPage } from './details.js';
import { hideCandidateList } from './candidate.js';

/**
 * 根據頁面 ID 渲染對應內容或執行初始化
 * @param {string} pageId - 目標頁面 ID
 */
export function renderPageContent(pageId) {
    switch (pageId) {
        case 'map-page':
            getUserLocation();
            break;
        case 'categories-page':
            if (state.isEditingRadius) {
                state.isEditingRadius = false;
                toggleRadiusEditMode(false);
            }
            if (state.isHubExpanded) {
                state.isHubExpanded = false;
                toggleHub(false);
            }
            hideCandidateList(); // 確保離開時關閉
            break;
        case 'wheel-page':
            renderWheel();
            break;
        case 'details-page':
            renderDetailsPage();
            break;
    }
    if (pageId !== 'map-page') { destroyRadiusMap(); }
    if (pageId !== 'categories-page') { DOMElements.filterPanel.classList.remove('visible'); }
}

export function toggleHub(isExpanded) {
    DOMElements.floatingActionHub.classList.toggle('is-active', isExpanded);
}

export function showLoading(text) {
    DOMElements.loadingText.textContent = text;
    DOMElements.loadingOverlay.classList.add('visible');
}

export function hideLoading() {
    DOMElements.loadingOverlay.classList.remove('visible');
}

export function updateRadiusLabel(radius) {
    DOMElements.radiusLabel.textContent = `${Math.round(radius)} 公尺`;
    DOMElements.radiusLabel.classList.add('visible');
}

export function toggleRadiusEditMode(isEditing, onRadiusChange) {
    const { 
        categoryListContainer, 
        floatingActionHub, 
        mainFooter, 
        editModeControls
    } = DOMElements;
    
    categoryListContainer.classList.toggle('hidden', isEditing);
    floatingActionHub.classList.toggle('hidden', isEditing);
    mainFooter.style.display = isEditing ? 'none' : 'block';
    editModeControls.classList.toggle('visible', isEditing);

    if (isEditing) {
        const center = state.searchCenter || state.userLocation;
        initCategoriesMap(); 
        const map = mapInstances.categories;
        setRadiusMapCenter('categories', center);
        drawRadiusEditor('categories', center, state.searchRadiusMeters, onRadiusChange);
        updateRadiusLabel(state.searchRadiusMeters);

        const allRestaurants = Object.values(state.restaurantData).flat();
        const globallyFilteredRestaurants = allRestaurants.filter(r => {
            const isOpen = !state.filters.openNow || r.hours === "營業中";
            const isPriceMatch = state.filters.priceLevel === 0 || r.price_level === state.filters.priceLevel;
            const isRatingMatch = state.filters.rating === 0 || r.rating >= state.filters.rating;
            return isOpen && isPriceMatch && isRatingMatch;
        });

        const tempFilteredData = {};
        globallyFilteredRestaurants.forEach(r => {
            for (const category in state.restaurantData) {
                if (state.restaurantData[category].some(resto => resto.name === r.name)) {
                    if (!tempFilteredData[category]) {
                        tempFilteredData[category] = [];
                    }
                    tempFilteredData[category].push(r);
                    break; 
                }
            }
        });
        
        updateMapMarkers(tempFilteredData, state.userLocation, null, null);
        
        const editorState = getEditorState('categories');
        if (editorState && editorState.circle) {
            map.fitBounds(editorState.circle.getBounds(), { padding: [50, 50] });
        }

    } else {
        removeRadiusEditor('categories');
        DOMElements.radiusLabel.classList.remove('visible');
        applyFiltersAndRender();
    }
}


export function initCategoriesMapAndRender(filteredData) {
    initCategoriesMap();
    updateMapMarkers(filteredData, state.userLocation, state.focusedCategories, state.activeCategory);
    
    const isFocusMode = state.focusedCategories.size > 0;

    if (isFocusMode && state.activeCategory && filteredData[state.activeCategory]) {
        const coordsOfActiveCategory = filteredData[state.activeCategory].map(r => [r.lat, r.lon]);
        flyToCoords(coordsOfActiveCategory);
    } else {
        const coordsToFit = [];
        const categoriesToConsider = isFocusMode ? state.focusedCategories : Object.keys(filteredData);
        
        for (const category of categoriesToConsider) {
            if (filteredData[category]) {
                filteredData[category].forEach(r => coordsToFit.push([r.lat, r.lon]));
            }
        }
        
        if (state.userLocation) { coordsToFit.push([state.userLocation.lat, state.userLocation.lon]); }
        if (coordsToFit.length > 0) { fitMapToBounds(coordsToFit, { paddingTopLeft: [20, 100], paddingBottomRight: [20, 200] }); }
    }

    renderCategories(filteredData);
    
    const resetViewHubItem = DOMElements.resetViewBtn.closest('.hub-item');
    if(resetViewHubItem) { resetViewHubItem.style.display = isFocusMode ? 'flex' : 'none'; }
    
    if (Object.keys(filteredData).length === 0 && Object.keys(state.restaurantData).length > 0) {
         DOMElements.categoryList.innerHTML = `<p class="empty-state-message">找不到符合條件的餐廳耶，試著放寬篩選看看？</p>`;
    } else if (Object.keys(state.restaurantData).length === 0) {
         DOMElements.categoryList.innerHTML = `<p class="empty-state-message">此區域似乎沒有餐廳喔！</p>`;
    }
}

function renderCategories(filteredData) {
    const categoryKeys = Object.keys(filteredData);
    DOMElements.categoryList.innerHTML = '';
    const isFocusMode = state.focusedCategories.size > 0;

    categoryKeys.forEach(category => {
        const item = document.createElement('div');
        item.className = 'category-list-item';
        item.dataset.category = category;
        if (state.focusedCategories.has(category)) { item.classList.add('active'); } 
        else if (isFocusMode) { item.classList.add('unfocused'); }
        item.textContent = category;
        DOMElements.categoryList.appendChild(item);
    });
}

export function renderRestaurantPreviewList(category, filteredData) {
    const listEl = DOMElements.restaurantPreviewList;
    listEl.innerHTML = '';

    if (!category || !filteredData[category] || filteredData[category].length === 0) {
        listEl.classList.remove('visible');
        return;
    }

    filteredData[category].forEach(restaurant => {
        const card = document.createElement('div');
        card.className = 'restaurant-preview-card';
        card.dataset.name = restaurant.name;
        card.innerHTML = `<h5>${restaurant.name}</h5><p>⭐ ${restaurant.rating} | ${'$'.repeat(restaurant.price_level)}</p>`;
        listEl.appendChild(card);
    });
    listEl.classList.add('visible');
}

export function updateWheelCount() {
    const count = state.wheelItems.size;
    DOMElements.wheelCountBadges.forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
}

export function updateFilterUI() {
    const { priceLevel, rating } = state.filters;
    DOMElements.priceFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === priceLevel); });
    DOMElements.ratingFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === rating); });
}