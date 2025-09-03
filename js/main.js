// 應用程式主入口

import { DOMElements } from './state.js';
import { navigateTo, navigateBack } from './navigation.js';
import {
    handleConfirmRadius,
    handleRecenter,
    handleSpinWheel,
    handleCategoryInteraction,
    handlePreviewCardInteraction,
    handleAddToWheelFromDetails
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
    DOMElements.restaurantPreviewList.addEventListener('mouseover', handlePreviewCardInteraction);
    DOMElements.restaurantPreviewList.addEventListener('click', handlePreviewCardInteraction);
    
    DOMElements.addToWheelDetailsBtn.addEventListener('click', handleAddToWheelFromDetails);
    
    // 初始渲染
    updateWheelCount();
}

// 當 DOM 載入完成後，啟動應用程式
document.addEventListener('DOMContentLoaded', init);