from flask import Blueprint, request
from sqlalchemy import or_

from app import db
from app.models.trek import Trek
from app.models.booking import Booking
from app.models.user import User
from app.services.cache_service import cache
from app.api.utils import api_response, api_error, staff_required_api, get_authenticated_user

staff_api = Blueprint('staff_api', __name__, url_prefix='/api/staff')


def verify_staff_assignment(trek, staff_user):
    """Verify that trek is assigned to this staff member."""
    if trek.assigned_staff_id != staff_user.id:
        return False
    return True


@staff_api.route('/treks', methods=['GET'])
@staff_required_api
def get_assigned_treks():
    """View treks assigned to the authenticated staff member."""
    staff = get_authenticated_user()
    treks = Trek.query.filter_by(assigned_staff_id=staff.id).order_by(Trek.start_date.asc()).all()
    return api_response(data=[t.to_dict() for t in treks])


@staff_api.route('/treks/<int:trek_id>', methods=['GET'])
@staff_required_api
def get_assigned_trek_detail(trek_id):
    """View assigned trek details and participant roster."""
    staff = get_authenticated_user()
    trek = db.get_or_404(Trek, trek_id)

    if not verify_staff_assignment(trek, staff):
        return api_error("Access denied. You are not assigned to manage this trek.", status_code=403)

    search = request.args.get('q', '').strip()
    bookings_query = Booking.query.filter_by(trek_id=trek.id, status='Booked')
    if search:
        bookings_query = bookings_query.join(User).filter(
            or_(User.name.ilike(f'%{search}%'), User.email.ilike(f'%{search}%'), User.phone.ilike(f'%{search}%'))
        )

    participants = [b.to_dict() for b in bookings_query.order_by(Booking.booking_date.desc()).all()]

    trek_data = trek.to_dict()
    trek_data['participants'] = participants

    return api_response(data=trek_data)


@staff_api.route('/treks/<int:trek_id>/slots', methods=['PUT'])
@staff_required_api
def update_slots(trek_id):
    """Update available slots for assigned trek."""
    staff = get_authenticated_user()
    trek = db.get_or_404(Trek, trek_id)

    if not verify_staff_assignment(trek, staff):
        return api_error("Access denied. You are not assigned to manage this trek.", status_code=403)

    data = request.get_json() or {}
    new_slots = data.get('available_slots')
    if new_slots is None:
        return api_error("Field 'available_slots' is required.", status_code=400)

    try:
        new_slots = int(new_slots)
        if new_slots < 0:
            return api_error("Available slots cannot be negative.", status_code=400)

        booked_count = trek.participant_count()
        if new_slots + booked_count > trek.total_slots:
            return api_error(
                f"Cannot set available slots to {new_slots}. Total capacity is {trek.total_slots}, and {booked_count} slots are already booked.",
                status_code=400
            )

        trek.available_slots = new_slots
        db.session.commit()
        cache.invalidate_trek_cache(trek.id)
        return api_response(data=trek.to_dict(), message="Available slots updated successfully.")
    except ValueError:
        return api_error("Invalid slots number.", status_code=400)


@staff_api.route('/treks/<int:trek_id>/status', methods=['PUT'])
@staff_required_api
def update_status(trek_id):
    """Update trek status where permitted (Open or Closed)."""
    staff = get_authenticated_user()
    trek = db.get_or_404(Trek, trek_id)

    if not verify_staff_assignment(trek, staff):
        return api_error("Access denied. You are not assigned to manage this trek.", status_code=403)

    data = request.get_json() or {}
    status = data.get('status')
    if status not in ['Open', 'Closed']:
        return api_error("Staff can only change status to 'Open' or 'Closed'.", status_code=400)

    if trek.status == 'Completed':
        return api_error("Cannot change status of an already completed trek.", status_code=400)

    trek.status = status
    db.session.commit()
    cache.invalidate_trek_cache(trek.id)
    return api_response(data=trek.to_dict(), message=f"Trek status set to {status}.")


@staff_api.route('/treks/<int:trek_id>/start', methods=['POST'])
@staff_required_api
def mark_started(trek_id):
    """Mark trek as started (sets status to Open)."""
    staff = get_authenticated_user()
    trek = db.get_or_404(Trek, trek_id)

    if not verify_staff_assignment(trek, staff):
        return api_error("Access denied. You are not assigned to manage this trek.", status_code=403)

    if trek.status in ['Approved', 'Pending', 'Closed']:
        trek.status = 'Open'
        db.session.commit()
        cache.invalidate_trek_cache(trek.id)
        return api_response(data=trek.to_dict(), message="Trek marked as started (Open).")
    elif trek.status == 'Open':
        return api_response(data=trek.to_dict(), message="Trek is already open.")
    else:
        return api_error("Cannot start a completed trek.", status_code=400)


@staff_api.route('/treks/<int:trek_id>/complete', methods=['POST'])
@staff_required_api
def mark_completed(trek_id):
    """Mark trek as completed (marks bookings as Completed, slots to 0)."""
    staff = get_authenticated_user()
    trek = db.get_or_404(Trek, trek_id)

    if not verify_staff_assignment(trek, staff):
        return api_error("Access denied. You are not assigned to manage this trek.", status_code=403)

    trek.status = 'Completed'
    trek.available_slots = 0

    active_bookings = Booking.query.filter_by(trek_id=trek.id, status='Booked').all()
    for b in active_bookings:
        b.status = 'Completed'

    db.session.commit()
    cache.invalidate_trek_cache(trek.id)
    return api_response(data=trek.to_dict(), message="Trek marked as Completed. All active bookings updated.")
