// js/details.js

import { state, DOMElements } from './state.js';
import { addCandidate, removeCandidate, hasCandidate } from './store.js'; // *** 修改：從 store 引入 ***

/**
 * 根據 state.currentRestaurantDetails 渲染店家詳情頁面
 */
export function renderDetailsPage() {
    const data = state.currentRestaurantDetails;
    if (!data) return;

    DOMElements.detailsHeaderImage.style.backgroundImage = `url(${data.details.photos[0]})`;
    DOMElements.detailsTitle.textContent = data.name;
    DOMElements.detailsRating.textContent = `⭐ ${data.rating}`;
    DOMElements.detailsPrice.textContent = '$'.repeat(data.price_level);
    DOMElements.detailsStatus.textContent = data.hours;

    // 更新「加入候選」按鈕的狀態
    const isAdded = hasCandidate(data.name);
    DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
    DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';

    // 渲染營業時間
    const hoursList = data.details.opening_hours.weekday_text;
    DOMElements.detailsHoursList.innerHTML = hoursList && hoursList.length > 0
        ? hoursList.map(line => `<li>${line}</li>`).join('')
        : '<li>暫無提供營業時間</li>';

    // 渲染評論
    const reviewsList = data.details.reviews;
    DOMElements.detailsReviewsList.innerHTML = reviewsList && reviewsList.length > 0
        ? reviewsList.map(review => `
            <div class="review-card">
                <div class="review-card-header">
                    <span class="review-author">${review.author_name}</span>
                    <span class="review-rating">${'⭐'.repeat(review.rating)}</span>
                    <span class="review-time">${review.relative_time_description}</span>
                </div>
                <p class="review-text">${review.text}</p>
            </div>
        `).join('')
        : '<p>暫無評論</p>';

    // 綁定致電和網站按鈕事件
    DOMElements.callBtn.onclick = () => {
        if (data.details.formatted_phone_number) {
            window.location.href = `tel:${data.details.formatted_phone_number}`;
        }
    };
    DOMElements.websiteBtn.onclick = () => {
        if (data.details.website && data.details.website !== '#') {
            window.open(data.details.website, '_blank');
        }
    };
}

/**
 * 處理在詳情頁點擊「加入候選」按鈕的事件
 */
export function handleAddToWheelFromDetails() {
    if (state.currentRestaurantDetails) {
        const name = state.currentRestaurantDetails.name;
        
        // *** 修改：使用 store 進行邏輯判斷與操作 ***
        const isCurrentlyAdded = hasCandidate(name);
        if (isCurrentlyAdded) {
            removeCandidate(name);
        } else {
            addCandidate(name);
        }
        
        // 操作後再次檢查狀態並更新 UI
        const isAddedAfterOperation = hasCandidate(name);
        DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAddedAfterOperation);
        DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAddedAfterOperation ? '已加入' : '加入候選';
    }
}