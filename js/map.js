// js/map.js

import { state, DOMElements } from './state.js';
import { handlePopupInteraction } from './handlers.js';

function renderPopupContent(restaurant) {
    const isAdded = state.wheelItems.has(restaurant.name);
    const placeId = restaurant.place_id || '';
    
    const infoText = state.isCategorizing ? '分類魔法進行中...' : `按 '+' 加入候選清單！`;

    return `
        <div class="popup-content">
            <h4>${restaurant.name}</h4>
            <div class="popup-info">
                <span>${infoText}</span>
            </div>
            <div class="popup-actions">
                <button data-place-id="${placeId}" data-name="${restaurant.name}" class="btn-secondary details-btn">更多</button>
                <button data-place-id="${placeId}" data-name="${restaurant.name}" class="btn-primary add-to-wheel-btn ${isAdded ? 'added' : ''}">${isAdded ? '✓' : '+'}</button>
            </div>
        </div>
    `;
}

export function updateOpenPopups() {
    const map = mapInstances.categories;
    if (!map) return;

    map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.isPopupOpen()) {
            const restaurantName = Object.keys(restaurantMarkers).find(name => restaurantMarkers[name] === layer);
            if (restaurantName) {
                const restaurantData = Object.values(state.restaurantData).flat().find(r => r.name === restaurantName);
                if (restaurantData) {
                    layer.setPopupContent(renderPopupContent(restaurantData));
                }
            }
        }
    });
}

// --- 以下是其他未變動的函式，為確保完整性，全部提供 ---
export const mapInstances = { radius: null, categories: null };
let restaurantMarkers = {};
let centerMarker = null;

function createMarker(restaurant, emoji, customClass = '', isHighlighted = false, activeCategory = null) {
    const map = mapInstances.categories;
    if (!restaurant.lat || !restaurant.lon) {
        console.warn("店家缺少經緯度:", restaurant.name);
        return;
    }
    const iconHtml = `<div class="map-category-icon ${customClass}">${emoji}</div>`;
    const customIcon = L.divIcon({
        html: iconHtml,
        className: `map-category-icon-container ${isHighlighted ? 'marker-highlight' : ''}`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
    
    const marker = L.marker([restaurant.lat, restaurant.lon], {
        icon: customIcon,
        opacity: (activeCategory && !isHighlighted) ? 0.35 : 1,
        zIndexOffset: isHighlighted ? 1000 : 0
    }).addTo(map);

    marker.bindPopup(renderPopupContent(restaurant), { className: 'custom-popup' });
    restaurantMarkers[restaurant.name] = marker;
}

export function updateMapMarkers(data, userLocation, searchCenter, focusedCategories, activeCategory) {
    const map = mapInstances.categories;
    if (!map) return;

    // ** [修正] ** 只清除餐廳標記，不清除使用者和中心點標記
    Object.values(restaurantMarkers).forEach(marker => marker.remove());
    restaurantMarkers = {};

    if (!centerMarker && userLocation) { // 僅在第一次載入時創建
        L.marker([userLocation.lat, userLocation.lon], {
            icon: L.divIcon({ html: '<div class="user-location-marker"></div>', className: '', iconSize: [24, 24] }),
            zIndexOffset: 1500
        }).addTo(map);
    }
    if (!centerMarker && searchCenter) { // 僅在第一次載入時創建
        centerMarker = L.marker([searchCenter.lat, searchCenter.lon], {
            icon: L.divIcon({ html: '<div class="search-center-marker"></div>', className: '', iconSize: [24, 24] }),
            zIndexOffset: 2000
        }).addTo(map);
    }

    if (Array.isArray(data)) {
        data.forEach(restaurant => createMarker(restaurant, '✨', 'unclassified'));
    } else {
        const isFocusMode = focusedCategories && focusedCategories.size > 0;
        for (const category in data) {
            if (isFocusMode && !focusedCategories.has(category)) continue;
            const iconMatch = category.match(/(\p{Emoji})/u);
            const iconEmoji = iconMatch ? iconMatch[1] : '📍';
            const isHighlighted = activeCategory === category;
            
            data[category].forEach(restaurant => {
                createMarker(restaurant, iconEmoji, '', isHighlighted, activeCategory);
            });
        }
    }
}

export function updateCategorizedMarkers(categorizedData) {
    for (const category in categorizedData) {
        const iconMatch = category.match(/(\p{Emoji})/u);
        const iconEmoji = iconMatch ? iconMatch[1] : '📍';
        
        categorizedData[category].forEach(restaurant => {
            const marker = restaurantMarkers[restaurant.name];
            if (marker && marker._icon) {
                const iconElement = marker._icon.querySelector('.map-category-icon');
                if (iconElement) {
                    iconElement.classList.remove('unclassified');
                    iconElement.textContent = iconEmoji;
                }
            }
        });
    }
}

const editorLayers = { radius: null, categories: null };

function destinationPoint(lat, lon, distance, bearing) {
    const R = 6371e3;
    const latRad = lat * Math.PI / 180, lonRad = lon * Math.PI / 180, bearingRad = bearing * Math.PI / 180;
    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distance / R) + Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad));
    const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad), Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad));
    return L.latLng(newLatRad * 180 / Math.PI, newLonRad * 180 / Math.PI);
}

