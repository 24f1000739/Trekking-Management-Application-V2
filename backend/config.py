import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))

# Auto-load .env file if present
def _load_env_file():
    for base in (PROJECT_ROOT, BASE_DIR):
        env_file = os.path.join(base, '.env')
        if os.path.isfile(env_file):
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass
            break

_load_env_file()


def _resolve_redis_url():
    if 'REDIS_URL' in os.environ:
        return os.environ['REDIS_URL']
    import socket
    for port in (6379, 6380):
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.1):
                return f'redis://localhost:{port}/0'
        except Exception:
            pass
    return 'redis://localhost:6379/0'


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

    # Redis configuration (auto-detects active Redis port 6379 or 6380)
    REDIS_URL = _resolve_redis_url()
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

    # Designated email recipient for monthly reports and reminders
    REPORT_RECIPIENT_EMAIL = os.environ.get('REPORT_RECIPIENT_EMAIL', 'riteshsah2804@gmail.com')

    # Mail configuration for reminders and reports
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'localhost')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 1025))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'false').lower() in ['true', '1']
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'false').lower() in ['true', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', None)
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', None)
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'no-reply@trekking.com')
