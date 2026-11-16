from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app import db


def utc_now():
    return datetime.now(timezone.utc)


class User(UserMixin, db.Model):
    """
    Unified User model supporting all three roles:
    - 'admin': Pre-existing superuser
    - 'staff': Trek staff managing assigned treks
    - 'user': Trekkers who book and participate in treks
    """

    __tablename__ = 'users'

    ROLES = ['admin', 'staff', 'user']

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user', index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_blacklisted = db.Column(db.Boolean, default=False, nullable=False)
    joining_date = db.Column(db.DateTime, default=utc_now)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(
        db.DateTime, default=utc_now, onupdate=utc_now
    )

    # Relationships
    bookings = db.relationship(
        'Booking', backref='user', lazy='dynamic', cascade='all, delete-orphan'
    )
    assigned_treks = db.relationship(
        'Trek', backref='assigned_staff', lazy='dynamic', foreign_keys='Trek.assigned_staff_id'
    )
    notifications = db.relationship(
        'Notification', backref='user', lazy='dynamic', cascade='all, delete-orphan'
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_admin(self):
        return self.role == 'admin'

    def is_staff(self):
        return self.role == 'staff'

    def is_user(self):
        return self.role == 'user'

    def can_login(self):
        return self.is_active and not self.is_blacklisted

    def get_id(self):
        return str(self.id)

    def to_dict(self):
        data = {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'is_active': self.is_active,
            'is_blacklisted': self.is_blacklisted,
            'joining_date': self.joining_date.strftime('%Y-%m-%d') if self.joining_date else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
        }
        if self.role == 'staff':
            data['assigned_treks'] = [{'id': t.id, 'name': t.name, 'status': t.status} for t in self.assigned_treks.all()]
            data['assigned_treks_count'] = self.assigned_treks.count()
        return data

    def __repr__(self):
        return f'<User {self.email} ({self.role})>'
