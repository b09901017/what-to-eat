// js/categoryDrawer.js

import { DOMElements } from './state.js';

const drawer = DOMElements.categoryDrawer;

export function show() {
    if (!drawer) return;
    // 使用 setTimeout 確保元素已渲染，動畫能順利觸發
    setTimeout(() => {
        drawer.classList.add('is-visible');
    }, 50); 
}

export function hide() {
    if (!drawer) return;
    drawer.classList.remove('is-visible');
}

export function initCategoryDrawer() {
    // 目前無須特別初始化，保留函式以便未來擴充
}