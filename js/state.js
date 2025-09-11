// 集中管理所有狀態和 DOM 元素參照

export const state = {
    currentPage: 'splash-page',
    navigationStack: [],
    wheelItems: new Set(),
    currentRestaurantDetails: null,
    isSpinning: false,
    userLocation: null,
    searchRadiusMeters: 500,
    searchCenter: null,
    restaurantData: {},
    activeCategory: null,
    focusedCategories: new Set(),
    currentWheelRotation: 0,
    animationFrameId: null,
    filters: {
        openNow: true,
        priceLevel: 0,
        rating: 0,
    },
    isEditingRadius: false,
    isHubExpanded: false,
    isSearchActive: false,
    searchTimeoutId: null,
    isDecidingOnMap: false,
    lastWinner: null,
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
    goToWheelBtn: document.getElementById('go-to-wheel-btn'),
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
    
    categoriesPage: document.getElementById('categories-page'),
    filterBtn: document.getElementById('filter-btn'),
    resizeRadiusBtn: document.getElementById('resize-radius-btn'),
    returnToCenterBtn: document.getElementById('return-to-center-btn'),
    filterPanel: document.getElementById('filter-panel'),
    closeFilterBtn: document.getElementById('close-filter-btn'),
    openNowToggle: document.getElementById('open-now-toggle'),
    priceFilterButtons: document.querySelector('.filter-buttons[data-filter="priceLevel"]'),
    ratingFilterButtons: document.querySelector('.filter-buttons[data-filter="rating"]'),
    
    // *** 新增：取得 header 和 bottom drawer 的參照 ***
    pageHeaderCondensed: document.querySelector('.page-header-condensed'),
    mapBottomDrawer: document.querySelector('.map-bottom-drawer'),

    floatingActionHub: document.getElementById('floating-action-hub'),
    hubToggleBtn: document.getElementById('hub-toggle-btn'),
    hubItemList: document.getElementById('hub-item-list'),

    // 調整範圍模式相關元素
    mainFooter: document.getElementById('main-footer'),
    editModeControls: document.getElementById('edit-mode-controls'),
    reSearchBtn: document.getElementById('re-search-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    
    // 候選清單視窗相關元素
    showCandidatesFooterBtn: document.getElementById('show-candidates-footer-btn'),
    candidateListOverlay: document.getElementById('candidate-list-overlay'),
    candidateListContent: document.getElementById('candidate-list-content'),
    closeCandidateListBtn: document.getElementById('close-candidate-list-btn'),
    randomDecisionBtn: document.getElementById('random-decision-btn'),
    
    // 地點搜尋相關元素
    locationSearchContainer: document.getElementById('location-search-container'),
    locationSearchToggleBtn: document.querySelector('.location-search-toggle-btn'),
    locationSearchInput: document.getElementById('location-search-input'),
    locationSearchResults: document.getElementById('location-search-results'),
    
    // 新的「顯示所有店家」按鈕
    showAllBtn: document.getElementById('show-all-btn'),
};