from datetime import datetime, timezone

from app import db


def utc_now():
    return datetime.now(timezone.utc)


class Trek(db.Model):
    """Trekking event created and managed in the system."""

    __tablename__ = 'treks'

    DIFFICULTY_CHOICES = ['Easy', 'Moderate', 'Hard']
    STATUS_CHOICES = ['Pending', 'Approved', 'Open', 'Closed', 'Completed']

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    location = db.Column(db.String(150), nullable=False, index=True)
    difficulty = db.Column(db.String(20), nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # Duration in days
    total_slots = db.Column(db.Integer, nullable=False)  # Maximum capacity
    available_slots = db.Column(db.Integer, nullable=False)
    assigned_staff_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(20), default='Pending', nullable=False, index=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text, nullable=True)
    meeting_point = db.Column(db.String(255), nullable=True)
    trek_requirements = db.Column(db.Text, nullable=True)
    instructions = db.Column(db.Text, nullable=True)
    image = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(
        db.DateTime, default=utc_now, onupdate=utc_now
    )

    # Relationships
    bookings = db.relationship('Booking', backref='trek', lazy='dynamic', cascade='all, delete-orphan')

    @property
    def trek_name(self):
        return self.name

    def is_bookable(self):
        return self.status == 'Open' and self.available_slots > 0

    def participant_count(self):
        active_bookings = self.bookings.filter_by(status='Booked').all()
        return sum(b.num_participants for b in active_bookings)

    def to_dict(self, include_bookings=False):
        staff_info = None
        if self.assigned_staff:
            staff_info = {
                'id': self.assigned_staff.id,
                'name': self.assigned_staff.name,
                'email': self.assigned_staff.email,
                'phone': self.assigned_staff.phone,
            }

        data = {
            'id': self.id,
            'name': self.name,
            'trek_name': self.name,
            'location': self.location,
            'difficulty': self.difficulty,
            'duration': self.duration,
            'total_slots': self.total_slots,
            'available_slots': self.available_slots,
            'assigned_staff_id': self.assigned_staff_id,
            'assigned_staff': staff_info,
            'status': self.status,
            'start_date': self.start_date.strftime('%Y-%m-%d') if self.start_date else None,
            'end_date': self.end_date.strftime('%Y-%m-%d') if self.end_date else None,
            'description': self.description or '',
            'meeting_point': self.meeting_point or 'To be announced',
            'trek_requirements': self.trek_requirements or 'Basic fitness required',
            'instructions': self.instructions or 'Follow guide instructions at all times',
            'image': self.image,
            'participant_count': self.participant_count(),
            'is_bookable': self.is_bookable(),
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M') if self.updated_at else None,
        }

        if include_bookings:
            data['bookings'] = [b.to_dict() for b in self.bookings.all()]

        return data

    def __repr__(self):
        return f'<Trek {self.name} ({self.status})>'
