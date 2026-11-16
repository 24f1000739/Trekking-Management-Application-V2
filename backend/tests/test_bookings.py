import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import unittest
from datetime import date, timedelta
from app import create_app, db
from app.models.user import User
from app.models.trek import Trek
from app.models.booking import Booking
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SECRET_KEY = 'test-secret-key-bookings'


class BookingsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        # Create a Trekker
        self.user = User(
            name='Bob Trekker',
            email='bob@example.com',
            phone='9888877771',
            role='user',
            is_active=True
        )
        self.user.set_password('User@123')

        # Create an Open Trek
        start = date.today() + timedelta(days=7)
        end = date.today() + timedelta(days=12)
        self.trek = Trek(
            name='Brahmatal Trek',
            location='Lohajung',
            difficulty='Moderate',
            duration=6,
            total_slots=10,
            available_slots=10,
            status='Open',
            start_date=start,
            end_date=end,
            meeting_point='Kathgodam Railway Station'
        )

        db.session.add_all([self.user, self.trek])
        db.session.commit()

        # Login as User
        self.login_user()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def login_user(self):
        self.client.post('/api/auth/login', json={
            'email': 'bob@example.com',
            'password': 'User@123'
        })

    def login_admin(self):
        self.client.post('/api/auth/login', json={
            'email': 'admin@trekking.com',
            'password': 'Admin@123'
        })

    def test_book_trek_success(self):
        """User can book an open trek, slots decrement atomically."""
        res = self.client.post(f'/api/user/treks/{self.trek.id}/book', json={
            'num_participants': 2
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()['data']
        self.assertEqual(data['status'], 'Booked')
        self.assertEqual(data['num_participants'], 2)

        # Check DB slots decremented
        trek = db.session.get(Trek, self.trek.id)
        self.assertEqual(trek.available_slots, 8)

    def test_overbooking_prevention(self):
        """System prevents overbooking beyond available slots."""
        # Request 15 slots when only 10 available
        res = self.client.post(f'/api/user/treks/{self.trek.id}/book', json={
            'num_participants': 15
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('Overbooking prevented', res.get_json()['message'])

        # Verify slots untouched
        trek = db.session.get(Trek, self.trek.id)
        self.assertEqual(trek.available_slots, 10)

    def test_duplicate_booking_prevention(self):
        """User cannot create duplicate active bookings for the same trek."""
        # First booking succeeds
        res1 = self.client.post(f'/api/user/treks/{self.trek.id}/book', json={'num_participants': 1})
        self.assertEqual(res1.status_code, 201)

        # Second booking for same trek rejected
        res2 = self.client.post(f'/api/user/treks/{self.trek.id}/book', json={'num_participants': 1})
        self.assertEqual(res2.status_code, 409)
        self.assertIn('Duplicate booking', res2.get_json()['message'])

    def test_booking_only_allowed_when_open(self):
        """Booking is rejected if trek status is not 'Open'."""
        self.trek.status = 'Closed'
        db.session.commit()

        res = self.client.post(f'/api/user/treks/{self.trek.id}/book', json={'num_participants': 1})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Only 'Open' treks can be booked", res.get_json()['message'])

    def test_cancel_booking_restores_slots(self):
        """Cancelling a booking marks status Cancelled and restores available slots."""
        # Book 3 slots
        res_book = self.client.post(f'/api/user/treks/{self.trek.id}/book', json={'num_participants': 3})
        booking_id = res_book.get_json()['data']['id']

        trek = db.session.get(Trek, self.trek.id)
        self.assertEqual(trek.available_slots, 7)

        # Cancel booking
        res_cancel = self.client.post(f'/api/user/bookings/{booking_id}/cancel')
        self.assertEqual(res_cancel.status_code, 200)

        # Slots restored
        db.session.refresh(trek)
        self.assertEqual(trek.available_slots, 10)

        # Booking status is Cancelled
        booking = db.session.get(Booking, booking_id)
        self.assertEqual(booking.status, 'Cancelled')
        self.assertIsNotNone(booking.cancellation_date)

    def test_prevent_trek_deletion_with_bookings(self):
        """Admin cannot delete a trek that has existing booking history."""
        # Create a booking
        self.client.post(f'/api/user/treks/{self.trek.id}/book', json={'num_participants': 1})

        # Login as Admin and try to delete trek
        self.login_admin()
        res = self.client.delete(f'/api/admin/treks/{self.trek.id}')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Cannot delete a trek with existing bookings', res.get_json()['message'])


if __name__ == '__main__':
    unittest.main()
