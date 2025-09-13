# backend/routes.py

import logging
import traceback
from flask import Blueprint, request, jsonify
from . import google_maps_service as gm_service
from . import gemini_service as ai_service

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/find_places', methods=['POST'])
def find_places_api():
    """
    API 端點：極速搜尋店家，僅回傳未分類的基本資訊列表。
    """
    try:
        data = request.get_json()
        if not data or 'lat' not in data or 'lon' not in data:
            return jsonify({"error": "缺少經緯度資訊"}), 400
        
        lat, lon = data['lat'], data['lon']
        radius = data.get('radius', 500)
        
        # 1. 取得基本店家列表
        basic_places = gm_service.get_basic_places((lat, lon), radius)
        if not basic_places:
            return jsonify([]) # 回傳空列表

        # 2. 精準距離過濾
        strictly_filtered_places = gm_service.filter_places_by_distance(basic_places, lat, lon, radius)
        
        # 3. 直接回傳未分類的列表
        return jsonify(strictly_filtered_places)

    except Exception as e:
        logging.error("在 /api/find_places 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "搜尋店家時發生未預期的錯誤"}), 500

@api_bp.route('/categorize_places', methods=['POST'])
def categorize_places_api():
    """
    API 端點：接收店家基本資訊列表，進行 AI 分類並回傳結果。
    這是一個可能耗時較長的操作。
    """
    try:
        places_to_categorize = request.get_json()
        if not isinstance(places_to_categorize, list):
            return jsonify({"error": "缺少或格式不正確的餐廳資料"}), 400

        # AI 只需要店名和類型
        restaurants_for_ai = [{"name": r.get('name'), "types": r.get('types', [])} for r in places_to_categorize]
        categorized_names = ai_service.categorize_restaurants_concurrently(restaurants_for_ai)
        
        logging.info("--- (非同步) AI 分類流程完成 ---")

        # 建立 name -> place_data 的映射，方便前端組合資料
        place_map = {p['name']: p for p in places_to_categorize}
        
        final_result = {}
        for category, names in categorized_names.items():
            final_result[category] = []
            for name in names:
                if name in place_map:
                    final_result[category].append(place_map[name])

        return jsonify(final_result)

    except Exception as e:
        logging.error("在 /api/categorize_places 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "AI 分類時發生未預期的錯誤"}), 500


@api_bp.route('/place_details', methods=['GET'])
def place_details_api():
    """
    API 端點：根據 place_id 獲取單一店家的詳細資訊。
    """
    try:
        place_id = request.args.get('place_id')
        if not place_id:
            return jsonify({"error": "缺少 'place_id' 參數"}), 400
        
        details = gm_service.get_place_details(place_id)
        if details:
            return jsonify(details)
        else:
            return jsonify({"error": "找不到該地點的詳細資訊"}), 404
            
    except Exception as e:
        logging.error(f"在 /api/place_details 路由 (place_id: {place_id}) 發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "獲取店家詳情時發生錯誤"}), 500


@api_bp.route('/geocode', methods=['GET'])
def geocode_api():
    """
    API 端點：將地址轉換為經緯度。
    """
    try:
        query = request.args.get('q')
        if not query:
            return jsonify({"error": "缺少查詢參數 'q'"}), 400
        
        results = gm_service.geocode_address(query)
        return jsonify(results)

    except Exception as e:
        logging.error("在 /api/geocode 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "地理編碼時發生錯誤"}), 500