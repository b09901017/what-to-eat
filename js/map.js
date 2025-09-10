// 處理所有 Leaflet 地圖相關的邏輯

import { state, DOMElements } from './state.js';
import { handlePopupInteraction } from './handlers.js';

// --- Helper: Moved from ui.js to break circular dependency ---
/**
 * Renders the HTML content for a restaurant popup on the map.
 * @param {object} restaurant - The restaurant data object.
 * @returns {string} HTML string for the popup.
 */
function renderPopupContent(restaurant) {
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
}


export const mapInstances = {
    radius: null,
    categories: null
};

const editorLayers = {
    radius: null,
    categories: null
};

let restaurantMarkers = {};
let centerMarker = null;

// --- Helper Functions ---

function destinationPoint(lat, lon, distance, bearing) {
    const R = 6371e3; // 地球半徑（公尺）
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const bearingRad = bearing * Math.PI / 180;
    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distance / R) + Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad));
    const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad), Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad));
    return L.latLng(newLatRad * 180 / Math.PI, newLonRad * 180 / Math.PI);
}

/**
 * --- 修正：更正視覺中心計算邏輯 ---
 * 根據目標經緯度，計算出一個新的經緯度，當地圖以此為中心時，目標點會落在畫面上方 1/4 處。
 * @param {L.LatLng} targetLatLng - 目標點的經緯度物件
 * @param {L.Map} map - Leaflet 地圖實例
 * @returns {L.LatLng} - 計算後的地圖中心經緯度
 */
function getVisualCenterLatLng(targetLatLng, map) {
    const mapSize = map.getSize();
    const targetPoint = map.project(targetLatLng); 
    
    const yOffset = mapSize.y / 4; 
    
    // *** 修正：將減法改為加法，才能將地圖中心下移，讓目標點出現在上半部 ***
    const newCenterPoint = L.point(targetPoint.x, targetPoint.y + yOffset); 
    
    const newCenterLatLng = map.unproject(newCenterPoint);
    
    return newCenterLatLng;
}


// --- Radius Editor Logic (Reusable) ---

