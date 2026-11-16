/**
 * Trekking Management Application (TMA) V2 - Vue 3 SPA
 * Features: Unified Auth, RBAC (Admin, Staff, User), Redis-cached Trek Explore,
 * Overbooking & Duplicate Prevention, Celery CSV Export, Notifications, and Reports.
 */

const { createApp, ref, reactive, computed, onMounted, watch } = Vue;
const { createRouter, createWebHistory } = VueRouter;

// Set Axios defaults
axios.defaults.baseURL = '';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Global Reactive Auth Store
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

// Toast / Notification helper
const toast = reactive({
    show: false,
    message: '',
    type: 'success', // 'success', 'danger', 'info', 'warning'
    trigger(msg, type = 'success') {
        this.message = msg;
        this.type = type;
        this.show = true;
        setTimeout(() => { this.show = false; }, 4000);
    }
});

// --- COMPONENTS ---

// 1. Navbar Component
const Navbar = {
    template: `
    <nav class="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">
        <div class="container-fluid px-4">
            <router-link to="/" class="navbar-brand d-flex align-items-center gap-2">
                <span class="brand-icon">🏔️</span>
                <span class="brand-text">TrekManager <span class="badge bg-primary fs-7">V2</span></span>
            </router-link>
            
            <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navMenu">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                    <!-- Admin Navigation -->
                    <template v-if="authStore.role === 'admin'">
                        <li class="nav-item">
                            <router-link to="/admin" class="nav-link"><i class="bi bi-speedometer2 me-1"></i> Admin Console</router-link>
                        </li>
                    </template>

                    <!-- Staff Navigation -->
                    <template v-if="authStore.role === 'staff'">
                        <li class="nav-item">
                            <router-link to="/staff" class="nav-link"><i class="bi bi-kanban me-1"></i> Staff Dashboard</router-link>
                        </li>
                    </template>

                    <!-- Trekker Navigation -->
                    <template v-if="authStore.role === 'user'">
                        <li class="nav-item">
                            <router-link to="/user" class="nav-link"><i class="bi bi-house-door me-1"></i> Dashboard</router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/explore" class="nav-link"><i class="bi bi-compass me-1"></i> Explore Treks</router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/bookings" class="nav-link"><i class="bi bi-ticket-perforated me-1"></i> My Bookings</router-link>
                        </li>
                        <li class="nav-item">
                            <router-link to="/history" class="nav-link"><i class="bi bi-journal-check me-1"></i> Trekking History</router-link>
                        </li>
                    </template>
                </ul>
                </div>

                

                <!-- Right Side: User Status & Notifications -->
                <div class="d-flex align-items-center gap-3">
                    <template v-if="authStore.isAuthenticated">
                        <!-- Notifications Dropdown -->
                        <div class="dropdown">
                            <button class="btn btn-outline-light notif-btn position-relative" type="button" data-bs-toggle="dropdown">
                                <i class="bi bi-bell"></i>
                                <span v-if="authStore.unreadCount > 0" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                                    {{ authStore.unreadCount }}
                                </span>
                            </button>
                            <div class="dropdown-menu dropdown-menu-end shadow-lg notif-dropdown p-0">
                                <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                                    <h6 class="mb-0 fw-bold">Notifications</h6>
                                    <button v-if="authStore.unreadCount > 0" @click="authStore.markAllNotificationsRead()" class="btn btn-sm btn-link p-0 text-decoration-none">
                                        Mark all read
                                    </button>
                                </div>
                                <div class="notif-list" style="max-height: 320px; overflow-y: auto;">
                                    <div v-if="authStore.notifications.length === 0" class="p-4 text-center text-muted small">
                                        No notifications yet.
                                    </div>
                                    <div v-for="n in authStore.notifications" :key="n.id" 
                                         :class="['p-3 border-bottom notif-item', {'bg-light-unread': !n.is_read}]"
                                         @click="authStore.markNotificationRead(n.id)">
                                        <div class="d-flex justify-content-between align-items-start mb-1">
                                            <span class="fw-semibold small text-primary">{{ n.title }}</span>
                                            <span class="text-muted" style="font-size: 0.7rem;">{{ n.created_at }}</span>
                                        </div>
                                        <p class="mb-1 text-secondary small text-break" style="white-space: pre-line;">{{ n.message }}</p>
                                        <a v-if="n.link" :href="n.link" target="_blank" class="btn btn-xs btn-outline-primary mt-1 small py-0 px-2" style="font-size: 0.75rem;">
                                            <i class="bi bi-box-arrow-up-right me-1"></i> Open Link
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- User Profile Dropdown -->
                        <div class="dropdown">
                            <button class="btn btn-user-profile dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                                <span class="avatar-circle">{{ authStore.user.name.charAt(0) }}</span>
                                <div class="text-start d-none d-md-block">
                                    <div class="user-name">{{ authStore.user.name }}</div>
                                    <span :class="['badge-role', 'role-' + authStore.role]">{{ authStore.role.toUpperCase() }}</span>
                                </div>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                <li class="px-3 py-2 text-muted small border-bottom">
                                    Signed in as <br><strong>{{ authStore.user.email }}</strong>
                                </li>
                                <li>
                                    <router-link to="/profile" class="dropdown-item py-2"><i class="bi bi-person me-2"></i>My Profile</router-link>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <button @click="handleLogout" class="dropdown-item py-2 text-danger">
                                        <i class="bi bi-box-arrow-right me-2"></i>Sign Out
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </template>

                    <!-- Login / Register Buttons for Guests -->
                    <template v-else>
                        <router-link to="/login" class="btn btn-outline-light btn-sm px-3">Sign In</router-link>
                        <router-link to="/register" class="btn btn-primary btn-sm px-3 shadow-sm">Register</router-link>
                    </template>
                </div>
            </div>
        </div>
    </nav>
    `,
    setup() {
        const router = VueRouter.useRouter();
        const handleLogout = async () => {
            await authStore.logout();
            toast.trigger("You have been signed out.", "info");
            router.push('/login');
        };
        return { authStore, handleLogout };
    }
};

// 2. Login View Component
const LoginView = {
    template: `
    <div class="auth-page-wrapper">
        <div class="container py-5">
            <div class="row justify-content-center">
                <div class="col-12 col-md-8 col-lg-5">
                    <div class="card auth-card border-0 shadow-lg">
                        <div class="auth-header text-center">
                            <div class="auth-logo mb-2">🏔️</div>
                            <h3 class="fw-bold mb-1">Welcome Back</h3>
                            <p class="text-white-50 small mb-0">Sign in to your TrekManager account</p>
                        </div>
                        <div class="card-body p-4 p-md-5">
                            <!-- Role Alert notice -->
                            <div class="alert alert-info py-2 px-3 small mb-4">
                                <i class="bi bi-info-circle me-1"></i> Admin & Staff accounts are managed by organization. Trekkers can self-register.
                            </div>

                            <form @submit.prevent="submitLogin">
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-secondary">Email Address</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-envelope text-muted"></i></span>
                                        <input v-model="form.email" type="email" class="form-control border-start-0" placeholder="name@domain.com" required>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-secondary">Password</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-lock text-muted"></i></span>
                                        <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="form-control border-start-0 border-end-0" placeholder="••••••••" required>
                                        <button type="button" class="input-group-text bg-light border-start-0 text-muted" @click="showPassword = !showPassword" tabindex="-1" style="cursor: pointer;" :title="showPassword ? 'Hide password' : 'Show password'">
                                            <i :class="['bi', showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill']"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <div class="form-check">
                                        <input v-model="form.rememberMe" class="form-check-input" type="checkbox" id="rememberMe">
                                        <label class="form-check-label small text-muted" for="rememberMe">Remember me</label>
                                    </div>
                                </div>

                                <button type="submit" :disabled="loading" class="btn btn-primary w-100 py-2 fw-semibold shadow-sm">
                                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                    {{ loading ? 'Signing in...' : 'Sign In' }}
                                </button>
                            </form>

                            <div class="text-center mt-4">
                                <span class="small text-muted">New trekker? </span>
                                <router-link to="/register" class="small fw-semibold text-primary text-decoration-none">Create an Account</router-link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const router = VueRouter.useRouter();
        const form = reactive({ email: '', password: '', rememberMe: false });
        const loading = ref(false);
        const showPassword = ref(false);

        const submitLogin = async () => {
            loading.value = true;
            try {
                const res = await authStore.login(form.email, form.password, form.rememberMe);
                toast.trigger(`Signed in successfully as ${res.data.user.name}`);
                if (res.data.role === 'admin') router.push('/admin');
                else if (res.data.role === 'staff') router.push('/staff');
                else router.push('/user');
            } catch (err) {
                const msg = err.response?.data?.message || err.message || "Invalid credentials.";
                toast.trigger(msg, 'danger');
            } finally {
                loading.value = false;
            }
        };

        return { form, loading, submitLogin, showPassword };
    }
};

// 3. Register View Component (Trekkers only)
const RegisterView = {
    template: `
    <div class="auth-page-wrapper">
        <div class="container py-5">
            <div class="row justify-content-center">
                <div class="col-12 col-md-8 col-lg-6">
                    <div class="card auth-card border-0 shadow-lg">
                        <div class="auth-header text-center">
                            <div class="auth-logo mb-2">🏔️</div>
                            <h3 class="fw-bold mb-1">Create Trekker Account</h3>
                            <p class="text-white-50 small mb-0">Join our community of adventure seekers</p>
                        </div>
                        <div class="card-body p-4 p-md-5">
                            <div class="alert alert-secondary py-2 px-3 small mb-4">
                                <i class="bi bi-shield-check me-1"></i> Public registration is for <strong>Trekkers</strong>. Trek Staff accounts are provisioned exclusively by Administrators.
                            </div>

                            <form @submit.prevent="submitRegister">
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold text-secondary">Full Name</label>
                                    <input v-model="form.name" type="text" class="form-control" placeholder="John Doe" required minlength="2">
                                </div>
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold text-secondary">Email</label>
                                        <input v-model="form.email" type="email" class="form-control" placeholder="john@example.com" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold text-secondary">Phone Number</label>
                                        <input v-model="form.phone" type="tel" class="form-control" placeholder="9876543210" required minlength="10">
                                    </div>
                                </div>
                                <div class="row g-3 mb-4">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold text-secondary">Password</label>
                                        <div class="input-group">
                                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-lock text-muted"></i></span>
                                            <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="form-control border-start-0 border-end-0" placeholder="Min 6 characters" required minlength="6">
                                            <button type="button" class="input-group-text bg-light border-start-0 text-muted" @click="showPassword = !showPassword" tabindex="-1" style="cursor: pointer;" :title="showPassword ? 'Hide password' : 'Show password'">
                                                <i :class="['bi', showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill']"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold text-secondary">Confirm Password</label>
                                        <div class="input-group">
                                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-shield-lock text-muted"></i></span>
                                            <input v-model="form.confirm_password" :type="showConfirmPassword ? 'text' : 'password'" class="form-control border-start-0 border-end-0" placeholder="Repeat password" required>
                                            <button type="button" class="input-group-text bg-light border-start-0 text-muted" @click="showConfirmPassword = !showConfirmPassword" tabindex="-1" style="cursor: pointer;" :title="showConfirmPassword ? 'Hide password' : 'Show password'">
                                                <i :class="['bi', showConfirmPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill']"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" :disabled="loading" class="btn btn-primary w-100 py-2 fw-semibold shadow-sm">
                                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                    {{ loading ? 'Creating account...' : 'Complete Registration' }}
                                </button>
                            </form>

                            <div class="text-center mt-4">
                                <span class="small text-muted">Already registered? </span>
                                <router-link to="/login" class="small fw-semibold text-primary text-decoration-none">Sign In</router-link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const router = VueRouter.useRouter();
        const form = reactive({ name: '', email: '', phone: '', password: '', confirm_password: '', role: 'user' });
        const loading = ref(false);
        const showPassword = ref(false);
        const showConfirmPassword = ref(false);

        const submitRegister = async () => {
            if (form.password !== form.confirm_password) {
                toast.trigger("Passwords do not match.", "danger");
                return;
            }
            loading.value = true;
            try {
                const res = await axios.post('/api/auth/register', form);
                toast.trigger(res.data.message || "Registration successful! You can now log in.");
                router.push('/login');
            } catch (err) {
                const msg = err.response?.data?.message || "Registration failed.";
                toast.trigger(msg, "danger");
            } finally {
                loading.value = false;
            }
        };

        return { form, loading, submitRegister, showPassword, showConfirmPassword };
    }
};

