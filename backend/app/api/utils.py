from functools import wraps
from flask import jsonify, request, session
from flask_login import current_user
from app import db
from app.models.user import User


def api_response(data=None, message="Operation completed successfully", status_code=200, success=True):
    """Standardized API success response."""
    payload = {
        "success": success,
        "message": message,
        "data": data if data is not None else {}
    }
    return jsonify(payload), status_code


def api_error(message="Unable to complete the request", error=None, status_code=400):
    """Standardized API error response."""
    payload = {
        "success": False,
        "message": message,
        "error": error if error is not None else {}
    }
    return jsonify(payload), status_code


def get_authenticated_user():
    """Retrieve current authenticated user from Flask-Login or session."""
    if current_user.is_authenticated:
        return current_user
    user_id = session.get('user_id')
    if user_id:
        user = db.session.get(User, user_id)
        if user and user.can_login():
            return user
    return None


def login_required_api(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            return api_error("Authentication required. Please log in.", status_code=401)
        if not user.can_login():
            return api_error("Your account has been deactivated or blacklisted.", status_code=403)
        return f(*args, **kwargs)
    return decorated


def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_authenticated_user()
            if not user:
                return api_error("Authentication required. Please log in.", status_code=401)
            if not user.can_login():
                return api_error("Your account has been deactivated or blacklisted.", status_code=403)
            if user.role not in allowed_roles:
                return api_error(f"Access denied. Requires one of roles: {', '.join(allowed_roles)}.", status_code=403)
            return f(*args, **kwargs)
        return decorated
    return decorator


admin_required_api = role_required('admin')
staff_required_api = role_required('staff')
user_required_api = role_required('user')
