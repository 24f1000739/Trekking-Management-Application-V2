from datetime import datetime
from flask import Blueprint, request
from sqlalchemy import or_

from app import db
from app.models.user import User
from app.models.trek import Trek
from app.models.booking import Booking
from app.models.notification import Notification
from app.services.cache_service import cache
from app.api.utils import api_response, api_error, admin_required_api

admin_api = Blueprint('admin_api', __name__, url_prefix='/api/admin')


@admin_api.route('/dashboard', methods=['GET'])
@admin_required_api
def dashboard():
    """Admin dashboard stats and recent activity."""
    total_treks = Trek.query.count()
    active_treks = Trek.query.filter_by(status='Open').count()
    completed_treks = Trek.query.filter_by(status='Completed').count()
    pending_treks = Trek.query.filter_by(status='Pending').count()

    total_users = User.query.filter_by(role='user').count()
    total_staff = User.query.filter_by(role='staff').count()
    blacklisted_users = User.query.filter_by(role='user', is_blacklisted=True).count()

    total_bookings = Booking.query.count()
    active_bookings = Booking.query.filter_by(status='Booked').count()
    completed_bookings = Booking.query.filter_by(status='Completed').count()
    cancelled_bookings = Booking.query.filter_by(status='Cancelled').count()

    recent_bookings = [
        b.to_dict() for b in Booking.query.order_by(Booking.booking_date.desc()).limit(8).all()
    ]

    # Popular treks
    all_treks = Trek.query.all()
    trek_stats = [t.to_dict() for t in all_treks]
    trek_stats.sort(key=lambda x: x['participant_count'], reverse=True)

    return api_response(data={
        'total_treks': total_treks,
        'active_treks': active_treks,
        'completed_treks': completed_treks,
        'pending_treks': pending_treks,
        'total_users': total_users,
        'total_staff': total_staff,
        'blacklisted_users': blacklisted_users,
        'total_bookings': total_bookings,
        'active_bookings': active_bookings,
        'completed_bookings': completed_bookings,
        'cancelled_bookings': cancelled_bookings,
        'recent_bookings': recent_bookings,
        'popular_treks': trek_stats[:5]
    })


# --- TREK MANAGEMENT ---

@admin_api.route('/treks', methods=['GET'])
@admin_required_api
def get_treks():
    """List and search all treks."""
    search = request.args.get('q', '').strip()
    status = request.args.get('status', '').strip()
    difficulty = request.args.get('difficulty', '').strip()

    query = Trek.query
    if status:
        query = query.filter_by(status=status)
    if difficulty and difficulty != 'All':
        query = query.filter_by(difficulty=difficulty)
    if search:
        if search.isdigit():
            query = query.filter(or_(Trek.id == int(search), Trek.name.ilike(f'%{search}%'), Trek.location.ilike(f'%{search}%')))
        else:
            query = query.filter(or_(Trek.name.ilike(f'%{search}%'), Trek.location.ilike(f'%{search}%')))

    treks = query.order_by(Trek.created_at.desc()).all()
    return api_response(data=[t.to_dict() for t in treks])


@admin_api.route('/treks', methods=['POST'])
@admin_required_api
def create_trek():
    """Create a new trek."""
    data = request.get_json() or {}

    required_fields = ['name', 'location', 'difficulty', 'duration', 'total_slots', 'start_date', 'end_date']
    for f in required_fields:
        if f not in data or data[f] is None or str(data[f]).strip() == '':
            return api_error(f"Field '{f}' is required.", status_code=400)

    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if end_date < start_date:
            return api_error("End date must be on or after start date.", status_code=400)

        total_slots = int(data['total_slots'])
        available_slots = int(data.get('available_slots', total_slots))
        duration = int(data['duration'])

        if total_slots <= 0 or duration <= 0:
            return api_error("Total slots and duration must be greater than 0.", status_code=400)
        if available_slots > total_slots:
            return api_error("Available slots cannot exceed total slots.", status_code=400)
    except ValueError as e:
        return api_error(f"Invalid date or number format: {e}", status_code=400)

    staff_id = data.get('assigned_staff_id')
    if staff_id:
        staff_member = User.query.filter_by(id=staff_id, role='staff').first()
        if not staff_member:
            return api_error("Assigned staff not found or is not staff role.", status_code=400)

    trek = Trek(
        name=data['name'].strip(),
        location=data['location'].strip(),
        difficulty=data['difficulty'],
        duration=duration,
        total_slots=total_slots,
        available_slots=available_slots,
        assigned_staff_id=staff_id if staff_id else None,
        status=data.get('status', 'Pending'),
        start_date=start_date,
        end_date=end_date,
        description=data.get('description', ''),
        meeting_point=data.get('meeting_point', ''),
        trek_requirements=data.get('trek_requirements', ''),
        instructions=data.get('instructions', ''),
        image=data.get('image', None)
    )

    db.session.add(trek)
    db.session.commit()

    # Invalidate Redis cache
    cache.invalidate_trek_cache()

    return api_response(data=trek.to_dict(), message="Trek created successfully.", status_code=201)


