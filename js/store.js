// js/store.js

import { state } from './state.js';
import { updateWheelCount } from './ui.js';
import { applyFiltersAndRender } from './handlers.js';

/**
 * 檢查指定的餐廳是否已在候選清單中
 * @param {string} name - 餐廳名稱
 * @returns {boolean}
 */
export function hasCandidate(name) {
    return state.wheelItems.has(name);
}

/**
 * 將一家餐廳加入候選清單
 * @param {string} name - 餐廳名稱
 * @returns {boolean} - 回傳是否成功加入
 */
export function addCandidate(name) {
    if (state.wheelItems.size >= 8) {
        alert('候選清單最多8個選項喔！');
        return false;
    }
    state.wheelItems.add(name);
    _onCandidateChange();
    return true;
}

/**
 * 從候選清單中移除一家餐廳
 * @param {string} name - 餐廳名稱
 */
export function removeCandidate(name) {
    state.wheelItems.delete(name);
    _onCandidateChange();
}

/**
 * 當候選清單發生變化時，觸發必要的 UI 更新
 * @private
 */
function _onCandidateChange() {
    updateWheelCount();
    // 重新渲染地圖是為了更新 marker 的 popup 狀態
    if (state.currentPage === 'categories-page') {
        applyFiltersAndRender();
    }
}