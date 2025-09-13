# backend/google_maps_service.py

import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from geopy.distance import geodesic
# [修正] 確保 PLACE_DETAIL_FIELDS 從 .config 匯入
from .config import gmaps, GOOGLE_MAPS_API_KEY, PLACE_DETAIL_FIELDS

def geocode_address(query):
    """
    使用 Google Geocoding API 將地址或地點名稱轉換為經緯度。
    """
    try:
        geocode_result = gmaps.geocode(query, language='zh-TW')
        if not geocode_result:
            return []
            
        return [{
            "address": result.get('formatted_address'),
            "lat": result['geometry']['location']['lat'],
            "lon": result['geometry']['location']['lng']
        } for result in geocode_result]
    except Exception as e:
        logging.error(f"Geocoding 查詢 '{query}' 時發生錯誤: {e}")
        return []

def get_basic_places(location, radius):
    """
    使用複合式策略搜尋地點，僅回傳基本資訊 (place_id, name, lat, lon, types)。
    """
    broad_search_types = ['restaurant', 'bar', 'cafe']
    specific_keywords = ['內用', '好吃', '消夜', '飲料', '甜點', '素食']
    unique_places = {}
    
    logging.info("--- 開始執行寬泛類型搜尋 (基本資料) ---")
    for place_type in broad_search_types:
        try:
            places_result = gmaps.places_nearby(location=location, radius=radius, language='zh-TW', type=place_type)
            for place in places_result.get('results', []):
                unique_places[place['place_id']] = place
            
            # 處理分頁
            if 'next_page_token' in places_result:
                time.sleep(2)
                next_page_result = gmaps.places_nearby(page_token=places_result['next_page_token'])
                for place in next_page_result.get('results', []):
                    unique_places[place['place_id']] = place
        except Exception as e:
            logging.error(f"搜尋類型 '{place_type}' 時發生錯誤: {e}")

    logging.info("--- 開始執行精準關鍵字搜尋 (基本資料) ---")
    for keyword in specific_keywords:
        try:
            places_result = gmaps.places_nearby(location=location, radius=radius, language='zh-TW', keyword=keyword)
            for place in places_result.get('results', []):
                unique_places[place['place_id']] = place
        except Exception as e:
            logging.error(f"搜尋關鍵字 '{keyword}' 時發生錯誤: {e}")

    # 格式化輸出
    formatted_places = []
    for place_id, place_data in unique_places.items():
        if 'geometry' in place_data and 'location' in place_data['geometry']:
            is_open_status = place_data.get('opening_hours', {}).get('open_now', False)
            formatted_places.append({
                "place_id": place_id,
                "name": place_data.get('name'),
                "lat": place_data['geometry']['location']['lat'],
                "lon": place_data['geometry']['location']['lng'],
                "types": place_data.get('types', []),
                "is_open": is_open_status
            })
            # ** [修改] ** 移除此處的 logging.info

    logging.info(f"複合式搜尋完成，共找到 {len(formatted_places)} 家不重複的店家。")
    return formatted_places


def get_place_details(place_id):
    """
    獲取單一地點的詳細資訊。
    """
    try:
        details_response = gmaps.place(place_id=place_id, language='zh-TW', fields=PLACE_DETAIL_FIELDS)
        
        if details_response.get('status') != 'OK': return None
        
        details = details_response['result']
        
        # 處理照片 URL
        photo_urls = []
        if 'photos' in details:
            for photo_ref in details.get('photos', [])[:2]: # 最多取兩張
                photo_urls.append(f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference={photo_ref['photo_reference']}&key={GOOGLE_MAPS_API_KEY}")
        if not photo_urls: # 如果沒有照片，使用預設圖
            photo_urls.append(f"https://placehold.co/600x400/F5EBE0/424242?text={details.get('name', '店家')}")

        # 格式化回傳的詳細資料
        return {
            "place_id": details.get('place_id'),
            "name": details.get('name'),
            "lat": details['geometry']['location']['lat'],
            "lon": details['geometry']['location']['lng'],
            "rating": details.get('rating', 0),
            "price_level": details.get('price_level', 0),
            "hours": "營業中" if details.get('opening_hours', {}).get('open_now', False) else "休息中" if 'opening_hours' in details else "資訊不足",
            "types": details.get('types', []),
            "details": {
                "photos": photo_urls,
                "reviews": [r for r in details.get('reviews', []) if r.get('text')],
                "opening_hours": {"weekday_text": details.get('opening_hours', {}).get('weekday_text', [])},
                "formatted_phone_number": details.get('formatted_phone_number', ''),
                "website": details.get('website', '#')
            }
        }
    except Exception as e:
        logging.error(f"處理 Place ID {place_id} 時發生錯誤: {e}")
        return None

def filter_places_by_distance(places, center_lat, center_lon, radius_meters):
    """
    使用 geopy 精準過濾掉超出半徑範圍的地點。
    (此函式現在接收一個 list of dicts)
    """
    filtered_places = []
    center_point = (center_lat, center_lon)
    
    for place_data in places:
        place_point = (place_data['lat'], place_data['lon'])
        distance = geodesic(center_point, place_point).meters
        if distance <= radius_meters:
            filtered_places.append(place_data)
            
    logging.info(f"距離過濾完成：從 {len(places)} 家過濾到 {len(filtered_places)} 家。")
    return filtered_places

# 這個函式現在不再被初始搜尋流程使用，但為了保持彈性，暫時保留
def get_all_restaurants_details_concurrently(place_ids):
    """
    並行獲取多個地點的詳細資訊。
    """
    all_restaurants = {}
    with ThreadPoolExecutor(max_workers=15) as executor:
        future_to_place_id = {executor.submit(get_place_details, pid): pid for pid in place_ids}
        for future in as_completed(future_to_place_id):
            restaurant_info = future.result()
            if restaurant_info and restaurant_info.get('name') and restaurant_info.get('name') not in all_restaurants:
                all_restaurants[restaurant_info['name']] = restaurant_info
    logging.info(f"成功獲取 {len(all_restaurants)} 家店家的詳細資訊。")
    return all_restaurants