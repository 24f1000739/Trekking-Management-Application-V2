import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import unittest
from app import create_app, db
from app.models.user import User
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SECRET_KEY = 'test-secret-key-auth'


class AuthTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_admin_pre_existing_seeded(self):
        """Admin must pre-exist and be seeded programmatically."""
        admin = User.query.filter_by(role='admin').first()
        self.assertIsNotNone(admin)
        self.assertEqual(admin.email, 'admin@trekking.com')
        self.assertTrue(admin.is_admin())
        self.assertTrue(admin.check_password('Admin@123'))

    def test_user_self_registration_success(self):
        """Trekker can self-register."""
        response = self.client.post('/api/auth/register', json={
            'name': 'John Trekker',
            'email': 'john@example.com',
            'phone': '9123456780',
            'password': 'password123',
            'confirm_password': 'password123',
            'role': 'user'
        })
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['role'], 'user')

        # Verify in DB
        user = User.query.filter_by(email='john@example.com').first()
        self.assertIsNotNone(user)
        self.assertTrue(user.is_user())

    def test_registration_rejects_staff_or_admin(self):
        """Staff and Admin registration is disallowed via public register endpoint."""
        response = self.client.post('/api/auth/register', json={
            'name': 'Fake Admin',
            'email': 'fake@example.com',
            'phone': '9123456781',
            'password': 'password123',
            'role': 'admin'
        })
        self.assertEqual(response.status_code, 403)

        response_staff = self.client.post('/api/auth/register', json={
            'name': 'Fake Staff',
            'email': 'fakestaff@example.com',
            'phone': '9123456782',
            'password': 'password123',
            'role': 'staff'
        })
        self.assertEqual(response_staff.status_code, 403)

    def test_registration_duplicate_email_rejected(self):
        """Duplicate email registration is rejected."""
        self.client.post('/api/auth/register', json={
            'name': 'User One',
            'email': 'dup@example.com',
            'phone': '9000000001',
            'password': 'password123'
        })
        response = self.client.post('/api/auth/register', json={
            'name': 'User Two',
            'email': 'dup@example.com',
            'phone': '9000000002',
            'password': 'password123'
        })
        self.assertEqual(response.status_code, 409)

    def test_login_success_and_logout(self):
        """User can log in and log out."""
        # Register user
        self.client.post('/api/auth/register', json={
            'name': 'Alice Walker',
            'email': 'alice@example.com',
            'phone': '9000000003',
            'password': 'secretpassword'
        })

        # Login
        login_res = self.client.post('/api/auth/login', json={
            'email': 'alice@example.com',
            'password': 'secretpassword'
        })
        self.assertEqual(login_res.status_code, 200)
        data = login_res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['role'], 'user')

        # Check /me
        me_res = self.client.get('/api/auth/me')
        self.assertEqual(me_res.status_code, 200)
        self.assertTrue(me_res.get_json()['data']['authenticated'])

        # Logout
        logout_res = self.client.post('/api/auth/logout')
        self.assertEqual(logout_res.status_code, 200)

        # Check /me again
        me_res2 = self.client.get('/api/auth/me')
        self.assertFalse(me_res2.get_json()['data']['authenticated'])

    def test_blacklisted_or_deactivated_user_cannot_login(self):
        """Deactivated or blacklisted accounts are blocked from logging in."""
        user = User(
            name='Blocked User',
            email='blocked@example.com',
            phone='9000000004',
            role='user',
            is_active=False,
            is_blacklisted=False
        )
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()

        # Login inactive user
        res = self.client.post('/api/auth/login', json={
            'email': 'blocked@example.com',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 403)

        # Blacklist user
        user.is_active = True
        user.is_blacklisted = True
        db.session.commit()

        res2 = self.client.post('/api/auth/login', json={
            'email': 'blocked@example.com',
            'password': 'password123'
        })
        self.assertEqual(res2.status_code, 403)


if __name__ == '__main__':
    unittest.main()