// 4. Admin Dashboard View Component
const AdminDashboardView = {
    template: `
    <div class="dashboard-container py-4">
        <div class="container-fluid px-4">
            <!-- Header & Action Toolbar -->
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 class="h3 fw-bold mb-1 text-dark">Admin Console</h2>
                    <p class="text-muted small mb-0">Manage trekking routes, staff assignments, user accounts, and monthly performance reports.</p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <button @click="openCreateTrekModal" class="btn btn-primary btn-sm px-3 shadow-sm">
                        <i class="bi bi-plus-circle me-1"></i> Create Trek
                    </button>
                    <button @click="openCreateStaffModal" class="btn btn-outline-primary btn-sm px-3">
                        <i class="bi bi-person-plus me-1"></i> Add Trek Staff
                    </button>
                    <button @click="runMonthlyReport" :disabled="reportLoading" class="btn btn-outline-dark btn-sm px-3">
                        <span v-if="reportLoading" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-file-earmark-text me-1"></i> Monthly Report
                    </button>
                    <button @click="runDailyReminders" :disabled="remindersLoading" class="btn btn-outline-secondary btn-sm px-3">
                        <span v-if="remindersLoading" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-alarm me-1"></i> Run Reminders
                    </button>
                </div>
            </div>

            <!-- Stats Counter Cards -->
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                    <div class="card stat-card border-0 shadow-sm p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="text-muted small fw-semibold text-uppercase">Total Treks</span>
                                <h3 class="fw-bold mb-0 text-primary">{{ stats.total_treks || 0 }}</h3>
                                <span class="text-success small"><i class="bi bi-check-circle"></i> {{ stats.active_treks || 0 }} Active</span>
                            </div>
                            <div class="stat-icon-wrapper bg-primary-subtle text-primary">
                                <i class="bi bi-compass fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card stat-card border-0 shadow-sm p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="text-muted small fw-semibold text-uppercase">Total Bookings</span>
                                <h3 class="fw-bold mb-0 text-success">{{ stats.total_bookings || 0 }}</h3>
                                <span class="text-info small">{{ stats.completed_bookings || 0 }} Completed</span>
                            </div>
                            <div class="stat-icon-wrapper bg-success-subtle text-success">
                                <i class="bi bi-ticket-perforated fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card stat-card border-0 shadow-sm p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="text-muted small fw-semibold text-uppercase">Trekkers</span>
                                <h3 class="fw-bold mb-0 text-info">{{ stats.total_users || 0 }}</h3>
                                <span class="text-danger small">{{ stats.blacklisted_users || 0 }} Blacklisted</span>
                            </div>
                            <div class="stat-icon-wrapper bg-info-subtle text-info">
                                <i class="bi bi-people fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card stat-card border-0 shadow-sm p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="text-muted small fw-semibold text-uppercase">Staff Guides</span>
                                <h3 class="fw-bold mb-0 text-warning">{{ stats.total_staff || 0 }}</h3>
                                <span class="text-muted small">Assigned & Active</span>
                            </div>
                            <div class="stat-icon-wrapper bg-warning-subtle text-warning">
                                <i class="bi bi-person-badge fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabbed Navigation Panels -->
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-white border-bottom-0 pt-3 px-4">
                    <ul class="nav nav-tabs card-header-tabs">
                        <li class="nav-item">
                            <button :class="['nav-link', { active: activeTab === 'treks' }]" @click="activeTab = 'treks'">
                                <i class="bi bi-map me-1"></i> Treks Management ({{ treks.length }})
                            </button>
                        </li>
                        <li class="nav-item">
                            <button :class="['nav-link', { active: activeTab === 'staff' }]" @click="activeTab = 'staff'">
                                <i class="bi bi-person-badge me-1"></i> Staff Directory ({{ staffList.length }})
                            </button>
                        </li>
                        <li class="nav-item">
                            <button :class="['nav-link', { active: activeTab === 'users' }]" @click="activeTab = 'users'">
                                <i class="bi bi-people me-1"></i> Registered Trekkers ({{ usersList.length }})
                            </button>
                        </li>
                        <li class="nav-item">
                            <button :class="['nav-link', { active: activeTab === 'bookings' }]" @click="activeTab = 'bookings'">
                                <i class="bi bi-calendar2-check me-1"></i> All Bookings ({{ bookingsList.length }})
                            </button>
                        </li>
                        <li class="nav-item">
                            <button :class="['nav-link', { active: activeTab === 'reports' }]" @click="activeTab = 'reports'">
                                <i class="bi bi-bar-chart-line me-1"></i> Reports & Historical Data
                            </button>
                        </li>
                    </ul>
                </div>
                <div class="card-body p-4">
                    <!-- Tab 1: Treks Management -->
                    <div v-if="activeTab === 'treks'">
                        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <div class="input-group" style="max-width: 320px;">
                                <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                                <input v-model="searchQuery.trek" @input="fetchTreks" type="text" class="form-control" placeholder="Search trek name or location...">
                            </div>
                            <div class="d-flex gap-2">
                                <select v-model="filterStatus.trek" @change="fetchTreks" class="form-select form-select-sm">
                                    <option value="">All Statuses</option>
                                    <option value="Open">Open</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Closed">Closed</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Trek</th>
                                        <th>Location</th>
                                        <th>Difficulty</th>
                                        <th>Dates</th>
                                        <th>Slots (Avail/Total)</th>
                                        <th>Assigned Staff</th>
                                        <th>Status</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="t in treks" :key="t.id">
                                        <td>
                                            <div class="fw-semibold text-dark">{{ t.name }}</div>
                                            <span class="text-muted small">{{ t.duration }} days</span>
                                        </td>
                                        <td>{{ t.location }}</td>
                                        <td><span :class="['badge-difficulty', 'diff-' + t.difficulty.toLowerCase()]">{{ t.difficulty }}</span></td>
                                        <td class="small">{{ t.start_date }} to {{ t.end_date }}</td>
                                        <td>
                                            <div class="d-flex align-items-center gap-2">
                                                <div class="progress flex-grow-1" style="height: 6px; width: 60px;">
                                                    <div class="progress-bar bg-primary" :style="{ width: ((t.total_slots - t.available_slots) / t.total_slots * 100) + '%' }"></div>
                                                </div>
                                                <span class="small fw-semibold">{{ t.available_slots }}/{{ t.total_slots }}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span v-if="t.assigned_staff" class="badge bg-light text-dark border">
                                                <i class="bi bi-person-fill me-1 text-primary"></i>{{ t.assigned_staff.name }}
                                            </span>
                                            <span v-else class="text-muted small fst-italic">Unassigned</span>
                                        </td>
                                        <td>
                                            <span :class="['badge-status', 'status-' + t.status.toLowerCase()]">{{ t.status }}</span>
                                        </td>
                                        <td class="text-end">
                                            <div class="dropdown d-inline-block">
                                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle py-1 px-2" type="button" data-bs-toggle="dropdown">
                                                    Manage
                                                </button>
                                                <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                                    <li><button @click="openEditTrekModal(t)" class="dropdown-item small"><i class="bi bi-pencil me-2"></i>Edit Details</button></li>
                                                    <li><button @click="openAssignModal(t)" class="dropdown-item small"><i class="bi bi-person-check me-2"></i>Assign Staff</button></li>
                                                    <li><hr class="dropdown-divider"></li>
                                                    <li class="dropdown-header small">Change Status</li>
                                                    <li v-for="st in ['Open', 'Approved', 'Closed', 'Completed']" :key="st">
                                                        <button v-if="t.status !== st" @click="changeTrekStatus(t.id, st)" class="dropdown-item small">
                                                            Mark as {{ st }}
                                                        </button>
                                                    </li>
                                                    <li><hr class="dropdown-divider"></li>
                                                    <li><button @click="deleteTrek(t)" class="dropdown-item small text-danger"><i class="bi bi-trash me-2"></i>Delete</button></li>
                                                </ul>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="treks.length === 0">
                                        <td colspan="8" class="text-center py-4 text-muted">No treks match the search criteria.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tab 2: Staff Management -->
                    <div v-if="activeTab === 'staff'">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="input-group" style="max-width: 320px;">
                                <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                                <input v-model="searchQuery.staff" @input="fetchStaff" type="text" class="form-control" placeholder="Search staff...">
                            </div>
                            <button @click="openCreateStaffModal" class="btn btn-sm btn-primary">
                                <i class="bi bi-plus-circle me-1"></i> Add New Staff
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Staff Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Assigned Treks</th>
                                        <th>Status</th>
                                        <th>Joining Date</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="s in staffList" :key="s.id">
                                        <td class="fw-semibold">{{ s.name }}</td>
                                        <td>{{ s.email }}</td>
                                        <td>{{ s.phone }}</td>
                                        <td>
                                            <span v-for="t in s.assigned_treks" :key="t.id" class="badge bg-primary-subtle text-primary me-1 mb-1">
                                                {{ t.name }}
                                            </span>
                                            <span v-if="!s.assigned_treks || s.assigned_treks.length === 0" class="text-muted small fst-italic">None</span>
                                        </td>
                                        <td>
                                            <span v-if="s.is_blacklisted" class="badge bg-danger">Blacklisted</span>
                                            <span v-else-if="!s.is_active" class="badge bg-secondary">Inactive</span>
                                            <span v-else class="badge bg-success">Active Guide</span>
                                        </td>
                                        <td class="small text-muted">{{ s.joining_date || s.created_at }}</td>
                                        <td class="text-end">
                                            <button @click="toggleStaffStatus(s, s.is_blacklisted ? 'unblacklist' : 'blacklist')" 
                                                    :class="['btn btn-xs px-2 me-1', s.is_blacklisted ? 'btn-outline-success' : 'btn-outline-danger']">
                                                {{ s.is_blacklisted ? 'Unblacklist' : 'Blacklist' }}
                                            </button>
                                            <button @click="toggleStaffStatus(s, s.is_active ? 'deactivate' : 'activate')" 
                                                    :class="['btn btn-xs px-2', s.is_active ? 'btn-outline-warning' : 'btn-outline-primary']">
                                                {{ s.is_active ? 'Deactivate' : 'Activate' }}
                                            </button>
                                        </td>
                                    </tr>
                                    <tr v-if="staffList.length === 0">
                                        <td colspan="7" class="text-center py-4 text-muted">No staff members found.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tab 3: Users Management -->
                    <div v-if="activeTab === 'users'">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="input-group" style="max-width: 320px;">
                                <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                                <input v-model="searchQuery.user" @input="fetchUsers" type="text" class="form-control" placeholder="Search trekkers...">
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Trekker Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th>Registered Date</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="u in usersList" :key="u.id">
                                        <td class="fw-semibold">{{ u.name }}</td>
                                        <td>{{ u.email }}</td>
                                        <td>{{ u.phone }}</td>
                                        <td>
                                            <span v-if="u.is_blacklisted" class="badge bg-danger">Blacklisted</span>
                                            <span v-else-if="!u.is_active" class="badge bg-secondary">Inactive</span>
                                            <span v-else class="badge bg-success">Good Standing</span>
                                        </td>
                                        <td class="small text-muted">{{ u.created_at }}</td>
                                        <td class="text-end">
                                            <button @click="toggleUserBlacklist(u)" 
                                                    :class="['btn btn-xs px-2 me-1', u.is_blacklisted ? 'btn-outline-success' : 'btn-outline-danger']">
                                                {{ u.is_blacklisted ? 'Unblacklist' : 'Blacklist' }}
                                            </button>
                                            <button @click="toggleUserActive(u)" 
                                                    :class="['btn btn-xs px-2', u.is_active ? 'btn-outline-warning' : 'btn-outline-primary']">
                                                {{ u.is_active ? 'Deactivate' : 'Activate' }}
                                            </button>
                                        </td>
                                    </tr>
                                    <tr v-if="usersList.length === 0">
                                        <td colspan="6" class="text-center py-4 text-muted">No trekkers registered yet.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tab 4: All Bookings -->
                    <div v-if="activeTab === 'bookings'">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Booking ID</th>
                                        <th>Trekker</th>
                                        <th>Trek Name</th>
                                        <th>Booking Date</th>
                                        <th>Participants</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="b in bookingsList" :key="b.id">
                                        <td>#{{ b.id }}</td>
                                        <td>
                                            <div class="fw-semibold">{{ b.user ? b.user.name : 'Unknown' }}</div>
                                            <span class="text-muted small">{{ b.user ? b.user.email : '' }}</span>
                                        </td>
                                        <td>
                                            <div class="fw-semibold text-primary">{{ b.trek ? b.trek.name : 'Trek #' + b.trek_id }}</div>
                                            <span class="text-muted small">{{ b.trek ? b.trek.location : '' }}</span>
                                        </td>
                                        <td class="small">{{ b.booking_date }}</td>
                                        <td><span class="badge bg-light text-dark border">{{ b.num_participants }}</span></td>
                                        <td>
                                            <span :class="['badge-booking', 'booking-' + b.status.toLowerCase()]">{{ b.status }}</span>
                                        </td>
                                    </tr>
                                    <tr v-if="bookingsList.length === 0">
                                        <td colspan="6" class="text-center py-4 text-muted">No bookings recorded yet.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tab 5: Reports & Statistics -->
                    <div v-if="activeTab === 'reports'">
                        <div class="row g-4">
                            <div class="col-md-7">
                                <h5 class="fw-bold mb-3">Popular Treks by Participation</h5>
                                <div class="table-responsive">
                                    <table class="table table-bordered align-middle">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Trek Name</th>
                                                <th>Difficulty</th>
                                                <th>Booked Count</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="pt in stats.popular_treks" :key="pt.id">
                                                <td class="fw-semibold">{{ pt.name }}</td>
                                                <td><span :class="['badge-difficulty', 'diff-' + pt.difficulty.toLowerCase()]">{{ pt.difficulty }}</span></td>
                                                <td><strong>{{ pt.participant_count }}</strong> trekkers</td>
                                                <td><span :class="['badge-status', 'status-' + pt.status.toLowerCase()]">{{ pt.status }}</span></td>
                                            </tr>
                                            <tr v-if="!stats.popular_treks || stats.popular_treks.length === 0">
                                                <td colspan="4" class="text-center text-muted">No trekking activity yet.</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="card bg-light border-0 p-4 rounded-3">
                                    <h5 class="fw-bold mb-2">Monthly Automated Report</h5>
                                    <p class="text-muted small">Generated on the 1st of each month via Celery background schedule. You can also trigger generation immediately.</p>
                                    <button @click="runMonthlyReport" :disabled="reportLoading" class="btn btn-primary w-100 py-2 mb-3">
                                        <span v-if="reportLoading" class="spinner-border spinner-border-sm me-2"></span>
                                        {{ reportLoading ? 'Generating...' : 'Generate Monthly Activity Report (HTML)' }}
                                    </button>
                                    <div v-if="lastReport" class="alert alert-success small mb-0">
                                        <strong>Report Generated!</strong><br>
                                        File: {{ lastReport.filename }}<br>
                                        <a :href="'/reports/' + lastReport.filename" target="_blank" class="btn btn-xs btn-outline-success mt-2">
                                            <i class="bi bi-eye me-1"></i> View Report
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Trek Form Modal (Create / Edit) -->
        <div v-if="showTrekModal" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
            <div class="modal-content-custom card border-0 shadow-lg p-4" style="max-width: 650px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <h5 class="fw-bold mb-0">{{ trekModalMode === 'create' ? 'Create New Trek' : 'Edit Trek Details' }}</h5>
                    <button @click="showTrekModal = false" class="btn-close"></button>
                </div>
                <form @submit.prevent="saveTrek">
                    <div class="row g-3 mb-3">
                        <div class="col-md-8">
                            <label class="form-label small fw-semibold">Trek Name</label>
                            <input v-model="trekForm.name" type="text" class="form-control" placeholder="Hampta Pass Trek" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-semibold">Difficulty</label>
                            <select v-model="trekForm.difficulty" class="form-select" required>
                                <option value="Easy">Easy</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">Location</label>
                            <input v-model="trekForm.location" type="text" class="form-control" placeholder="Manali, HP" required>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-semibold">Duration (days)</label>
                            <input v-model="trekForm.duration" type="number" min="1" class="form-control" required>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-semibold">Total Capacity</label>
                            <input v-model="trekForm.total_slots" type="number" min="1" class="form-control" required>
                        </div>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">Start Date</label>
                            <input v-model="trekForm.start_date" type="date" class="form-control" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">End Date</label>
                            <input v-model="trekForm.end_date" type="date" class="form-control" required>
                        </div>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">Meeting Point</label>
                            <input v-model="trekForm.meeting_point" type="text" class="form-control" placeholder="Manali Bus Stand, 7 AM">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">Assign Trek Guide (Staff)</label>
                            <select v-model="trekForm.assigned_staff_id" class="form-select">
                                <option :value="null">-- Unassigned --</option>
                                <option v-for="s in staffList" :key="s.id" :value="s.id">{{ s.name }} ({{ s.email }})</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold">Description</label>
                        <textarea v-model="trekForm.description" class="form-control" rows="2" placeholder="Describe the trek experience..."></textarea>
                    </div>
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">Requirements</label>
                            <input v-model="trekForm.trek_requirements" type="text" class="form-control" placeholder="Hiking boots, warm jacket">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-semibold">Instructions</label>
                            <input v-model="trekForm.instructions" type="text" class="form-control" placeholder="Be on time, carry ID">
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2">
                        <button type="button" @click="showTrekModal = false" class="btn btn-outline-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary px-4">Save Trek</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Add Staff Modal -->
        <div v-if="showStaffModal" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
            <div class="modal-content-custom card border-0 shadow-lg p-4" style="max-width: 480px; width: 90%;">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <h5 class="fw-bold mb-0">Create Trek Staff Member</h5>
                    <button @click="showStaffModal = false" class="btn-close"></button>
                </div>
                <form @submit.prevent="saveStaff">
                    <div class="mb-3">
                        <label class="form-label small fw-semibold">Guide Name</label>
                        <input v-model="staffForm.name" type="text" class="form-control" placeholder="Bachendri Pal" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold">Email Address</label>
                        <input v-model="staffForm.email" type="email" class="form-control" placeholder="guide@trekking.com" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold">Contact Phone</label>
                        <input v-model="staffForm.phone" type="tel" class="form-control" placeholder="9876543210" required>
                    </div>
                    <div class="mb-4">
                        <label class="form-label small fw-semibold">Initial Password</label>
                        <input v-model="staffForm.password" type="password" class="form-control" placeholder="••••••••" required minlength="6">
                    </div>
                    <div class="d-flex justify-content-end gap-2">
                        <button type="button" @click="showStaffModal = false" class="btn btn-outline-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary px-4">Create Staff</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Assign Staff Modal -->
        <div v-if="showAssignModal" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
            <div class="modal-content-custom card border-0 shadow-lg p-4" style="max-width: 450px; width: 90%;">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <h5 class="fw-bold mb-0">Assign Staff to {{ selectedTrek ? selectedTrek.name : '' }}</h5>
                    <button @click="showAssignModal = false" class="btn-close"></button>
                </div>
                <div class="mb-4">
                    <label class="form-label small fw-semibold">Select Trek Guide</label>
                    <select v-model="assignedStaffId" class="form-select">
                        <option :value="null">-- Unassigned --</option>
                        <option v-for="s in staffList" :key="s.id" :value="s.id">{{ s.name }} ({{ s.email }})</option>
                    </select>
                </div>
                <div class="d-flex justify-content-end gap-2">
                    <button type="button" @click="showAssignModal = false" class="btn btn-outline-secondary">Cancel</button>
                    <button @click="submitAssignment" class="btn btn-primary">Save Assignment</button>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const stats = ref({});
        const activeTab = ref('treks');
        const treks = ref([]);
        const staffList = ref([]);
        const usersList = ref([]);
        const bookingsList = ref([]);
        const searchQuery = reactive({ trek: '', staff: '', user: '' });
        const filterStatus = reactive({ trek: '' });

        const showTrekModal = ref(false);
        const trekModalMode = ref('create');
        const trekForm = reactive({
            id: null, name: '', location: '', difficulty: 'Moderate', duration: 5,
            total_slots: 20, start_date: '', end_date: '', meeting_point: '',
            description: '', trek_requirements: '', instructions: '', assigned_staff_id: null
        });

        const showStaffModal = ref(false);
        const staffForm = reactive({ name: '', email: '', phone: '', password: '' });

        const showAssignModal = ref(false);
        const selectedTrek = ref(null);
        const assignedStaffId = ref(null);

        const reportLoading = ref(false);
        const remindersLoading = ref(false);
        const lastReport = ref(null);

        const fetchDashboard = async () => {
            try {
                const res = await axios.get('/api/admin/dashboard');
                stats.value = res.data.data;
            } catch (e) { }
        };

        const fetchTreks = async () => {
            try {
                const params = { q: searchQuery.trek, status: filterStatus.trek };
                const res = await axios.get('/api/admin/treks', { params });
                treks.value = res.data.data;
            } catch (e) { }
        };

        const fetchStaff = async () => {
            try {
                const res = await axios.get('/api/admin/staff', { params: { q: searchQuery.staff } });
                staffList.value = res.data.data;
            } catch (e) { }
        };

        const fetchUsers = async () => {
            try {
                const res = await axios.get('/api/admin/users', { params: { q: searchQuery.user } });
                usersList.value = res.data.data;
            } catch (e) { }
        };

        const fetchBookings = async () => {
            try {
                const res = await axios.get('/api/admin/bookings');
                bookingsList.value = res.data.data;
            } catch (e) { }
        };

        const openCreateTrekModal = () => {
            trekModalMode.value = 'create';
            Object.assign(trekForm, {
                id: null, name: '', location: '', difficulty: 'Moderate', duration: 5,
                total_slots: 20, start_date: '', end_date: '', meeting_point: '',
                description: '', trek_requirements: '', instructions: '', assigned_staff_id: null
            });
            showTrekModal.value = true;
        };

        const openEditTrekModal = (t) => {
            trekModalMode.value = 'edit';
            Object.assign(trekForm, {
                id: t.id, name: t.name, location: t.location, difficulty: t.difficulty, duration: t.duration,
                total_slots: t.total_slots, start_date: t.start_date, end_date: t.end_date,
                meeting_point: t.meeting_point, description: t.description,
                trek_requirements: t.trek_requirements, instructions: t.instructions,
                assigned_staff_id: t.assigned_staff_id
            });
            showTrekModal.value = true;
        };

        const saveTrek = async () => {
            try {
                if (trekModalMode.value === 'create') {
                    await axios.post('/api/admin/treks', trekForm);
                    toast.trigger("Trek created successfully.");
                } else {
                    await axios.put(`/api/admin/treks/${trekForm.id}`, trekForm);
                    toast.trigger("Trek updated successfully.");
                }
                showTrekModal.value = false;
                fetchTreks();
                fetchDashboard();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to save trek.", "danger");
            }
        };

        const deleteTrek = async (t) => {
            if (!confirm(`Are you sure you want to delete trek '${t.name}'?`)) return;
            try {
                await axios.delete(`/api/admin/treks/${t.id}`);
                toast.trigger("Trek deleted.");
                fetchTreks();
                fetchDashboard();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Cannot delete trek.", "danger");
            }
        };

        const changeTrekStatus = async (id, status) => {
            try {
                await axios.post(`/api/admin/treks/${id}/status`, { status });
                toast.trigger(`Status changed to ${status}`);
                fetchTreks();
                fetchDashboard();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to change status.", "danger");
            }
        };

        const openAssignModal = (t) => {
            selectedTrek.value = t;
            assignedStaffId.value = t.assigned_staff_id;
            showAssignModal.value = true;
        };

        const submitAssignment = async () => {
            try {
                await axios.post(`/api/admin/treks/${selectedTrek.value.id}/assign-staff`, { staff_id: assignedStaffId.value });
                toast.trigger("Staff assigned successfully.");
                showAssignModal.value = false;
                fetchTreks();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Assignment failed.", "danger");
            }
        };

        const openCreateStaffModal = () => {
            Object.assign(staffForm, { name: '', email: '', phone: '', password: '' });
            showStaffModal.value = true;
        };

        const saveStaff = async () => {
            try {
                await axios.post('/api/admin/staff', staffForm);
                toast.trigger("Trek staff created successfully.");
                showStaffModal.value = false;
                fetchStaff();
                fetchDashboard();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to create staff.", "danger");
            }
        };

        const toggleStaffStatus = async (s, action) => {
            try {
                await axios.post(`/api/admin/staff/${s.id}/toggle-status`, { action });
                toast.trigger("Staff status updated.");
                fetchStaff();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to update staff status.", "danger");
            }
        };

        const toggleUserBlacklist = async (u) => {
            const action = u.is_blacklisted ? 'unblacklist' : 'blacklist';
            try {
                await axios.post(`/api/admin/users/${u.id}/toggle-status`, { action });
                toast.trigger(`User blacklist status updated.`);
                fetchUsers();
                fetchDashboard();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to update user.", "danger");
            }
        };

        const toggleUserActive = async (u) => {
            const action = u.is_active ? 'deactivate' : 'activate';
            try {
                await axios.post(`/api/admin/users/${u.id}/toggle-status`, { action });
                toast.trigger(`User active status updated.`);
                fetchUsers();
                fetchDashboard();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to update user status.", "danger");
            }
        };

        const runMonthlyReport = async () => {
            reportLoading.value = true;
            try {
                const res = await axios.post('/api/admin/reports/monthly');
                lastReport.value = res.data.data;
                toast.trigger("Monthly activity report generated successfully.");
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to generate report.", "danger");
            } finally {
                reportLoading.value = false;
            }
        };

        const runDailyReminders = async () => {
            remindersLoading.value = true;
            try {
                const res = await axios.post('/api/admin/tasks/run-daily-reminders');
                toast.trigger(`Dispatched reminders for upcoming treks.`);
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to run reminders.", "danger");
            } finally {
                remindersLoading.value = false;
            }
        };

        onMounted(() => {
            fetchDashboard();
            fetchTreks();
            fetchStaff();
            fetchUsers();
            fetchBookings();
        });

        return {
            stats, activeTab, treks, staffList, usersList, bookingsList,
            searchQuery, filterStatus, showTrekModal, trekModalMode, trekForm,
            showStaffModal, staffForm, showAssignModal, selectedTrek, assignedStaffId,
            reportLoading, remindersLoading, lastReport,
            fetchTreks, fetchStaff, fetchUsers, fetchBookings,
            openCreateTrekModal, openEditTrekModal, saveTrek, deleteTrek,
            changeTrekStatus, openAssignModal, submitAssignment,
            openCreateStaffModal, saveStaff, toggleStaffStatus, toggleUserBlacklist, toggleUserActive,
            runMonthlyReport, runDailyReminders
        };
    }
};

// 5. Staff Dashboard View Component
const StaffDashboardView = {
    template: `
    <div class="dashboard-container py-4">
        <div class="container-fluid px-4">
            <div class="mb-4">
                <h2 class="h3 fw-bold mb-1 text-dark">Trek Staff Portal</h2>
                <p class="text-muted small mb-0">Manage your assigned routes, adjust available slots, and coordinate participant rosters.</p>
            </div>

            <!-- Assigned Treks Grid -->
            <div class="row g-4">
                <div v-for="t in assignedTreks" :key="t.id" class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100 border-0 shadow-sm trek-staff-card">
                        <div class="card-header bg-white border-0 pt-3 px-3 d-flex justify-content-between align-items-start">
                            <div>
                                <span :class="['badge-difficulty', 'diff-' + t.difficulty.toLowerCase()]">{{ t.difficulty }}</span>
                                <span class="text-muted small ms-2"><i class="bi bi-clock"></i> {{ t.duration }} Days</span>
                            </div>
                            <span :class="['badge-status', 'status-' + t.status.toLowerCase()]">{{ t.status }}</span>
                        </div>
                        <div class="card-body px-3 py-2">
                            <h5 class="fw-bold text-dark mb-1">{{ t.name }}</h5>
                            <p class="text-muted small mb-2"><i class="bi bi-geo-alt-fill text-danger me-1"></i>{{ t.location }}</p>
                            
                            <div class="bg-light p-2 rounded mb-3">
                                <div class="d-flex justify-content-between small mb-1">
                                    <span class="text-secondary">Capacity:</span>
                                    <strong>{{ t.participant_count }} / {{ t.total_slots }} Booked</strong>
                                </div>
                                <div class="progress" style="height: 6px;">
                                    <div class="progress-bar bg-success" :style="{ width: ((t.total_slots - t.available_slots) / t.total_slots * 100) + '%' }"></div>
                                </div>
                                <div class="text-end small mt-1 text-muted">{{ t.available_slots }} slots available</div>
                            </div>

                            <div class="small text-muted mb-1"><i class="bi bi-calendar-event me-1"></i> {{ t.start_date }} &rarr; {{ t.end_date }}</div>
                            <div class="small text-muted mb-3"><i class="bi bi-signpost-split me-1"></i> {{ t.meeting_point || 'To be announced' }}</div>
                        </div>
                        <div class="card-footer bg-white border-0 p-3 pt-0 d-flex flex-wrap gap-2">
                            <button @click="openRosterModal(t)" class="btn btn-sm btn-outline-primary flex-grow-1">
                                <i class="bi bi-people me-1"></i> Participants ({{ t.participant_count }})
                            </button>
                            <button @click="openSlotsModal(t)" class="btn btn-sm btn-outline-secondary">
                                <i class="bi bi-sliders me-1"></i> Slots / Status
                            </button>
                            <button v-if="t.status !== 'Open' && t.status !== 'Completed'" @click="startTrek(t)" class="btn btn-sm btn-success w-100 mt-1">
                                <i class="bi bi-play-fill me-1"></i> Mark as Started (Open)
                            </button>
                            <button v-if="t.status === 'Open'" @click="completeTrek(t)" class="btn btn-sm btn-dark w-100 mt-1">
                                <i class="bi bi-flag-fill me-1"></i> Mark as Completed
                            </button>
                        </div>
                    </div>
                </div>

                <div v-if="assignedTreks.length === 0" class="col-12">
                    <div class="card border-0 shadow-sm p-5 text-center">
                        <div class="display-4 text-muted mb-3">🏔️</div>
                        <h4 class="fw-bold">No Treks Assigned Yet</h4>
                        <p class="text-muted small">The administrator has not assigned any active treks to your guide profile. Please check back later.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Slot & Status Update Modal -->
        <div v-if="showSlotsModal" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
            <div class="modal-content-custom card border-0 shadow-lg p-4" style="max-width: 440px; width: 90%;">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <h5 class="fw-bold mb-0">Manage Slots & Status</h5>
                    <button @click="showSlotsModal = false" class="btn-close"></button>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Trek</label>
                    <div class="form-control bg-light">{{ activeTrek.name }}</div>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Available Slots</label>
                    <input v-model="slotForm.available_slots" type="number" min="0" :max="activeTrek.total_slots - activeTrek.participant_count" class="form-control" required>
                    <div class="form-text small">Max allowed: {{ activeTrek.total_slots - activeTrek.participant_count }} (Total: {{ activeTrek.total_slots }}, Booked: {{ activeTrek.participant_count }})</div>
                </div>
                <div class="mb-4">
                    <label class="form-label small fw-semibold">Status</label>
                    <select v-model="slotForm.status" class="form-select">
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                    </select>
                </div>
                <div class="d-flex justify-content-end gap-2">
                    <button @click="showSlotsModal = false" class="btn btn-outline-secondary">Cancel</button>
                    <button @click="submitSlotUpdate" class="btn btn-primary">Update</button>
                </div>
            </div>
        </div>

        <!-- Participants Roster Modal -->
        <div v-if="showRosterModal" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
            <div class="modal-content-custom card border-0 shadow-lg p-4" style="max-width: 650px; width: 90%; max-height: 85vh; overflow-y: auto;">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <div>
                        <h5 class="fw-bold mb-0">Participant Roster</h5>
                        <span class="text-muted small">{{ activeTrek ? activeTrek.name : '' }}</span>
                    </div>
                    <button @click="showRosterModal = false" class="btn-close"></button>
                </div>
                
                <div class="mb-3">
                    <input v-model="rosterSearch" type="text" class="form-control form-control-sm" placeholder="Search participant by name or email...">
                </div>

                <div class="table-responsive">
                    <table class="table table-sm align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Participant</th>
                                <th>Phone</th>
                                <th>Party Size</th>
                                <th>Booked On</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in filteredParticipants" :key="p.id">
                                <td>
                                    <div class="fw-semibold">{{ p.user ? p.user.name : 'Unknown' }}</div>
                                    <span class="text-muted" style="font-size: 0.75rem;">{{ p.user ? p.user.email : '' }}</span>
                                </td>
                                <td class="small">{{ p.user ? p.user.phone : '-' }}</td>
                                <td><span class="badge bg-primary-subtle text-primary">{{ p.num_participants }}</span></td>
                                <td class="small text-muted">{{ p.booking_date }}</td>
                            </tr>
                            <tr v-if="filteredParticipants.length === 0">
                                <td colspan="4" class="text-center py-3 text-muted">No confirmed participants found.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const assignedTreks = ref([]);
        const showSlotsModal = ref(false);
        const showRosterModal = ref(false);
        const activeTrek = ref(null);
        const slotForm = reactive({ available_slots: 0, status: 'Open' });
        const participants = ref([]);
        const rosterSearch = ref('');

        const fetchAssignedTreks = async () => {
            try {
                const res = await axios.get('/api/staff/treks');
                assignedTreks.value = res.data.data;
            } catch (e) { }
        };

        const openSlotsModal = (t) => {
            activeTrek.value = t;
            slotForm.available_slots = t.available_slots;
            slotForm.status = t.status === 'Completed' ? 'Open' : t.status;
            showSlotsModal.value = true;
        };

        const submitSlotUpdate = async () => {
            try {
                await axios.put(`/api/staff/treks/${activeTrek.value.id}/slots`, { available_slots: slotForm.available_slots });
                if (['Open', 'Closed'].includes(slotForm.status)) {
                    await axios.put(`/api/staff/treks/${activeTrek.value.id}/status`, { status: slotForm.status });
                }
                toast.trigger("Trek slots & status updated.");
                showSlotsModal.value = false;
                fetchAssignedTreks();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to update slots.", "danger");
            }
        };

        const openRosterModal = async (t) => {
            activeTrek.value = t;
            rosterSearch.value = '';
            try {
                const res = await axios.get(`/api/staff/treks/${t.id}`);
                participants.value = res.data.data.participants || [];
                showRosterModal.value = true;
            } catch (err) {
                toast.trigger("Unable to load participants.", "danger");
            }
        };

        const startTrek = async (t) => {
            try {
                await axios.post(`/api/staff/treks/${t.id}/start`);
                toast.trigger(`Trek '${t.name}' marked as started (Open).`);
                fetchAssignedTreks();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to start trek.", "danger");
            }
        };

        const completeTrek = async (t) => {
            if (!confirm(`Mark trek '${t.name}' as completed? This will finalize all bookings.`)) return;
            try {
                await axios.post(`/api/staff/treks/${t.id}/complete`);
                toast.trigger(`Trek marked as completed.`);
                fetchAssignedTreks();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to complete trek.", "danger");
            }
        };

        const filteredParticipants = computed(() => {
            if (!rosterSearch.value) return participants.value;
            const q = rosterSearch.value.toLowerCase();
            return participants.value.filter(p =>
                (p.user?.name && p.user.name.toLowerCase().includes(q)) ||
                (p.user?.email && p.user.email.toLowerCase().includes(q))
            );
        });

        onMounted(() => {
            fetchAssignedTreks();
        });

        return {
            assignedTreks, showSlotsModal, showRosterModal, activeTrek,
            slotForm, rosterSearch, filteredParticipants,
            openSlotsModal, submitSlotUpdate, openRosterModal, startTrek, completeTrek
        };
    }
};

