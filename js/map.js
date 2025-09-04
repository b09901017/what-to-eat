// 處理所有 Leaflet 地圖相關的邏輯

import { DOMElements } from './state.js';
import { handlePopupInteraction } from './handlers.js';
import { renderPopupContent } from './ui.js';

let radiusMapInstance = null;
let categoriesMapInstance = null;
let radiusCircle = null;
let radiusDragMarker = null;
let userMarker = null;
const restaurantMarkers = {};

function destinationPoint(lat, lon, distance, bearing) {
    const R = 6371e3;
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const bearingRad = bearing * Math.PI / 180;
    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distance / R) + Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad));
    const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad), Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad));
    return [newLatRad * 180 / Math.PI, newLonRad * 180 / Math.PI];
}

export function initRadiusMap(location, radius, onRadiusChange) {
    const centerLatLng = L.latLng(location.lat, location.lon);
    if (!radiusMapInstance) {
        radiusMapInstance = L.map(DOMElements.radiusMap, { zoomControl: false }).setView(centerLatLng, 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(radiusMapInstance);
    }

    if (userMarker) userMarker.remove();
    userMarker = L.marker(centerLatLng, {
        icon: L.divIcon({ html: '<div class="user-location-marker"></div>', className: '', iconSize: [24, 24] }),
        zIndexOffset: 1000
    }).addTo(radiusMapInstance);

    if (radiusCircle) radiusCircle.remove();
    radiusCircle = L.circle(centerLatLng, { radius, color: 'var(--primary-color)', weight: 2, fillOpacity: 0.1 }).addTo(radiusMapInstance);
    
    const edgeLatLng = L.latLng(destinationPoint(location.lat, location.lon, radius, 90));
    
    if (radiusDragMarker) radiusDragMarker.remove();
    radiusDragMarker = L.marker(edgeLatLng, {
        draggable: true,
        icon: L.divIcon({ 
            html: '<div class="radius-drag-handle-container"><div class="radius-drag-handle"></div></div>', 
            className: '', 
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        })
    }).addTo(radiusMapInstance);

    radiusDragMarker.on('drag', (e) => {
        const newRadius = Math.max(50, Math.round(centerLatLng.distanceTo(e.target.getLatLng())));
        radiusCircle.setRadius(newRadius);
        onRadiusChange(newRadius);
    });
}

export function recenterRadiusMap(location) {
    if (radiusMapInstance && location) {
        radiusMapInstance.setView([location.lat, location.lon], 15);
    }
}

export function destroyRadiusMap() {
    if (radiusMapInstance) {
        radiusMapInstance.remove();
        radiusMapInstance = null;
    }
}

export function initCategoriesMap() {
    if (!categoriesMapInstance) {
        categoriesMapInstance = L.map(DOMElements.leafletMap).setView([24.97, 121.54], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(categoriesMapInstance);
        categoriesMapInstance.on('popupopen', (e) => {
            e.popup.getElement().addEventListener('click', handlePopupInteraction);
        });
    }
    return categoriesMapInstance;
}

// *** 恢復：接收 activeCategory 進行高亮 ***
export function updateMapMarkers(restaurantData, userLocation, focusedCategories, activeCategory) {
    if (!categoriesMapInstance) return;

    Object.values(restaurantMarkers).forEach(marker => marker.remove());
    for (const key in restaurantMarkers) {
        delete restaurantMarkers[key];
    }
    if (userMarker) {
        userMarker.remove();
        userMarker = null;
    }

    if (userLocation) {
        userMarker = L.marker([userLocation.lat, userLocation.lon], {
            icon: L.divIcon({ html: '<div class="user-location-marker"></div>', className: '', iconSize: [24, 24] }),
            zIndexOffset: 2000
        }).addTo(categoriesMapInstance);
    }
    
    const isFocusMode = focusedCategories && focusedCategories.size > 0;

    for (const category in restaurantData) {
        if (isFocusMode && !focusedCategories.has(category)) {
            continue;
        }

        const iconMatch = category.match(/(\p{Emoji})/u);
        const iconEmoji = iconMatch ? iconMatch[1] : '📍';
        
        restaurantData[category].forEach(restaurant => {
            // *** 判斷是否為高亮狀態 ***
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
                // *** 如果有高亮類別，其他類別就半透明 ***
                opacity: (activeCategory && !isHighlighted) ? 0.35 : 1,
                zIndexOffset: isHighlighted ? 1000 : 0
            }).addTo(categoriesMapInstance);

            marker.bindPopup(renderPopupContent(restaurant), { className: 'custom-popup' });
            restaurantMarkers[restaurant.name] = marker;
        });
    }
}


export function fitMapToBounds(coords) {
    if (categoriesMapInstance && coords.length > 0) {
        categoriesMapInstance.fitBounds(coords, { paddingTopLeft: [20, 20], paddingBottomRight: [20, 350] });
    }
}

export function flyToMarker(name) {
    const marker = restaurantMarkers[name];
    if (marker && categoriesMapInstance) {
        categoriesMapInstance.flyTo(marker.getLatLng());
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