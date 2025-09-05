// js/wheel.js

import { state, DOMElements } from './state.js';

/**
 * 根據 state.wheelItems 渲染命運羅盤的扇區
 */
export function renderWheel() {
    const items = [...state.wheelItems];
    const hasEnoughItems = items.length >= 2;

    // 根據是否有足夠選項，切換佔位符和羅盤的顯示
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
        
        // 使用 clip-path 繪製扇形
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

    // 增加隨機偏移量，讓指針不會每次都停在正中間
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
 * 顯示轉盤結果的彈出視窗
 * @param {string} winner - 獲勝的餐廳名稱
 */
export function showResult(winner) {
    DOMElements.resultText.textContent = '';
    DOMElements.resultOverlay.classList.add('visible');
    
    let i = 0;
    function typeWriter() {
        if (i < winner.length) {
            DOMElements.resultText.innerHTML += winner.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    }
    typeWriter();
}

/**
 * 隱藏轉盤結果的彈出視窗，並重置羅盤狀態
 */
export function hideResult() {
    DOMElements.resultOverlay.classList.remove('visible');
    const winnerSlice = DOMElements.wheelContainer.querySelector('.winner-glow');
    if (winnerSlice) {
        winnerSlice.classList.remove('winner-glow');
    }
    renderWheel(); // 重新渲染以清除高亮
}