// 6. User Dashboard View Component
const UserDashboardView = {
    template: `
    <div class="dashboard-container py-4">
        <div class="container-fluid px-4">
            <!-- Welcome Banner -->
            <div class="welcome-banner text-white p-4 p-md-5 rounded-4 shadow-sm mb-4">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <span class="badge bg-light text-primary px-3 py-1 mb-2 fw-semibold">Trekker Portal</span>
                        <h2 class="display-6 fw-bold mb-2">Hello, {{ authStore.user ? authStore.user.name : 'Trekker' }}!</h2>
                        <p class="text-white-50 mb-3">Ready for your next summit? Browse verified high-altitude routes or manage your reservations.</p>
                        <div class="d-flex flex-wrap gap-2">
                            <button @click="activeTab = 'available'" :class="['btn px-4 shadow-sm fw-semibold', activeTab === 'available' ? 'btn-light text-primary' : 'btn-outline-light']">
                                <i class="bi bi-compass me-1"></i> Available Treks ({{ availableTreks.length }})
                            </button>
                            <button @click="activeTab = 'bookings'" :class="['btn px-4 fw-semibold', activeTab === 'bookings' ? 'btn-light text-primary' : 'btn-outline-light']">
                                <i class="bi bi-ticket-perforated me-1"></i> My Bookings ({{ bookings.length }})
                            </button>
                        </div>
                    </div>
                    <div class="col-md-4 text-md-end mt-3 mt-md-0">
                        <button @click="triggerExport" :disabled="exportLoading" class="btn btn-outline-light btn-sm px-3 shadow-sm">
                            <span v-if="exportLoading" class="spinner-border spinner-border-sm me-1"></span>
                            <i v-else class="bi bi-file-earmark-spreadsheet me-1"></i>
                            {{ exportLoading ? 'Exporting...' : 'Export History (CSV)' }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Export Alert Banner if triggered -->
            <div v-if="downloadLink" class="alert alert-success d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm">
                <div>
                    <i class="bi bi-check-circle-fill fs-5 text-success me-2"></i>
                    <strong>Export Complete!</strong> Your complete booking history CSV is ready for download.
                </div>
                <a :href="downloadLink" class="btn btn-sm btn-success px-3">
                    <i class="bi bi-download me-1"></i> Download CSV File
                </a>
            </div>

            <!-- Quick Stats -->
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm p-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="stat-icon-wrapper bg-primary-subtle text-primary">
                                <i class="bi bi-ticket-perforated fs-4"></i>
                            </div>
                            <div>
                                <h4 class="fw-bold mb-0 text-dark">{{ activeBookingsCount }}</h4>
                                <span class="text-muted small">Active Confirmed Bookings</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm p-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="stat-icon-wrapper bg-success-subtle text-success">
                                <i class="bi bi-award fs-4"></i>
                            </div>
                            <div>
                                <h4 class="fw-bold mb-0 text-dark">{{ completedCount }}</h4>
                                <span class="text-muted small">Completed Expeditions</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm p-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="stat-icon-wrapper bg-info-subtle text-info">
                                <i class="bi bi-compass fs-4"></i>
                            </div>
                            <div>
                                <h4 class="fw-bold mb-0 text-dark">{{ availableTreks.length }}</h4>
                                <span class="text-muted small">Open Treks Available</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Active / Upcoming Booking Highlight -->
            <div v-if="upcomingBooking" class="card border-0 shadow-sm mb-4 border-start border-primary border-4 p-4">
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                    <div>
                        <span class="badge bg-primary-subtle text-primary mb-1">Upcoming Trek</span>
                        <h4 class="fw-bold mb-0 text-dark">{{ upcomingBooking.trek.name }}</h4>
                    </div>
                    <span class="badge bg-success px-3 py-2">Confirmed</span>
                </div>
                <div class="row g-3 mt-1">
                    <div class="col-md-3">
                        <span class="text-muted small d-block">Dates</span>
                        <strong>{{ upcomingBooking.trek.start_date }} &rarr; {{ upcomingBooking.trek.end_date }}</strong>
                    </div>
                    <div class="col-md-3">
                        <span class="text-muted small d-block">Meeting Point</span>
                        <strong>{{ upcomingBooking.trek.meeting_point || 'To be updated' }}</strong>
                    </div>
                    <div class="col-md-3">
                        <span class="text-muted small d-block">Party Size</span>
                        <strong>{{ upcomingBooking.num_participants }} Participant(s)</strong>
                    </div>
                    <div class="col-md-3 text-md-end">
                        <router-link to="/bookings" class="btn btn-outline-primary btn-sm mt-2">Manage Booking</router-link>
                    </div>
                </div>
            </div>

            <!-- Tab 1: Available Treks (Search, Filter, Book) -->
            <div v-if="activeTab === 'available'">
                <!-- Filter Bar -->
                <div class="card border-0 shadow-sm p-3 mb-4">
                    <div class="row g-3 align-items-center">
                        <div class="col-md-4">
                            <div class="input-group">
                                <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                <input v-model="filters.q" @input="fetchAvailableTreks" type="text" class="form-control border-start-0" placeholder="Search trek name or location...">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <select v-model="filters.difficulty" @change="fetchAvailableTreks" class="form-select">
                                <option value="All">All Difficulties</option>
                                <option value="Easy">Easy</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <div class="input-group">
                                <span class="input-group-text bg-light"><i class="bi bi-clock"></i></span>
                                <input v-model="filters.duration" @input="fetchAvailableTreks" type="number" min="1" class="form-control" placeholder="Max days...">
                            </div>
                        </div>
                        <div class="col-md-2 text-md-end">
                            <button @click="resetFilters" class="btn btn-outline-secondary btn-sm w-100">
                                <i class="bi bi-arrow-counterclockwise me-1"></i> Reset
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Loading Spinner -->
                <div v-if="treksLoading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="text-muted small mt-2">Loading verified routes from cache...</p>
                </div>

                <!-- Treks Grid -->
                <div v-else class="row g-4 mb-4">
                    <div v-for="t in availableTreks" :key="t.id" class="col-12 col-md-6 col-lg-4">
                        <div class="card h-100 border-0 shadow-sm trek-card">
                            <div class="card-header bg-white border-0 pt-3 px-3 d-flex justify-content-between align-items-start">
                                <div>
                                    <span :class="['badge-difficulty', 'diff-' + t.difficulty.toLowerCase()]">{{ t.difficulty }}</span>
                                    <span class="text-muted small ms-2"><i class="bi bi-clock"></i> {{ t.duration }} Days</span>
                                </div>
                                <span class="badge-status status-open">{{ t.status }}</span>
                            </div>
                            <div class="card-body px-3 py-2">
                                <h5 class="fw-bold text-dark mb-1">{{ t.name }}</h5>
                                <p class="text-muted small mb-2"><i class="bi bi-geo-alt-fill text-danger me-1"></i>{{ t.location }}</p>
                                
                                <p class="text-secondary small mb-3 text-truncate-2">{{ t.description || 'Experience stunning Himalayan vistas on this carefully curated expedition route.' }}</p>

                                <div class="bg-light p-2 rounded mb-3">
                                    <div class="d-flex justify-content-between small mb-1">
                                        <span class="text-secondary">Slots Available:</span>
                                        <strong :class="t.available_slots <= 3 ? 'text-danger' : 'text-success'">{{ t.available_slots }} / {{ t.total_slots }}</strong>
                                    </div>
                                    <div class="progress" style="height: 6px;">
                                        <div class="progress-bar bg-primary" :style="{ width: ((t.total_slots - t.available_slots) / t.total_slots * 100) + '%' }"></div>
                                    </div>
                                </div>

                                <div class="small text-muted mb-1"><i class="bi bi-calendar-event me-1"></i> {{ t.start_date }} &rarr; {{ t.end_date }}</div>
                                <div class="small text-muted mb-2"><i class="bi bi-signpost-split me-1"></i> {{ t.meeting_point || 'To be announced' }}</div>
                            </div>
                            <div class="card-footer bg-white border-0 p-3 pt-0">
                                <button @click="openBookModal(t)" :disabled="t.available_slots <= 0" class="btn btn-primary w-100 shadow-sm">
                                    <i class="bi bi-ticket-perforated me-1"></i>
                                    {{ t.available_slots > 0 ? 'Book This Trek' : 'Fully Booked' }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-if="availableTreks.length === 0" class="col-12">
                        <div class="card border-0 shadow-sm p-5 text-center">
                            <div class="display-4 text-muted mb-3">🏔️</div>
                            <h4 class="fw-bold">No Open Treks Found</h4>
                            <p class="text-muted small">No treks match your search or filter criteria. Try adjusting the difficulty or duration filters.</p>
                            <div><button @click="resetFilters" class="btn btn-outline-primary btn-sm">Clear All Filters</button></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Recent Bookings Table -->
            <div v-if="activeTab === 'bookings'" class="card border-0 shadow-sm">
                <div class="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold mb-0">My Reservations</h5>
                    <router-link to="/bookings" class="btn btn-sm btn-link text-decoration-none">Manage All Bookings</router-link>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Booking ID</th>
                                <th>Trek Name</th>
                                <th>Location</th>
                                <th>Dates</th>
                                <th>Party Size</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="b in bookings" :key="b.id">
                                <td><strong>#{{ b.id }}</strong></td>
                                <td class="fw-semibold text-primary">{{ b.trek ? b.trek.name : '-' }}</td>
                                <td>{{ b.trek ? b.trek.location : '-' }}</td>
                                <td class="small">{{ b.trek ? b.trek.start_date : '-' }} &rarr; {{ b.trek ? b.trek.end_date : '-' }}</td>
                                <td><span class="badge bg-light text-dark border">{{ b.num_participants }}</span></td>
                                <td><span :class="['badge-booking', 'booking-' + b.status.toLowerCase()]">{{ b.status }}</span></td>
                                <td class="text-end">
                                    <button v-if="b.status === 'Booked'" @click="cancelBooking(b)" class="btn btn-sm btn-outline-danger py-1 px-2">
                                        <i class="bi bi-x-circle me-1"></i> Cancel
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="bookings.length === 0">
                                <td colspan="7" class="text-center py-4 text-muted">You have no reservations yet. Select an available trek to book!</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Booking Modal -->
        <div v-if="showBookModal" class="modal-backdrop-custom d-flex align-items-center justify-content-center">
            <div class="modal-content-custom card border-0 shadow-lg p-4" style="max-width: 500px; width: 90%;">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <h5 class="fw-bold mb-0">Confirm Trek Reservation</h5>
                    <button @click="showBookModal = false" class="btn-close"></button>
                </div>
                <div v-if="bookingError" class="alert alert-danger py-2 small mb-3">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> {{ bookingError }}
                </div>
                <div class="bg-light p-3 rounded-3 mb-3">
                    <h5 class="fw-bold text-dark mb-1">{{ selectedTrek.name }}</h5>
                    <div class="small text-muted mb-2"><i class="bi bi-geo-alt-fill text-danger me-1"></i>{{ selectedTrek.location }}</div>
                    <div class="row g-2 small text-secondary">
                        <div class="col-6"><strong>Difficulty:</strong> {{ selectedTrek.difficulty }}</div>
                        <div class="col-6"><strong>Duration:</strong> {{ selectedTrek.duration }} Days</div>
                        <div class="col-6"><strong>Start Date:</strong> {{ selectedTrek.start_date }}</div>
                        <div class="col-6"><strong>Slots Available:</strong> <span class="badge bg-success">{{ selectedTrek.available_slots }}</span></div>
                    </div>
                </div>
                <form @submit.prevent="submitBooking">
                    <div class="mb-3">
                        <label class="form-label small fw-semibold">Number of Participants (Party Size)</label>
                        <input v-model.number="bookForm.num_participants" type="number" min="1" :max="selectedTrek.available_slots" class="form-control form-control-lg" required>
                        <div class="form-text small">
                            Requested: {{ bookForm.num_participants }} participant(s). Remaining after booking: {{ selectedTrek.available_slots - bookForm.num_participants }}
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2">
                        <button type="button" @click="showBookModal = false" class="btn btn-outline-secondary">Cancel</button>
                        <button type="submit" :disabled="bookingLoading || bookForm.num_participants > selectedTrek.available_slots" class="btn btn-primary px-4">
                            <span v-if="bookingLoading" class="spinner-border spinner-border-sm me-1"></span>
                            {{ bookingLoading ? 'Confirming...' : 'Confirm Reservation' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    `,
    setup() {
        const activeTab = ref('available');
        const availableTreks = ref([]);
        const treksLoading = ref(false);
        const filters = reactive({
            q: '',
            difficulty: 'All',
            duration: '',
            location: ''
        });

        const bookings = ref([]);
        const selectedTrek = ref({});
        const showBookModal = ref(false);
        const bookForm = reactive({ num_participants: 1 });
        const bookingLoading = ref(false);
        const bookingError = ref('');

        const exportLoading = ref(false);
        const downloadLink = ref(null);

        const fetchAvailableTreks = async () => {
            treksLoading.value = true;
            try {
                const params = {};
                if (filters.q) params.q = filters.q;
                if (filters.difficulty && filters.difficulty !== 'All') params.difficulty = filters.difficulty;
                if (filters.duration) params.duration = filters.duration;
                if (filters.location) params.location = filters.location;

                const res = await axios.get('/api/user/treks', { params });
                availableTreks.value = res.data.data;
            } catch (e) { }
            finally {
                treksLoading.value = false;
            }
        };

        const resetFilters = () => {
            filters.q = '';
            filters.difficulty = 'All';
            filters.duration = '';
            filters.location = '';
            fetchAvailableTreks();
        };

        const fetchUserBookings = async () => {
            try {
                const res = await axios.get('/api/user/bookings');
                bookings.value = res.data.data;
            } catch (e) { }
        };

        const openBookModal = (trek) => {
            selectedTrek.value = trek;
            bookForm.num_participants = 1;
            bookingError.value = '';
            showBookModal.value = true;
        };

        const submitBooking = async () => {
            bookingLoading.value = true;
            bookingError.value = '';
            try {
                await axios.post(`/api/user/treks/${selectedTrek.value.id}/book`, {
                    num_participants: bookForm.num_participants
                });
                toast.trigger("Trek booked successfully! Confirmation saved to your reservations.");
                showBookModal.value = false;
                fetchAvailableTreks();
                fetchUserBookings();
                authStore.fetchNotifications();
            } catch (err) {
                bookingError.value = err.response?.data?.message || "Booking failed. Please try again.";
            } finally {
                bookingLoading.value = false;
            }
        };

        const cancelBooking = async (b) => {
            if (!confirm(`Are you sure you want to cancel your booking for '${b.trek ? b.trek.name : 'this trek'}'?`)) return;
            try {
                await axios.post(`/api/user/bookings/${b.id}/cancel`);
                toast.trigger("Booking cancelled successfully.");
                fetchUserBookings();
                fetchAvailableTreks();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Cancellation failed.", "danger");
            }
        };

        const triggerExport = async () => {
            exportLoading.value = true;
            try {
                const res = await axios.post('/api/user/export-history');
                if (res.data.data && res.data.data.download_url) {
                    downloadLink.value = res.data.data.download_url;
                }
                toast.trigger(res.data.message || "Export initiated!");
                authStore.fetchNotifications();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Export failed.", "danger");
            } finally {
                exportLoading.value = false;
            }
        };

        const activeBookingsCount = computed(() => {
            return bookings.value.filter(b => b.status === 'Booked').length;
        });

        const completedCount = computed(() => {
            return bookings.value.filter(b => b.status === 'Completed').length;
        });

        const upcomingBooking = computed(() => {
            return bookings.value.find(b => b.status === 'Booked');
        });

        onMounted(() => {
            fetchAvailableTreks();
            fetchUserBookings();
        });

        return {
            authStore, activeTab, availableTreks, treksLoading, filters,
            bookings, selectedTrek, showBookModal, bookForm, bookingLoading, bookingError,
            exportLoading, downloadLink,
            fetchAvailableTreks, resetFilters, openBookModal, submitBooking,
            cancelBooking, triggerExport,
            activeBookingsCount, completedCount, upcomingBooking
        };
    }
};

