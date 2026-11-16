from flask import Blueprint
from app import db
from app.models.notification import Notification
from app.api.utils import api_response, api_error, login_required_api, get_authenticated_user

notifications_api = Blueprint('notifications_api', __name__, url_prefix='/api/notifications')


@notifications_api.route('', methods=['GET'])
@login_required_api
def get_notifications():
    """Get all notifications for authenticated user."""
    user = get_authenticated_user()
    notifs = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(20).all()
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return api_response(data={
        'notifications': [n.to_dict() for n in notifs],
        'unread_count': unread_count
    })


@notifications_api.route('/<int:notification_id>/read', methods=['PUT'])
@login_required_api
def mark_read(notification_id):
    """Mark a single notification as read."""
    user = get_authenticated_user()
    notif = db.get_or_404(Notification, notification_id)
    if notif.user_id != user.id:
        return api_error("Access denied.", status_code=403)

    notif.is_read = True
    db.session.commit()
    return api_response(data=notif.to_dict(), message="Notification marked as read.")


@notifications_api.route('/read-all', methods=['PUT'])
@login_required_api
def mark_all_read():
    """Mark all notifications for authenticated user as read."""
    user = get_authenticated_user()
    Notification.query.filter_by(user_id=user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    return api_response(message="All notifications marked as read.")
