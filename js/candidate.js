// js/candidate.js

import { state, DOMElements } from './state.js';
import { toggleWheelItem } from './handlers.js'; // 依賴 handlers 中的核心邏輯

/**
 * 根據 state.wheelItems 渲染候選清單
 */
export function renderCandidateList() {
    const contentEl = DOMElements.candidateListContent;
    const decisionBtn = DOMElements.randomDecisionBtn;
    contentEl.innerHTML = '';
    
    const itemCount = state.wheelItems.size;

    if (itemCount === 0) {
        contentEl.innerHTML = '<p class="candidate-list-placeholder">尚未加入任何候選店家</p>';
    } else {
        [...state.wheelItems].forEach(name => {
            const item = document.createElement('div');
            item.className = 'candidate-item';
            item.innerHTML = `
                <span>${name}</span>
                <button class="remove-candidate-btn" data-name="${name}">&times;</button>
            `;
            contentEl.appendChild(item);
        });
    }

    // 根據候選數量決定是否禁用決定按鈕
    if (itemCount >= 2) {
        decisionBtn.disabled = false;
    } else {
        decisionBtn.disabled = true;
    }
}

/**
 * 顯示候選清單彈出視窗
 */
export function showCandidateList() {
    renderCandidateList();
    DOMElements.candidateListOverlay.classList.add('visible');
}

/**
 * 隱藏候選清單彈出視窗
 */
export function hideCandidateList() {
    DOMElements.candidateListOverlay.classList.remove('visible');
}

/**
 * 處理點擊「查看候選」按鈕的事件
 */
export function handleShowCandidateList() {
    showCandidateList();
}

/**
 * 處理在候選清單中的互動（例如：移除店家）
 * @param {Event} e - 點擊事件
 */
export function handleCandidateListInteraction(e) {
    const removeBtn = e.target.closest('.remove-candidate-btn');
    if (removeBtn) {
        const name = removeBtn.dataset.name;
        toggleWheelItem(name, false); // 調用核心處理邏輯來移除
        renderCandidateList(); // 重新渲染列表
    }
}