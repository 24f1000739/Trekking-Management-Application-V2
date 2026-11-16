// Auth Views: Login and Registration
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
