import os
import sys

# Ensure backend_dir is always first in sys.path so 'app' package resolves to backend/app
_current_dir = os.path.abspath(os.path.dirname(__file__))
_backend_dir = os.path.abspath(os.path.join(_current_dir, '..'))
_project_root = os.path.abspath(os.path.join(_backend_dir, '..'))

if 'app' in sys.modules and getattr(sys.modules['app'], '__file__', '').endswith('app.py') and not hasattr(sys.modules['app'], '__path__'):
    del sys.modules['app']

for _item in (_project_root, '', _backend_dir):
    while _item in sys.path:
        sys.path.remove(_item)

sys.path.insert(0, _backend_dir)
sys.path.append(_project_root)

# Compatibility fix for older Redis servers on Windows (avoids Redis 3.x non-deterministic Lua error and Redis < 6.2 ZRANGE BYSCORE)
try:
    import kombu.transport.redis
    import time

    def _compat_refresh_binding(self, keys, args, client):
        key, deadlines_key = keys[0], keys[1]
        member, exchange, ttl = args[0], args[1], args[2]
        now_ms = int(time.time() * 1000)
        score = now_ms + int(ttl)
        with client.pipeline() as pipe:
            pipe.sadd(key, member)
            try:
                pipe.zadd(deadlines_key, {exchange: score})
            except Exception:
                pipe.zadd(deadlines_key, score, exchange)
            pipe.execute()

    kombu.transport.redis.Channel._refresh_binding = _compat_refresh_binding

    _orig_restore_visible = kombu.transport.redis.QoS.restore_visible
    def _compat_restore_visible(self, start=0, num=10, interval=10):
        try:
            return _orig_restore_visible(self, start, num, interval)
        except Exception as ex:
            if 'not an integer' in str(ex) or 'syntax error' in str(ex):
                with self.channel.conn_or_acquire() as client:
                    ceil = time.time() - self.visibility_timeout
                    try:
                        with kombu.transport.redis.Mutex(client, self.unacked_mutex_key, self.unacked_mutex_expire):
                            start_val = start if (start is not None and num is not None) else None
                            num_val = num if (start is not None and num is not None) else None
                            visible = client.zrevrangebyscore(
                                self.unacked_index_key, ceil, 0,
                                start=start_val, num=num_val, withscores=True
                            )
                            for tag, score in visible or []:
                                self.restore_by_tag(tag, client)
                    except kombu.transport.redis.MutexHeld:
                        pass
            else:
                raise

    kombu.transport.redis.QoS.restore_visible = _compat_restore_visible
except Exception:
    pass

from celery import Celery
from celery.schedules import crontab
from config import Config


def make_celery(app_name=__name__):
    celery = Celery(
        app_name,
        broker=Config.CELERY_BROKER_URL,
        backend=Config.CELERY_RESULT_BACKEND,
        include=['app.tasks.trek_tasks']
    )

    celery.conf.update(
        worker_enable_remote_control=False,
        timezone='UTC',
        enable_utc=True,
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        # Celery Beat Periodic Schedule
        beat_schedule={
            'send-daily-reminders-every-day': {
                'task': 'app.tasks.trek_tasks.send_daily_reminders',
                'schedule': crontab(hour=6, minute=0),  # Every morning at 6:00 AM
            },
            'generate-monthly-report-first-of-month': {
                'task': 'app.tasks.trek_tasks.generate_monthly_report',
                'schedule': crontab(day_of_month=1, hour=0, minute=0),  # 1st of month at midnight
            },
        },
    )

    class ContextTask(celery.Task):
        """Ensure Celery tasks run within Flask application context."""
        def __call__(self, *args, **kwargs):
            from flask import has_app_context
            if has_app_context():
                return self.run(*args, **kwargs)
            from app import create_app
            app = create_app()
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


celery = make_celery()
