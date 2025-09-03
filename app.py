import os
import googlemaps
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from dotenv import load_dotenv

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

app = Flask(__name__)
CORS(app)

# --- Gemini AI 輔助函式 ---

def get_categories_from_gemini(restaurants_for_ai):
    """
    使用 Gemini API 將餐廳列表進行分類。
    """
    if not restaurants_for_ai:
        return {}
        
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # 優化第二點：修改 Prompt
    prompt = f"""
你是美食分類專家，將餐廳按「具體食物類型」分類。

核心原則：
- 分類到具體食物（如「牛肉麵」「炒飯」「小籠包」），不用大分類（如「麵食類」「飯類」）
- 根據餐廳名稱判斷主要食物類型
- 每間店只分到一個最符合的類別

常見分類範例：
牛肉麵、餛飩麵、拉麵、陽春麵、義大利麵、炒飯、滷肉飯、雞肉飯、丼飯、小籠包、水餃、包子、漢堡、炸雞、壽司、火鍋、燒肉、咖啡、手搖飲、素食等

餐廳資料：
{json.dumps(restaurants_for_ai, ensure_ascii=False, indent=2)}

輸出格式（只要JSON，無其他文字）：
{{
  "牛肉麵": ["餐廳A"],
  "餛飩麵": ["餐廳B"],
  "炒飯": ["餐廳C"]
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
        return {"附近美食": all_restaurant_names}

# --- API 路由 ---

@app.route('/api/search', methods=['POST'])
def search_restaurants():
    data = request.get_json()
    if not data or 'lat' not in data or 'lon' not in data:
        return jsonify({"error": "缺少經緯度資訊"}), 400

    location = (data['lat'], data['lon'])
    radius = data.get('radius', 500)

    try:
        places_result = gmaps.places_nearby(
            location=location,
            radius=radius,
            language='zh-TW',
            type='restaurant'
        )

        all_restaurants = {}
        restaurants_for_ai = []

        for place in places_result.get('results', []):
            place_id = place['place_id']
            details = gmaps.place(place_id=place_id, language='zh-TW', fields=[
                'name', 'geometry', 'rating', 'user_ratings_total', 'price_level', 
                'opening_hours', 'formatted_phone_number', 'website', 'photo', 'review', 'type'
            ])['result']
            
            hours_text = "資訊不足"
            if 'opening_hours' in details:
                hours_text = "營業中" if details['opening_hours'].get('open_now', False) else "休息中"

            photo_urls = []
            if 'photos' in details:
                for photo in details['photos'][:2]:
                    photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference={photo['photo_reference']}&key={GOOGLE_MAPS_API_KEY}"
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
                    "reviews": details.get('reviews', []),
                    "opening_hours": {"weekday_text": details.get('opening_hours', {}).get('weekday_text', [])},
                    "formatted_phone_number": details.get('formatted_phone_number', ''),
                    "website": details.get('website', '#')
                }
            }
            all_restaurants[restaurant_info['name']] = restaurant_info
            
            restaurants_for_ai.append({
                "name": details.get('name'),
                "types": details.get('types', [])
            })

        categorized_names = get_categories_from_gemini(restaurants_for_ai)

        final_result = {}
        for category, names in categorized_names.items():
            final_result[category] = []
            for name in names:
                if name in all_restaurants:
                    final_result[category].append(all_restaurants[name])
        
        return jsonify(final_result)

    except Exception as e:
        print(f"發生錯誤: {e}")
        return jsonify({"error": "搜尋時發生未預期的錯誤"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)