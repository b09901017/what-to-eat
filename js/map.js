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


// 分別管理不同頁面的地圖實例和圖層
const mapInstances = {
    radius: null,
    categories: null
};

const editorLayers = {
    radius: null,
    categories: null
};

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
            radius: circle.getRadius()
        };
    }
    return null;
}


// --- Map Initialization ---

export function initRadiusMap(location, radius, onRadiusChange) {
    const mapKey = 'radius';
    if (!mapInstances[mapKey]) {
        mapInstances[mapKey] = L.map(DOMElements.radiusMap, { zoomControl: false }).setView([location.lat, location.lon], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(mapInstances[mapKey]);
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

export function recenterRadiusMap(location) {
    const mapKey = 'radius';
    const map = mapInstances[mapKey];
    if (map && location) {
        map.setView([location.lat, location.lon], 15);
        const editorState = getEditorState(mapKey);
        if (editorState) {
            drawRadiusEditor(mapKey, location, editorState.radius, (r) => {});
        }
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

let restaurantMarkers = {};
let userLocationMarker = null;

export function updateMapMarkers(restaurantData, userLocation, focusedCategories, activeCategory) {
    const map = mapInstances.categories;
    if (!map) return;

    Object.values(restaurantMarkers).forEach(marker => marker.remove());
    restaurantMarkers = {};
    if (userLocationMarker) userLocationMarker.remove();
    
    if (userLocation) {
        userLocationMarker = L.marker([userLocation.lat, userLocation.lon], {
            icon: L.divIcon({ html: '<div class="user-location-marker"></div>', className: '', iconSize: [24, 24] }),
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

export function fitMapToBounds(coords, paddingOptions) {
    const map = mapInstances.categories;
    if (map && coords.length > 0) {
        const defaultPadding = { paddingTopLeft: [20, 20], paddingBottomRight: [20, 20] };
        map.fitBounds(coords, { ...defaultPadding, ...paddingOptions });
    }
}

export function flyToMarker(name) {
    const map = mapInstances.categories;
    const marker = restaurantMarkers[name];
    if (marker && map) {
        map.flyTo(marker.getLatLng());
        setTimeout(() => {
            marker.openPopup();
            if (marker._icon) {
                marker._icon.classList.add('marker-active');
                setTimeout(() => {
                    if (marker._icon) marker._icon.classList.remove('marker-active');
                }, 600);
            }
        }, 300);
    }
}