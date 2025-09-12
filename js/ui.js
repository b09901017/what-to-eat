// js/ui.js

import { state, DOMElements } from './state.js';
import { applyFiltersAndRender } from './handlers.js';
import { initCategoriesMap, updateMapMarkers, fitMapToBounds, drawRadiusEditor, removeRadiusEditor, setRadiusMapCenter, flyToCoords, getEditorState, clearWinnerMarker } from './map.js';
import { renderWheel, hideResult as hideWheelResult } from './wheel.js';

// --- 核心修改：移除了 renderPageContent 函式 ---
// 它的邏輯已經被整合到 navigation.js 的 _setActivePage 函式中，
// 從而解開了 ui.js 和 handlers.js 之間的循環依賴。


/**
 * 顯示/隱藏 Floating Action Hub
 * @param {boolean} isExpanded - 是否展開
 */
export function toggleHub(isExpanded) {
    DOMElements.floatingActionHub.classList.toggle('is-active', isExpanded);
}

/**
 * 顯示全域載入遮罩
 * @param {string} text - 顯示的文字
 */
export function showLoading(text) {
    DOMElements.loadingText.textContent = text;
    DOMElements.loadingOverlay.classList.add('visible');
}

/**
 * 隱藏全域載入遮罩
 */
export function hideLoading() {
    DOMElements.loadingOverlay.classList.remove('visible');
}

/**
 * 更新半徑標籤的文字
 * @param {number} radius - 半徑（公尺）
 */
export function updateRadiusLabel(radius) {
    DOMElements.radiusLabel.textContent = `${Math.round(radius)} 公尺`;
    DOMElements.radiusLabel.classList.add('visible');
}

/**
 * 切換半徑編輯模式的 UI 狀態
 * @param {boolean} isEditing - 是否進入編輯模式
 * @param {function} onRadiusChange - 半徑變化時的回調函式
 */
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
    
    // 根據是否為編輯模式，切換各個 UI 元件的可見性
    if (pageHeaderCondensed) pageHeaderCondensed.style.visibility = isEditing ? 'hidden' : 'visible';
    if (categoryDrawer) categoryDrawer.style.visibility = isEditing ? 'hidden' : 'visible';
    if (restaurantDrawer) restaurantDrawer.style.visibility = isEditing ? 'hidden' : 'visible';
    if (mainFooter) mainFooter.style.visibility = isEditing ? 'hidden' : 'visible';
    
    if (floatingActionHub) floatingActionHub.classList.toggle('hidden-for-edit', isEditing);
    editModeControls.classList.toggle('visible', isEditing);
    
    // 根據模式，將地點搜尋框移動到合適的位置
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

    // 進入/離開編輯模式時，在地圖上繪製/移除編輯器
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

/**
 * 初始化美食地圖並根據篩選後的數據渲染標記和分類列表
 * @param {Object} filteredData - 篩選後的餐廳數據
 */
export function initCategoriesMapAndRender(filteredData) {
    initCategoriesMap(); 
    updateMapMarkers(filteredData, state.userLocation, state.searchCenter, state.focusedCategories, state.activeCategory);
    
    const isFocusMode = state.focusedCategories.size > 0;

    // 決定地圖視野
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
    
    // 處理無結果時的提示訊息
    if (Object.keys(filteredData).length === 0 && Object.keys(state.restaurantData).length > 0) {
         DOMElements.categoryList.innerHTML = `<p class="empty-state-message">找不到符合條件的餐廳耶，試著放寬篩選看看？</p>`;
    } else if (Object.keys(state.restaurantData).length === 0) {
         DOMElements.categoryList.innerHTML = `<p class="empty-state-message">此區域似乎沒有餐廳喔！</p>`;
    }
}

/**
 * 渲染分類列表
 * @param {Object} filteredData - 篩選後的餐廳數據
 */
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

/**
 * 更新候選清單的計數器徽章
 */
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

/**
 * 根據當前 state 更新篩選面板的 UI
 */
export function updateFilterUI() {
    const { priceLevel, rating } = state.filters;
    DOMElements.priceFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === priceLevel); });
    DOMElements.ratingFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === rating); });
}

/**
 * 顯示結果遮罩（打字機效果）
 * @param {string} winner - 獲勝的餐廳名稱
 */
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

/**
 * 隱藏結果遮罩，並根據當前頁面執行後續動作
 */
export function hideResult() {
    DOMElements.resultOverlay.classList.remove('visible');
    
    if (state.currentPage === 'wheel-page') {
        hideWheelResult(); // 如果在羅盤頁，則重置羅盤
    } else {
        clearWinnerMarker(); // 否則，清除地圖上的獲勝標記
        applyFiltersAndRender(); // 並重新渲染地圖
    }
}

// --- 地點搜尋 UI ---

/**
 * 切換搜尋 UI 的展開/收合狀態
 * @param {boolean} isActive - 是否啟用
 */
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

/**
 * 渲染搜尋結果列表
 * @param {Array} results - 從 API 獲取的結果陣列
 * @param {string} mapKey - 當前操作的地圖 key
 */
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

/**
 * 清空搜尋結果列表
 */
export function clearSearchResults() {
    DOMElements.locationSearchResults.innerHTML = '';
    DOMElements.locationSearchResults.classList.remove('visible');
}