@admin_api.route('/treks/<int:trek_id>', methods=['GET'])
@admin_required_api
def get_trek_detail(trek_id):
    """Get single trek details with participants."""
    trek = db.get_or_404(Trek, trek_id)
    return api_response(data=trek.to_dict(include_bookings=True))


@admin_api.route('/treks/<int:trek_id>', methods=['PUT'])
@admin_required_api
def update_trek(trek_id):
    """Update trek details."""
    trek = db.get_or_404(Trek, trek_id)
    data = request.get_json() or {}

    try:
        if 'name' in data:
            trek.name = data['name'].strip()
        if 'location' in data:
            trek.location = data['location'].strip()
        if 'difficulty' in data:
            trek.difficulty = data['difficulty']
        if 'duration' in data:
            trek.duration = int(data['duration'])
        if 'total_slots' in data:
            trek.total_slots = int(data['total_slots'])
        if 'available_slots' in data:
            trek.available_slots = int(data['available_slots'])
        if 'status' in data:
            trek.status = data['status']
        if 'start_date' in data:
            trek.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            trek.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if 'description' in data:
            trek.description = data['description']
        if 'meeting_point' in data:
            trek.meeting_point = data['meeting_point']
        if 'trek_requirements' in data:
            trek.trek_requirements = data['trek_requirements']
        if 'instructions' in data:
            trek.instructions = data['instructions']
        if 'assigned_staff_id' in data:
            sid = data['assigned_staff_id']
            trek.assigned_staff_id = sid if sid else None

        db.session.commit()
        # Invalidate Redis cache
        cache.invalidate_trek_cache(trek.id)
        return api_response(data=trek.to_dict(), message="Trek updated successfully.")
    except ValueError as e:
        return api_error(f"Validation error: {e}", status_code=400)


@admin_api.route('/treks/<int:trek_id>', methods=['DELETE'])
@admin_required_api
def delete_trek(trek_id):
    """Delete a trek only if no bookings exist."""
    trek = db.get_or_404(Trek, trek_id)
    if trek.bookings.count() > 0:
        return api_error("Cannot delete a trek with existing bookings. Booking history must be preserved.", status_code=400)

    db.session.delete(trek)
    db.session.commit()
    cache.invalidate_trek_cache(trek_id)
    return api_response(message="Trek deleted successfully.")


@admin_api.route('/treks/<int:trek_id>/status', methods=['POST'])
@admin_required_api
def set_trek_status(trek_id):
    """Change trek status: Pending, Approved, Open, Closed, Completed."""
    trek = db.get_or_404(Trek, trek_id)
    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in Trek.STATUS_CHOICES:
        return api_error(f"Invalid status. Choose from: {Trek.STATUS_CHOICES}", status_code=400)

    trek.status = new_status
    if new_status == 'Completed':
        # Mark active bookings as completed
        for b in trek.bookings.filter_by(status='Booked').all():
            b.status = 'Completed'
        trek.available_slots = 0

    db.session.commit()
    cache.invalidate_trek_cache(trek_id)
    return api_response(data=trek.to_dict(), message=f"Trek status updated to {new_status}.")


@admin_api.route('/treks/<int:trek_id>/assign-staff', methods=['POST'])
@admin_required_api
def assign_staff(trek_id):
    """Assign a staff member to a trek."""
    trek = db.get_or_404(Trek, trek_id)
    data = request.get_json() or {}
    staff_id = data.get('staff_id')

    if staff_id:
        staff = User.query.filter_by(id=staff_id, role='staff').first()
        if not staff or staff.is_blacklisted or not staff.is_active:
            return api_error("Staff member not found, deactivated, or blacklisted.", status_code=400)
        trek.assigned_staff_id = staff.id
    else:
        trek.assigned_staff_id = None

    db.session.commit()
    cache.invalidate_trek_cache(trek_id)
    return api_response(data=trek.to_dict(), message="Staff assignment updated.")


# --- STAFF MANAGEMENT ---

@admin_api.route('/staff', methods=['GET'])
@admin_required_api
def get_staff():
    """List all staff members."""
    search = request.args.get('q', '').strip()
    query = User.query.filter_by(role='staff')
    if search:
        query = query.filter(or_(User.name.ilike(f'%{search}%'), User.email.ilike(f'%{search}%'), User.phone.ilike(f'%{search}%')))
    staff_list = query.order_by(User.created_at.desc()).all()
    return api_response(data=[s.to_dict() for s in staff_list])


@admin_api.route('/staff', methods=['POST'])
@admin_required_api
def create_staff():
    """Create a new Trek Staff account (Staff accounts are created by Admin only)."""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')

    if not name or not email or not phone or not password:
        return api_error("Name, email, phone, and password are required.", status_code=400)

    if User.query.filter_by(email=email).first():
        return api_error("Email already exists.", status_code=409)
    if User.query.filter_by(phone=phone).first():
        return api_error("Phone number already exists.", status_code=409)

    staff = User(
        name=name,
        email=email,
        phone=phone,
        role='staff',
        is_active=True,
        is_blacklisted=False
    )
    staff.set_password(password)

    db.session.add(staff)
    db.session.commit()
    return api_response(data=staff.to_dict(), message="Staff account created successfully.", status_code=201)


