class TrainingSessionAnalyzer {
    constructor() {
        this.throws = [];
        this.currentSession = null;
        this.charts = {};
        
        this.init();
    }

    init() {
        this.loadSessionData();
        this.setupEventListeners();
        this.updateUI();
        this.trackPageView();
    }

    trackPageView() {
        if (window.analytics) {
            window.analytics.trackEvent('comparison_page_view', {
                throwCount: this.throws.length,
                hasSession: !!this.currentSession
            });
        }
    }

    loadSessionData() {
        try {
            // Load current session
            const sessionData = localStorage.getItem('curling_current_session');
            if (sessionData) {
                this.currentSession = JSON.parse(sessionData);
            }

            // Load throws data
            const throwsData = localStorage.getItem('curling_session_throws');
            if (throwsData) {
                this.throws = JSON.parse(throwsData);
            }

            // Initialize session if needed
            if (!this.currentSession && this.throws.length === 0) {
                this.startNewSession();
            }

            console.log('Loaded session data:', {
                session: this.currentSession,
                throwCount: this.throws.length
            });
        } catch (error) {
            console.error('Error loading session data:', error);
            this.throws = [];
            this.currentSession = null;
        }
    }

    saveSessionData() {
        try {
            localStorage.setItem('curling_current_session', JSON.stringify(this.currentSession));
            localStorage.setItem('curling_session_throws', JSON.stringify(this.throws));
        } catch (error) {
            console.error('Error saving session data:', error);
        }
    }

    setupEventListeners() {
        // Session controls
        document.getElementById('newSessionBtn').addEventListener('click', () => {
            this.startNewSession();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportSessionData();
        });

        // Individual analysis close button
        document.getElementById('closeAnalysisBtn').addEventListener('click', () => {
            this.closeIndividualAnalysis();
        });

        // Listen for new throw data from main page
        window.addEventListener('storage', (e) => {
            if (e.key === 'curling_session_throws') {
                console.log('Storage event detected for session throws');
                this.loadSessionData();
                this.updateUI();
            }
        });

        // Check for new throw on page load
        this.checkForNewThrow();
    }

    checkForNewThrow() {
        // Just reload data when page loads
        this.loadSessionData();
    }

    startNewSession() {
        if (this.throws.length > 0) {
            const confirmed = confirm('Start a new session? This will clear all current throw data.');
            if (!confirmed) return;
        }

        this.currentSession = {
            id: 'session_' + Date.now(),
            startTime: new Date().toISOString(),
            name: `Session ${new Date().toLocaleDateString()}`
        };

        this.throws = [];
        // Clear localStorage too
        localStorage.removeItem('curling_session_throws');
        localStorage.removeItem('curling_current_session');
        localStorage.removeItem('curling_latest_throw');
        
        this.saveSessionData();
        this.updateUI();

        if (window.analytics) {
            window.analytics.trackEvent('new_session_started');
        }
    }

