// js/ui.js

import { state, DOMElements, loadingMessages } from './state.js';
import { getUserLocation, applyFiltersAndRender } from './handlers.js';
import { initCategoriesMap, updateMapMarkers, fitBoundsToSearchRadius, destroyRadiusMap, drawRadiusEditor, removeRadiusEditor, setRadiusMapCenter, getEditorState, clearWinnerMarker } from './map.js';
import { renderWheel, hideResult as hideWheelResult } from './wheel.js';
import { renderDetailsPage } from './details.js';
import { hideCandidateList } from './candidate.js';

export function initCategoriesMapAndRender(data) {
    initCategoriesMap();
    updateMapMarkers(data, state.userLocation, state.searchCenter, state.focusedCategories, state.activeCategory);
    if (state.isInitialMapView) {
        fitBoundsToSearchRadius();
        state.isInitialMapView = false;
    }
    
    // ** [修正] ** 渲染分類列表的邏輯現在由 applyFiltersAndRender 觸發後，
    // 在這裡被調用，以確保 UI 正確
    renderCategories(Array.isArray(data) ? null : data, state.isCategorizing);

    DOMElements.mapBottomDrawer?.classList.add('visible');
    const isFocusMode = state.focusedCategories.size > 0;
    DOMElements.showAllBtn.parentElement.classList.toggle('visible', isFocusMode);
}

export function renderCategories(filteredData, isCategorizing) {
    const listEl = DOMElements.categoryList;
    listEl.innerHTML = '';
    listEl.classList.remove('reveal');

    if (isCategorizing) {
        listEl.innerHTML = `
            <div class="chef-animation-container">
                <div class="chef"><div class="chef-hat"></div><div class="chef-head"><div class="chef-eye left"></div><div class="chef-eye right"></div></div></div>
                <div class="chef-pot"><div class="bubble"></div><div class="bubble"></div><div class="bubble"></div></div>
            </div>
            <p class="empty-state-message" style="padding-top: 0;">AI 大廚正在料理美食標籤...</p>`;
        return;
    }

    if (!filteredData) {
        const errorMessage = `<p>哎呀，AI 大廚罷工了！😭</p><button class="retry-btn">再試一次</button>`;
        listEl.innerHTML = `<div class="empty-state-message">${errorMessage}</div>`;
        return;
    }

    if (Object.keys(filteredData).length === 0) {
        const message = "此區域似乎沒有餐廳喔！";
        listEl.innerHTML = `<p class="empty-state-message">${message}</p>`;
        return;
    }
    
    const categoryKeys = Object.keys(filteredData);
    categoryKeys.forEach(category => {
        const item = document.createElement('div');
        item.className = 'category-list-item';
        item.dataset.category = category;
        item.textContent = category;
        listEl.appendChild(item);
    });

    setTimeout(() => listEl.classList.add('reveal'), 100);
    updateCategoryStyles();
}

export function updateCategoryStyles() {
    const isFocusMode = state.focusedCategories.size > 0;
    DOMElements.categoryList.querySelectorAll('.category-list-item').forEach(item => {
        const category = item.dataset.category;
        const isActive = state.focusedCategories.has(category);
        item.classList.toggle('active', isActive);
        item.classList.toggle('unfocused', isFocusMode && !isActive);
        if (isActive) item.classList.remove('unfocused');
    });
}

// --- 以下是其他未變動的函式，為確保完整性，全部提供 ---

export function renderPageContent(pageId) {
    switch (pageId) {
        case 'map-page': getUserLocation(); break;
        case 'categories-page':
            if (state.isEditingRadius) { state.isEditingRadius = false; toggleRadiusEditMode(false); }
            if (state.isHubExpanded) { state.isHubExpanded = false; toggleHub(false); }
            clearWinnerMarker();
            hideCandidateList();
            break;
        case 'wheel-page': renderWheel(); break;
        case 'details-page': renderDetailsPage(); break;
    }
    if (pageId !== 'map-page') { destroyRadiusMap(); }
    if (pageId !== 'categories-page') { DOMElements.filterPanel.classList.remove('visible'); }
}

export function toggleHub(isExpanded) {
    DOMElements.floatingActionHub.classList.toggle('is-active', isExpanded);
}

export function showLoading(text) {
    DOMElements.loadingText.textContent = text || loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
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
    const { floatingActionHub, mainFooter, editModeControls, locationSearchContainer, pageHeaderCondensed, mapBottomDrawer } = DOMElements;
    if (pageHeaderCondensed) pageHeaderCondensed.style.visibility = isEditing ? 'hidden' : 'visible';
    if (mapBottomDrawer) mapBottomDrawer.style.visibility = isEditing ? 'hidden' : 'visible';
    if (mainFooter) mainFooter.style.visibility = isEditing ? 'hidden' : 'visible';
    if (floatingActionHub) floatingActionHub.classList.toggle('hidden-for-edit', isEditing);
    editModeControls.classList.toggle('visible', isEditing);

    if (isEditing) {
        const hintElement = editModeControls.querySelector('.edit-mode-hint');
        if (hintElement) { editModeControls.insertBefore(locationSearchContainer, hintElement); }
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

export function renderRestaurantPreviewList(category, filteredData) {
    const listEl = DOMElements.restaurantPreviewList;
    const drawerEl = DOMElements.mapBottomDrawer;
    listEl.innerHTML = '';

    if (!category || !filteredData[category] || filteredData[category].length === 0) {
        listEl.classList.remove('visible');
        drawerEl.classList.remove('expanded');
        return;
    }

    filteredData[category].forEach(restaurant => {
        const card = document.createElement('div');
        card.className = 'restaurant-preview-card';
        card.dataset.name = restaurant.name;
        card.dataset.placeId = restaurant.place_id;
        card.innerHTML = `<h5>${restaurant.name}</h5><p>點擊地圖圖示可查看詳情</p>`;
        listEl.appendChild(card);
    });
    listEl.classList.add('visible');
    drawerEl.classList.add('expanded');
}

export function updateWheelCount() {
    const count = state.wheelItems.size;
    DOMElements.wheelCountBadges.forEach(badge => { badge.textContent = count; });
    DOMElements.showCandidatesFooterBtn.querySelector('.wheel-count-badge')?.classList.toggle('visible', count > 0);
}

export function updateFilterUI() {
    const { priceLevel, rating } = state.filters;
    DOMElements.priceFilterButtons.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.value) === priceLevel));
    DOMElements.ratingFilterButtons.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.value) === rating));
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