// Admin Dashboard & Management Component
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
