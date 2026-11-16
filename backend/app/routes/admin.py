from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from app import db
from app.decorators import admin_required
from app.forms import AssignStaffForm, SearchForm, TrekForm
from app.models.booking import Booking
from app.models.staff import Staff
from app.models.trek import Trek
from app.models.user import User

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route('/dashboard')
@login_required
@admin_required
def dashboard():
    """Admin dashboard with summary statistics."""
    total_treks = Trek.query.count()
    total_users = User.query.count()
    total_staff = Staff.query.count()
    total_bookings = Booking.query.count()

    recent_bookings = (
        Booking.query.order_by(Booking.booking_date.desc()).limit(8).all()
    )
    pending_staff = (
        Staff.query.filter_by(status='pending', blacklisted=False)
        .order_by(Staff.created_at.desc())
        .limit(8)
        .all()
    )

    return render_template(
        'admin/dashboard.html',
        total_treks=total_treks,
        total_users=total_users,
        total_staff=total_staff,
        total_bookings=total_bookings,
        recent_bookings=recent_bookings,
        pending_staff=pending_staff,
    )


@admin_bp.route('/treks')
@login_required
@admin_required
def treks():
    """List all treks with optional search."""
    search = request.args.get('q', '').strip()
    query = Trek.query

    if search:
        if search.isdigit():
            query = query.filter(
                or_(Trek.id == int(search), Trek.name.ilike(f'%{search}%'))
            )
        else:
            query = query.filter(Trek.name.ilike(f'%{search}%'))

    treks_list = query.order_by(Trek.created_at.desc()).all()
    return render_template('admin/treks.html', treks=treks_list, search=search)