export function drawRadiusEditor(mapKey, location, radius, onRadiusChange) {
    const map = mapInstances[mapKey];
    if (!map) return;
    removeRadiusEditor(mapKey);
    const centerLatLng = L.latLng(location.lat, location.lon);
    const circle = L.circle(centerLatLng, { radius, color: 'var(--primary-color)', weight: 2, fillOpacity: 0.1 });
    const edgeLatLng = destinationPoint(location.lat, location.lon, radius, 90);
    const handleMarker = L.marker(edgeLatLng, { draggable: true, icon: L.divIcon({ html: '<div class="radius-drag-handle-container"><div class="radius-drag-handle"></div></div>', className: '', iconSize: [40, 40], iconAnchor: [20, 20] }) });
    const centerMarker = L.marker(centerLatLng, { draggable: true, icon: L.divIcon({ html: '<div class="radius-center-marker"></div>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] }) });
    handleMarker.on('drag', (e) => {
        const currentCenter = centerMarker.getLatLng();
        const newRadius = Math.max(50, Math.round(currentCenter.distanceTo(e.target.getLatLng())));
        circle.setRadius(newRadius);
        onRadiusChange(newRadius);
    });
    centerMarker.on('drag', (e) => {
        const newCenter = e.target.getLatLng();
        const currentRadius = circle.getRadius();
        circle.setLatLng(newCenter);
        const newHandlePos = destinationPoint(newCenter.lat, newCenter.lng, currentRadius, 90);
        handleMarker.setLatLng(newHandlePos);
    });
    editorLayers[mapKey] = L.layerGroup([circle, handleMarker, centerMarker]).addTo(map);
}

export function removeRadiusEditor(mapKey) {
    if (editorLayers[mapKey]) { editorLayers[mapKey].remove(); editorLayers[mapKey] = null; }
}

export function getEditorState(mapKey) {
    const editor = editorLayers[mapKey];
    if (!editor) return null;
    const layers = editor.getLayers();
    const circle = layers.find(layer => layer instanceof L.Circle);
    const centerMarker = layers.find(layer => layer instanceof L.Marker && layer.options.icon.options.html.includes('radius-center-marker'));
    if (circle && centerMarker) { return { center: centerMarker.getLatLng(), radius: circle.getRadius(), circle: circle }; }
    return null;
}

export function initRadiusMap(location, radius, onRadiusChange) {
    const mapKey = 'radius';
    if (!mapInstances[mapKey]) {
        mapInstances[mapKey] = L.map(DOMElements.radiusMap, { zoomControl: false }).setView([location.lat, location.lon], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }).addTo(mapInstances[mapKey]);
    }
    drawRadiusEditor(mapKey, location, radius, onRadiusChange);
}

export function initCategoriesMap() {
    const mapKey = 'categories';
    if (!mapInstances[mapKey]) {
        mapInstances[mapKey] = L.map(DOMElements.leafletMap).setView([24.97, 121.54], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(mapInstances[mapKey]);
        mapInstances[mapKey].on('popupopen', (e) => { e.popup.getElement().addEventListener('click', handlePopupInteraction); });
    }
    return mapInstances[mapKey];
}

export function setRadiusMapCenter(mapKey, location) {
    const map = mapInstances[mapKey];
    if (map && location) { map.setView([location.lat, location.lon]); }
}

export function recenterRadiusMap(mapKey, location) {
    const map = mapInstances[mapKey];
    if (map && location) {
        map.flyTo([location.lat, location.lon], 13, { duration: 1.0 });
        setTimeout(() => {
            const editorState = getEditorState(mapKey);
            const radius = editorState ? editorState.radius : state.searchRadiusMeters;
            drawRadiusEditor(mapKey, location, radius, (r) => { state.searchRadiusMeters = r; });
        }, 1000);
    }
}

export function destroyRadiusMap() {
    const mapKey = 'radius';
    removeRadiusEditor(mapKey);
    if (mapInstances[mapKey]) {
        mapInstances[mapKey].remove();
        mapInstances[mapKey] = null;
        // ** [新增] ** 清除標記引用，避免內存洩漏
        centerMarker = null;
        restaurantMarkers = {};
    }
}

export function showOnlyCandidateMarkers(candidateNames) {
    const candidateSet = new Set(candidateNames);
    for (const name in restaurantMarkers) {
        const marker = restaurantMarkers[name];
        if (candidateSet.has(name)) { marker.setOpacity(1); } else { marker.setOpacity(0); }
    }
}

export function clearWinnerMarker() {
    if (state.lastWinner && restaurantMarkers[state.lastWinner]) {
        const marker = restaurantMarkers[state.lastWinner];
        if (marker._icon) { marker._icon.classList.remove('marker-winner'); }
        marker.closePopup();
        state.lastWinner = null;
    }
}

export function fitBoundsToSearchRadius() {
    const map = mapInstances.categories;
    const center = state.searchCenter;
    const radius = state.searchRadiusMeters;
    if (map && center && radius) {
        const northEast = destinationPoint(center.lat, center.lon, radius, 45);
        const southWest = destinationPoint(center.lat, center.lon, radius, 225);
        const bounds = L.latLngBounds(northEast, southWest);
        const topUIHeight = DOMElements.pageHeaderCondensed?.offsetHeight || 80;
        const bottomUIHeight = DOMElements.mapBottomDrawer?.offsetHeight || 200;
        const paddingOptions = { paddingTopLeft: [20, topUIHeight + 20], paddingBottomRight: [20, bottomUIHeight + 20] };
        map.flyToBounds(bounds, { ...paddingOptions, duration: 1.0, maxZoom: 16 });
    }
}

export function flyToMarker(name) {
    const map = mapInstances.categories;
    const marker = restaurantMarkers[name];
    if (marker && map) {
        marker.openPopup();
        if (marker._icon) {
            marker._icon.classList.add('marker-active');
            setTimeout(() => { if (marker._icon) marker._icon.classList.remove('marker-active'); }, 800);
        }
    }
}

export function startRandomMarkerAnimation(candidateNames) {
    return new Promise((resolve) => {
        const map = mapInstances.categories;
        if (!map) resolve(null);
        const candidateMarkers = candidateNames.map(name => restaurantMarkers[name]).filter(Boolean);
        if (candidateMarkers.length < 2) resolve(candidateMarkers.length > 0 ? candidateNames[0] : null);
        const winnerIndex = Math.floor(Math.random() * candidateNames.length);
        const winnerName = candidateNames[winnerIndex];
        const ANIMATION_DURATION = 7000;
        const totalFlashes = candidateMarkers.length * 4 + winnerIndex;
        let lastMarker = null;
        let startTimestamp = null;
        const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
        const animationStep = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = (timestamp - startTimestamp) / ANIMATION_DURATION;
            if (progress >= 1) {
                if (lastMarker && lastMarker._icon) { lastMarker._icon.classList.remove('marker-flash'); }
                const winnerMarker = restaurantMarkers[winnerName];
                if (winnerMarker && winnerMarker._icon) {
                    winnerMarker._icon.classList.add('marker-winner');
                    winnerMarker.openPopup();
                }
                resolve(winnerName);
                return;
            }
            const easedProgress = easeOutCubic(progress);
            const currentFlashIndex = Math.floor(easedProgress * totalFlashes);
            const currentMarkerIndex = currentFlashIndex % candidateMarkers.length;
            const currentMarker = candidateMarkers[currentMarkerIndex];
            if (currentMarker !== lastMarker) {
                if (lastMarker && lastMarker._icon) { lastMarker._icon.classList.remove('marker-flash'); }
                if (currentMarker && currentMarker._icon) { currentMarker._icon.classList.add('marker-flash'); }
                lastMarker = currentMarker;
            }
            requestAnimationFrame(animationStep);
        };
        requestAnimationFrame(animationStep);
    });
}