@admin_api.route('/staff/<int:staff_id>', methods=['PUT'])
@admin_required_api
def update_staff(staff_id):
    """Update staff details."""
    staff = User.query.filter_by(id=staff_id, role='staff').first_or_404()
    data = request.get_json() or {}

    if 'name' in data:
        staff.name = data['name'].strip()
    if 'email' in data:
        email = data['email'].strip().lower()
        if User.query.filter(User.email == email, User.id != staff.id).first():
            return api_error("Email already in use.", status_code=409)
        staff.email = email
    if 'phone' in data:
        phone = data['phone'].strip()
        if User.query.filter(User.phone == phone, User.id != staff.id).first():
            return api_error("Phone already in use.", status_code=409)
        staff.phone = phone
    if 'password' in data and data['password']:
        staff.set_password(data['password'])

    db.session.commit()
    return api_response(data=staff.to_dict(), message="Staff details updated.")


@admin_api.route('/staff/<int:staff_id>/toggle-status', methods=['POST'])
@admin_required_api
def toggle_staff_status(staff_id):
    """Toggle blacklist or active status of a staff member."""
    staff = User.query.filter_by(id=staff_id, role='staff').first_or_404()
    data = request.get_json() or {}

    action = data.get('action')  # 'blacklist', 'unblacklist', 'deactivate', 'activate'
    if action == 'blacklist':
        staff.is_blacklisted = True
    elif action == 'unblacklist':
        staff.is_blacklisted = False
    elif action == 'deactivate':
        staff.is_active = False
    elif action == 'activate':
        staff.is_active = True
    else:
        staff.is_blacklisted = not staff.is_blacklisted

    db.session.commit()
    return api_response(data=staff.to_dict(), message=f"Staff status updated. Blacklisted: {staff.is_blacklisted}, Active: {staff.is_active}")


# --- USER MANAGEMENT ---

@admin_api.route('/users', methods=['GET'])
@admin_required_api
def get_users():
    """List all registered trekkers."""
    search = request.args.get('q', '').strip()
    query = User.query.filter_by(role='user')
    if search:
        query = query.filter(or_(User.name.ilike(f'%{search}%'), User.email.ilike(f'%{search}%'), User.phone.ilike(f'%{search}%')))
    users = query.order_by(User.created_at.desc()).all()
    return api_response(data=[u.to_dict() for u in users])


@admin_api.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@admin_api.route('/users/<int:user_id>/toggle-blacklist', methods=['POST'])
@admin_required_api
def toggle_user_status(user_id):
    """Toggle blacklist or active status of a trekker."""
    user = User.query.filter_by(id=user_id, role='user').first_or_404()
    data = request.get_json() or {}
    action = data.get('action')

    if action == 'blacklist':
        user.is_blacklisted = True
    elif action == 'unblacklist':
        user.is_blacklisted = False
    elif action == 'deactivate':
        user.is_active = False
    elif action == 'activate':
        user.is_active = True
    else:
        user.is_blacklisted = not user.is_blacklisted

    db.session.commit()
    return api_response(
        data=user.to_dict(),
        message=f"User {user.name} status updated. Blacklisted: {user.is_blacklisted}, Active: {user.is_active}"
    )


# --- BOOKINGS MONITOR ---

@admin_api.route('/bookings', methods=['GET'])
@admin_required_api
def get_bookings():
    """View all bookings across the platform."""
    trek_id = request.args.get('trek_id')
    status = request.args.get('status')
    query = Booking.query
    if trek_id:
        query = query.filter_by(trek_id=trek_id)
    if status:
        query = query.filter_by(status=status)
    bookings = query.order_by(Booking.booking_date.desc()).all()
    return api_response(data=[b.to_dict() for b in bookings])


# --- REPORTS & BACKGROUND TASKS ---

@admin_api.route('/reports/monthly', methods=['POST', 'GET'])
@admin_required_api
def monthly_report_action():
    """Trigger or retrieve the monthly report."""
    from app.tasks.trek_tasks import generate_monthly_report
    # Run the job synchronously or as task
    try:
        result = generate_monthly_report()
        return api_response(data=result, message="Monthly report generated successfully.")
    except Exception as e:
        return api_error(f"Failed to generate report: {e}", status_code=500)


@admin_api.route('/tasks/run-daily-reminders', methods=['POST'])
@admin_required_api
def run_daily_reminders_manual():
    """Manually trigger daily reminders for upcoming treks."""
    from app.tasks.trek_tasks import send_daily_reminders
    try:
        result = send_daily_reminders()
        return api_response(data=result, message="Daily reminders dispatched successfully.")
    except Exception as e:
        return api_error(f"Failed to run daily reminders: {e}", status_code=500)
