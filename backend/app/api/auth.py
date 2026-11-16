from flask import Blueprint, request, session
from flask_login import login_user, logout_user
from app import db
from app.models.user import User
from app.api.utils import api_response, api_error, get_authenticated_user, login_required_api

auth_api = Blueprint('auth_api', __name__, url_prefix='/api/auth')


@auth_api.route('/login', methods=['POST'])
def login():
    """Authenticate Admin, Staff, or User."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return api_error("Email and password are required.", status_code=400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return api_error("Invalid email or password.", status_code=401)

    if not user.is_active:
        return api_error("Your account has been deactivated. Please contact the administrator.", status_code=403)

    if user.is_blacklisted:
        return api_error("Your account has been blacklisted due to policy violations.", status_code=403)

    # Log in
    login_user(user, remember=data.get('remember_me', False))
    session['user_id'] = user.id
    session['user_role'] = user.role

    return api_response(
        data={
            'user': user.to_dict(),
            'role': user.role
        },
        message=f"Welcome back, {user.name}!"
    )


@auth_api.route('/register', methods=['POST'])
def register():
    """
    Trekker self-registration only.
    Staff and Admin registration through this endpoint is strictly disallowed.
    """
    data = request.get_json() or {}
    role = data.get('role', 'user').strip().lower()

    if role != 'user':
        return api_error("Only trekkers can register. Staff accounts must be created by an Administrator.", status_code=403)

    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not name or not email or not phone or not password:
        return api_error("Name, email, phone, and password are required.", status_code=400)

    if len(password) < 6:
        return api_error("Password must be at least 6 characters long.", status_code=400)

    if confirm_password and password != confirm_password:
        return api_error("Passwords do not match.", status_code=400)

    if User.query.filter_by(email=email).first():
        return api_error("This email is already registered.", status_code=409)

    if User.query.filter_by(phone=phone).first():
        return api_error("This phone number is already in use.", status_code=409)

    new_user = User(
        name=name,
        email=email,
        phone=phone,
        role='user',
        is_active=True,
        is_blacklisted=False
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    return api_response(
        data=new_user.to_dict(),
        message="Registration successful! You can now log in.",
        status_code=201
    )


@auth_api.route('/me', methods=['GET'])
def me():
    """Get current authenticated user info."""
    user = get_authenticated_user()
    if not user:
        return api_response(data={'authenticated': False}, message="Not authenticated")
    return api_response(
        data={
            'authenticated': True,
            'user': user.to_dict(),
            'role': user.role
        }
    )


@auth_api.route('/profile', methods=['PUT'])
@login_required_api
def update_profile():
    """Update profile details of the authenticated user."""
    user = get_authenticated_user()
    data = request.get_json() or {}

    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()

    if name:
        user.name = name
    if email and email != user.email:
        if User.query.filter(User.email == email, User.id != user.id).first():
            return api_error("Email already in use by another account.", status_code=409)
        user.email = email
    if phone and phone != user.phone:
        if User.query.filter(User.phone == phone, User.id != user.id).first():
            return api_error("Phone number already in use by another account.", status_code=409)
        user.phone = phone

    password = data.get('password')
    if password:
        if len(password) < 6:
            return api_error("New password must be at least 6 characters.", status_code=400)
        user.set_password(password)

    db.session.commit()
    return api_response(data=user.to_dict(), message="Profile updated successfully.")


@auth_api.route('/logout', methods=['POST'])
def logout():
    """Log out authenticated user."""
    logout_user()
    session.clear()
    return api_response(message="Logged out successfully.")
