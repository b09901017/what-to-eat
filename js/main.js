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
    handleResetView // *** 新增 ***
} from './handlers.js';
import { hideResult, updateWheelCount } from './ui.js';

// 初始化應用程式
function init() {
    // 綁定所有事件監聽器
    DOMElements.startBtn.addEventListener('click', () => navigateTo('map-page'));
    DOMElements.confirmRadiusBtn.addEventListener('click', handleConfirmRadius);
    DOMElements.recenterBtn.addEventListener('click', handleRecenter);
    
    DOMElements.backBtns.forEach(btn => btn.addEventListener('click', navigateBack));
    DOMElements.viewWheelBtn.addEventListener('click', () => navigateTo('wheel-page'));
    
    DOMElements.spinBtn.addEventListener('click', handleSpinWheel);
    DOMElements.closeResultBtn.addEventListener('click', hideResult);
    
    DOMElements.categoryList.addEventListener('click', handleCategoryInteraction);
    // *** 恢復預覽列表的事件監聽 ***
    DOMElements.restaurantPreviewList.addEventListener('mouseover', handlePreviewCardInteraction);
    DOMElements.restaurantPreviewList.addEventListener('click', handlePreviewCardInteraction);
    
    DOMElements.addToWheelDetailsBtn.addEventListener('click', handleAddToWheelFromDetails);

    DOMElements.filterBtn.addEventListener('click', toggleFilterPanel);
    DOMElements.resetViewBtn.addEventListener('click', handleResetView); // *** 新增 ***
    DOMElements.closeFilterBtn.addEventListener('click', toggleFilterPanel);
    DOMElements.openNowToggle.addEventListener('change', handleFilterChange);
    DOMElements.priceFilterButtons.addEventListener('click', handleFilterChange);
    DOMElements.ratingFilterButtons.addEventListener('click', handleFilterChange);
    
    updateWheelCount();
}

document.addEventListener('DOMContentLoaded', init);