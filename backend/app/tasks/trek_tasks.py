import csv
import os
from datetime import datetime, timedelta, timezone
import logging

from app.celery_app import celery
from app import db
from app.models.user import User
from app.models.trek import Trek
from app.models.booking import Booking
from app.models.notification import Notification
from config import Config

logger = logging.getLogger(__name__)


@celery.task(name='app.tasks.trek_tasks.send_daily_reminders')
def send_daily_reminders():
    """
    Scheduled Job A: Daily Reminders
    Identifies users with upcoming booked treks (starting within next 48 hours)
    and sends structured reminders containing trek details, meeting point, and instructions.
    """
    now = datetime.now(timezone.utc).date()
    reminder_window_end = now + timedelta(days=2)

    logger.info(f"Running daily reminders for treks between {now} and {reminder_window_end}")

    # Find open/approved treks starting in this window
    upcoming_treks = Trek.query.filter(
        Trek.status.in_(['Open', 'Approved']),
        Trek.start_date >= now,
        Trek.start_date <= reminder_window_end
    ).all()

    reminders_sent = 0
    for trek in upcoming_treks:
        active_bookings = Booking.query.filter_by(trek_id=trek.id, status='Booked').all()
        for booking in active_bookings:
            user = db.session.get(User, booking.user_id)
            if not user or not user.is_active or user.is_blacklisted:
                continue

            days_left = (trek.start_date - now).days
            timing_str = "tomorrow" if days_left <= 1 else f"in {days_left} days ({trek.start_date.strftime('%b %d, %Y')})"

            title = f"Upcoming Trek Reminder: {trek.name}"
            message = (
                f"Hello {user.name}, your trek '{trek.name}' is starting {timing_str}!\n\n"
                f"• Location: {trek.location}\n"
                f"• Start Date: {trek.start_date.strftime('%Y-%m-%d')}\n"
                f"• Meeting Point: {trek.meeting_point or 'To be announced'}\n"
                f"• Instructions: {trek.instructions or 'Be on time with necessary gear.'}\n"
                f"• Requirements: {trek.trek_requirements or 'Basic fitness & identification.'}\n"
                f"• Participants: {booking.num_participants}"
            )

            # 1. Create in-app notification
            notification = Notification(
                user_id=user.id,
                title=title,
                message=message,
                notification_type='reminder',
                link=f"/treks/{trek.id}"
            )
            db.session.add(notification)

            # 2. Simulated / Webhook / Email / SMS delivery
            webhook_url = os.environ.get('GOOGLE_CHAT_WEBHOOK_URL')
            if webhook_url:
                try:
                    import requests
                    requests.post(webhook_url, json={"text": f"*{title}*\n{message}"}, timeout=2.0)
                    logger.info(f"[GCHAT WEBHOOK SENT] Reminder sent to Google Chat webhook for {user.name}")
                except Exception as ex:
                    logger.warning(f"[GCHAT WEBHOOK FAILED] {ex}")

            logger.info(f"[EMAIL/SMS/GCHAT DISPATCHED] To: {user.email} (Phone: {user.phone}) | Subject: {title} | Body: {message[:120]}...")
            reminders_sent += 1

    db.session.commit()
    logger.info(f"Daily reminders complete. Dispatched {reminders_sent} reminder(s).")
    return {'reminders_sent': reminders_sent, 'timestamp': datetime.now(timezone.utc).isoformat()}


