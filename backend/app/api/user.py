import os
from datetime import datetime, timezone
from flask import Blueprint, request, send_from_directory
from sqlalchemy import or_

from app import db
from app.models.trek import Trek
from app.models.booking import Booking
from app.models.notification import Notification
from app.services.cache_service import cache
from app.api.utils import api_response, api_error, user_required_api, get_authenticated_user
from config import Config

user_api = Blueprint('user_api', __name__, url_prefix='/api/user')


@user_api.route('/treks', methods=['GET'])
@user_required_api
def explore_treks():
    """
    Browse and search approved/open treks.
    Results are cached in Redis.
    """
    search = request.args.get('q', '').strip()
    location = request.args.get('location', '').strip()
    difficulty = request.args.get('difficulty', '').strip()
    duration = request.args.get('duration', '').strip()
    start_date = request.args.get('start_date', '').strip()

    filter_key = f"{search}:{location}:{difficulty}:{duration}:{start_date}"

    # Try Redis cache
    cached_result = cache.get_cached_treks(filter_key)
    if cached_result is not None:
        return api_response(data=cached_result, message="Loaded from cache.")

    # Cache miss: query database
    query = Trek.query.filter_by(status='Open').filter(Trek.available_slots > 0)

    if location:
        query = query.filter(Trek.location.ilike(f'%{location}%'))
    if difficulty and difficulty != 'All':
        query = query.filter_by(difficulty=difficulty)
    if duration and duration.isdigit():
        query = query.filter(Trek.duration <= int(duration))
    if start_date:
        try:
            parsed_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Trek.start_date >= parsed_date)
        except ValueError:
            pass
    if search:
        query = query.filter(
            or_(Trek.name.ilike(f'%{search}%'), Trek.location.ilike(f'%{search}%'))
        )

    treks = query.order_by(Trek.start_date.asc()).all()
    treks_data = [t.to_dict() for t in treks]

    # Store in Redis cache
    cache.set_cached_treks(treks_data, filter_key)

    return api_response(data=treks_data)


@user_api.route('/treks/<int:trek_id>', methods=['GET'])
@user_required_api
def get_trek_details(trek_id):
    """
    Get detailed information for a specific trek.
    Cached in Redis.
    """
    cached_trek = cache.get_cached_trek_detail(trek_id)
    if cached_trek:
        return api_response(data=cached_trek)

    trek = db.get_or_404(Trek, trek_id)
    data = trek.to_dict()
    cache.set_cached_trek_detail(trek_id, data)
    return api_response(data=data)


@user_api.route('/treks/<int:trek_id>/book', methods=['POST'])
@user_required_api
def book_trek(trek_id):
    """
    Trek booking with business rule checks:
    1. Trek status must be 'Open'
    2. User cannot have duplicate active booking
    3. Requested slots must be available
    4. Atomic slot decrement
    5. Invalidate Redis cache
    """
    user = get_authenticated_user()
    data = request.get_json() or {}
    num_participants = int(data.get('num_participants', 1))

    if num_participants <= 0:
        return api_error("Number of participants must be at least 1.", status_code=400)

    trek = db.get_or_404(Trek, trek_id)

    if trek.status != 'Open':
        return api_error(f"Trek is currently '{trek.status}'. Only 'Open' treks can be booked.", status_code=400)

    # 1. Overbooking prevention
    if trek.available_slots < num_participants:
        return api_error(
            f"Overbooking prevented. Requested {num_participants} slot(s), but only {trek.available_slots} available.",
            status_code=400
        )

    # 2. Duplicate booking prevention
    existing_active = Booking.query.filter_by(
        user_id=user.id,
        trek_id=trek.id,
        status='Booked'
    ).first()
    if existing_active:
        return api_error(
            "Duplicate booking rejected. You already have an active reservation for this trek.",
            status_code=409
        )

    # Atomic decrement
    trek.available_slots -= num_participants

    booking = Booking(
        user_id=user.id,
        trek_id=trek.id,
        status='Booked',
        num_participants=num_participants,
        booking_date=datetime.now(timezone.utc)
    )

    # In-app notification
    notification = Notification(
        user_id=user.id,
        title="Trek Booking Confirmed!",
        message=f"You have successfully booked '{trek.name}' for {num_participants} participant(s). Start date: {trek.start_date.strftime('%Y-%m-%d')}.",
        notification_type='success',
        link=f"/bookings"
    )

    db.session.add(booking)
    db.session.add(notification)
    db.session.commit()

    # Invalidate Redis cache
    cache.invalidate_trek_cache(trek.id)

    return api_response(
        data=booking.to_dict(),
        message="Trek booked successfully!",
        status_code=201
    )


