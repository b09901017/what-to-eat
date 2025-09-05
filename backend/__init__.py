# backend/__init__.py

from flask import Flask, send_from_directory
from flask_cors import CORS

def create_app():
    """
    應用程式工廠函式
    """
    # 初始化 App，並設定靜態檔案的路徑
    app = Flask(__name__, static_folder='../', static_url_path='/')
    CORS(app)

    # 註冊 API 路由
    from .routes import api_bp
    app.register_blueprint(api_bp)

    # 設定前端主頁的路由
    @app.route('/')
    def serve_index():
        return send_from_directory('../', 'index.html')

    return app