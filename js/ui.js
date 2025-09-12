// js/ui.js

import { state, DOMElements } from './state.js';
import { getUserLocation, applyFiltersAndRender } from './handlers.js';
import { initCategoriesMap, updateMapMarkers, fitMapToBounds, destroyRadiusMap, drawRadiusEditor, removeRadiusEditor, setRadiusMapCenter, flyToCoords, getEditorState, mapInstances, clearWinnerMarker } from './map.js';
import { renderWheel, hideResult as hideWheelResult } from './wheel.js';
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
            // *** 新增：重置雙抽屜狀態 ***
            if (state.isRestaurantDrawerOpen) {
                state.isRestaurantDrawerOpen = false;
                hideRestaurantDrawer();
            }
            clearWinnerMarker();
            hideCandidateList();
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
        floatingActionHub, 
        mainFooter, 
        editModeControls,
        locationSearchContainer,
        pageHeaderCondensed,
        categoryDrawer,
        restaurantDrawer
    } = DOMElements;
    
    if (pageHeaderCondensed) pageHeaderCondensed.style.visibility = isEditing ? 'hidden' : 'visible';
    if (categoryDrawer) categoryDrawer.style.visibility = isEditing ? 'hidden' : 'visible';
    if (restaurantDrawer) restaurantDrawer.style.visibility = isEditing ? 'hidden' : 'visible';
    if (mainFooter) mainFooter.style.visibility = isEditing ? 'hidden' : 'visible';
    
    if (floatingActionHub) floatingActionHub.classList.toggle('hidden-for-edit', isEditing);
    editModeControls.classList.toggle('visible', isEditing);
    
    if (isEditing) {
        const hintElement = editModeControls.querySelector('.edit-mode-hint');
        if(hintElement) {
            editModeControls.insertBefore(locationSearchContainer, hintElement);
        }
        locationSearchContainer.dataset.mapKey = 'categories';
        locationSearchContainer.classList.add('in-edit-mode');
    } else {
        const mapPageOverlay = document.querySelector('#map-page .map-ui-overlay');
        mapPageOverlay.insertBefore(locationSearchContainer, mapPageOverlay.querySelector('.page-footer'));
        locationSearchContainer.dataset.mapKey = 'radius';
        locationSearchContainer.classList.remove('in-edit-mode');
    }

    const map = initCategoriesMap();
    if (!map) return;

    if (isEditing) {
        const center = state.searchCenter || state.userLocation;
        setRadiusMapCenter('categories', center);
        drawRadiusEditor('categories', center, state.searchRadiusMeters, onRadiusChange);
        updateRadiusLabel(state.searchRadiusMeters);

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
    updateMapMarkers(filteredData, state.userLocation, state.searchCenter, state.focusedCategories, state.activeCategory);
    
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
        
        if (state.searchCenter) { coordsToFit.push([state.searchCenter.lat, state.searchCenter.lon]); }
        if (coordsToFit.length > 0) { fitMapToBounds(coordsToFit, { paddingTopLeft: [20, 100], paddingBottomRight: [20, 200] }); }
    }

    renderCategories(filteredData);
    
    // *** 修改：顯示類別抽屜而不是舊的底部抽屜 ***
    showCategoryDrawer();

    DOMElements.showAllBtn.parentElement.classList.toggle('visible', isFocusMode);
    
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
        return;
    }

    filteredData[category].forEach(restaurant => {
    // 建立一個新的 <div> 元素作為卡片
    const card = document.createElement('div');
    
    // 設定 class 和 data attribute
    card.className = 'restaurant-preview-card';
    card.dataset.name = restaurant.name;
    
    // --- 這行是修正後的地方 ---
    // 我們在 '$' 字串上呼叫 .repeat() 方法，
    // 讓它根據 restaurant.price_level 的數值重複出現
    card.innerHTML = `<h5>${restaurant.name}</h5><p>⭐ ${restaurant.rating} | ${'$'.repeat(restaurant.price_level)}</p>`;
    
    // 將建立好的卡片加到列表元素中
    listEl.appendChild(card);
});
}

