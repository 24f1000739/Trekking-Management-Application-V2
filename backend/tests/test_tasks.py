import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import unittest
import os
import csv
from datetime import date, timedelta
from app import create_app, db
from app.models.user import User
from app.models.trek import Trek
from app.models.booking import Booking
from app.models.notification import Notification
from app.tasks.trek_tasks import send_daily_reminders, generate_monthly_report, export_booking_history_csv
from app.services.cache_service import cache
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SECRET_KEY = 'test-secret-key-tasks'


class TasksTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.app_context = self.app.app_context()
        self.app_context.push()

        # Seed Admin, Staff, User
        self.admin = User.query.filter_by(role='admin').first()

        self.user = User(
            name='Charlie Hiker',
            email='charlie@example.com',
            phone='9777766661',
            role='user',
            is_active=True
        )
        self.user.set_password('Charlie@123')

        # Trek starting tomorrow (within 48 hours for daily reminders)
        tomorrow = date.today() + timedelta(days=1)
        end_date = tomorrow + timedelta(days=5)
        self.upcoming_trek = Trek(
            name='Kedarkantha Winter Summit',
            location='Uttarkashi',
            difficulty='Moderate',
            duration=5,
            total_slots=12,
            available_slots=10,
            status='Open',
            start_date=tomorrow,
            end_date=end_date,
            meeting_point='Dehradun ISBT, 6:00 AM',
            instructions='Wear 3-layer warm clothing and sturdy trekking shoes'
        )

        db.session.add_all([self.user, self.upcoming_trek])
        db.session.commit()

        # Book the user on upcoming trek
        self.booking = Booking(
            user_id=self.user.id,
            trek_id=self.upcoming_trek.id,
            status='Booked',
            num_participants=2
        )
        db.session.add(self.booking)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_daily_reminders_task(self):
        """Daily reminders task identifies upcoming treks and dispatches notifications."""
        result = send_daily_reminders()
        self.assertGreaterEqual(result['reminders_sent'], 1)

        # Check in-app notification created for user
        notif = Notification.query.filter_by(user_id=self.user.id, notification_type='reminder').first()
        self.assertIsNotNone(notif)
        self.assertIn('Kedarkantha Winter Summit', notif.title)
        self.assertIn('Dehradun ISBT', notif.message)
        self.assertIn('Wear 3-layer warm clothing', notif.message)

    def test_monthly_activity_report_task(self):
        """Monthly activity report generates HTML file with trekking statistics."""
        result = generate_monthly_report()
        self.assertIn('filename', result)
        self.assertTrue(os.path.exists(result['filepath']))

        # Verify content of generated HTML
        with open(result['filepath'], 'r', encoding='utf-8') as f:
            html = f.read()
            self.assertIn('Monthly Activity Report', html)
            self.assertIn('Kedarkantha Winter Summit', html)

        # Check notification sent to Admin
        admin_notif = Notification.query.filter_by(user_id=self.admin.id, notification_type='success').first()
        self.assertIsNotNone(admin_notif)
        self.assertIn('Monthly Activity Report Ready', admin_notif.title)

    def test_csv_export_task(self):
        """User-triggered async job exports booking history as CSV with required columns."""
        result = export_booking_history_csv(self.user.id)
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['record_count'], 1)

        csv_filepath = os.path.join(Config.EXPORT_DIRECTORY, result['filename'])
        self.assertTrue(os.path.exists(csv_filepath))

        # Validate CSV contents and header
        with open(csv_filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            self.assertIn('Booking ID', headers)
            self.assertIn('User ID', headers)
            self.assertIn('Trek Name', headers)
            self.assertIn('Location', headers)
            self.assertIn('Booking Status', headers)
            self.assertIn('Booking Date', headers)

            rows = list(reader)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['Trek Name'], 'Kedarkantha Winter Summit')
            self.assertEqual(rows[0]['Booking Status'], 'Booked')

        # Check completion notification created for user
        user_notif = Notification.query.filter_by(user_id=self.user.id, notification_type='export').first()
        self.assertIsNotNone(user_notif)
        self.assertIn('CSV Export Ready', user_notif.title)

    def test_cache_service_fallback(self):
        """Cache service correctly handles set, get, delete, and pattern invalidation."""
        cache.set('test_key', {'status': 'active'}, timeout=60)
        cached = cache.get('test_key')
        self.assertEqual(cached, {'status': 'active'})

        cache.delete('test_key')
        self.assertIsNone(cache.get('test_key'))

        # Pattern invalidation
        cache.set('treks:filter:1', ['trek1'])
        cache.set('treks:filter:2', ['trek2'])
        cache.invalidate_trek_cache()
        self.assertIsNone(cache.get('treks:filter:1'))
        self.assertIsNone(cache.get('treks:filter:2'))


if __name__ == '__main__':
    unittest.main()
