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
