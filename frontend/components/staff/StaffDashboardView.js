// Staff Dashboard & Trek Operations Component
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
