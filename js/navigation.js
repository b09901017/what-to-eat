// 處理頁面導航邏輯

import { state, DOMElements } from './state.js';
import { renderPageContent } from './ui.js';

function _setActivePage(pageId) {
    state.currentPage = pageId;
    DOMElements.pages.forEach(page => {
        page.classList.toggle('active', page.id === pageId);
    });
    renderPageContent(pageId);
}

export function navigateTo(pageId) {
    if (state.currentPage === pageId) return;

    state.navigationStack.push(state.currentPage);
    _setActivePage(pageId);
}

export function navigateBack() {
    const previousPage = state.navigationStack.pop();
    if (previousPage) {
        _setActivePage(previousPage);
    }
}