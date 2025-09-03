document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'http://127.0.0.1:5000/api/search';

    const state = {
        currentPage: 'splash-page',
        navigationStack: [],
        wheelItems: new Set(),
        currentRestaurantDetails: null, // 新增：儲存當前查看的店家詳情
        isSpinning: false,
        userLocation: null,
        searchRadiusMeters: 500,
        restaurantData: {},
        activeCategory: null,
        categoryColors: { "中式麵館 🍜": "#E57373", "美味便當 🍱": "#81C784", "義式風情 🍝": "#64B5F6", "健康早午餐 🥪": "#FFD54F", "手搖飲料 🍹": "#BA68C8" },
        mapInstance: null,
        mapMarkers: {},
        restaurantMarkers: {},
        userMarker: null,
        radiusMapInstance: null,
        radiusCircle: null,
        radiusDragMarker: null,
        currentWheelRotation: 0,
        animationFrameId: null,
    };

    const DOMElements = {
        pages: document.querySelectorAll('.page'),
        startBtn: document.getElementById('start-btn'),
        locationStatus: document.getElementById('location-status'),
        radiusMap: document.getElementById('radius-map'),
        recenterBtn: document.getElementById('recenter-btn'),
        radiusLabel: document.getElementById('radius-label'),
        confirmRadiusBtn: document.getElementById('confirm-radius-btn'),
        leafletMap: document.getElementById('leaflet-map'),
        categoryList: document.getElementById('category-list'),
        restaurantPreviewList: document.getElementById('restaurant-preview-list'),
        wheelContainer: document.getElementById('wheel-container'),
        spinBtn: document.getElementById('spin-btn'),
        wheelPlaceholder: document.getElementById('wheel-placeholder'),
        backBtns: document.querySelectorAll('.back-btn'),
        wheelCountBadges: document.querySelectorAll('.wheel-count-badge'),
        viewWheelBtn: document.getElementById('view-wheel-btn'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingText: document.getElementById('loading-text'),
        resultOverlay: document.getElementById('result-overlay'),
        resultText: document.getElementById('result-text'),
        closeResultBtn: document.getElementById('close-result-btn'),
        // 新增：店家詳情頁面元素
        detailsPage: document.getElementById('details-page'),
        detailsHeaderImage: document.querySelector('.details-header-image'),
        detailsTitle: document.querySelector('.details-title'),
        detailsRating: document.querySelector('.details-rating'),
        detailsPrice: document.querySelector('.details-price'),
        detailsStatus: document.querySelector('.details-status'),
        callBtn: document.getElementById('call-btn'),
        websiteBtn: document.getElementById('website-btn'),
        addToWheelDetailsBtn: document.getElementById('add-to-wheel-details-btn'),
        detailsHoursList: document.querySelector('.details-hours-list'),
        detailsReviewsList: document.querySelector('.details-reviews-list'),
    };

    const navigate = {
        to: (pageId) => {
            if (state.currentPage === pageId) return;
            if (state.currentPage === 'map-page' && state.radiusMapInstance) {
                state.radiusMapInstance.remove();
                state.radiusMapInstance = null;
            }
            state.navigationStack.push(state.currentPage);
            state.currentPage = pageId;
            DOMElements.pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');

            // 根據不同頁面執行初始化
            if (pageId === 'map-page') handlers.getUserLocation();
            if (pageId === 'categories-page') handlers.initCategoriesMapAndRender();
            if (pageId === 'wheel-page') render.wheel();
            if (pageId === 'details-page') render.detailsPage();
        },
        back: () => {
            const previousPage = state.navigationStack.pop();
            if (previousPage) {
                state.currentPage = previousPage;
                DOMElements.pages.forEach(page => page.classList.remove('active'));
                document.getElementById(previousPage).classList.add('active');
            }
        }
    };

    const render = {
        categories: () => {
            DOMElements.categoryList.innerHTML = '';
            Object.keys(state.restaurantData).forEach(category => {
                const item = document.createElement('div');
                item.className = 'category-list-item';
                item.textContent = `${category.split(' ')[1]} ${category.split(' ')[0]}`;
                item.dataset.category = category;
                DOMElements.categoryList.appendChild(item);
            });
        },
        mapMarkers: (highlightedCategory = null) => {
            Object.values(state.restaurantMarkers).forEach(marker => marker.remove());
            state.mapMarkers = {}; state.restaurantMarkers = {};
            if(state.userMarker) state.userMarker.remove();
            if (state.userLocation && state.mapInstance) {
                 state.userMarker = L.marker([state.userLocation.lat, state.userLocation.lon], { 
                    icon: L.divIcon({ html: '<div class="user-location-marker"></div>', className: '', iconSize: [20, 20]}),
                    zIndexOffset: 2000
                }).addTo(state.mapInstance);
            }
            for (const category in state.restaurantData) {
                state.mapMarkers[category] = [];
                const color = state.categoryColors[category] || '#BDBDBD';
                state.restaurantData[category].forEach(restaurant => {
                    const iconHtml = `<div style="background-color: ${color}; width: 1rem; height: 1rem; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`;
                    const customIcon = L.divIcon({ html: iconHtml, className: 'custom-map-icon', iconSize: [16, 16], iconAnchor: [8, 8] });
                    const isHighlighted = highlightedCategory === null || category === highlightedCategory;
                    const marker = L.marker([restaurant.lat, restaurant.lon], { icon: customIcon, opacity: isHighlighted ? 1 : 0.3 }).addTo(state.mapInstance);
                    marker.bindPopup(render.popupContent(restaurant), { className: 'custom-popup' });
                    state.mapMarkers[category].push(marker);
                    state.restaurantMarkers[restaurant.name] = marker;
                });
            }
        },
        popupContent: (restaurant) => {
            const isAdded = state.wheelItems.has(restaurant.name);
            return `
                <div class="popup-content">
                    <h4>${restaurant.name}</h4>
                    <div class="popup-info">
                        <span>⭐ ${restaurant.rating}</span>
                        <span>${'$'.repeat(restaurant.price_level)}</span>
                        <span>${restaurant.hours}</span>
                    </div>
                    <div class="popup-actions">
                        <button data-name="${restaurant.name}" class="btn-secondary details-btn">更多</button>
                        <button data-name="${restaurant.name}" class="btn-primary add-to-wheel-btn ${isAdded ? 'added' : ''}">${isAdded ? '✓' : '+'}</button>
                    </div>
                </div>
            `;
        },
        restaurantPreviewList: (category) => {
            const listEl = DOMElements.restaurantPreviewList;
            listEl.innerHTML = '';
            if(!category || !state.restaurantData[category]) {
                listEl.classList.remove('visible'); return;
            }
            state.restaurantData[category].forEach(restaurant => {
                const card = document.createElement('div');
                card.className = 'restaurant-preview-card';
                card.dataset.name = restaurant.name;
                card.innerHTML = `<h5>${restaurant.name}</h5><p>⭐ ${restaurant.rating} | ${'$'.repeat(restaurant.price_level)}</p>`;
                listEl.appendChild(card);
            });
            listEl.classList.add('visible');
        },
        detailsPage: () => {
            const data = state.currentRestaurantDetails;
            if (!data) return;

            DOMElements.detailsHeaderImage.style.backgroundImage = `url(${data.details.photos[0]})`;
            DOMElements.detailsTitle.textContent = data.name;
            DOMElements.detailsRating.textContent = `⭐ ${data.rating}`;
            DOMElements.detailsPrice.textContent = '$'.repeat(data.price_level);
            DOMElements.detailsStatus.textContent = data.hours;

            // 更新詳情頁的加入候選按鈕狀態
            const isAdded = state.wheelItems.has(data.name);
            DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
            DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';

            DOMElements.detailsHoursList.innerHTML = data.details.opening_hours.weekday_text.map(line => `<li>${line}</li>`).join('');
            
            DOMElements.detailsReviewsList.innerHTML = data.details.reviews.map(review => `
                <div class="review-card">
                    <div class="review-card-header">
                        <span class="review-author">${review.author_name}</span>
                        <span class="review-rating">${'⭐'.repeat(review.rating)}</span>
                        <span class="review-time">${review.relative_time_description}</span>
                    </div>
                    <p class="review-text">${review.text}</p>
                </div>
            `).join('');
            
            // 綁定電話和網站按鈕事件
            DOMElements.callBtn.onclick = () => { if (data.details.formatted_phone_number) window.location.href = `tel:${data.details.formatted_phone_number}`; };
            DOMElements.websiteBtn.onclick = () => { if (data.details.website && data.details.website !== '#') window.open(data.details.website, '_blank'); };
        },
        wheel: () => {
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
        },
        wheelCount: () => {
            const count = state.wheelItems.size;
            DOMElements.wheelCountBadges.forEach(badge => {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            });
        }
    };

    const handlers = {
        initCategoriesMapAndRender: () => {
            state.activeCategory = null; 
            if (!state.mapInstance) {
                state.mapInstance = L.map(DOMElements.leafletMap).setView([24.97, 121.54], 15);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(state.mapInstance);
                // 使用事件代理來處理動態生成的 popup 內的點擊事件
                state.mapInstance.on('popupopen', (e) => {
                    e.popup.getElement().addEventListener('click', handlers.popupInteraction);
                });
            }
            const allCoords = Object.values(state.restaurantData).flat().map(r => [r.lat, r.lon]);
            if (state.userLocation) allCoords.push([state.userLocation.lat, state.userLocation.lon]);
            if (allCoords.length > 0) state.mapInstance.fitBounds(allCoords, { paddingTopLeft: [20, 20], paddingBottomRight: [20, 300]});
            render.categories();
            render.mapMarkers();
            render.restaurantPreviewList(null);
        },
        initRadiusMap: (location) => {
            const centerLatLng = L.latLng(location.lat, location.lon);
            if (!state.radiusMapInstance) {
                state.radiusMapInstance = L.map(DOMElements.radiusMap, { zoomControl: false }).setView(centerLatLng, 15);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(state.radiusMapInstance);
            }
            state.radiusCircle = L.circle(centerLatLng, { radius: state.searchRadiusMeters, color: 'var(--primary-color)', weight: 2, fillOpacity: 0.1, }).addTo(state.radiusMapInstance);
            const edgeLatLng = L.latLng(destinationPoint(location.lat, location.lon, state.searchRadiusMeters, 90));
            state.radiusDragMarker = L.marker(edgeLatLng, { draggable: true, icon: L.divIcon({ html: '<div class="radius-drag-handle"></div>', className: 'radius-drag-handle-icon', iconSize: [20, 20] }) }).addTo(state.radiusMapInstance);
            state.radiusDragMarker.on('drag', (e) => {
                const newRadius = Math.max(50, Math.round(centerLatLng.distanceTo(e.target.getLatLng())));
                state.searchRadiusMeters = newRadius;
                state.radiusCircle.setRadius(newRadius);
                DOMElements.radiusLabel.textContent = `${newRadius} 公尺`;
            });
        },
        getUserLocation: () => {
            navigator.geolocation.getCurrentPosition(
                (pos) => { state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude }; DOMElements.locationStatus.textContent = '拖曳手把或縮放地圖調整範圍'; DOMElements.confirmRadiusBtn.disabled = false; handlers.initRadiusMap(state.userLocation); },
                () => { state.userLocation = { lat: 24.975, lon: 121.538 }; DOMElements.locationStatus.textContent = '無法取得位置，將使用預設地點'; DOMElements.confirmRadiusBtn.disabled = false; handlers.initRadiusMap(state.userLocation); }
            );
        },
        searchRestaurants: async () => {
            DOMElements.loadingOverlay.classList.add('visible'); DOMElements.loadingText.textContent = "正在尋找附近美食...";
            try {
                const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: state.userLocation.lat, lon: state.userLocation.lon, radius: state.searchRadiusMeters }) });
                if (!response.ok) throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
                state.restaurantData = await response.json();
                navigate.to('categories-page');
            } catch (error) { console.error("搜尋失敗:", error); DOMElements.loadingText.textContent = "搜尋失敗，請稍後再試"; setTimeout(() => DOMElements.loadingOverlay.classList.remove('visible'), 2000); return; }
            DOMElements.loadingOverlay.classList.remove('visible');
        },
        popupInteraction: (e) => {
            const btn = e.target.closest('.add-to-wheel-btn, .details-btn');
            if (!btn) return;
            const name = btn.dataset.name;
            if (btn.classList.contains('add-to-wheel-btn')) {
                handlers.toggleWheelItem(name);
                // 更新 popup 內的按鈕狀態
                const isAdded = state.wheelItems.has(name);
                btn.classList.toggle('added', isAdded);
                btn.textContent = isAdded ? '✓' : '+';
            } else if (btn.classList.contains('details-btn')) {
                handlers.showDetails(name);
            }
        },
        toggleWheelItem: (name) => {
            if (state.wheelItems.has(name)) {
                state.wheelItems.delete(name);
            } else {
                if (state.wheelItems.size >= 8) { alert('候選清單最多8個選項喔！'); return; }
                state.wheelItems.add(name);
            }
            render.wheelCount();
        },
        showDetails: (name) => {
            const restaurant = Object.values(state.restaurantData).flat().find(r => r.name === name);
            if (restaurant) {
                state.currentRestaurantDetails = restaurant;
                navigate.to('details-page');
            }
        },
        spinWheel: () => {
            if (state.isSpinning) return;
            state.isSpinning = true; DOMElements.spinBtn.disabled = true;
            const items = [...state.wheelItems];
            const sliceAngle = 360 / items.length;
            const randomIndex = Math.floor(Math.random() * items.length);
            const winner = items[randomIndex];
            const randomOffset = (Math.random() * 0.8 - 0.4) * sliceAngle;
            const targetRotation = 360 * 5 + (360 - (randomIndex * sliceAngle)) - (sliceAngle / 2) + randomOffset;
            let start = null; const duration = 5000;
            const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = timestamp - start; const t = Math.min(progress / duration, 1); const easedT = easeOutQuint(t);
                const rotation = state.currentWheelRotation + easedT * (targetRotation - state.currentWheelRotation);
                DOMElements.wheelContainer.style.transform = `rotate(${rotation}deg)`;
                if (progress < duration) { state.animationFrameId = requestAnimationFrame(step); } 
                else {
                    state.currentWheelRotation = rotation % 360; state.isSpinning = false; DOMElements.spinBtn.disabled = false;
                    const winnerSlice = DOMElements.wheelContainer.querySelector(`.wheel-slice[data-name="${winner}"]`);
                    if(winnerSlice) winnerSlice.classList.add('winner-glow');
                    setTimeout(() => {
                        DOMElements.resultText.textContent = ''; DOMElements.resultOverlay.classList.add('visible');
                        let i = 0; function typeWriter() { if (i < winner.length) { DOMElements.resultText.innerHTML += winner.charAt(i); i++; setTimeout(typeWriter, 100); } } typeWriter();
                    }, 500);
                }
            };
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = requestAnimationFrame(step);
        },
        closeResult: () => {
            DOMElements.resultOverlay.classList.remove('visible');
            const winnerSlice = DOMElements.wheelContainer.querySelector('.winner-glow');
            if(winnerSlice) winnerSlice.classList.remove('winner-glow');
            render.wheel();
        },
        categoryInteraction: (e) => {
            const target = e.target.closest('.category-list-item');
            if (!target) return;
            const category = target.dataset.category;
            const allItems = DOMElements.categoryList.querySelectorAll('.category-list-item');
            if (state.activeCategory === category) { state.activeCategory = null; target.classList.remove('active'); } 
            else { state.activeCategory = category; allItems.forEach(item => item.classList.remove('active')); target.classList.add('active'); }
            render.mapMarkers(state.activeCategory);
            render.restaurantPreviewList(state.activeCategory);
            let coordsToFit = (state.activeCategory === null) ? Object.values(state.restaurantData).flat().map(r => [r.lat, r.lon]) : state.restaurantData[state.activeCategory].map(r => [r.lat, r.lon]);
            if (state.userLocation) coordsToFit.push([state.userLocation.lat, state.userLocation.lon]);
            if (coordsToFit.length > 0) state.mapInstance.fitBounds(coordsToFit, { paddingTopLeft: [20, 20], paddingBottomRight: [20, 350]});
        },
        previewCardInteraction: (e) => {
            const card = e.target.closest('.restaurant-preview-card');
            if(!card) return;
            const name = card.dataset.name;
            const marker = state.restaurantMarkers[name];
            if(!marker) return;
            state.mapInstance.flyTo(marker.getLatLng());
            setTimeout(() => {
                marker.openPopup();
                if(marker._icon) { marker._icon.classList.add('marker-active'); setTimeout(() => { if(marker._icon) marker._icon.classList.remove('marker-active'); }, 600); }
            }, 300);
        }
    };
    
    function destinationPoint(lat, lon, distance, bearing) {
        const R = 6371e3; const latRad = lat * Math.PI / 180; const lonRad = lon * Math.PI / 180; const bearingRad = bearing * Math.PI / 180;
        const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distance / R) + Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad));
        const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad), Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad));
        return [newLatRad * 180 / Math.PI, newLonRad * 180 / Math.PI];
    }

    const init = () => {
        DOMElements.startBtn.addEventListener('click', () => navigate.to('map-page'));
        DOMElements.confirmRadiusBtn.addEventListener('click', handlers.searchRestaurants);
        DOMElements.recenterBtn.addEventListener('click', () => { if(state.radiusMapInstance && state.userLocation) state.radiusMapInstance.setView([state.userLocation.lat, state.userLocation.lon], 15); });
        DOMElements.backBtns.forEach(btn => btn.addEventListener('click', navigate.back));
        DOMElements.viewWheelBtn.addEventListener('click', () => navigate.to('wheel-page'));
        DOMElements.spinBtn.addEventListener('click', handlers.spinWheel);
        DOMElements.closeResultBtn.addEventListener('click', handlers.closeResult);
        DOMElements.categoryList.addEventListener('click', handlers.categoryInteraction);
        DOMElements.restaurantPreviewList.addEventListener('mouseover', handlers.previewCardInteraction);
        DOMElements.restaurantPreviewList.addEventListener('click', handlers.previewCardInteraction);
        DOMElements.addToWheelDetailsBtn.addEventListener('click', () => {
            if (state.currentRestaurantDetails) {
                const name = state.currentRestaurantDetails.name;
                handlers.toggleWheelItem(name);
                const isAdded = state.wheelItems.has(name);
                DOMElements.addToWheelDetailsBtn.classList.toggle('added', isAdded);
                DOMElements.addToWheelDetailsBtn.querySelector('span').textContent = isAdded ? '已加入' : '加入候選';
            }
        });
        render.wheelCount();
    };

    init();
});