// Explore Treks View Component
const ExploreTreksView = UserDashboardView;

// 7. My Bookings View Component
const MyBookingsView = {
    template: `
    <div class="dashboard-container py-4">
        <div class="container-fluid px-4">
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 class="h3 fw-bold mb-1 text-dark">My Bookings</h2>
                    <p class="text-muted small mb-0">Track your confirmed reservations, download itineraries, or cancel where permitted.</p>
                </div>
                <div class="d-flex gap-2">
                    <button @click="triggerExport" :disabled="exportLoading" class="btn btn-outline-primary btn-sm px-3">
                        <span v-if="exportLoading" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-file-earmark-spreadsheet me-1"></i>
                        {{ exportLoading ? 'Exporting...' : 'Export (CSV)' }}
                    </button>
                    <router-link to="/explore" class="btn btn-primary btn-sm px-3 shadow-sm">
                        <i class="bi bi-plus-circle me-1"></i> Book New Trek
                    </router-link>
                </div>
            </div>

            <!-- Export Alert Banner -->
            <div v-if="downloadLink" class="alert alert-success d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm">
                <div>
                    <i class="bi bi-check-circle-fill fs-5 text-success me-2"></i>
                    <strong>Export Complete!</strong> Your complete booking history CSV is ready for download.
                </div>
                <a :href="downloadLink" class="btn btn-sm btn-success px-3">
                    <i class="bi bi-download me-1"></i> Download CSV File
                </a>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Booking ID</th>
                                <th>Trek Name</th>
                                <th>Dates</th>
                                <th>Meeting Point</th>
                                <th>Party Size</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="b in bookings" :key="b.id">
                                <td><strong>#{{ b.id }}</strong></td>
                                <td>
                                    <div class="fw-semibold text-primary">{{ b.trek ? b.trek.name : 'Trek #' + b.trek_id }}</div>
                                    <span class="text-muted small">{{ b.trek ? b.trek.location : '' }}</span>
                                </td>
                                <td class="small">{{ b.trek ? b.trek.start_date : '-' }} to {{ b.trek ? b.trek.end_date : '-' }}</td>
                                <td class="small">{{ b.trek ? (b.trek.meeting_point || 'To be announced') : '-' }}</td>
                                <td><span class="badge bg-light text-dark border">{{ b.num_participants }}</span></td>
                                <td><span :class="['badge-booking', 'booking-' + b.status.toLowerCase()]">{{ b.status }}</span></td>
                                <td class="text-end">
                                    <button v-if="b.status === 'Booked'" @click="cancelBooking(b)" class="btn btn-sm btn-outline-danger py-1 px-2">
                                        <i class="bi bi-x-circle me-1"></i> Cancel
                                    </button>
                                    <span v-else class="text-muted small fst-italic">No action</span>
                                </td>
                            </tr>
                            <tr v-if="bookings.length === 0">
                                <td colspan="7" class="text-center py-5 text-muted">
                                    No bookings found. <router-link to="/user" class="text-primary text-decoration-none">Discover our available treks!</router-link>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const bookings = ref([]);

        const fetchBookings = async () => {
            try {
                const res = await axios.get('/api/user/bookings');
                bookings.value = res.data.data;
            } catch (e) { }
        };

        const cancelBooking = async (b) => {
            if (!confirm(`Are you sure you want to cancel your booking for '${b.trek ? b.trek.name : 'this trek'}'?`)) return;
            try {
                await axios.post(`/api/user/bookings/${b.id}/cancel`);
                toast.trigger("Booking cancelled successfully.");
                fetchBookings();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Cancellation failed.", "danger");
            }
        };

        const exportLoading = ref(false);
        const downloadLink = ref(null);

        const triggerExport = async () => {
            exportLoading.value = true;
            try {
                const res = await axios.post('/api/user/export-history');
                if (res.data.data && res.data.data.download_url) {
                    downloadLink.value = res.data.data.download_url;
                }
                toast.trigger(res.data.message || "Export initiated!");
                authStore.fetchNotifications();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Export failed.", "danger");
            } finally {
                exportLoading.value = false;
            }
        };

        onMounted(() => {
            fetchBookings();
        });

        return { bookings, cancelBooking, triggerExport, exportLoading, downloadLink };
    }
};

// 9. Trekking History View Component (Celery Async CSV Export)
const TrekkingHistoryView = {
    template: `
    <div class="dashboard-container py-4">
        <div class="container-fluid px-4">
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 class="h3 fw-bold mb-1 text-dark">Trekking History</h2>
                    <p class="text-muted small mb-0">Review all your completed expeditions and export your complete record via Celery background tasks.</p>
                </div>
                <button @click="triggerExport" :disabled="exportLoading" class="btn btn-primary btn-sm px-3 shadow-sm">
                    <span v-if="exportLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-file-earmark-spreadsheet me-1"></i>
                    {{ exportLoading ? 'Preparing CSV...' : 'Export History (CSV)' }}
                </button>
            </div>

            <!-- Export Alert Banner -->
            <div v-if="downloadLink" class="alert alert-success d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm">
                <div>
                    <i class="bi bi-check-circle-fill fs-5 text-success me-2"></i>
                    <strong>Export Ready!</strong> Your complete booking history CSV has been processed.
                </div>
                <a :href="downloadLink" class="btn btn-sm btn-success px-3">
                    <i class="bi bi-download me-1"></i> Download CSV File
                </a>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Trek Name</th>
                                <th>Location</th>
                                <th>Difficulty</th>
                                <th>Dates</th>
                                <th>Completed Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="h in history" :key="h.id">
                                <td class="fw-semibold text-primary">{{ h.trek ? h.trek.name : 'Expedition #' + h.trek_id }}</td>
                                <td>{{ h.trek ? h.trek.location : '-' }}</td>
                                <td><span :class="['badge-difficulty', 'diff-' + (h.trek ? h.trek.difficulty.toLowerCase() : 'moderate')]">{{ h.trek ? h.trek.difficulty : '-' }}</span></td>
                                <td class="small">{{ h.trek ? h.trek.start_date : '-' }} &rarr; {{ h.trek ? h.trek.end_date : '-' }}</td>
                                <td><span class="badge bg-success-subtle text-success">Completed</span></td>
                            </tr>
                            <tr v-if="history.length === 0">
                                <td colspan="5" class="text-center py-5 text-muted">
                                    No completed expeditions in your record yet. After finishing a trek, it will appear here!
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const history = ref([]);
        const exportLoading = ref(false);
        const downloadLink = ref(null);

        const fetchHistory = async () => {
            try {
                const res = await axios.get('/api/user/history');
                history.value = res.data.data;
            } catch (e) { }
        };

        const triggerExport = async () => {
            exportLoading.value = true;
            try {
                const res = await axios.post('/api/user/export-history');
                if (res.data.data && res.data.data.download_url) {
                    downloadLink.value = res.data.data.download_url;
                }
                toast.trigger(res.data.message || "Export ready!");
                authStore.fetchNotifications();
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Export failed.", "danger");
            } finally {
                exportLoading.value = false;
            }
        };

        onMounted(() => {
            fetchHistory();
        });

        return { history, exportLoading, downloadLink, triggerExport };
    }
};

