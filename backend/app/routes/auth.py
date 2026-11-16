from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from app import db
from app.forms import LoginForm, RegisterStaffForm, RegisterUserForm
from app.models.admin import Admin
from app.models.staff import Staff
from app.models.user import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/')
def index():
    """Redirect to appropriate dashboard or login page."""
    if current_user.is_authenticated:
        role = current_user.get_role()
        if role == 'admin':
            return redirect(url_for('admin.dashboard'))
        if role == 'staff':
            if current_user.is_approved():
                return redirect(url_for('staff.dashboard'))
            return redirect(url_for('staff.pending_approval'))
        return redirect(url_for('user.dashboard'))
    return redirect(url_for('auth.login'))


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Authenticate admin, staff, or user."""
    if current_user.is_authenticated:
        return redirect(url_for('auth.index'))

    form = LoginForm()
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        password = form.password.data

        admin = Admin.query.filter_by(email=email).first()
        if admin and admin.check_password(password):
            login_user(admin, remember=form.remember_me.data)
            flash('Welcome back, Administrator!', 'success')
            return redirect(url_for('admin.dashboard'))

        staff = Staff.query.filter_by(email=email).first()
        if staff:
            if staff.blacklisted:
                flash('Your staff account has been blacklisted.', 'danger')
                return render_template('auth/login.html', form=form)
            if staff.check_password(password):
                login_user(staff, remember=form.remember_me.data)
                if staff.is_approved():
                    flash(f'Welcome back, {staff.name}!', 'success')
                    return redirect(url_for('staff.dashboard'))
                flash('Your account is pending admin approval.', 'warning')
                return redirect(url_for('staff.pending_approval'))

        user = User.query.filter_by(email=email).first()
        if user:
            if user.blacklisted:
                flash('Your account has been blacklisted.', 'danger')
                return render_template('auth/login.html', form=form)
            if user.check_password(password):
                login_user(user, remember=form.remember_me.data)
                flash(f'Welcome back, {user.name}!', 'success')
                return redirect(url_for('user.dashboard'))

        flash('Invalid email or password.', 'danger')

    return render_template('auth/login.html', form=form)


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Register as trekker or trek staff."""
    if current_user.is_authenticated:
        return redirect(url_for('auth.index'))

    role = request.args.get('role', 'user')
    if role == 'staff':
        form = RegisterStaffForm()
        template = 'auth/register_staff.html'
    else:
        form = RegisterUserForm()
        template = 'auth/register_user.html'

    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        phone = form.phone.data.strip()

        if Admin.query.filter_by(email=email).first():
            flash('This email is reserved.', 'danger')
            return render_template(template, form=form)

        if role == 'staff':
            if Staff.query.filter_by(email=email).first():
                flash('Email already registered.', 'danger')
                return render_template(template, form=form)
            if Staff.query.filter_by(phone=phone).first():
                flash('Phone number already registered.', 'danger')
                return render_template(template, form=form)
            if User.query.filter_by(email=email).first():
                flash('Email already registered as user.', 'danger')
                return render_template(template, form=form)

            staff = Staff(
                name=form.name.data.strip(),
                email=email,
                phone=phone,
                status='pending',
            )
            staff.set_password(form.password.data)
            db.session.add(staff)
            db.session.commit()
            flash(
                'Staff registration successful! Await admin approval before login.',
                'success',
            )
            return redirect(url_for('auth.login'))

        if User.query.filter_by(email=email).first():
            flash('Email already registered.', 'danger')
            return render_template(template, form=form)
        if User.query.filter_by(phone=phone).first():
            flash('Phone number already registered.', 'danger')
            return render_template(template, form=form)
        if Staff.query.filter_by(email=email).first():
            flash('Email already registered as staff.', 'danger')
            return render_template(template, form=form)

        user = User(
            name=form.name.data.strip(),
            email=email,
            phone=phone,
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template(template, form=form)


@auth_bp.route('/logout')
@login_required
def logout():
    """Log out current user."""
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))
