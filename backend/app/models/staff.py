from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app import db


class Staff(UserMixin, db.Model):
    """Trek staff member who manages assigned treks."""

    __tablename__ = 'staff'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    status = db.Column(db.String(20), default='pending', nullable=False)
    blacklisted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    assigned_treks = db.relationship('Trek', backref='assigned_staff', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_approved(self):
        return self.status == 'approved' and not self.blacklisted

    def get_role(self):
        return 'staff'

    def get_id(self):
        return f'staff:{self.id}'

    def __repr__(self):
        return f'<Staff {self.email}>'
