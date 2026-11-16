// User Trekker Dashboard & Explore Treks Component
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
