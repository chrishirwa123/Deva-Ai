"""
Deva AI — application entry point.

Run with:  python app.py
Then open: http://127.0.0.1:5000
"""
from flask import Flask, render_template

from config import config
from memory.database import init_db


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_MB * 1024 * 1024

    with app.app_context():
        init_db()

    from routes.chat_routes import bp as chat_bp
    from routes.memory_routes import bp as memory_bp
    from routes.research_routes import bp as research_bp
    from routes.knowledge_routes import bp as knowledge_bp
    from routes.settings_routes import bp as settings_bp

    app.register_blueprint(chat_bp)
    app.register_blueprint(memory_bp)
    app.register_blueprint(research_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(settings_bp)

    # --- Page routes (server-rendered shells; JS does the rest) ---

    @app.get("/")
    def landing():
        return render_template("landing.html")

    @app.get("/chat")
    @app.get("/chat/<int:conv_id>")
    def chat_page(conv_id=None):
        return render_template("chat.html", conv_id=conv_id)

    @app.get("/assistant")
    def assistant_page():
        return render_template("assistant.html")

    @app.get("/research")
    def research_page():
        return render_template("research.html")

    @app.get("/knowledge")
    def knowledge_page():
        return render_template("knowledge.html")

    @app.get("/memory")
    def memory_page():
        return render_template("memory.html")

    @app.get("/profile")
    def profile_page():
        return render_template("profile.html")

    @app.get("/settings")
    def settings_page():
        return render_template("settings.html")

    @app.errorhandler(404)
    def not_found(e):
        return render_template("landing.html"), 404

    return app


app = create_app()

if __name__ == "__main__":
    print(f"\n  Deva AI starting at http://{config.HOST}:{config.PORT}\n")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
