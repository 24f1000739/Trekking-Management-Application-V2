from functools import wraps

from flask import abort, flash, redirect, url_for
from flask_login import current_user


def admin_required(f):
    """Restrict route access to admin users only."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        if current_user.get_role() != 'admin':
            flash('Admin access required.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)

    return decorated_function


def staff_required(f):
    """Restrict route access to approved, non-blacklisted staff."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        if current_user.get_role() != 'staff':
            flash('Staff access required.', 'danger')
            return redirect(url_for('auth.login'))
        if current_user.blacklisted:
            flash('Your account has been blacklisted.', 'danger')
            return redirect(url_for('auth.logout'))
        if not current_user.is_approved():
            return redirect(url_for('staff.pending_approval'))
        return f(*args, **kwargs)

    return decorated_function


def user_required(f):
    """Restrict route access to non-blacklisted trekkers."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        if current_user.get_role() != 'user':
            flash('User access required.', 'danger')
            return redirect(url_for('auth.login'))
        if current_user.blacklisted:
            flash('Your account has been blacklisted.', 'danger')
            return redirect(url_for('auth.logout'))
        return f(*args, **kwargs)

    return decorated_function


def assigned_staff_required(get_trek_id):
    """Ensure only staff assigned to a trek can manage it."""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from app.models.trek import Trek

            trek_id = kwargs.get(get_trek_id) or kwargs.get('trek_id')
            trek = Trek.query.get_or_404(trek_id)

            if current_user.get_role() != 'staff':
                abort(403)
            if trek.assigned_staff_id != current_user.id:
                flash('You are not assigned to this trek.', 'danger')
                return redirect(url_for('staff.dashboard'))
            return f(*args, **kwargs)

        return decorated_function

    return decorator