@admin_bp.route('/treks/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_trek():
    """Create a new trek."""
    form = TrekForm()
    approved_staff = Staff.query.filter_by(status='approved', blacklisted=False).all()
    form.assigned_staff_id.choices = [(0, '-- Not Assigned --')] + [
        (s.id, s.name) for s in approved_staff
    ]

    if form.validate_on_submit():
        staff_id = form.assigned_staff_id.data if form.assigned_staff_id.data else None
        if staff_id == 0:
            staff_id = None

        trek = Trek(
            name=form.name.data.strip(),
            location=form.location.data.strip(),
            difficulty=form.difficulty.data,
            duration=form.duration.data,
            total_slots=form.total_slots.data,
            available_slots=form.available_slots.data,
            assigned_staff_id=staff_id,
            status=form.status.data,
            start_date=form.start_date.data,
            end_date=form.end_date.data,
            description=form.description.data,
        )
        db.session.add(trek)
        db.session.commit()
        flash('Trek created successfully.', 'success')
        return redirect(url_for('admin.treks'))

    return render_template('admin/trek_form.html', form=form, title='Create Trek')


@admin_bp.route('/treks/<int:trek_id>/edit', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_trek(trek_id):
    """Edit an existing trek."""
    trek = Trek.query.get_or_404(trek_id)
    form = TrekForm(obj=trek)
    approved_staff = Staff.query.filter_by(status='approved', blacklisted=False).all()
    form.assigned_staff_id.choices = [(0, '-- Not Assigned --')] + [
        (s.id, s.name) for s in approved_staff
    ]

    if form.validate_on_submit():
        staff_id = form.assigned_staff_id.data if form.assigned_staff_id.data else None
        if staff_id == 0:
            staff_id = None

        trek.name = form.name.data.strip()
        trek.location = form.location.data.strip()
        trek.difficulty = form.difficulty.data
        trek.duration = form.duration.data
        trek.total_slots = form.total_slots.data
        trek.available_slots = form.available_slots.data
        trek.assigned_staff_id = staff_id
        trek.status = form.status.data
        trek.start_date = form.start_date.data
        trek.end_date = form.end_date.data
        trek.description = form.description.data
        db.session.commit()
        flash('Trek updated successfully.', 'success')
        return redirect(url_for('admin.treks'))

    if request.method == 'GET':
        form.assigned_staff_id.data = trek.assigned_staff_id or 0

    return render_template(
        'admin/trek_form.html', form=form, title='Edit Trek', trek=trek
    )


@admin_bp.route('/treks/<int:trek_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_trek(trek_id):
    """Delete a trek only if no bookings exist (preserve history)."""
    trek = Trek.query.get_or_404(trek_id)
    if trek.bookings.count() > 0:
        flash(
            'Cannot delete trek with existing bookings. Booking history must be preserved.',
            'danger',
        )
        return redirect(url_for('admin.treks'))
    db.session.delete(trek)
    db.session.commit()
    flash('Trek deleted successfully.', 'success')
    return redirect(url_for('admin.treks'))


@admin_bp.route('/treks/<int:trek_id>/assign', methods=['GET', 'POST'])
@login_required
@admin_required
def assign_staff(trek_id):
    """Assign staff to a trek."""
    trek = Trek.query.get_or_404(trek_id)
    form = AssignStaffForm()
    approved_staff = Staff.query.filter_by(status='approved', blacklisted=False).all()
    form.assigned_staff_id.choices = [(s.id, s.name) for s in approved_staff]

    if not approved_staff:
        flash('No approved staff available for assignment.', 'warning')
        return redirect(url_for('admin.treks'))

    if form.validate_on_submit():
        trek.assigned_staff_id = form.assigned_staff_id.data
        db.session.commit()
        flash('Staff assigned to trek successfully.', 'success')
        return redirect(url_for('admin.treks'))

    if trek.assigned_staff_id:
        form.assigned_staff_id.data = trek.assigned_staff_id

    return render_template('admin/assign_staff.html', form=form, trek=trek)


@admin_bp.route('/staff')
@login_required
@admin_required
def staff_list():
    """View all staff with search and tab filtering."""
    search = request.args.get('q', '').strip()
    status_filter = request.args.get('status', 'all')

    query = Staff.query
    if status_filter == 'pending':
        query = query.filter_by(status='pending', blacklisted=False)
    elif status_filter == 'approved':
        query = query.filter_by(status='approved', blacklisted=False)
    elif status_filter == 'blacklisted':
        query = query.filter_by(blacklisted=True)

    if search:
        if search.isdigit():
            query = query.filter(
                or_(Staff.id == int(search), Staff.name.ilike(f'%{search}%'))
            )
        else:
            query = query.filter(
                or_(
                    Staff.name.ilike(f'%{search}%'),
                    Staff.email.ilike(f'%{search}%'),
                )
            )

    staff_members = query.order_by(Staff.created_at.desc()).all()
    return render_template(
        'admin/staff.html',
        staff_members=staff_members,
        search=search,
        status_filter=status_filter,
    )


@admin_bp.route('/staff/<int:staff_id>/approve', methods=['POST'])
@login_required
@admin_required
def approve_staff(staff_id):
    """Approve pending staff registration."""
    staff = Staff.query.get_or_404(staff_id)
    staff.status = 'approved'
    db.session.commit()
    flash(f'{staff.name} has been approved.', 'success')
    return redirect(url_for('admin.staff_list', status='pending'))


@admin_bp.route('/staff/<int:staff_id>/reject', methods=['POST'])
@login_required
@admin_required
def reject_staff(staff_id):
    """Reject pending staff registration."""
    staff = Staff.query.get_or_404(staff_id)
    staff.status = 'rejected'
    db.session.commit()
    flash(f'{staff.name} has been rejected.', 'warning')
    return redirect(url_for('admin.staff_list', status='pending'))


@admin_bp.route('/staff/<int:staff_id>/blacklist', methods=['POST'])
@login_required
@admin_required
def blacklist_staff(staff_id):
    """Blacklist a staff member."""
    staff = Staff.query.get_or_404(staff_id)
    staff.blacklisted = True
    staff.status = 'blacklisted'
    db.session.commit()
    flash(f'{staff.name} has been blacklisted.', 'danger')
    return redirect(url_for('admin.staff_list'))


@admin_bp.route('/users')
@login_required
@admin_required
def users():
    """View all users with search."""
    search = request.args.get('q', '').strip()
    query = User.query

    if search:
        if search.isdigit():
            query = query.filter(
                or_(User.id == int(search), User.name.ilike(f'%{search}%'))
            )
        else:
            query = query.filter(
                or_(
                    User.name.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                )
            )

    users_list = query.order_by(User.created_at.desc()).all()
    return render_template('admin/users.html', users=users_list, search=search)


@admin_bp.route('/users/<int:user_id>/blacklist', methods=['POST'])
@login_required
@admin_required
def blacklist_user(user_id):
    """Blacklist a user."""
    user = User.query.get_or_404(user_id)
    user.blacklisted = True
    db.session.commit()
    flash(f'{user.name} has been blacklisted.', 'danger')
    return redirect(url_for('admin.users'))


@admin_bp.route('/bookings')
@login_required
@admin_required
def bookings():
    """View all bookings."""
    bookings_list = Booking.query.order_by(Booking.booking_date.desc()).all()
    return render_template('admin/bookings.html', bookings=bookings_list)


@admin_bp.route('/search', methods=['GET', 'POST'])
@login_required
@admin_required
def search():
    """Global search for treks, users, and staff."""
    query = request.args.get('q', '').strip()
    treks_results = []
    users_results = []
    staff_results = []

    if query:
        if query.isdigit():
            qid = int(query)
            treks_results = Trek.query.filter(
                or_(Trek.id == qid, Trek.name.ilike(f'%{query}%'))
            ).all()
            users_results = User.query.filter(
                or_(User.id == qid, User.name.ilike(f'%{query}%'))
            ).all()
            staff_results = Staff.query.filter(
                or_(Staff.id == qid, Staff.name.ilike(f'%{query}%'))
            ).all()
        else:
            treks_results = Trek.query.filter(
                Trek.name.ilike(f'%{query}%')
            ).all()
            users_results = User.query.filter(
                or_(User.name.ilike(f'%{query}%'), User.email.ilike(f'%{query}%'))
            ).all()
            staff_results = Staff.query.filter(
                or_(Staff.name.ilike(f'%{query}%'), Staff.email.ilike(f'%{query}%'))
            ).all()

    return render_template(
        'admin/search.html',
        query=query,
        treks_results=treks_results,
        users_results=users_results,
        staff_results=staff_results,
    )
