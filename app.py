# app.py

from backend import create_app

# 透過工廠函式建立 app
app = create_app()

if __name__ == '__main__':
    # 執行 app
    app.run(debug=True, port=5000)