    exportSessionData() {
        const exportData = {
            session: this.currentSession,
            throws: this.throws,
            exportDate: new Date().toISOString(),
            summary: this.calculateSessionSummary()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        a.download = `curling-session-${this.currentSession.id}-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);

        if (window.analytics) {
            window.analytics.trackEvent('session_exported', {
                throwCount: this.throws.length
            });
        }
    }

    updateUI() {
        this.updateSessionInfo();
        this.updateQuickStats();
        this.updateTrendCharts();
        this.updateComparisonTable();
        this.toggleSections();
    }

    updateSessionInfo() {
        document.getElementById('throwCount').textContent = this.throws.length;
        
        if (this.currentSession) {
            const startTime = new Date(this.currentSession.startTime);
            const duration = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60));
            document.getElementById('sessionDuration').textContent = `${duration} min`;
            document.getElementById('sessionStart').textContent = startTime.toLocaleTimeString();
        }
    }

    updateQuickStats() {
        if (this.throws.length === 0) return;

        const summary = this.calculateSessionSummary();
        
        document.getElementById('avgPushoff').textContent = summary.avgPushoff.toFixed(2);
        document.getElementById('avgVelocity').textContent = summary.avgVelocity.toFixed(2);
        document.getElementById('avgStability').textContent = summary.avgStability.toFixed(0);
        document.getElementById('bestGlide').textContent = summary.bestGlide;
        document.getElementById('consistency').textContent = summary.consistency.toFixed(0);
        document.getElementById('improvement').textContent = summary.improvement;
    }

    calculateSessionSummary() {
        if (this.throws.length === 0) return {};

        const pushoffs = this.throws.map(t => t.pushoffStrength || 0);
        const velocities = this.throws.map(t => t.peakVelocity || 0);
        const stabilities = this.throws.map(t => t.stabilityScore || 0);

        const avgPushoff = pushoffs.reduce((a, b) => a + b, 0) / pushoffs.length;
        const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
        const avgStability = stabilities.reduce((a, b) => a + b, 0) / stabilities.length;

        // Best glide efficiency
        const glideQualities = this.throws.map(t => t.glideEfficiency || 'Good');
        const excellentCount = glideQualities.filter(g => g === 'Excellent').length;
        const veryGoodCount = glideQualities.filter(g => g === 'Very Good').length;
        let bestGlide = 'Good';
        if (excellentCount > 0) bestGlide = `${excellentCount} Excellent`;
        else if (veryGoodCount > 0) bestGlide = `${veryGoodCount} Very Good`;

        // Consistency
        const pushoffCV = this.calculateCV(pushoffs);
        const velocityCV = this.calculateCV(velocities);
        const stabilityCV = this.calculateCV(stabilities);
        const avgCV = (pushoffCV + velocityCV + stabilityCV) / 3;
        const consistency = Math.max(0, 100 - (avgCV * 10));

        // Improvement trend
        let improvement = 'Stable';
        if (this.throws.length >= 3) {
            const recent = this.throws.slice(-3);
            const early = this.throws.slice(0, 3);
            const recentAvg = recent.reduce((a, t) => a + (t.stabilityScore || 0), 0) / recent.length;
            const earlyAvg = early.reduce((a, t) => a + (t.stabilityScore || 0), 0) / early.length;
            
            if (recentAvg > earlyAvg + 5) improvement = 'Improving';
            else if (recentAvg < earlyAvg - 5) improvement = 'Declining';
        }

        return {
            avgPushoff,
            avgVelocity,
            avgStability,
            bestGlide,
            consistency,
            improvement
        };
    }

    calculateCV(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return mean === 0 ? 0 : (stdDev / mean) * 100;
    }

    updateTrendCharts() {
        if (this.throws.length === 0) return;

        this.createPushoffTrendChart();
        this.createVelocityStabilityChart();
        this.createDecelTrendChart();
    }

    createPushoffTrendChart() {
        const ctx = document.getElementById('pushoffTrendChart').getContext('2d');
        
        if (this.charts.pushoffTrend) {
            this.charts.pushoffTrend.destroy();
        }

        const labels = this.throws.map((_, i) => `Throw ${i + 1}`);
        const data = this.throws.map(t => t.pushoffStrength || 0);

        this.charts.pushoffTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Push-off Strength (m/s²)',
                    data: data,
                    borderColor: '#f56565',
                    backgroundColor: 'rgba(245, 101, 101, 0.1)',
                    tension: 0.3,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Push-off Strength (m/s²)'
                        }
                    }
                }
            }
        });
    }

    createVelocityStabilityChart() {
        const ctx = document.getElementById('velocityStabilityChart').getContext('2d');
        
        if (this.charts.velocityStability) {
            this.charts.velocityStability.destroy();
        }

        const labels = this.throws.map((_, i) => `Throw ${i + 1}`);

        this.charts.velocityStability = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Peak Velocity (m/s)',
                        data: this.throws.map(t => t.peakVelocity || 0),
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Stability Score (%)',
                        data: this.throws.map(t => t.stabilityScore || 0),
                        borderColor: '#48bb78',
                        backgroundColor: 'rgba(72, 187, 120, 0.1)',
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Velocity (m/s)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Stability (%)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                }
            }
        });
    }

    createDecelTrendChart() {
        const ctx = document.getElementById('decelTrendChart').getContext('2d');
        
        if (this.charts.decelTrend) {
            this.charts.decelTrend.destroy();
        }

        const labels = this.throws.map((_, i) => `Throw ${i + 1}`);
        const data = this.throws.map(t => t.decelRate || 0);

        this.charts.decelTrend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Deceleration Rate (m/s²)',
                    data: data,
                    backgroundColor: data.map(d => {
                        if (d > 2.0) return 'rgba(245, 101, 101, 0.7)'; // Poor
                        if (d < 0.5) return 'rgba(72, 187, 120, 0.7)'; // Excellent
                        if (d < 1.0) return 'rgba(56, 178, 172, 0.7)'; // Very Good
                        return 'rgba(66, 153, 225, 0.7)'; // Good
                    }),
                    borderColor: data.map(d => {
                        if (d > 2.0) return '#f56565';
                        if (d < 0.5) return '#48bb78';
                        if (d < 1.0) return '#38b2ac';
                        return '#4299e1';
                    }),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Deceleration Rate (m/s²)'
                        }
                    }
                }
            }
        });
    }

    updateComparisonTable() {
        const tbody = document.getElementById('comparisonTableBody');
        tbody.innerHTML = '';

        this.throws.forEach((throwData, index) => {
            const row = document.createElement('tr');
            const time = new Date(throwData.timestamp).toLocaleTimeString();
            
            row.innerHTML = `
                <td class="throw-number">#${index + 1}</td>
                <td>${time}</td>
                <td>${(throwData.pushoffStrength || 0).toFixed(2)}</td>
                <td>${(throwData.peakVelocity || 0).toFixed(2)}</td>
                <td>${(throwData.slideDuration || 0).toFixed(2)}</td>
                <td>${(throwData.decelRate || 0).toFixed(3)}</td>
                <td>${(throwData.stabilityScore || 0).toFixed(0)}%</td>
                <td class="efficiency-${(throwData.glideEfficiency || 'good').toLowerCase().replace(' ', '-')}">${throwData.glideEfficiency || 'Good'}</td>
                <td class="table-actions">
                    <button class="table-btn view" onclick="window.sessionAnalyzer.viewThrowDetails(${index})">View</button>
                    <button class="table-btn delete" onclick="window.sessionAnalyzer.deleteThrow(${index})">Delete</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    viewThrowDetails(index) {
        const throwData = this.throws[index];
        if (!throwData) return;

        document.getElementById('analysisTitle').textContent = `Throw #${index + 1} Analysis`;
        document.getElementById('individualAnalysis').style.display = 'block';

        this.showDetailedMetrics(throwData);

        if (window.analytics) {
            window.analytics.trackEvent('throw_details_viewed', { throwIndex: index });
        }
    }

    showDetailedMetrics(throwData) {
        const metricsContainer = document.getElementById('detailedMetrics');
        metricsContainer.innerHTML = '';

        const metrics = [
            { label: 'Push-off Strength', value: `${(throwData.pushoffStrength || 0).toFixed(2)} m/s²` },
            { label: 'Peak Velocity', value: `${(throwData.peakVelocity || 0).toFixed(2)} m/s` },
            { label: 'Slide Duration', value: `${(throwData.slideDuration || 0).toFixed(2)} seconds` },
            { label: 'Deceleration Rate', value: `${(throwData.decelRate || 0).toFixed(3)} m/s²` },
            { label: 'Stability Score', value: `${(throwData.stabilityScore || 0).toFixed(0)}%` },
            { label: 'Glide Efficiency', value: throwData.glideEfficiency || 'Good' },
            { label: 'Recorded At', value: new Date(throwData.timestamp).toLocaleString() }
        ];

        metrics.forEach(metric => {
            const item = document.createElement('div');
            item.className = 'analysis-item';
            item.innerHTML = `
                <label>${metric.label}:</label>
                <span>${metric.value}</span>
            `;
            metricsContainer.appendChild(item);
        });
    }

    deleteThrow(index) {
        const confirmed = confirm(`Delete throw #${index + 1}?`);
        if (!confirmed) return;

        this.throws.splice(index, 1);
        this.saveSessionData();
        this.updateUI();

        if (window.analytics) {
            window.analytics.trackEvent('throw_deleted', { 
                throwIndex: index,
                remainingThrows: this.throws.length 
            });
        }
    }

    closeIndividualAnalysis() {
        document.getElementById('individualAnalysis').style.display = 'none';
    }

    toggleSections() {
        const hasData = this.throws.length > 0;
        
        document.getElementById('noDataSection').style.display = hasData ? 'none' : 'block';
        document.getElementById('quickStats').style.display = hasData ? 'block' : 'none';
        document.getElementById('trendSection').style.display = hasData ? 'block' : 'none';
        document.getElementById('comparisonSection').style.display = hasData ? 'block' : 'none';
    }
}

// Initialize the session analyzer
document.addEventListener('DOMContentLoaded', () => {
    window.sessionAnalyzer = new TrainingSessionAnalyzer();
});

// Handle page visibility to update data when returning from main page
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.sessionAnalyzer) {
        window.sessionAnalyzer.loadSessionData();
        window.sessionAnalyzer.updateUI();
    }
});