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
    SECRET_KEY = 'test-secret-key-treks'


class TreksTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

        # Login as Admin
        self.admin = User.query.filter_by(role='admin').first()
        self.login_admin()

        # Create a Staff Guide
        self.staff = User(
            name='Tenzing Guide',
            email='tenzing@trekking.com',
            phone='9811122233',
            role='staff',
            is_active=True
        )
        self.staff.set_password('Staff@123')
        db.session.add(self.staff)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def login_admin(self):
        self.client.post('/api/auth/login', json={
            'email': 'admin@trekking.com',
            'password': 'Admin@123'
        })

    def login_staff(self):
        self.client.post('/api/auth/login', json={
            'email': 'tenzing@trekking.com',
            'password': 'Staff@123'
        })

    def test_admin_create_trek(self):
        """Admin can create a new trek with all required attributes."""
        start = (date.today() + timedelta(days=5)).strftime('%Y-%m-%d')
        end = (date.today() + timedelta(days=10)).strftime('%Y-%m-%d')

        res = self.client.post('/api/admin/treks', json={
            'name': 'Roopkund Trek',
            'location': 'Uttarakhand',
            'difficulty': 'Hard',
            'duration': 5,
            'total_slots': 20,
            'available_slots': 20,
            'start_date': start,
            'end_date': end,
            'meeting_point': 'Lohajung',
            'assigned_staff_id': self.staff.id
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()['data']
        self.assertEqual(data['name'], 'Roopkund Trek')
        self.assertEqual(data['assigned_staff']['id'], self.staff.id)

    def test_admin_update_trek(self):
        """Admin can update trek details."""
        start = (date.today() + timedelta(days=5)).strftime('%Y-%m-%d')
        end = (date.today() + timedelta(days=10)).strftime('%Y-%m-%d')
        res = self.client.post('/api/admin/treks', json={
            'name': 'Kuari Pass',
            'location': 'Joshimath',
            'difficulty': 'Moderate',
            'duration': 4,
            'total_slots': 15,
            'start_date': start,
            'end_date': end
        })
        trek_id = res.get_json()['data']['id']

        update_res = self.client.put(f'/api/admin/treks/{trek_id}', json={
            'difficulty': 'Hard',
            'total_slots': 25,
            'available_slots': 25
        })
        self.assertEqual(update_res.status_code, 200)
        updated = update_res.get_json()['data']
        self.assertEqual(updated['difficulty'], 'Hard')
        self.assertEqual(updated['total_slots'], 25)

    def test_staff_view_assigned_treks_only(self):
        """Staff can view only treks assigned to them."""
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=10)

        # Assigned to staff
        t1 = Trek(
            name='Hampta Pass',
            location='Manali',
            difficulty='Moderate',
            duration=5,
            total_slots=10,
            available_slots=10,
            assigned_staff_id=self.staff.id,
            status='Open',
            start_date=start,
            end_date=end
        )
        # Not assigned
        t2 = Trek(
            name='Kedarkantha',
            location='Sankri',
            difficulty='Easy',
            duration=4,
            total_slots=15,
            available_slots=15,
            assigned_staff_id=None,
            status='Open',
            start_date=start,
            end_date=end
        )
        db.session.add_all([t1, t2])
        db.session.commit()

        # Login as staff
        self.login_staff()
        res = self.client.get('/api/staff/treks')
        self.assertEqual(res.status_code, 200)
        assigned = res.get_json()['data']
        self.assertEqual(len(assigned), 1)
        self.assertEqual(assigned[0]['name'], 'Hampta Pass')

        # Staff cannot access unassigned trek detail
        forbidden_res = self.client.get(f'/api/staff/treks/{t2.id}')
        self.assertEqual(forbidden_res.status_code, 403)

    def test_staff_update_slots_and_status(self):
        """Staff can update available slots and change status between Open and Closed."""
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=10)
        t = Trek(
            name='Valley of Flowers',
            location='Govindghat',
            difficulty='Easy',
            duration=4,
            total_slots=20,
            available_slots=20,
            assigned_staff_id=self.staff.id,
            status='Open',
            start_date=start,
            end_date=end
        )
        db.session.add(t)
        db.session.commit()

        self.login_staff()

        # Update slots
        res_slots = self.client.put(f'/api/staff/treks/{t.id}/slots', json={'available_slots': 15})
        self.assertEqual(res_slots.status_code, 200)
        self.assertEqual(res_slots.get_json()['data']['available_slots'], 15)

        # Exceeding total capacity rejected
        res_bad_slots = self.client.put(f'/api/staff/treks/{t.id}/slots', json={'available_slots': 25})
        self.assertEqual(res_bad_slots.status_code, 400)

        # Update status
        res_status = self.client.put(f'/api/staff/treks/{t.id}/status', json={'status': 'Closed'})
        self.assertEqual(res_status.status_code, 200)
        self.assertEqual(res_status.get_json()['data']['status'], 'Closed')


if __name__ == '__main__':
    unittest.main()
