// js/main.js

import { DOMElements } from './state.js';
import { navigateTo, navigateBack } from './navigation.js';
import {
    handleConfirmRadius,
    handleRecenter,
    handlePreviewCardInteraction,
    toggleFilterPanel,
    handleFilterChange,
    handleCategoryPress,
    handleCategoryRelease,
    handleResetView,
    handleToggleRadiusEdit,
    handleConfirmRadiusReSearch,
    handleToggleHub,
    handleSearchIconClick,
    handleSearchInput,
    handleSearchResultClick,
    handleRandomDecisionOnMap,
    handleReturnToCenter,
} from './handlers.js';
import {
    handleShowCandidateList,
    handleCandidateListInteraction,
    hideCandidateList
} from './candidate.js';
import { handleSpinWheel } from './wheel.js';
import { handleAddToWheelFromDetails } from './details.js';
import { updateWheelCount, hideResult } from './ui.js';

// 初始化應用程式
function init() {
    // 綁定所有事件監聽器
    DOMElements.startBtn.addEventListener('click', () => navigateTo('map-page'));
    DOMElements.confirmRadiusBtn.addEventListener('click', handleConfirmRadius);
    DOMElements.recenterBtn.addEventListener('click', handleRecenter);
    
    DOMElements.backBtns.forEach(btn => btn.addEventListener('click', navigateBack));
    
    DOMElements.goToWheelBtn.addEventListener('click', () => navigateTo('wheel-page'));
    
    DOMElements.reSearchBtn.addEventListener('click', handleConfirmRadiusReSearch); 
    DOMElements.cancelEditBtn.addEventListener('click', handleToggleRadiusEdit);
    
    DOMElements.spinBtn.addEventListener('click', handleSpinWheel);
    DOMElements.closeResultBtn.addEventListener('click', hideResult);
    
    DOMElements.categoryList.addEventListener('mousedown', handleCategoryPress);
    DOMElements.categoryList.addEventListener('mouseup', handleCategoryRelease);
    DOMElements.categoryList.addEventListener('touchstart', handleCategoryPress, { passive: true });
    DOMElements.categoryList.addEventListener('touchend', handleCategoryRelease);
    DOMElements.categoryList.addEventListener('mouseleave', handleCategoryRelease);

    DOMElements.restaurantPreviewList.addEventListener('click', handlePreviewCardInteraction);
    
    DOMElements.addToWheelDetailsBtn.addEventListener('click', handleAddToWheelFromDetails);

    DOMElements.filterBtn.addEventListener('click', toggleFilterPanel);
    DOMElements.showAllBtn.addEventListener('click', handleResetView);
    DOMElements.resizeRadiusBtn.addEventListener('click', handleToggleRadiusEdit);
    DOMElements.returnToCenterBtn.addEventListener('click', handleReturnToCenter);
    DOMElements.closeFilterBtn.addEventListener('click', toggleFilterPanel);
    DOMElements.openNowToggle.addEventListener('change', handleFilterChange);
    DOMElements.priceFilterButtons.addEventListener('click', handleFilterChange);
    DOMElements.ratingFilterButtons.addEventListener('click', handleFilterChange);
    
    DOMElements.hubToggleBtn.addEventListener('click', handleToggleHub);
    
    DOMElements.showCandidatesFooterBtn.addEventListener('click', handleShowCandidateList);
    DOMElements.closeCandidateListBtn.addEventListener('click', hideCandidateList);
    DOMElements.candidateListOverlay.addEventListener('click', (e) => {
        if (e.target === DOMElements.candidateListOverlay) hideCandidateList();
    });
    DOMElements.candidateListContent.addEventListener('click', handleCandidateListInteraction);
    DOMElements.randomDecisionBtn.addEventListener('click', handleRandomDecisionOnMap);
    
    // 為地點搜尋元件綁定事件
    DOMElements.locationSearchToggleBtn.addEventListener('click', handleSearchIconClick);
    DOMElements.locationSearchInput.addEventListener('input', handleSearchInput);
    DOMElements.locationSearchResults.addEventListener('click', handleSearchResultClick);


    // 初始化 UI
    updateWheelCount();
}

document.addEventListener('DOMContentLoaded', init);