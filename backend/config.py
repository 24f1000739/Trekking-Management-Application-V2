import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))


class Config:
    # Security
    SECRET_KEY = os.environ.get('SECRET_KEY', 'trekking-management-v2-secret-key-2026')
    
    # Database (SQLite only, created programmatically)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(PROJECT_ROOT, 'instance', 'trekking_v2.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False  # REST APIs use token/session auth

    # Redis configuration (port 6380 avoids Windows Hyper-V port exclusions on 6379)
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6380/0')
    CACHE_DEFAULT_TIMEOUT = int(os.environ.get('CACHE_DEFAULT_TIMEOUT', 300))  # 5 minutes TTL

    # Celery configuration
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)

    # Directories for generated files
    EXPORT_DIRECTORY = os.path.join(PROJECT_ROOT, 'exports')
    REPORT_DIRECTORY = os.path.join(PROJECT_ROOT, 'reports')

    # Initial Admin credentials (seeded programmatically if absent)
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@trekking.com')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@123')
    ADMIN_NAME = os.environ.get('ADMIN_NAME', 'System Administrator')

    # Mail configuration for reminders and reports
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'localhost')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 1025))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'false').lower() in ['true', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', None)
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', None)
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'no-reply@trekking.com')
