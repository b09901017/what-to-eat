// 集中管理所有狀態和 DOM 元素參照

export const state = {
    currentPage: 'splash-page',
    navigationStack: [],
    wheelItems: new Set(),
    currentRestaurantDetails: null,
    isSpinning: false,
    userLocation: null,
    searchRadiusMeters: 500,
    restaurantData: {},
    activeCategory: null,
    currentWheelRotation: 0,
    animationFrameId: null,
    filters: {
        openNow: true,
        priceLevel: 0,
        rating: 0,
    },
};

export const DOMElements = {
    pages: document.querySelectorAll('.page'),
    startBtn: document.getElementById('start-btn'),
    locationStatus: document.getElementById('location-status'),
    radiusMap: document.getElementById('radius-map'),
    recenterBtn: document.getElementById('recenter-btn'),
    radiusLabel: document.getElementById('radius-label'),
    confirmRadiusBtn: document.getElementById('confirm-radius-btn'),
    leafletMap: document.getElementById('leaflet-map'),
    categoryList: document.getElementById('category-list'),
    restaurantPreviewList: document.getElementById('restaurant-preview-list'),
    wheelContainer: document.getElementById('wheel-container'),
    spinBtn: document.getElementById('spin-btn'),
    wheelPlaceholder: document.getElementById('wheel-placeholder'),
    backBtns: document.querySelectorAll('.back-btn'),
    wheelCountBadges: document.querySelectorAll('.wheel-count-badge'),
    viewWheelBtn: document.getElementById('view-wheel-btn'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    resultOverlay: document.getElementById('result-overlay'),
    resultText: document.getElementById('result-text'),
    closeResultBtn: document.getElementById('close-result-btn'),
    detailsPage: document.getElementById('details-page'),
    detailsHeaderImage: document.querySelector('.details-header-image'),
    detailsTitle: document.querySelector('.details-title'),
    detailsRating: document.querySelector('.details-rating'),
    detailsPrice: document.querySelector('.details-price'),
    detailsStatus: document.querySelector('.details-status'),
    callBtn: document.getElementById('call-btn'),
    websiteBtn: document.getElementById('website-btn'),
    addToWheelDetailsBtn: document.getElementById('add-to-wheel-details-btn'),
    detailsHoursList: document.querySelector('.details-hours-list'),
    detailsReviewsList: document.querySelector('.details-reviews-list'),
    
    // *** 優化第二點：新增 DOM 元素參照 ***
    categoriesPage: document.getElementById('categories-page'), // 整個頁面容器
    filterBtn: document.getElementById('filter-btn'),
    filterPanel: document.getElementById('filter-panel'),
    closeFilterBtn: document.getElementById('close-filter-btn'), // 關閉按鈕
    openNowToggle: document.getElementById('open-now-toggle'),
    priceFilterButtons: document.querySelector('.filter-buttons[data-filter="priceLevel"]'),
    ratingFilterButtons: document.querySelector('.filter-buttons[data-filter="rating"]'),
};