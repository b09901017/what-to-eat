// js/main.js

import { DOMElements } from './state.js';
import { navigateTo, navigateBack } from './navigation.js';
import {
    handleConfirmRadius,
    handleRecenter,
    handlePreviewCardInteraction,
    toggleFilterPanel,
    handleFilterChange,
    handleCategoryInteraction,
    handleResetView,
    handleToggleRadiusEdit,
    handleConfirmRadiusReSearch,
    handleToggleHub,
    handleSearchIconClick,
    handleSearchInput,
    handleSearchResultClick,
    handleRandomDecisionOnMap,
    handleReturnToCenter,
    handleUITestMode,
    handleRetryCategorization 
} from './handlers.js';
import {
    handleShowCandidateList,
    handleCandidateListInteraction,
    hideCandidateList
} from './candidate.js';
import { handleSpinWheel } from './wheel.js';
import { handleAddToWheelFromDetails } from './details.js';
import { updateWheelCount, hideResult } from './ui.js';

function init() {
    DOMElements.startBtn.addEventListener('click', () => navigateTo('map-page'));
    DOMElements.uiTestBtn.addEventListener('click', handleUITestMode);
    DOMElements.confirmRadiusBtn.addEventListener('click', handleConfirmRadius);
    DOMElements.recenterBtn.addEventListener('click', handleRecenter);
    
    DOMElements.backBtns.forEach(btn => btn.addEventListener('click', navigateBack));
    
    DOMElements.goToWheelBtn.addEventListener('click', () => navigateTo('wheel-page'));
    
    DOMElements.reSearchBtn.addEventListener('click', handleConfirmRadiusReSearch); 
    DOMElements.cancelEditBtn.addEventListener('click', handleToggleRadiusEdit);
    
    DOMElements.spinBtn.addEventListener('click', handleSpinWheel);
    DOMElements.closeResultBtn.addEventListener('click', hideResult);
    
    // ** [修改] ** 區分點擊 "重試按鈕" 和 "分類項目"
    DOMElements.categoryList.addEventListener('click', (e) => {
        if (e.target.classList.contains('retry-btn')) {
            handleRetryCategorization(e); // 將事件傳遞下去
        } else {
            handleCategoryInteraction(e);
        }
    });
    
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
    
    DOMElements.locationSearchToggleBtn.addEventListener('click', handleSearchIconClick);
    DOMElements.locationSearchInput.addEventListener('input', handleSearchInput);
    DOMElements.locationSearchResults.addEventListener('click', handleSearchResultClick);

    updateWheelCount();
}

document.addEventListener('DOMContentLoaded', init);