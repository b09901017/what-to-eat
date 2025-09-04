// 處理所有 DOM 渲染和更新

import { state, DOMElements } from './state.js';
import { getUserLocation } from './handlers.js';
import { initCategoriesMap, updateMapMarkers, fitMapToBounds, destroyRadiusMap, drawRadiusEditor, removeRadiusEditor, setRadiusMapCenter } from './map.js';

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
    const { categoryListContainer, floatingActionHub, reSearchBtn, hubItemList, goToWheelBtn } = DOMElements;
    
    categoryListContainer.classList.toggle('hidden', isEditing);
    floatingActionHub.classList.toggle('hidden', isEditing);
    goToWheelBtn.style.display = isEditing ? 'none' : 'inline-flex';
    
    reSearchBtn.classList.toggle('visible', isEditing);
    hubItemList.style.display = isEditing ? 'none' : '';
    DOMElements.hubToggleBtn.style.display = isEditing ? 'none' : 'flex';

    if (isEditing) {
        const center = state.searchCenter || state.userLocation;
        initCategoriesMap(); 
        setRadiusMapCenter('categories', center);
        drawRadiusEditor('categories', center, state.searchRadiusMeters, onRadiusChange);
        updateRadiusLabel(state.searchRadiusMeters);
    } else {
        removeRadiusEditor('categories');
        DOMElements.radiusLabel.classList.remove('visible');
    }
}

export function initCategoriesMapAndRender(filteredData) {
    initCategoriesMap();
    updateMapMarkers(filteredData, state.userLocation, state.focusedCategories, state.activeCategory);
    
    const coordsToFit = [];
    const isFocusMode = state.focusedCategories.size > 0;

    if (isFocusMode) {
        for (const category of state.focusedCategories) {
            if (filteredData[category]) {
                filteredData[category].forEach(r => coordsToFit.push([r.lat, r.lon]));
            }
        }
    } else {
        Object.values(filteredData).flat().forEach(r => coordsToFit.push([r.lat, r.lon]));
    }
    
    if (state.userLocation) { coordsToFit.push([state.userLocation.lat, state.userLocation.lon]); }
    if (coordsToFit.length > 0) { fitMapToBounds(coordsToFit, { paddingTopLeft: [20, 100], paddingBottomRight: [20, 200] }); }

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

export function renderDetailsPage() {
    const data = state.currentRestaurantDetails;
    if (!data) return;

    DOMElements.detailsHeaderImage.style.backgroundImage = `url(${data.details.photos[0]})`;
    DOMElements.detailsTitle.textContent = data.name;
    DOMElements.detailsRating.textContent = `⭐ ${data.rating}`;
    DOMElements.detailsPrice.textContent = '$'.repeat(data.price_level);
    DOMElements.detailsStatus.textContent = data.hours;

    const isAdded = state.wheelItems.has(data.name);
    DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
    DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';

    const hoursList = data.details.opening_hours.weekday_text;
    DOMElements.detailsHoursList.innerHTML = hoursList && hoursList.length > 0 ? hoursList.map(line => `<li>${line}</li>`).join('') : '<li>暫無提供營業時間</li>';

    const reviewsList = data.details.reviews;
    DOMElements.detailsReviewsList.innerHTML = reviewsList && reviewsList.length > 0 ? reviewsList.map(review => `<div class="review-card"><div class="review-card-header"><span class="review-author">${review.author_name}</span><span class="review-rating">${'⭐'.repeat(review.rating)}</span><span class="review-time">${review.relative_time_description}</span></div><p class="review-text">${review.text}</p></div>`).join('') : '<p>暫無評論</p>';

    DOMElements.callBtn.onclick = () => { if (data.details.formatted_phone_number) window.location.href = `tel:${data.details.formatted_phone_number}`; };
    DOMElements.websiteBtn.onclick = () => { if (data.details.website && data.details.website !== '#') window.open(data.details.website, '_blank'); };
}

export function renderWheel() {
    const items = [...state.wheelItems];
    const hasEnoughItems = items.length >= 2;
    DOMElements.wheelPlaceholder.style.display = hasEnoughItems ? 'none' : 'block';
    DOMElements.wheelContainer.parentElement.style.display = hasEnoughItems ? 'flex' : 'none';
    DOMElements.spinBtn.style.display = hasEnoughItems ? 'inline-flex' : 'none';
    DOMElements.spinBtn.disabled = state.isSpinning;
    if (!hasEnoughItems) return;

    DOMElements.wheelContainer.innerHTML = '';
    const sliceAngle = 360 / items.length;
    const colors = ['#FFF1E6', '#F0EFEB'];
    DOMElements.wheelContainer.style.setProperty('--slice-angle', `${sliceAngle}deg`);

    items.forEach((item, index) => {
        const slice = document.createElement('div');
        slice.className = 'wheel-slice';
        slice.dataset.name = item;
        slice.style.transform = `rotate(${sliceAngle * index}deg)`;
        const sliceContent = document.createElement('div');
        sliceContent.className = 'wheel-slice-content';
        sliceContent.style.backgroundColor = colors[index % colors.length];
        const text = document.createElement('span');
        text.className = 'wheel-slice-text';
        text.textContent = item;
        sliceContent.appendChild(text);
        slice.appendChild(sliceContent);
        if (items.length > 2) {
            const angleRad = (Math.PI / 180) * sliceAngle;
            const tan = Math.tan(angleRad / 2);
            slice.style.clipPath = `polygon(50% 50%, 100% ${50 - tan * 50}%, 100% ${50 + tan * 50}%)`;
        }
        DOMElements.wheelContainer.appendChild(slice);
    });
}

export function updateWheelCount() {
    const count = state.wheelItems.size;
    DOMElements.wheelCountBadges.forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
}

export function showResult(winner) {
    DOMElements.resultText.textContent = '';
    DOMElements.resultOverlay.classList.add('visible');
    
    let i = 0;
    function typeWriter() {
        if (i < winner.length) { DOMElements.resultText.innerHTML += winner.charAt(i); i++; setTimeout(typeWriter, 100); }
    }
    typeWriter();
}

export function hideResult() {
    DOMElements.resultOverlay.classList.remove('visible');
    const winnerSlice = DOMElements.wheelContainer.querySelector('.winner-glow');
    if (winnerSlice) { winnerSlice.classList.remove('winner-glow'); }
    renderWheel();
}

export function updateFilterUI() {
    const { priceLevel, rating } = state.filters;
    DOMElements.priceFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === priceLevel); });
    DOMElements.ratingFilterButtons.querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', Number(btn.dataset.value) === rating); });
}

export function renderCandidateList() {
    const contentEl = DOMElements.candidateListContent;
    contentEl.innerHTML = '';
    if (state.wheelItems.size === 0) {
        contentEl.innerHTML = '<p class="candidate-list-placeholder">尚未加入任何候選店家</p>';
        return;
    }
    [...state.wheelItems].forEach(name => {
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.innerHTML = `
            <span>${name}</span>
            <button class="remove-candidate-btn" data-name="${name}">&times;</button>
        `;
        contentEl.appendChild(item);
    });
}
export function showCandidateList() {
    renderCandidateList();
    DOMElements.candidateListOverlay.classList.add('visible');
}
export function hideCandidateList() {
    DOMElements.candidateListOverlay.classList.remove('visible');
}