# backend/gemini_service.py

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from .config import gemini_model

def get_categories_from_gemini_chunk(restaurant_chunk):
    """
    將一小批餐廳資料送交給 Gemini API 進行分類。
    """
    if not restaurant_chunk: return {}
    
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
        response = gemini_model.generate_content(prompt)
        text_to_parse = response.text
        if '```json' in text_to_parse:
            text_to_parse = text_to_parse.split('```json')[1].split('```')[0]
        
        return json.loads(text_to_parse)
    except Exception as e:
        logging.error(f"Gemini API 呼叫或解析失敗: {e}\nResponse Text: {response.text if 'response' in locals() else 'N/A'}")
        return {"error": "AI classification failed"}

def categorize_restaurants_concurrently(restaurants_for_ai):
    """
    並行處理所有餐廳的 AI 分類請求。
    """
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