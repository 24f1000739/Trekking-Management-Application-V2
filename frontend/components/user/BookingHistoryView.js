// Booking History & Active Bookings Component
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
