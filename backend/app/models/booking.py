from datetime import datetime, timezone

from app import db


def utc_now():
    return datetime.now(timezone.utc)


class Booking(db.Model):
    """Record of a user booking a trek."""

    __tablename__ = 'bookings'

    STATUS_CHOICES = ['Booked', 'Cancelled', 'Completed']

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    trek_id = db.Column(db.Integer, db.ForeignKey('treks.id'), nullable=False, index=True)
    booking_date = db.Column(db.DateTime, default=utc_now, nullable=False)
    status = db.Column(db.String(20), default='Booked', nullable=False, index=True)
    num_participants = db.Column(db.Integer, default=1, nullable=False)
    payment_status = db.Column(db.String(20), default='Confirmed', nullable=False)
    cancellation_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(
        db.DateTime, default=utc_now, onupdate=utc_now
    )

    def to_dict(self):
        user_info = None
        if self.user:
            user_info = {
                'id': self.user.id,
                'name': self.user.name,
                'email': self.user.email,
                'phone': self.user.phone,
            }

        trek_info = None
        if self.trek:
            trek_info = {
                'id': self.trek.id,
                'name': self.trek.name,
                'location': self.trek.location,
                'difficulty': self.trek.difficulty,
                'duration': self.trek.duration,
                'status': self.trek.status,
                'start_date': self.trek.start_date.strftime('%Y-%m-%d') if self.trek.start_date else None,
                'end_date': self.trek.end_date.strftime('%Y-%m-%d') if self.trek.end_date else None,
                'meeting_point': self.trek.meeting_point,
            }

        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': user_info,
            'trek_id': self.trek_id,
            'trek': trek_info,
            'booking_date': self.booking_date.strftime('%Y-%m-%d %H:%M') if self.booking_date else None,
            'status': self.status,
            'num_participants': self.num_participants,
            'payment_status': self.payment_status,
            'cancellation_date': self.cancellation_date.strftime('%Y-%m-%d %H:%M') if self.cancellation_date else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
        }

    def __repr__(self):
        return f'<Booking {self.id} User={self.user_id} Trek={self.trek_id} ({self.status})>'
