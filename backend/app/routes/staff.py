from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from app import db
from app.decorators import assigned_staff_required, staff_required
from app.forms import SearchForm, StaffTrekUpdateForm
from app.models.booking import Booking
from app.models.trek import Trek

staff_bp = Blueprint('staff', __name__, url_prefix='/staff')


@staff_bp.route('/pending')
@login_required
def pending_approval():
    """Show pending approval page for unapproved staff."""
    if current_user.get_role() != 'staff':
        return redirect(url_for('auth.login'))
    if current_user.is_approved():
        return redirect(url_for('staff.dashboard'))
    return render_template('staff/pending.html')


@staff_bp.route('/dashboard')
@login_required
@staff_required
def dashboard():
    """Staff dashboard with assigned treks overview."""
    assigned_treks = Trek.query.filter_by(
        assigned_staff_id=current_user.id
    ).order_by(Trek.start_date.desc()).all()

    total_assigned = len(assigned_treks)
    open_treks = sum(1 for t in assigned_treks if t.status == 'Open')
    total_participants = sum(t.participant_count() for t in assigned_treks)

    return render_template(
        'staff/dashboard.html',
        assigned_treks=assigned_treks,
        total_assigned=total_assigned,
        open_treks=open_treks,
        total_participants=total_participants,
    )


@staff_bp.route('/treks/<int:trek_id>')
@login_required
@staff_required
@assigned_staff_required('trek_id')
def manage_trek(trek_id):
    """Manage an assigned trek - view details and participants."""
    trek = Trek.query.get_or_404(trek_id)
    search = request.args.get('q', '').strip()

    participants_query = Booking.query.filter_by(trek_id=trek_id, status='Booked')
    if search:
        from app.models.user import User

        participants_query = participants_query.join(User).filter(
            or_(
                User.name.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%'),
            )
        )
        if search.isdigit():
            participants_query = participants_query.filter(
                or_(User.id == int(search), Booking.id == int(search))
            )

    participants = participants_query.order_by(Booking.booking_date.desc()).all()
    form = StaffTrekUpdateForm(available_slots=trek.available_slots, status=trek.status)

    return render_template(
        'staff/manage_trek.html',
        trek=trek,
        participants=participants,
        form=form,
        search=search,
    )


@staff_bp.route('/treks/<int:trek_id>/update', methods=['POST'])
@login_required
@staff_required
@assigned_staff_required('trek_id')
def update_trek(trek_id):
    """Update available slots and status for assigned trek."""
    trek = Trek.query.get_or_404(trek_id)
    form = StaffTrekUpdateForm()

    if form.validate_on_submit():
        if form.available_slots.data < 0:
            flash('Available slots cannot be negative.', 'danger')
            return redirect(url_for('staff.manage_trek', trek_id=trek_id))

        booked_count = trek.participant_count()
        if form.available_slots.data + booked_count > trek.total_slots:
            flash(
                'Available slots plus booked participants cannot exceed total slots.',
                'danger',
            )
            return redirect(url_for('staff.manage_trek', trek_id=trek_id))

        trek.available_slots = form.available_slots.data
        trek.status = form.status.data
        db.session.commit()
        flash('Trek updated successfully.', 'success')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{field}: {error}', 'danger')

    return redirect(url_for('staff.manage_trek', trek_id=trek_id))


@staff_bp.route('/treks/<int:trek_id>/start', methods=['POST'])
@login_required
@staff_required
@assigned_staff_required('trek_id')
def mark_started(trek_id):
    """Mark trek as started (status Open)."""
    trek = Trek.query.get_or_404(trek_id)
    if trek.status in ('Approved', 'Pending'):
        trek.status = 'Open'
        db.session.commit()
        flash('Trek marked as started (Open).', 'success')
    elif trek.status == 'Open':
        flash('Trek is already open.', 'info')
    else:
        flash('Cannot start a closed or completed trek.', 'warning')
    return redirect(url_for('staff.manage_trek', trek_id=trek_id))


@staff_bp.route('/treks/<int:trek_id>/complete', methods=['POST'])
@login_required
@staff_required
@assigned_staff_required('trek_id')
def mark_completed(trek_id):
    """Mark trek as completed."""
    trek = Trek.query.get_or_404(trek_id)
    trek.status = 'Completed'
    trek.available_slots = 0

    active_bookings = Booking.query.filter_by(trek_id=trek_id, status='Booked').all()
    for booking in active_bookings:
        booking.status = 'Completed'

    db.session.commit()
    flash('Trek marked as completed.', 'success')
    return redirect(url_for('staff.manage_trek', trek_id=trek_id))
