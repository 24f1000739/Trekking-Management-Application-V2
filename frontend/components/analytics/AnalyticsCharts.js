// TMA V2 Chart.js & Analytics Component
const AnalyticsDashboard = {
    props: ['stats', 'treks'],
    template: `
        <div class="analytics-container my-4">
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="card shadow-sm p-3">
                        <h6>Expedition Booking Trends</h6>
                        <canvas id="bookingTrendChart"></canvas>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card shadow-sm p-3">
                        <h6>Participant Distribution by Route</h6>
                        <canvas id="routeDistChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `
};
