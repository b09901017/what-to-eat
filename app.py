import os
import googlemaps
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
from dotenv import load_dotenv
import traceback
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from requests.adapters import HTTPAdapter

# --- 1. 初始化與設定 (Setup & Initialization) ---

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GOOGLE_MAPS_API_KEY or not GEMINI_API_KEY:
    raise ValueError("請在 .env 檔案中設定 GOOGLE_MAPS_API_KEY 和 GEMINI_API_KEY")

try:
    session = requests.Session()
    adapter = HTTPAdapter(pool_connections=50, pool_maxsize=50)
    session.mount('https://', adapter)
    gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY, requests_session=session)
    
    genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    logging.error(f"初始化 Google 服務失敗: {e}")
    raise

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)


# --- 2. 後端核心輔助函式 (Core Helper Functions) ---

def search_unique_places(location, radius):
    # broad_search_types = ['restaurant', 'cafe', 'meal_takeaway', 'bar', 'food']
    broad_search_types = ['restaurant', 'bar', 'cafe']
    specific_keywords = ['內用', '好吃', '消夜', '飲料', '甜點', '素食']
    unique_places = {}
    
    logging.info("--- 開始執行寬泛類型搜尋 ---")
    for place_type in broad_search_types:
        try:
            places_result = gmaps.places_nearby(location=location, radius=radius, language='zh-TW', type=place_type)
            for place in places_result.get('results', []):
                unique_places[place['place_id']] = place
            
            if 'next_page_token' in places_result:
                time.sleep(2)
                next_page_result = gmaps.places_nearby(page_token=places_result['next_page_token'])
                for place in next_page_result.get('results', []):
                    unique_places[place['place_id']] = place
        except Exception as e:
            logging.error(f"搜尋類型 '{place_type}' 時發生錯誤: {e}")

    logging.info("--- 開始執行精準關鍵字搜尋 ---")
    for keyword in specific_keywords:
        try:
            places_result = gmaps.places_nearby(location=location, radius=radius, language='zh-TW', keyword=keyword)
            for place in places_result.get('results', []):
                unique_places[place['place_id']] = place
        except Exception as e:
            logging.error(f"搜尋關鍵字 '{keyword}' 時發生錯誤: {e}")

    logging.info(f"複合式搜尋完成，共找到 {len(unique_places)} 家不重複的店家。")
    return list(unique_places.keys())

