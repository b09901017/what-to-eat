import os
import googlemaps
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
from dotenv import load_dotenv
import traceback
import time

# --- 初始化 ---

# 載入 .env 檔案中的環境變數
load_dotenv()

# 從環境變數讀取 API 金鑰
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# 檢查 API 金鑰是否存在
if not GOOGLE_MAPS_API_KEY or not GEMINI_API_KEY:
    raise ValueError("請在 .env 檔案中設定 GOOGLE_MAPS_API_KEY 和 GEMINI_API_KEY")

# 初始化 Google Maps 和 Gemini 客戶端
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
genai.configure(api_key=GEMINI_API_KEY)

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)


# --- Gemini AI 輔助函式 ---

def get_categories_from_gemini(restaurants_for_ai):
    """
    使用 Gemini API 將餐廳列表進行分類，並在分類名稱後附加 Emoji。
    """
    if not restaurants_for_ai:
        return {}
        
    model = genai.GenerativeModel('gemini-1.5-flash')
    
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
{json.dumps(restaurants_for_ai, ensure_ascii=False, indent=2)}

輸出格式（只要JSON，無其他文字）：
{{
  "牛肉麵 🍜": ["餐廳A"],
  "餛飩麵 🥟": ["餐廳B"],
  "炒飯 🍚": ["餐廳C"]
}}
    """
    
    try:
        response = model.generate_content(prompt)
        cleaned_response = response.text.strip().replace('```json', '').replace('```', '')
        categories = json.loads(cleaned_response)
        return categories
    except Exception as e:
        print(f"Gemini API 呼叫失敗: {e}")
        all_restaurant_names = [r['name'] for r in restaurants_for_ai]
        return {"附近美食 📍": all_restaurant_names}

# --- API 路由 ---

@app.route('/api/search', methods=['POST'])
def search_restaurants():
    data = request.get_json()
    if not data or 'lat' not in data or 'lon' not in data:
        return jsonify({"error": "缺少經緯度資訊"}), 400

    location = (data['lat'], data['lon'])
    radius = data.get('radius', 500)
    
    # *** 終極優化 V2：複合式搜尋策略 ***
    # 1. 寬泛類型搜尋 (Type Search) - 負責打下基礎
    broad_search_types = ['restaurant', 'cafe', 'meal_takeaway', 'bar', 'food']
    # 2. 精準關鍵字搜尋 (Keyword Search) - 負責查漏補缺
    specific_keywords = ['拉麵', '火鍋', '壽司', '牛排', '素食', '小吃', '早餐', '宵夜', '甜點', '麵包']
    
    unique_places = {}

    try:
        # --- 第一階段：執行寬泛類型搜尋 ---
        print("--- 開始執行寬泛類型搜尋 ---")
        for place_type in broad_search_types:
            print(f"搜尋類型: {place_type}...")
            
            places_result = gmaps.places_nearby(
                location=location, radius=radius, language='zh-TW', type=place_type
            )
            for place in places_result.get('results', []):
                unique_places[place['place_id']] = place
            
            # 處理分頁
            if 'next_page_token' in places_result:
                time.sleep(2)
                print(f"  -> 為 {place_type} 獲取下一頁...")
                next_page_result = gmaps.places_nearby(page_token=places_result['next_page_token'])
                for place in next_page_result.get('results', []):
                    unique_places[place['place_id']] = place

        # --- 第二階段：執行精準關鍵字搜尋 ---
        print("\n--- 開始執行精準關鍵字搜尋 ---")
        for keyword in specific_keywords:
            print(f"搜尋關鍵字: {keyword}...")
            places_result = gmaps.places_nearby(
                location=location, radius=radius, language='zh-TW', keyword=keyword
            )
            for place in places_result.get('results', []):
                unique_places[place['place_id']] = place


        print(f"\n複合式搜尋完成，共找到 {len(unique_places)} 家不重複的店家。")

        all_restaurants = {}
        restaurants_for_ai = []

        # --- 第三階段：統一獲取詳細資訊 ---
        for place_id in unique_places.keys():
            try:
                fields = [
                    'name', 'geometry', 'rating', 'user_ratings_total', 'price_level', 
                    'opening_hours', 'formatted_phone_number', 'website', 'photo', 'reviews', 'type'
                ]
                details_response = gmaps.place(place_id=place_id, language='zh-TW', fields=fields)

                if details_response.get('status') != 'OK':
                    continue
                
                details = details_response['result']
                
                reviews = [review for review in details.get('reviews', []) if review.get('text')]

                hours_text = "資訊不足"
                if 'opening_hours' in details:
                    hours_text = "營業中" if details['opening_hours'].get('open_now', False) else "休息中"

                photo_urls = []
                if 'photos' in details:
                    for photo_ref in details['photos'][:2]:
                        photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference={photo_ref['photo_reference']}&key={GOOGLE_MAPS_API_KEY}"
                        photo_urls.append(photo_url)
                
                if not photo_urls:
                    photo_urls.append(f"https://placehold.co/600x400/F5EBE0/424242?text={details.get('name', '店家')}")

                restaurant_info = {
                    "name": details.get('name'),
                    "lat": details['geometry']['location']['lat'],
                    "lon": details['geometry']['location']['lng'],
                    "rating": details.get('rating', 0),
                    "price_level": details.get('price_level', 0),
                    "hours": hours_text,
                    "details": {
                        "photos": photo_urls,
                        "reviews": reviews,
                        "opening_hours": {"weekday_text": details.get('opening_hours', {}).get('weekday_text', [])},
                        "formatted_phone_number": details.get('formatted_phone_number', ''),
                        "website": details.get('website', '#')
                    }
                }
                
                if restaurant_info['name'] not in all_restaurants:
                    all_restaurants[restaurant_info['name']] = restaurant_info
                    restaurants_for_ai.append({
                        "name": details.get('name'),
                        "types": details.get('types', [])
                    })
            except Exception as e:
                print(f"處理 Place ID {place_id} 時發生錯誤:")
                traceback.print_exc()
                continue

        # --- 第四階段：AI 分類與回傳 ---
        categorized_names = get_categories_from_gemini(restaurants_for_ai)

        final_result = {}
        for category, names in categorized_names.items():
            final_result[category] = []
            for name in names:
                if name in all_restaurants:
                    final_result[category].append(all_restaurants[name])
        
        return jsonify(final_result)

    except Exception as e:
        print("在 /api/search 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "搜尋時發生未預期的錯誤"}), 500

# --- 提供前端頁面的路由 ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)