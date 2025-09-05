import os
from dotenv import load_dotenv

# 載入 .env 檔案中的環境變數
load_dotenv()

# --- API 金鑰 ---
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- Google Maps API 設定 ---
# 地點詳情請求的欄位
# 注意：根據 Google API 要求，'photo' 和 'type' 應為單數形式
PLACE_DETAIL_FIELDS = [
    'place_id', 'name', 'geometry', 'rating', 'user_ratings_total', 
    'price_level', 'opening_hours', 'formatted_phone_number', 'website', 
    'photo', 'review', 'type'
]

# 複合式搜尋策略中使用的關鍵字和類型
BROAD_SEARCH_TYPES = ['restaurant', 'bar', 'cafe']
SPECIFIC_KEYWORDS = ['內用', '好吃', '消夜', '飲料', '甜點', '素食']

# --- Gemini API 設定 ---
GEMINI_MODEL_NAME = 'gemini-1.5-flash'
AI_CATEGORIZATION_CHUNK_SIZE = 30 # 每批次處理的餐廳數量

# --- 應用程式設定 ---
MAX_WORKERS_GOOGLE_MAPS = 15 # Google Maps API 並行請求的最大執行緒數
MAX_WORKERS_GEMINI = 10     # Gemini API 並行請求的最大執行緒數
REQUESTS_POOL_CONNECTIONS = 50 # Requests Session 的連線池大小
REQUESTS_POOL_MAXSIZE = 50     # Requests Session 的最大連線池大小