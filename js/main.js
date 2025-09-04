// 應用程式主入口

import { DOMElements } from './state.js';
import { navigateTo, navigateBack } from './navigation.js';
import {
    handleConfirmRadius,
    handleRecenter,
    handleSpinWheel,
    handlePreviewCardInteraction,
    handleAddToWheelFromDetails,
    toggleFilterPanel,
    handleFilterChange,
    handleClickToCloseFilter,
    handleCategoryInteraction,
    handleResetView,
    handleToggleRadiusEdit,
    handleConfirmRadiusReSearch,
    handleToggleHub,
    handleShowCandidateList, // *** 新增 ***
    handleCandidateListInteraction, // *** 新增 ***
} from './handlers.js';
import { hideResult, updateWheelCount, hideCandidateList } from './ui.js';

// 初始化應用程式
function init() {
    // 綁定所有事件監聽器
    DOMElements.startBtn.addEventListener('click', () => navigateTo('map-page'));
    DOMElements.confirmRadiusBtn.addEventListener('click', handleConfirmRadius);
    DOMElements.recenterBtn.addEventListener('click', handleRecenter);
    
    DOMElements.backBtns.forEach(btn => btn.addEventListener('click', navigateBack));
    DOMElements.goToWheelBtn.addEventListener('click', () => navigateTo('wheel-page')); // *** 修改 ***
    DOMElements.reSearchBtn.addEventListener('click', handleConfirmRadiusReSearch); 
    
    DOMElements.spinBtn.addEventListener('click', handleSpinWheel);
    DOMElements.closeResultBtn.addEventListener('click', hideResult);
    
    DOMElements.categoryList.addEventListener('click', handleCategoryInteraction);
    DOMElements.restaurantPreviewList.addEventListener('mouseover', handlePreviewCardInteraction);
    DOMElements.restaurantPreviewList.addEventListener('click', handlePreviewCardInteraction);
    
    DOMElements.addToWheelDetailsBtn.addEventListener('click', handleAddToWheelFromDetails);

    DOMElements.filterBtn.addEventListener('click', toggleFilterPanel);
    DOMElements.resetViewBtn.addEventListener('click', handleResetView);
    DOMElements.resizeRadiusBtn.addEventListener('click', handleToggleRadiusEdit);
    DOMElements.closeFilterBtn.addEventListener('click', toggleFilterPanel);
    DOMElements.openNowToggle.addEventListener('change', handleFilterChange);
    DOMElements.priceFilterButtons.addEventListener('click', handleFilterChange);
    DOMElements.ratingFilterButtons.addEventListener('click', handleFilterChange);
    
    DOMElements.hubToggleBtn.addEventListener('click', handleToggleHub);
    
    // *** 新增：為候選清單視窗綁定事件 ***
    DOMElements.showCandidatesBtn.addEventListener('click', handleShowCandidateList);
    DOMElements.closeCandidateListBtn.addEventListener('click', hideCandidateList);
    DOMElements.candidateListOverlay.addEventListener('click', (e) => {
        if (e.target === DOMElements.candidateListOverlay) hideCandidateList();
    });
    DOMElements.candidateListContent.addEventListener('click', handleCandidateListInteraction);


    updateWheelCount();
}

document.addEventListener('DOMContentLoaded', init);