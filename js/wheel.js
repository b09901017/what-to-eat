// js/wheel.js

import { state, DOMElements } from './state.js';
import { showResult } from './ui.js';

/**
 * 根據 state.wheelItems 渲染命運羅盤的扇區
 */
export function renderWheel() {
    const items = [...state.wheelItems];
    const hasEnoughItems = items.length >= 2;

    DOMElements.wheelPlaceholder.style.display = hasEnoughItems ? 'none' : 'block';
    DOMElements.wheelContainer.parentElement.style.display = hasEnoughItems ? 'flex' : 'none';
    DOMElements.spinBtn.style.display = hasEnoughItems ? 'inline-flex' : 'none';
    DOMElements.spinBtn.disabled = state.isSpinning;

    if (!hasEnoughItems) return;

    DOMElements.wheelContainer.innerHTML = '';
    const sliceAngle = 360 / items.length;
    const colors = ['#FFF1E6', '#F0EFEB'];
    DOMElements.wheelContainer.style.setProperty('--slice-angle', `${sliceAngle}deg`);

    items.forEach((item, index) => {
        const slice = document.createElement('div');
        slice.className = 'wheel-slice';
        slice.dataset.name = item;
        slice.style.transform = `rotate(${sliceAngle * index}deg)`;
        
        const sliceContent = document.createElement('div');
        sliceContent.className = 'wheel-slice-content';
        sliceContent.style.backgroundColor = colors[index % colors.length];
        
        const text = document.createElement('span');
        text.className = 'wheel-slice-text';
        text.textContent = item;
        
        sliceContent.appendChild(text);
        slice.appendChild(sliceContent);
        
        if (items.length > 2) {
            const angleRad = (Math.PI / 180) * sliceAngle;
            const tan = Math.tan(angleRad / 2);
            slice.style.clipPath = `polygon(50% 50%, 100% ${50 - tan * 50}%, 100% ${50 + tan * 50}%)`;
        }
        
        DOMElements.wheelContainer.appendChild(slice);
    });
}

/**
 * 處理轉動按鈕的點擊事件，執行轉盤動畫
 */
export function handleSpinWheel() {
    if (state.isSpinning) return;
    state.isSpinning = true;
    DOMElements.spinBtn.disabled = true;

    const items = [...state.wheelItems];
    const sliceAngle = 360 / items.length;
    const randomIndex = Math.floor(Math.random() * items.length);
    const winner = items[randomIndex];
    state.lastWinner = winner;

    const randomOffset = (Math.random() * 0.8 - 0.4) * sliceAngle;
    const targetRotation = 360 * 5 + (360 - (randomIndex * sliceAngle)) - (sliceAngle / 2) + randomOffset;
    
    let start = null;
    const duration = 5000;
    const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

    const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const t = Math.min(progress / duration, 1);
        const easedT = easeOutQuint(t);
        const rotation = state.currentWheelRotation + easedT * (targetRotation - state.currentWheelRotation);
        
        DOMElements.wheelContainer.style.transform = `rotate(${rotation}deg)`;

        if (progress < duration) {
            state.animationFrameId = requestAnimationFrame(step);
        } else {
            state.currentWheelRotation = rotation % 360;
            state.isSpinning = false;
            DOMElements.spinBtn.disabled = false;
            
            const winnerSlice = DOMElements.wheelContainer.querySelector(`.wheel-slice[data-name="${winner}"]`);
            if (winnerSlice) winnerSlice.classList.add('winner-glow');
            
            setTimeout(() => showResult(winner), 500);
        }
    };

    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = requestAnimationFrame(step);
}


/**
 * *** 修改：僅處理羅盤頁面的結果重置 ***
 */
export function hideResult() {
    const winnerSlice = DOMElements.wheelContainer.querySelector('.winner-glow');
    if (winnerSlice) {
        winnerSlice.classList.remove('winner-glow');
    }
    renderWheel();
}