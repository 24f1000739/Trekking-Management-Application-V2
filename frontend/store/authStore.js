// Global Reactive Authentication Store
const authStore = reactive({
    user: null,
    role: null,
    isAuthenticated: false,
    loading: true,
    notifications: [],
    unreadCount: 0,

    async checkAuth() {
        try {
            const res = await axios.get('/api/auth/me');
            if (res.data.success && res.data.data.authenticated) {
                this.user = res.data.data.user;
                this.role = res.data.data.role;
                this.isAuthenticated = true;
                this.fetchNotifications();
            } else {
                this.reset();
            }
        } catch (e) {
            this.reset();
        } finally {
            this.loading = false;
        }
    },

    async login(email, password, rememberMe = false) {
        const res = await axios.post('/api/auth/login', { email, password, remember_me: rememberMe });
        if (res.data.success) {
            this.user = res.data.data.user;
            this.role = res.data.data.role;
            this.isAuthenticated = true;
            this.fetchNotifications();
            return res.data;
        }
        throw new Error(res.data.message || 'Login failed');
    },

    async logout() {
        try {
            await axios.post('/api/auth/logout');
        } catch (e) { }
        this.reset();
    },

    reset() {
        this.user = null;
        this.role = null;
        this.isAuthenticated = false;
        this.notifications = [];
        this.unreadCount = 0;
    },

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