// 10. Profile View Component
const ProfileView = {
    template: `
    <div class="dashboard-container py-4">
        <div class="container py-3">
            <div class="row justify-content-center">
                <div class="col-12 col-md-8 col-lg-6">
                    <div class="card border-0 shadow-sm p-4">
                        <h4 class="fw-bold mb-3">Profile Settings</h4>
                        <form @submit.prevent="updateProfile">
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-secondary">Role</label>
                                <input :value="authStore.role ? authStore.role.toUpperCase() : ''" class="form-control bg-light" disabled>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-secondary">Full Name</label>
                                <input v-model="form.name" type="text" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-secondary">Email Address</label>
                                <input v-model="form.email" type="email" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-secondary">Phone Number</label>
                                <input v-model="form.phone" type="tel" class="form-control" required>
                            </div>
                            <div class="mb-4">
                                <label class="form-label small fw-semibold text-secondary">New Password (leave blank to keep current)</label>
                                <input v-model="form.password" type="password" class="form-control" placeholder="••••••••">
                            </div>
                            <button type="submit" :disabled="loading" class="btn btn-primary w-100 py-2 fw-semibold shadow-sm">
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const form = reactive({ name: '', email: '', phone: '', password: '' });
        const loading = ref(false);

        onMounted(() => {
            if (authStore.user) {
                form.name = authStore.user.name;
                form.email = authStore.user.email;
                form.phone = authStore.user.phone;
            }
        });

        const updateProfile = async () => {
            loading.value = true;
            try {
                const res = await axios.put('/api/auth/profile', form);
                authStore.user = res.data.data;
                toast.trigger("Profile updated successfully.");
                form.password = '';
            } catch (err) {
                toast.trigger(err.response?.data?.message || "Failed to update profile.", "danger");
            } finally {
                loading.value = false;
            }
        };

        return { authStore, form, loading, updateProfile };
    }
};

// --- ROUTER CONFIGURATION ---
const routes = [
    {
        path: '/', redirect: () => {
            if (!authStore.isAuthenticated) return '/login';
            if (authStore.role === 'admin') return '/admin';
            if (authStore.role === 'staff') return '/staff';
            return '/user';
        }
    },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/admin', component: AdminDashboardView, meta: { requiresAuth: true, role: 'admin' } },
    { path: '/staff', component: StaffDashboardView, meta: { requiresAuth: true, role: 'staff' } },
    { path: '/user', component: UserDashboardView, meta: { requiresAuth: true, role: 'user' } },
    { path: '/explore', component: ExploreTreksView, meta: { requiresAuth: true, role: 'user' } },
    { path: '/bookings', component: MyBookingsView, meta: { requiresAuth: true, role: 'user' } },
    { path: '/history', component: TrekkingHistoryView, meta: { requiresAuth: true, role: 'user' } },
    { path: '/profile', component: ProfileView, meta: { requiresAuth: true } }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(async (to, from, next) => {
    if (authStore.loading) {
        await authStore.checkAuth();
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        toast.trigger("Please sign in to access this page.", "warning");
        return next('/login');
    }

    if (to.meta.role && authStore.role !== to.meta.role) {
        toast.trigger("Access denied for this user role.", "danger");
        return next('/');
    }

    next();
});

// --- ROOT APP ---
const App = {
    components: { Navbar },
    template: `
    <div class="app-layout">
        <Navbar />
        
        <!-- Global Toast Notification -->
        <div v-if="toast.show" :class="['alert', 'alert-' + toast.type, 'global-toast', 'shadow-lg', 'border-0', 'd-flex', 'align-items-center', 'gap-2']">
            <i :class="['bi', toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill']"></i>
            <span>{{ toast.message }}</span>
            <button @click="toast.show = false" class="btn-close ms-auto"></button>
        </div>

        <!-- Router View Container -->
        <main class="app-content">
            <router-view />
        </main>
    </div>
    `,
    setup() {
        onMounted(async () => {
            await authStore.checkAuth();
        });
        return { toast };
    }
};

const app = createApp(App);
app.use(router);
app.mount('#app');
