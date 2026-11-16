from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from app import db
from app.decorators import user_required
from app.forms import ProfileForm, TrekFilterForm
from app.models.booking import Booking
from app.models.trek import Trek
from app.models.user import User

user_bp = Blueprint('user', __name__, url_prefix='/user')


@user_bp.route('/dashboard')
@login_required
@user_required
def dashboard():
    """User dashboard with available and booked treks."""
    available_treks = (
        Trek.query.filter_by(status='Open')
        .filter(Trek.available_slots > 0)
        .order_by(Trek.start_date.asc())
        .limit(6)
        .all()
    )

    my_bookings = (
        Booking.query.filter_by(user_id=current_user.id)
        .order_by(Booking.booking_date.desc())
        .limit(5)
        .all()
    )

    booked_count = Booking.query.filter_by(
        user_id=current_user.id, status='Booked'
    ).count()
    completed_count = Booking.query.filter_by(
        user_id=current_user.id, status='Completed'
    ).count()

    return render_template(
        'user/dashboard.html',
        available_treks=available_treks,
        my_bookings=my_bookings,
        booked_count=booked_count,
        completed_count=completed_count,
    )


@user_bp.route('/treks')
@login_required
@user_required
def treks():
    """Browse and filter open treks."""
    form = TrekFilterForm(request.args)
    query = Trek.query.filter_by(status='Open').filter(Trek.available_slots > 0)

    location = request.args.get('location', '').strip()
    difficulty = request.args.get('difficulty', '').strip()
    search = request.args.get('q', '').strip()

    if location:
        query = query.filter(Trek.location.ilike(f'%{location}%'))
    if difficulty:
        query = query.filter_by(difficulty=difficulty)
    if search:
        query = query.filter(
            or_(
                Trek.name.ilike(f'%{search}%'),
                Trek.location.ilike(f'%{search}%'),
            )
        )

    treks_list = query.order_by(Trek.start_date.asc()).all()
    return render_template(
        'user/treks.html',
        treks=treks_list,
        form=form,
        location=location,
        difficulty=difficulty,
        search=search,
    )


@user_bp.route('/treks/<int:trek_id>')
@login_required
@user_required
def trek_detail(trek_id):
    """View trek details."""
    trek = Trek.query.get_or_404(trek_id)
    existing_booking = Booking.query.filter_by(
        user_id=current_user.id, trek_id=trek_id, status='Booked'
    ).first()
    return render_template(
        'user/trek_detail.html', trek=trek, existing_booking=existing_booking
    )


@user_bp.route('/treks/<int:trek_id>/book', methods=['POST'])
@login_required
@user_required
def book_trek(trek_id):
    """Book an open trek with available slots."""
    trek = Trek.query.get_or_404(trek_id)

    if trek.status != 'Open':
        flash('Only open treks can be booked.', 'danger')
        return redirect(url_for('user.trek_detail', trek_id=trek_id))

    if trek.available_slots <= 0:
        flash('No slots available. Trek is fully booked.', 'danger')
        return redirect(url_for('user.trek_detail', trek_id=trek_id))

    existing = Booking.query.filter_by(
        user_id=current_user.id, trek_id=trek_id, status='Booked'
    ).first()
    if existing:
        flash('You have already booked this trek.', 'warning')
        return redirect(url_for('user.my_bookings'))

    booking = Booking(
        user_id=current_user.id,
        trek_id=trek_id,
        status='Booked',
        booking_date=datetime.utcnow(),
    )
    trek.available_slots -= 1
    db.session.add(booking)
    db.session.commit()

    flash('Trek booked successfully!', 'success')
    return redirect(url_for('user.booking_confirmation', booking_id=booking.id))


@user_bp.route('/bookings/confirmation/<int:booking_id>')
@login_required
@user_required
def booking_confirmation(booking_id):
    """Booking confirmation page."""
    booking = Booking.query.get_or_404(booking_id)
    if booking.user_id != current_user.id:
        flash('Unauthorized access.', 'danger')
        return redirect(url_for('user.dashboard'))
    return render_template('user/booking_confirmation.html', booking=booking)


@user_bp.route('/bookings')
@login_required
@user_required
def my_bookings():
    """View all user bookings."""
    bookings_list = (
        Booking.query.filter_by(user_id=current_user.id)
        .order_by(Booking.booking_date.desc())
        .all()
    )
    return render_template('user/bookings.html', bookings=bookings_list)


@user_bp.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@login_required
@user_required
def cancel_booking(booking_id):
    """Cancel an active booking."""
    booking = Booking.query.get_or_404(booking_id)
    if booking.user_id != current_user.id:
        flash('Unauthorized access.', 'danger')
        return redirect(url_for('user.my_bookings'))

    if booking.status != 'Booked':
        flash('Only active bookings can be cancelled.', 'warning')
        return redirect(url_for('user.my_bookings'))

    trek = Trek.query.get(booking.trek_id)
    booking.status = 'Cancelled'
    if trek and trek.status == 'Open':
        trek.available_slots += 1
    db.session.commit()
    flash('Booking cancelled successfully.', 'info')
    return redirect(url_for('user.my_bookings'))


@user_bp.route('/history')
@login_required
@user_required
def trekking_history():
    """View completed trekking history."""
    history = (
        Booking.query.filter_by(user_id=current_user.id, status='Completed')
        .order_by(Booking.booking_date.desc())
        .all()
    )
    return render_template('user/history.html', history=history)


@user_bp.route('/profile', methods=['GET', 'POST'])
@login_required
@user_required
def profile():
    """View and edit user profile."""
    form = ProfileForm(obj=current_user)

    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        phone = form.phone.data.strip()

        existing_email = User.query.filter(
            User.email == email, User.id != current_user.id
        ).first()
        if existing_email:
            flash('Email already in use.', 'danger')
            return render_template('user/profile.html', form=form)

        existing_phone = User.query.filter(
            User.phone == phone, User.id != current_user.id
        ).first()
        if existing_phone:
            flash('Phone number already in use.', 'danger')
            return render_template('user/profile.html', form=form)

        current_user.name = form.name.data.strip()
        current_user.email = email
        current_user.phone = phone
        db.session.commit()
        flash('Profile updated successfully.', 'success')
        return redirect(url_for('user.profile'))

    return render_template('user/profile.html', form=form)
