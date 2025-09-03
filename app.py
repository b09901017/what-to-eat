import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import random

app = Flask(__name__)
CORS(app)

# --- 全新的、更豐富的模擬數據 ---
mock_data = {
    "中式麵館 🍜": [
        {"name": "鼎泰豐", "lat": 24.978, "lon": 121.540, "rating": 4.8, "price_level": 4, "hours": "營業中", "details": {
            "photos": ["https://placehold.co/600x400/F5EBE0/424242?text=小籠包", "https://placehold.co/600x400/D5B4B4/424242?text=店內環境"],
            "reviews": [
                {"author_name": "陳先生", "rating": 5, "text": "服務一流，小籠包皮薄多汁，不愧是米其林推薦！", "relative_time_description": "2 週前"},
                {"author_name": "美食家Emily", "rating": 4, "text": "排隊時間有點長，但食物品質穩定，炒飯也很好吃。", "relative_time_description": "1 個月前"}
            ],
            "opening_hours": { "weekday_text": ["星期一: 11:00 AM – 9:30 PM", "星期二: 11:00 AM – 9:30 PM", "...", "星期日: 10:30 AM – 9:30 PM"] },
            "formatted_phone_number": "(02) 2321-8928", "website": "https://www.dintaifung.com.tw/"
        }},
        {"name": "永康牛肉麵", "lat": 24.976, "lon": 121.542, "rating": 4.5, "price_level": 3, "hours": "休息中", "details": {
             "photos": ["https://placehold.co/600x400/E3D5CA/424242?text=紅燒牛肉麵"],
             "reviews": [{"author_name": "老饕王", "rating": 5, "text": "湯頭濃郁，牛肉燉得軟爛入味，絕對是台北必吃！", "relative_time_description": "3 天前"}],
             "opening_hours": { "weekday_text": ["星期一至日: 11:00 AM – 3:30 PM, 4:30 PM – 9:00 PM"] }, "formatted_phone_number": "(02) 2351-1051", "website": "#"
        }}
    ],
    "美味便當 🍱": [
        {"name": "池上飯包", "lat": 24.973, "lon": 121.539, "rating": 4.3, "price_level": 2, "hours": "營業中", "details": {
            "photos": ["https://placehold.co/600x400/D5E8D4/424242?text=招牌飯包"],
            "reviews": [{"author_name": "上班族李", "rating": 4, "text": "快速、好吃、CP值高，午餐的好選擇。", "relative_time_description": "昨天"}],
            "opening_hours": { "weekday_text": ["星期一至五: 10:30 AM – 8:00 PM"] }, "formatted_phone_number": "(02) 2911-5588", "website": "#"
        }}
    ],
    "義式風情 🍝": [
        {"name": "薄多義 Bite 2 Eat", "lat": 24.975, "lon": 121.536, "rating": 4.6, "price_level": 3, "hours": "營業中", "details": {
            "photos": ["https://placehold.co/600x400/FADCD9/424242?text=瑪格麗特披薩", "https://placehold.co/600x400/F9F1F0/424242?text=用餐氛圍"],
            "reviews": [{"author_name": "情侶約會", "rating": 5, "text": "氣氛很好，披薩是窯烤的，餅皮很Q，適合聚餐。", "relative_time_description": "5 天前"}],
            "opening_hours": { "weekday_text": ["星期一至日: 11:30 AM – 9:30 PM"] }, "formatted_phone_number": "(02) 2776-3288", "website": "https://www.bite2eatpizza.com/"
        }}
    ],
    "健康早午餐 🥪": [
         {"name": "樂子 the Diner", "lat": 24.972, "lon": 121.543, "rating": 4.7, "price_level": 3, "hours": "營業中", "details": {
            "photos": ["https://placehold.co/600x400/FFF2CC/424242?text=班尼迪克蛋"],
            "reviews": [{"author_name": "週末放鬆", "rating": 5, "text": "份量十足的美式早午餐，每次來都點不一樣的，從沒失望過。", "relative_time_description": "上週末"}],
            "opening_hours": { "weekday_text": ["星期一至五: 9:00 AM – 9:00 PM", "週末: 8:00 AM – 9:30 PM"] }, "formatted_phone_number": "(02) 2754-1680", "website": "https://www.thediner.com.tw/"
        }}
    ],
     "手搖飲料 🍹": [
        {"name": "春水堂", "lat": 24.979, "lon": 121.537, "rating": 4.4, "price_level": 3, "hours": "營業中", "details": {
            "photos": ["https://placehold.co/600x400/D4E2D4/424242?text=珍珠奶茶"],
            "reviews": [{"author_name": "觀光客", "rating": 4, "text": "珍珠奶茶的創始店，雖然貴了點，但茶香濃郁，珍珠Q彈，值得一試。", "relative_time_description": "2 週前"}],
            "opening_hours": { "weekday_text": ["星期一至日: 11:00 AM – 10:00 PM"] }, "formatted_phone_number": "(02) 2321-9356", "website": "https://www.chunshuitang.com.tw/"
        }}
    ]
}

@app.route('/api/search', methods=['POST'])
def search_restaurants():
    # 模擬網路延遲和處理時間
    time.sleep(random.uniform(0.5, 1.5))
    
    # 這裡的程式碼是為了讓模擬數據看起來更真實
    # 在真實世界中，你會在這裡呼叫 Google Maps API
    data = request.get_json()
    if not data or 'lat' not in data or 'lon' not in data:
        return jsonify({"error": "缺少經緯度資訊"}), 400
    
    # 在真實情境中，你會使用 data['lat'], data['lon'], data['radius'] 去搜尋
    # 但因為我們用的是 mock data，所以直接回傳
    
    return jsonify(mock_data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)

