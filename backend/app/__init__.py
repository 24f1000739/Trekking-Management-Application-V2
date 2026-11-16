import os
from datetime import datetime, timezone
from flask import Flask, render_template, send_from_directory, abort
from flask_login import LoginManager, current_user
from flask_sqlalchemy import SQLAlchemy

from config import Config

db = SQLAlchemy()
login_manager = LoginManager()


def create_app(config_class=Config):
    """
    Application factory for Trekking Management Application V2.
    Initializes Flask REST APIs, Cache, Database, and Vue.js SPA entry point.
    """
    backend_app_dir = os.path.abspath(os.path.dirname(__file__))
    project_root = os.path.abspath(os.path.join(backend_app_dir, '..', '..'))
    frontend_dir = os.path.join(project_root, 'frontend')

    template_dir = os.path.join(frontend_dir, 'templates') if os.path.isdir(os.path.join(frontend_dir, 'templates')) else os.path.join(backend_app_dir, 'templates')
    static_dir = os.path.join(frontend_dir, 'static') if os.path.isdir(os.path.join(frontend_dir, 'static')) else os.path.join(backend_app_dir, 'static')

    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    app.config.from_object(config_class)

    # Ensure necessary folders exist
    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs(app.config.get('EXPORT_DIRECTORY', os.path.join(project_root, 'exports')), exist_ok=True)
    os.makedirs(app.config.get('REPORT_DIRECTORY', os.path.join(project_root, 'reports')), exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)

    # Initialize Cache Service
    from app.services.cache_service import cache
    cache.init_app(app)

    # Register REST API Blueprints
    from app.api.auth import auth_api
    from app.api.admin import admin_api
    from app.api.staff import staff_api
    from app.api.user import user_api
    from app.api.notifications import notifications_api

    app.register_blueprint(auth_api)
    app.register_blueprint(admin_api)
    app.register_blueprint(staff_api)
    app.register_blueprint(user_api)
    app.register_blueprint(notifications_api)

    # Single Jinja2 Entry Point for Vue.js SPA
    @app.route('/')
    @app.route('/login')
    @app.route('/register')
    @app.route('/admin')
    @app.route('/staff')
    @app.route('/user')
    @app.route('/explore')
    @app.route('/bookings')
    @app.route('/history')
    @app.route('/profile')
    def index():
        """Single Jinja2 HTML entry point for the Vue.js 3 SPA."""
        return render_template('index.html')

    # Serve generated monthly HTML reports to Admin
    @app.route('/reports/<path:filename>')
    def serve_report(filename):
        if not current_user.is_authenticated or current_user.role != 'admin':
            abort(403)
        return send_from_directory(app.config['REPORT_DIRECTORY'], filename)

    # Programmatic Database Creation & Seeding
    with app.app_context():
        db.create_all()
        seed_admin(app)

    return app


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for session management."""
    from app.models.user import User
    try:
        uid = int(user_id)
        return db.session.get(User, uid)
    except (ValueError, TypeError):
        return None


def seed_admin(app):
    """Programmatically create exactly one initial Admin if absent."""
    from app.models.user import User

    admin = User.query.filter_by(role='admin').first()
    if not admin:
        admin_user = User(
            name=app.config.get('ADMIN_NAME', 'System Administrator'),
            email=app.config.get('ADMIN_EMAIL', 'admin@trekking.com'),
            phone='9876543210',
            role='admin',
            is_active=True,
            is_blacklisted=False,
            joining_date=datetime.now(timezone.utc)
        )
        admin_user.set_password(app.config.get('ADMIN_PASSWORD', 'Admin@123'))
        db.session.add(admin_user)
        db.session.commit()

