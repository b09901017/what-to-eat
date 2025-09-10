# backend/config.py

import os
import logging
import requests
import googlemaps
import google.generativeai as genai
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter

# --- 基礎設定 ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()

# --- API 金鑰讀取 ---
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GOOGLE_MAPS_API_KEY or not GEMINI_API_KEY:
    raise ValueError("請在 .env 檔案中設定 GOOGLE_MAPS_API_KEY 和 GEMINI_API_KEY")

# --- 外部服務初始化 ---
try:
    # 建立具備連線池的 Session 以提升效能
    session = requests.Session()
    adapter = HTTPAdapter(pool_connections=50, pool_maxsize=50)
    session.mount('https://', adapter)

    # 初始化 Google Maps Client
    gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY, requests_session=session)

    # 初始化 Gemini API
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')

except Exception as e:
    logging.error(f"初始化 Google 服務失敗: {e}")
    raise