def get_place_details(place_id):
    try:
        fields = ['place_id', 'name', 'geometry', 'rating', 'user_ratings_total', 'price_level', 
                  'opening_hours', 'formatted_phone_number', 'website', 'photo', 'reviews', 'type']
        details_response = gmaps.place(place_id=place_id, language='zh-TW', fields=fields)
        
        if details_response.get('status') != 'OK': return None
        
        details = details_response['result']
        
        photo_urls = []
        if 'photos' in details:
            for photo_ref in details.get('photos', [])[:2]:
                photo_urls.append(f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference={photo_ref['photo_reference']}&key={GOOGLE_MAPS_API_KEY}")
        if not photo_urls:
            photo_urls.append(f"https://placehold.co/600x400/F5EBE0/424242?text={details.get('name', '店家')}")

        return {
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

def get_all_restaurants_details_concurrently(place_ids):
    all_restaurants = {}
    with ThreadPoolExecutor(max_workers=15) as executor:
        future_to_place_id = {executor.submit(get_place_details, pid): pid for pid in place_ids}
        for future in as_completed(future_to_place_id):
            restaurant_info = future.result()
            if restaurant_info and restaurant_info.get('name') and restaurant_info.get('name') not in all_restaurants:
                all_restaurants[restaurant_info['name']] = restaurant_info
    logging.info(f"成功獲取 {len(all_restaurants)} 家店家的詳細資訊。")
    return all_restaurants

def get_categories_from_gemini_chunk(restaurant_chunk):
    if not restaurant_chunk: return {}
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    # ★★★ 恢復您原本帶有範例的 Prompt ★★★
    prompt = f"""
你是美食分類專家，請將餐廳列表按照「具體食物類型」進行分類。

核心原則：
1. 分類到具體食物（如「牛肉麵」、「炒飯」），而非大分類（如「麵食」）。
2. 根據餐廳名稱判斷最主要的食物類型。
3. 每間餐廳只歸類到一個最適合的類別。
4. **在每個分類名稱的最後，加上一個最能代表該分類的 Emoji**。

常見分類範例：
牛肉麵 🍜, 餛飩麵 🥟, 拉麵 🍜, 義大利麵 🍝, 炒飯 🍚, 滷肉飯 🍚, 壽司 🍣, 火鍋 🍲, 燒肉 🍖, 咖啡廳 ☕️, 手搖飲 🍹, 素食 🥗

餐廳資料：
{json.dumps(restaurant_chunk, ensure_ascii=False, indent=2)}

輸出格式（只要JSON，無其他文字）：
{{
  "牛肉麵 🍜": ["餐廳A"],
  "餛飩麵 🥟": ["餐廳B"],
  "炒飯 🍚": ["餐廳C"]
}}
    """
    try:
        response = model.generate_content(prompt)
        text_to_parse = response.text
        if '```json' in text_to_parse:
            text_to_parse = text_to_parse.split('```json')[1].split('```')[0]
        
        return json.loads(text_to_parse)
    except Exception as e:
        logging.error(f"Gemini API 呼叫或解析失敗: {e}")
        return {"error": "AI classification failed"}

def categorize_restaurants_concurrently(restaurants_for_ai):
    logging.info("--- 開始並行請求 AI 進行美食分類 ---")
    CHUNK_SIZE = 30 
    final_categories = {}
    
    restaurant_chunks = [restaurants_for_ai[i:i + CHUNK_SIZE] for i in range(0, len(restaurants_for_ai), CHUNK_SIZE)]
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_chunk = {executor.submit(get_categories_from_gemini_chunk, chunk): chunk for chunk in restaurant_chunks}
        
        for future in as_completed(future_to_chunk):
            try:
                chunk_result = future.result()
                if "error" in chunk_result: continue 

                for category, names in chunk_result.items():
                    if category not in final_categories:
                        final_categories[category] = []
                    final_categories[category].extend(names)
            except Exception as e:
                logging.error(f"處理 Gemini 分類批次時出錯: {e}")
    
    return final_categories

# --- 3. API 路由 (API Route) ---

@app.route('/api/search', methods=['POST'])
def search_restaurants_api():
    data = request.get_json()
    if not data or 'lat' not in data or 'lon' not in data:
        return jsonify({"error": "缺少經緯度資訊"}), 400

    try:
        location = (data['lat'], data['lon'])
        radius = data.get('radius', 500)
        
        place_ids = search_unique_places(location, radius)
        if not place_ids: return jsonify({})

        all_restaurants = get_all_restaurants_details_concurrently(place_ids)
        
        restaurants_for_ai = [{"name": r.get('name'), "types": r.get('types', [])} for r in all_restaurants.values()]

        categorized_names = categorize_restaurants_concurrently(restaurants_for_ai)
        logging.info("--- AI 分類流程完成 ---")

        final_result = {}
        # 保持強健的處理邏輯，以應對 AI 可能回傳字典或字串的情況
        for category, items in categorized_names.items():
            if category not in final_result:
                final_result[category] = []
            
            for item in items:
                name_to_check = None
                if isinstance(item, dict) and 'name' in item:
                    name_to_check = item['name']
                elif isinstance(item, str):
                    name_to_check = item
                
                if name_to_check and name_to_check in all_restaurants:
                    final_result[category].append(all_restaurants[name_to_check])
        
        return jsonify(final_result)

    except Exception as e:
        logging.error("在 /api/search 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "搜尋時發生未預期的錯誤"}), 500

# --- 4. 前端頁面路由 (Frontend Serving Route) ---

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)