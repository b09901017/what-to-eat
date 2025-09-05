# backend/routes.py

import logging
import traceback
from flask import Blueprint, request, jsonify
from . import google_maps_service as gm_service
from . import gemini_service as ai_service

# 建立名為 'api' 的 Blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/find_places', methods=['POST'])
def find_places_api():
    """
    API 端點：搜尋店家並回傳詳細資訊。
    """
    try:
        data = request.get_json()
        if not data or 'lat' not in data or 'lon' not in data:
            return jsonify({"error": "缺少經緯度資訊"}), 400
        
        lat, lon = data['lat'], data['lon']
        radius = data.get('radius', 500)
        
        place_ids = gm_service.search_unique_places((lat, lon), radius)
        if not place_ids:
            return jsonify({})

        all_restaurants = gm_service.get_all_restaurants_details_concurrently(place_ids)
        strictly_filtered_restaurants = gm_service.filter_places_by_distance(all_restaurants, lat, lon, radius)
        
        return jsonify(strictly_filtered_restaurants)

    except Exception as e:
        logging.error("在 /api/find_places 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "搜尋店家時發生未預期的錯誤"}), 500

@api_bp.route('/categorize_places', methods=['POST'])
def categorize_places_api():
    """
    API 端點：接收店家資料並進行 AI 分類。
    """
    try:
        all_restaurants = request.get_json()
        if not all_restaurants or not isinstance(all_restaurants, dict):
            return jsonify({"error": "缺少或格式不正確的餐廳資料"}), 400

        restaurants_for_ai = [{"name": r.get('name'), "types": r.get('types', [])} for r in all_restaurants.values()]
        categorized_names = ai_service.categorize_restaurants_concurrently(restaurants_for_ai)
        
        logging.info("--- AI 分類流程完成 ---")

        final_result = {}
        for category, names in categorized_names.items():
            final_result[category] = []
            for name in names:
                if name in all_restaurants:
                    final_result[category].append(all_restaurants[name])
        
        return jsonify(final_result)

    except Exception as e:
        logging.error("在 /api/categorize_places 路由發生未預期的錯誤:")
        traceback.print_exc()
        return jsonify({"error": "AI 分類時發生未預期的錯誤"}), 500