@celery.task(name='app.tasks.trek_tasks.generate_monthly_report')
def generate_monthly_report():
    """
    Scheduled Job B: Monthly Activity Report
    Calculates monthly activity metrics and generates an HTML report for Admin.
    """
    logger.info("Generating monthly activity report for Admin...")
    now = datetime.now(timezone.utc)
    report_month = now.strftime('%B %Y')

    total_treks = Trek.query.count()
    completed_treks = Trek.query.filter_by(status='Completed').count()
    active_treks = Trek.query.filter_by(status='Open').count()
    total_users = User.query.filter_by(role='user').count()
    total_staff = User.query.filter_by(role='staff').count()
    total_bookings = Booking.query.count()
    completed_bookings = Booking.query.filter_by(status='Completed').count()
    cancelled_bookings = Booking.query.filter_by(status='Cancelled').count()

    # Popular treks by booking count
    all_treks = Trek.query.all()
    trek_stats = []
    for t in all_treks:
        booked_count = t.participant_count()
        trek_stats.append({
            'name': t.name,
            'location': t.location,
            'difficulty': t.difficulty,
            'status': t.status,
            'participants': booked_count,
            'total_slots': t.total_slots
        })
    trek_stats.sort(key=lambda x: x['participants'], reverse=True)
    popular_treks = trek_stats[:5]

    # Generate HTML report
    os.makedirs(Config.REPORT_DIRECTORY, exist_ok=True)
    report_filename = f"monthly_report_{now.strftime('%Y_%m')}.html"
    report_filepath = os.path.join(Config.REPORT_DIRECTORY, report_filename)

    popular_rows = "".join(f"""
        <tr>
            <td><strong>{t['name']}</strong></td>
            <td>{t['location']}</td>
            <td><span class="badge bg-secondary">{t['difficulty']}</span></td>
            <td>{t['status']}</td>
            <td><strong>{t['participants']}</strong> / {t['total_slots']}</td>
        </tr>
    """ for t in popular_treks)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Trekking Management System - Monthly Activity Report ({report_month})</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {{ background: #f8fafc; font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }}
        .report-header {{ background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; }}
        .stat-box {{ background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: center; }}
        .stat-value {{ font-size: 2rem; font-weight: bold; color: #2563eb; }}
        .stat-label {{ color: #64748b; font-size: 0.9rem; text-transform: uppercase; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="report-header">
            <h1 class="h2 mb-1">Monthly Activity Report</h1>
            <p class="mb-0 opacity-75">Trekking Management Application V2 &bull; Period: {report_month} &bull; Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}</p>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-3"><div class="stat-box"><div class="stat-value">{total_treks}</div><div class="stat-label">Total Treks</div></div></div>
            <div class="col-md-3"><div class="stat-box"><div class="stat-value text-success">{active_treks}</div><div class="stat-label">Active / Open</div></div></div>
            <div class="col-md-3"><div class="stat-box"><div class="stat-value text-info">{completed_treks}</div><div class="stat-label">Completed Treks</div></div></div>
            <div class="col-md-3"><div class="stat-box"><div class="stat-value text-primary">{total_users}</div><div class="stat-label">Total Trekkers</div></div></div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-4"><div class="stat-box"><div class="stat-value">{total_bookings}</div><div class="stat-label">Total Bookings</div></div></div>
            <div class="col-md-4"><div class="stat-box"><div class="stat-value text-success">{completed_bookings}</div><div class="stat-label">Completed Bookings</div></div></div>
            <div class="col-md-4"><div class="stat-box"><div class="stat-value text-danger">{cancelled_bookings}</div><div class="stat-label">Cancelled Bookings</div></div></div>
        </div>

        <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-white py-3">
                <h5 class="card-title mb-0">Most Popular Treks</h5>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Trek Name</th>
                            <th>Location</th>
                            <th>Difficulty</th>
                            <th>Status</th>
                            <th>Booked Participants</th>
                        </tr>
                    </thead>
                    <tbody>
                        {popular_rows if popular_rows else '<tr><td colspan="5" class="text-center text-muted">No trekking activity recorded.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</body>
</html>
"""
    with open(report_filepath, 'w', encoding='utf-8') as f:
        f.write(html_content)

    # Create notification for admin user(s)
    admin_users = User.query.filter_by(role='admin').all()
    for admin in admin_users:
        notif = Notification(
            user_id=admin.id,
            title=f"Monthly Activity Report Ready ({report_month})",
            message=f"The monthly trekking report for {report_month} is now available. {completed_treks} treks completed, {total_bookings} total bookings.",
            notification_type='success',
            link=f"/reports/{report_filename}"
        )
        db.session.add(notif)
        logger.info(f"[EMAIL DISPATCHED TO ADMIN] To: {admin.email} | Subject: Monthly Trekking Activity Report ({report_month}) | Report: {report_filepath}")
    db.session.commit()

    logger.info(f"Report written to {report_filepath}")
    return {
        'filename': report_filename,
        'filepath': report_filepath,
        'generated_at': now.isoformat(),
        'completed_treks': completed_treks,
        'total_bookings': total_bookings
    }


@celery.task(name='app.tasks.trek_tasks.export_booking_history_csv')
def export_booking_history_csv(user_id):
    """
    User-Triggered Async Job C: Export Booking History
    Retrieves user bookings, generates CSV, and creates completion notification.
    """
    logger.info(f"Starting async CSV export for user_id={user_id}")
    user = db.session.get(User, user_id)
    if not user:
        logger.error(f"User {user_id} not found for export")
        return {'status': 'failed', 'error': 'User not found'}

    bookings = Booking.query.filter_by(user_id=user_id).order_by(Booking.booking_date.desc()).all()

    os.makedirs(Config.EXPORT_DIRECTORY, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    filename = f"booking_history_user_{user_id}_{timestamp}.csv"
    filepath = os.path.join(Config.EXPORT_DIRECTORY, filename)

    fieldnames = [
        'Booking ID',
        'User ID',
        'User Name',
        'User Email',
        'Trek Name',
        'Location',
        'Difficulty',
        'Duration (Days)',
        'Booking Status',
        'Participants',
        'Booking Date',
        'Trek Start Date',
        'Trek End Date',
        'Meeting Point',
        'Cancellation Date'
    ]

    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for b in bookings:
            trek = b.trek
            writer.writerow({
                'Booking ID': b.id,
                'User ID': user.id,
                'User Name': user.name,
                'User Email': user.email,
                'Trek Name': trek.name if trek else 'N/A',
                'Location': trek.location if trek else 'N/A',
                'Difficulty': trek.difficulty if trek else 'N/A',
                'Duration (Days)': trek.duration if trek else 'N/A',
                'Booking Status': b.status,
                'Participants': b.num_participants,
                'Booking Date': b.booking_date.strftime('%Y-%m-%d %H:%M:%S') if b.booking_date else '',
                'Trek Start Date': trek.start_date.strftime('%Y-%m-%d') if (trek and trek.start_date) else '',
                'Trek End Date': trek.end_date.strftime('%Y-%m-%d') if (trek and trek.end_date) else '',
                'Meeting Point': trek.meeting_point if trek else '',
                'Cancellation Date': b.cancellation_date.strftime('%Y-%m-%d %H:%M:%S') if b.cancellation_date else ''
            })

    # Create completion notification
    notification = Notification(
        user_id=user.id,
        title="Booking History CSV Export Ready",
        message=f"Your trekking and booking history has been exported successfully ({len(bookings)} records). You can download it now.",
        notification_type='export',
        link=f"/api/user/export-history/download/{filename}"
    )
    db.session.add(notification)
    db.session.commit()

    logger.info(f"CSV export completed for user {user.id}. File: {filename}")
    return {
        'status': 'completed',
        'filename': filename,
        'record_count': len(bookings),
        'download_url': f"/api/user/export-history/download/{filename}"
    }