@user_api.route('/bookings', methods=['GET'])
@user_required_api
def get_user_bookings():
    """Get all bookings for the authenticated user."""
    user = get_authenticated_user()
    bookings = Booking.query.filter_by(user_id=user.id).order_by(Booking.booking_date.desc()).all()
    return api_response(data=[b.to_dict() for b in bookings])


@user_api.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@user_required_api
def cancel_booking(booking_id):
    """
    Cancel an active booking:
    1. Status -> 'Cancelled'
    2. Cancellation date -> now
    3. Slots restored if trek is 'Open'
    4. Invalidate Redis cache
    """
    user = get_authenticated_user()
    booking = db.get_or_404(Booking, booking_id)

    if booking.user_id != user.id:
        return api_error("Access denied. This booking does not belong to you.", status_code=403)

    if booking.status != 'Booked':
        return api_error(f"Cannot cancel a booking with status '{booking.status}'.", status_code=400)

    trek = db.session.get(Trek, booking.trek_id)
    booking.status = 'Cancelled'
    booking.cancellation_date = datetime.now(timezone.utc)

    # Restore available slots if trek is Open
    if trek and trek.status == 'Open':
        trek.available_slots = min(trek.total_slots, trek.available_slots + booking.num_participants)

    notification = Notification(
        user_id=user.id,
        title="Booking Cancelled",
        message=f"Your booking for '{trek.name if trek else 'Trek'}' has been cancelled.",
        notification_type='warning',
        link="/bookings"
    )
    db.session.add(notification)
    db.session.commit()

    # Invalidate Redis cache
    if trek:
        cache.invalidate_trek_cache(trek.id)

    return api_response(data=booking.to_dict(), message="Booking cancelled successfully.")


@user_api.route('/history', methods=['GET'])
@user_required_api
def trekking_history():
    """View completed trekking history for user."""
    user = get_authenticated_user()
    history = Booking.query.filter_by(user_id=user.id, status='Completed').order_by(Booking.booking_date.desc()).all()
    return api_response(data=[b.to_dict() for b in history])


@user_api.route('/export-history', methods=['POST'])
@user_required_api
def export_history():
    """
    User-Triggered Async Job C: Export Booking History
    Dispatches Celery background task to generate CSV when Redis is running,
    or generates synchronously as fallback.
    """
    user = get_authenticated_user()
    from app.tasks.trek_tasks import export_booking_history_csv
    from app.services.cache_service import cache

    if cache._is_redis_available():
        try:
            task = export_booking_history_csv.delay(user.id)
            return api_response(
                data={'task_id': task.id, 'status': 'PROCESSING'},
                message="Export task initiated. You will receive a notification when the CSV file is ready.",
                status_code=202
            )
        except Exception:
            pass

    # Direct synchronous execution fallback when Redis broker is offline
    result = export_booking_history_csv(user.id)
    return api_response(
        data=result,
        message="Booking history exported successfully. Your CSV is ready for download."
    )


@user_api.route('/export-history/download/<filename>', methods=['GET'])
@user_required_api
def download_export(filename):
    """Download the exported CSV file."""
    # Security check: ensure user owns file or is admin
    user = get_authenticated_user()
    if f"user_{user.id}" not in filename and not user.is_admin():
        return api_error("Access denied to requested file.", status_code=403)

    return send_from_directory(Config.EXPORT_DIRECTORY, filename, as_attachment=True)
