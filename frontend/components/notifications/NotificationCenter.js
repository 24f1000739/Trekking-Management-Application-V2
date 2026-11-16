// In-App Notification Center & Alerts
async fetchNotifications() {
        if (!this.isAuthenticated) return;
        try {
            const res = await axios.get('/api/notifications');
            if (res.data.success) {
                this.notifications = res.data.data.notifications || [];
                this.unreadCount = res.data.data.unread_count || 0;
            }
        } catch (e) { }
    },

    async markNotificationRead(id) {
        try {
            await axios.put(`/api/notifications/${id}/read`);
            const notif = this.notifications.find(n => n.id === id);
            if (notif && !notif.is_read) {
                notif.is_read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
        } catch (e) { }
    },

    async markAllNotificationsRead() {
        try {
            await axios.put('/api/notifications/read-all');
            this.notifications.forEach(n => n.is_read = true);
            this.unreadCount = 0;
        } catch (e) { }
    }
});