// === 新增：雙抽屜系統的 UI 控制函式 ===

/**
 * 顯示類別抽屜（固定在底部）
 */
export function showCategoryDrawer() {
    DOMElements.categoryDrawer.classList.add('visible');
}

/**
 * 隱藏類別抽屜
 */
export function hideCategoryDrawer() {
    DOMElements.categoryDrawer.classList.remove('visible');
}

/**
 * 顯示店家抽屜並載入指定類別的店家列表
 * @param {string} category - 要顯示的美食類別
 */
export function showRestaurantDrawer(category) {
    if (!state.isRestaurantDrawerOpen) {
        state.isRestaurantDrawerOpen = true;
        DOMElements.restaurantDrawer.classList.add('visible');
        
        // 更新 Floating Action Hub 位置
        DOMElements.floatingActionHub.classList.add('restaurant-drawer-open');
    }
    
    // 載入店家列表
    const filteredData = getFilteredRestaurantData();
    renderRestaurantPreviewList(category, filteredData);
}

/**
 * 隱藏店家抽屜
 */
export function hideRestaurantDrawer() {
    if (state.isRestaurantDrawerOpen) {
        state.isRestaurantDrawerOpen = false;
        DOMElements.restaurantDrawer.classList.remove('visible');
        
        // 恢復 Floating Action Hub 位置
        DOMElements.floatingActionHub.classList.remove('restaurant-drawer-open');
        
        // 清空店家列表
        DOMElements.restaurantPreviewList.innerHTML = '';
    }
}

/**
 * 獲取當前篩選後的餐廳資料
 * @returns {Object} 篩選後的餐廳資料
 */
function getFilteredRestaurantData() {
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
    
    return finalFilteredData;
}

export function updateWheelCount() {
    const count = state.wheelItems.size;
    DOMElements.wheelCountBadges.forEach(badge => {
        badge.textContent = count;
    });

    const mainBadge = DOMElements.showCandidatesFooterBtn.querySelector('.wheel-count-badge');
    if (mainBadge) {
        mainBadge.classList.toggle('visible', count > 0);
    }
}

export function updateFilterUI() {
    const { priceLevel, rating } = state.filters;
    DOMElements.priceFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === priceLevel); });
    DOMElements.ratingFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === rating); });
}

export function showResult(winner) {
    DOMElements.resultText.textContent = '';
    DOMElements.resultOverlay.classList.add('visible');
    
    let i = 0;
    function typeWriter() {
        if (i < winner.length) {
            DOMElements.resultText.innerHTML += winner.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    }
    typeWriter();
}

export function hideResult() {
    DOMElements.resultOverlay.classList.remove('visible');
    
    if (state.currentPage === 'wheel-page') {
        hideWheelResult();
    } else {
        clearWinnerMarker();
        applyFiltersAndRender();
    }
}

// --- Location Search UI ---

export function toggleSearchUI(isActive) {
    DOMElements.locationSearchContainer.classList.toggle('active', isActive);
    if (isActive) {
        setTimeout(() => DOMElements.locationSearchInput.focus(), 700);
    } else {
        DOMElements.locationSearchInput.value = '';
        DOMElements.locationSearchInput.blur();
        clearSearchResults();
    }
}

export function renderSearchResults(results, mapKey) {
    const { locationSearchResults } = DOMElements;
    clearSearchResults();
    if (results.length > 0) {
        results.forEach(result => {
            const li = document.createElement('li');
            li.textContent = result.address;
            li.dataset.lat = result.lat;
            li.dataset.lon = result.lon;
            li.dataset.mapKey = mapKey;
            locationSearchResults.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '找不到結果';
        li.classList.add('loading');
        locationSearchResults.appendChild(li);
    }
    locationSearchResults.classList.add('visible');
}

export function clearSearchResults() {
    DOMElements.locationSearchResults.innerHTML = '';
    DOMElements.locationSearchResults.classList.remove('visible');
}