export function drawRadiusEditor(mapKey, location, radius, onRadiusChange) {
    const map = mapInstances[mapKey];
    if (!map) return;

    removeRadiusEditor(mapKey);

    const centerLatLng = L.latLng(location.lat, location.lon);

    const circle = L.circle(centerLatLng, { radius, color: 'var(--primary-color)', weight: 2, fillOpacity: 0.1 });
    
    const edgeLatLng = destinationPoint(location.lat, location.lon, radius, 90);
    
    const handleMarker = L.marker(edgeLatLng, {
        draggable: true,
        icon: L.divIcon({ 
            html: '<div class="radius-drag-handle-container"><div class="radius-drag-handle"></div></div>', 
            className: '', 
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        })
    });
    
    const centerMarker = L.marker(centerLatLng, {
        draggable: true,
        icon: L.divIcon({
            html: '<div class="radius-center-marker"></div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    });

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
    if (editorLayers[mapKey]) {
        editorLayers[mapKey].remove();
        editorLayers[mapKey] = null;
    }
}

export function getEditorState(mapKey) {
    const editor = editorLayers[mapKey];
    if (!editor) return null;
    
    const layers = editor.getLayers();
    const circle = layers.find(layer => layer instanceof L.Circle);
    const centerMarker = layers.find(layer => layer instanceof L.Marker && layer.options.icon.options.html.includes('radius-center-marker'));
    
    if (circle && centerMarker) {
        return {
            center: centerMarker.getLatLng(),
            radius: circle.getRadius(),
            circle: circle
        };
    }
    return null;
}


// --- Map Initialization ---

export function initRadiusMap(location, radius, onRadiusChange) {
    const mapKey = 'radius';
    if (!mapInstances[mapKey]) {
        mapInstances[mapKey] = L.map(DOMElements.radiusMap, { zoomControl: false }).setView([location.lat, location.lon], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { 
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(mapInstances[mapKey]);
    }
    
    drawRadiusEditor(mapKey, location, radius, onRadiusChange);
}

export function initCategoriesMap() {
    const mapKey = 'categories';
    if (!mapInstances[mapKey]) {
        mapInstances[mapKey] = L.map(DOMElements.leafletMap).setView([24.97, 121.54], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(mapInstances[mapKey]);
        mapInstances[mapKey].on('popupopen', (e) => {
            e.popup.getElement().addEventListener('click', handlePopupInteraction);
        });
    }
    return mapInstances[mapKey];
}

// --- Map Control ---

export function setRadiusMapCenter(mapKey, location) {
    const map = mapInstances[mapKey];
    if (map && location) {
        map.setView([location.lat, location.lon]);
    }
}

export function recenterRadiusMap(mapKey, location) {
    const map = mapInstances[mapKey];
    if (map && location) {
        map.flyTo([location.lat, location.lon], 15, { duration: 1.0 });
        
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
    }
}

export function updateMapMarkers(restaurantData, userLocation, searchCenter, focusedCategories, activeCategory) {
    const map = mapInstances.categories;
    if (!map) return;

    Object.values(restaurantMarkers).forEach(marker => marker.remove());
    restaurantMarkers = {};
    if (centerMarker) centerMarker.remove();
    
    if (userLocation) {
        L.marker([userLocation.lat, userLocation.lon], {
            icon: L.divIcon({ html: '<div class="user-location-marker"></div>', className: '', iconSize: [24, 24] }),
            zIndexOffset: 1500
        }).addTo(map);
    }
    if (searchCenter) {
        centerMarker = L.marker([searchCenter.lat, searchCenter.lon], {
            icon: L.divIcon({ html: '<div class="search-center-marker"></div>', className: '', iconSize: [24, 24] }),
            zIndexOffset: 2000
        }).addTo(map);
    }
    
    const isFocusMode = focusedCategories && focusedCategories.size > 0;

    for (const category in restaurantData) {
        if (isFocusMode && !focusedCategories.has(category)) {
            continue;
        }

        const iconMatch = category.match(/(\p{Emoji})/u);
        const iconEmoji = iconMatch ? iconMatch[1] : '📍';
        
        restaurantData[category].forEach(restaurant => {
            const isHighlighted = activeCategory === category;
            const iconHtml = `<div class="map-category-icon">${iconEmoji}</div>`;
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
        });
    }
}


export function showOnlyCandidateMarkers(candidateNames) {
    const candidateSet = new Set(candidateNames);
    for (const name in restaurantMarkers) {
        const marker = restaurantMarkers[name];
        if (candidateSet.has(name)) {
            marker.setOpacity(1);
        } else {
            marker.setOpacity(0);
        }
    }
}

export function clearWinnerMarker() {
    if (state.lastWinner && restaurantMarkers[state.lastWinner]) {
        const marker = restaurantMarkers[state.lastWinner];
        if (marker._icon) {
            marker._icon.classList.remove('marker-winner');
        }
        marker.closePopup();
        state.lastWinner = null;
    }
}


export function fitMapToBounds(coords, paddingOptions) {
    const map = mapInstances.categories;
    if (map && coords.length > 0) {
        const defaultPadding = { paddingTopLeft: [20, 20], paddingBottomRight: [20, 20] };
        map.fitBounds(coords, { ...defaultPadding, ...paddingOptions });
    }
}

export function flyToCoords(coords) {
    const map = mapInstances.categories;
    if (!map || coords.length === 0) return;

    const isSinglePoint = coords.length === 1;

    if (isSinglePoint) {
        const targetLatLng = L.latLng(coords[0][0], coords[0][1]);
        const newCenterLatLng = getVisualCenterLatLng(targetLatLng, map);
        
        map.flyTo(newCenterLatLng, 16, { duration: 0.8 });
    } else {
        const paddingOptions = { 
            paddingTopLeft: [20, 100], 
            paddingBottomRight: [20, 300] 
        };
        map.flyToBounds(coords, { ...paddingOptions, duration: 0.8 });
    }
}

export function flyToMarker(name) {
    const map = mapInstances.categories;
    const marker = restaurantMarkers[name];
    if (marker && map) {
        const targetLatLng = marker.getLatLng();
        
        const newCenterLatLng = getVisualCenterLatLng(targetLatLng, map);

        map.flyTo(newCenterLatLng, map.getZoom(), {
            duration: 0.5
        });

        setTimeout(() => {
            marker.openPopup();
            if (marker._icon) {
                marker._icon.classList.add('marker-active');
                setTimeout(() => {
                    if (marker._icon) marker._icon.classList.remove('marker-active');
                }, 800);
            }
        }, 500); 
    }
}

export function startRandomMarkerAnimation(candidateNames) {
    return new Promise((resolve) => {
        const map = mapInstances.categories;
        if (!map) resolve(null);
        
        const candidateMarkers = candidateNames.map(name => restaurantMarkers[name]).filter(Boolean);
        if (candidateMarkers.length < 2) resolve(candidateMarkers.length > 0 ? candidateNames[0] : null);

        const markerBounds = L.latLngBounds(candidateMarkers.map(m => m.getLatLng()));
        map.flyToBounds(markerBounds, { padding: [100, 100], duration: 0.5 });
        
        const winnerIndex = Math.floor(Math.random() * candidateNames.length);
        const winnerName = candidateNames[winnerIndex];

        let delay = 100;
        let totalFlashes = candidateMarkers.length * 2 + winnerIndex;
        let flashCount = 0;
        let lastMarker = null;

        function flashNext() {
            if (lastMarker && lastMarker._icon) {
                lastMarker._icon.classList.remove('marker-flash');
            }

            if (flashCount >= totalFlashes) {
                const winnerMarker = restaurantMarkers[winnerName];
                if (winnerMarker && winnerMarker._icon) {
                    winnerMarker._icon.classList.add('marker-winner');
                    winnerMarker.openPopup();
                }
                resolve(winnerName);
                return;
            }

            const currentMarker = candidateMarkers[flashCount % candidateMarkers.length];
            if (currentMarker && currentMarker._icon) {
                currentMarker._icon.classList.add('marker-flash');
            }
            lastMarker = currentMarker;

            if (flashCount > Math.floor(totalFlashes * 0.5)) delay *= 1.2;
            if (flashCount > Math.floor(totalFlashes * 0.8)) delay *= 1.3;
            
            flashCount++;
            setTimeout(flashNext, delay);
        }

        setTimeout(flashNext, 500);
    });
}