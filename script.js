class CurlingSlideAnalyzer {
    constructor() {
        this.isRecording = false;
        this.sensorData = {
            acceleration: { x: [], y: [], z: [], timestamps: [] },
            gyroscope: { x: [], y: [], z: [], timestamps: [] },
            velocity: { x: [], timestamps: [] }
        };
        this.startTime = null;
        this.recordingInterval = null;
        this.charts = {};
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkSensorSupport();
        this.checkBluetoothSupport();
        this.updateUI();
    }

    setupEventListeners() {
        const recordBtn = document.getElementById('recordBtn');

        recordBtn.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.resizeCharts();
            }, 500);
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.resizeCharts();
        });
    }

    async checkSensorSupport() {
        const accelStatus = document.getElementById('accelStatus');
        const gyroStatus = document.getElementById('gyroStatus');
        const sensorStatusSection = document.getElementById('sensorStatus');
        
        let hasIssues = false;

        // Check accelerometer support
        if ('DeviceMotionEvent' in window) {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                // iOS 13+ requires permission
                accelStatus.textContent = 'Permission Required';
                accelStatus.style.color = '#ed8936';
                hasIssues = true;
            } else {
                accelStatus.textContent = 'Available';
                accelStatus.style.color = '#48bb78';
            }
        } else {
            accelStatus.textContent = 'Not Supported';
            accelStatus.style.color = '#f56565';
            hasIssues = true;
        }

        // Check gyroscope support
        if ('DeviceOrientationEvent' in window) {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ requires permission
                gyroStatus.textContent = 'Permission Required';
                gyroStatus.style.color = '#ed8936';
                hasIssues = true;
            } else {
                gyroStatus.textContent = 'Available';
                gyroStatus.style.color = '#48bb78';
            }
        } else {
            gyroStatus.textContent = 'Not Supported';
            gyroStatus.style.color = '#f56565';
            hasIssues = true;
        }

        // Only show sensor status if there are issues
        sensorStatusSection.style.display = hasIssues ? 'block' : 'none';
    }

    async requestPermissions() {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                
                if (motionPermission === 'granted' && orientationPermission === 'granted') {
                    this.updateSensorStatus();
                    return true;
                } else {
                    alert('Sensor permissions are required for this app to work.');
                    return false;
                }
            } catch (error) {
                console.error('Error requesting permissions:', error);
                alert('Error requesting sensor permissions.');
                return false;
            }
        }
        return true; // Assume granted for non-iOS devices
    }

    updateSensorStatus() {
        const accelStatus = document.getElementById('accelStatus');
        const gyroStatus = document.getElementById('gyroStatus');
        
        accelStatus.textContent = 'Available';
        accelStatus.style.color = '#48bb78';
        gyroStatus.textContent = 'Available';
        gyroStatus.style.color = '#48bb78';
    }

    async startRecording() {
        // Request permissions if needed
        const hasPermissions = await this.requestPermissions();
        if (!hasPermissions) return;

        this.isRecording = true;
        this.startTime = Date.now();
        this.clearData(false); // Clear data but don't update UI
        
        // Track recording start
        if (window.analytics) {
            window.analytics.trackEvent('recording_start', {
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
        }
        
        this.updateUI();
        this.startSensorListening();
        this.startRecordingTimer();
    }

    stopRecording() {
        this.isRecording = false;
        this.stopSensorListening();
        this.stopRecordingTimer();
        
        // Track recording stop with data
        if (window.analytics) {
            window.analytics.trackEvent('recording_stop', {
                dataPoints: this.sensorData.acceleration.x.length,
                duration: this.sensorData.acceleration.timestamps.length > 0 ? 
                    this.sensorData.acceleration.timestamps[this.sensorData.acceleration.timestamps.length - 1] - 
                    this.sensorData.acceleration.timestamps[0] : 0,
                timestamp: new Date().toISOString()
            });
        }
        
        this.updateUI();
        this.processData();
        this.createCharts();
        this.showAnalysis();
    }

    startSensorListening() {
        // Auto-stop detection variables
        this.autoStopBuffer = []; // Buffer to track recent motion
        this.autoStopThreshold = 1.5; // m/s² - settled motion threshold
        this.autoStopDuration = 3.0; // seconds of calm motion to auto-stop
        this.autoStopCheckInterval = 0.5; // check every 0.5 seconds
        this.lastAutoStopCheck = 0;

        // Listen to device motion (accelerometer + gyroscope)
        this.deviceMotionHandler = (event) => {
            if (!this.isRecording) return;

            const timestamp = (Date.now() - this.startTime) / 1000;

            // Accelerometer data - align with curling mechanics
            // X = forward/backward (down the sheet)
            // Y = side-to-side (lateral)
            // Z = vertical (up/down)
            if (event.accelerationIncludingGravity) {
                this.sensorData.acceleration.x.push(event.accelerationIncludingGravity.x || 0);
                this.sensorData.acceleration.y.push(event.accelerationIncludingGravity.y || 0);
                this.sensorData.acceleration.z.push(event.accelerationIncludingGravity.z || 0);
                this.sensorData.acceleration.timestamps.push(timestamp);

                // Check for auto-stop (only after 10 seconds of recording to avoid stopping during push-off)
                if (timestamp > 10.0 && timestamp - this.lastAutoStopCheck >= this.autoStopCheckInterval) {
                    this.checkAutoStop(event.accelerationIncludingGravity, timestamp);
                    this.lastAutoStopCheck = timestamp;
                }
            }

            // Gyroscope data - body rotation rates (convert to degrees/second)
            // Alpha = yaw (rotation around vertical)
            // Beta = pitch (forward/backward tilt)  
            // Gamma = roll (side-to-side tilt)
            if (event.rotationRate) {
                this.sensorData.gyroscope.x.push((event.rotationRate.beta || 0) * 180 / Math.PI); // Pitch
                this.sensorData.gyroscope.y.push((event.rotationRate.gamma || 0) * 180 / Math.PI); // Roll
                this.sensorData.gyroscope.z.push((event.rotationRate.alpha || 0) * 180 / Math.PI); // Yaw
                this.sensorData.gyroscope.timestamps.push(timestamp);
            }

            this.updateLiveData(event);
        };

        window.addEventListener('devicemotion', this.deviceMotionHandler);
    }

    checkAutoStop(acceleration, timestamp) {
        // Calculate total acceleration magnitude
        const totalAccel = Math.sqrt(
            Math.pow(acceleration.x || 0, 2) + 
            Math.pow(acceleration.y || 0, 2) + 
            Math.pow(acceleration.z || 0, 2)
        );

        // Add to buffer with timestamp
        this.autoStopBuffer.push({
            acceleration: totalAccel,
            timestamp: timestamp
        });

        // Keep only recent data (within auto-stop duration)
        this.autoStopBuffer = this.autoStopBuffer.filter(
            point => timestamp - point.timestamp <= this.autoStopDuration
        );

        // Check if we have enough data and all recent motion is below threshold
        if (this.autoStopBuffer.length >= (this.autoStopDuration / this.autoStopCheckInterval)) {
            const allCalm = this.autoStopBuffer.every(
                point => point.acceleration < this.autoStopThreshold
            );

            if (allCalm) {
                console.log(`Auto-stopping: ${this.autoStopDuration}s of calm motion detected`);
                this.stopRecording();
                
                // Show notification about auto-stop
                this.showAutoStopNotification();
            }
        }
    }

    showAutoStopNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: #48bb78;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            text-align: center;
        `;
        notification.textContent = '🛑 Auto-stopped: Motion settled';
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    stopSensorListening() {
        if (this.deviceMotionHandler) {
            window.removeEventListener('devicemotion', this.deviceMotionHandler);
        }
    }

    startRecordingTimer() {
        this.recordingInterval = setInterval(() => {
            if (this.isRecording) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                document.getElementById('recordingTime').textContent = elapsed.toFixed(1);
            }
        }, 100);
    }

    stopRecordingTimer() {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
    }

    updateLiveData(event) {
        if (event.accelerationIncludingGravity) {
            document.getElementById('accelX').textContent = (event.accelerationIncludingGravity.x || 0).toFixed(2);
            document.getElementById('accelY').textContent = (event.accelerationIncludingGravity.y || 0).toFixed(2);
            document.getElementById('accelZ').textContent = (event.accelerationIncludingGravity.z || 0).toFixed(2);
        }

        if (event.rotationRate) {
            document.getElementById('gyroX').textContent = ((event.rotationRate.beta || 0) * 180 / Math.PI).toFixed(1);
            document.getElementById('gyroY').textContent = ((event.rotationRate.gamma || 0) * 180 / Math.PI).toFixed(1);
            document.getElementById('gyroZ').textContent = ((event.rotationRate.alpha || 0) * 180 / Math.PI).toFixed(1);
        }
    }

    updateUI() {
        const recordBtn = document.getElementById('recordBtn');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const liveDataSection = document.getElementById('liveDataSection');

        if (this.isRecording) {
            recordBtn.innerHTML = '<span class="btn-icon">⏹️</span><span class="btn-text">Stop Recording</span>';
            recordBtn.classList.add('recording');
            statusDot.classList.add('recording');
            statusText.textContent = 'Recording...';
            liveDataSection.style.display = 'block';
        } else {
            recordBtn.innerHTML = '<span class="btn-icon">⏺️</span><span class="btn-text">Start Recording</span>';
            recordBtn.classList.remove('recording');
            statusDot.classList.remove('recording');
            
            if (this.hasData()) {
                statusText.textContent = 'Data Ready for Analysis';
                statusDot.classList.add('processing');
                liveDataSection.style.display = 'none';
            } else {
                statusText.textContent = 'Ready to Record';
                statusDot.classList.remove('processing');
                liveDataSection.style.display = 'none';
            }
        }
    }

    hasData() {
        return this.sensorData.acceleration.x.length > 0 || this.sensorData.gyroscope.x.length > 0;
    }

    clearData(updateUI = true) {
        // Track data clearing
        if (window.analytics && this.hasData()) {
            window.analytics.trackEvent('data_cleared', {
                hadData: true,
                timestamp: new Date().toISOString()
            });
        }

        this.sensorData = {
            acceleration: { x: [], y: [], z: [], timestamps: [] },
            gyroscope: { x: [], y: [], z: [], timestamps: [] },
            velocity: { x: [], timestamps: [] }
        };

        // Hide charts section
        document.getElementById('chartsSection').style.display = 'none';
        
        // Clear existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};

        if (updateUI) {
            this.updateUI();
        }
    }

    processData() {
        // Basic data processing and validation
        if (!this.hasData()) {
            alert('No sensor data recorded. Please try again.');
            return;
        }

        // Trim the data to actual throw motion
        this.trimToActualThrow();

        // Calculate velocity by integrating forward acceleration
        this.calculateVelocity();

        console.log('Processing delivery data...');
        console.log('Acceleration points:', this.sensorData.acceleration.x.length);
        console.log('Gyroscope points:', this.sensorData.gyroscope.x.length);
        console.log('Velocity points:', this.sensorData.velocity.x.length);
    }

    trimToActualThrow() {
        const accel = this.sensorData.acceleration;
        const gyro = this.sensorData.gyroscope;
        
        if (accel.x.length === 0) return;

        // Find start: first significant acceleration spike (push-off)
        const accelThreshold = 2.0; // m/s² - significant movement
        let startIndex = 0;
        
        for (let i = 0; i < accel.x.length; i++) {
            const totalAccel = Math.sqrt(
                Math.pow(accel.x[i], 2) + 
                Math.pow(accel.y[i], 2) + 
                Math.pow(accel.z[i], 2)
            );
            if (totalAccel > accelThreshold) {
                startIndex = Math.max(0, i - 5); // Include 5 points before movement
                break;
            }
        }

        // Find end: when motion settles down after delivery
        let endIndex = accel.x.length - 1;
        const settlePeriod = 20; // Look for 20 consecutive calm points
        let calmCount = 0;
        
        for (let i = startIndex + 30; i < accel.x.length; i++) { // Start looking after initial movement
            const totalAccel = Math.sqrt(
                Math.pow(accel.x[i], 2) + 
                Math.pow(accel.y[i], 2) + 
                Math.pow(accel.z[i], 2)
            );
            
            if (totalAccel < 1.5) { // Settled motion
                calmCount++;
                if (calmCount >= settlePeriod) {
                    endIndex = i - settlePeriod + 10; // Include a few points after settling
                    break;
                }
            } else {
                calmCount = 0; // Reset if motion detected
            }
        }

        console.log(`Trimming data: ${startIndex} to ${endIndex} (${endIndex - startIndex} points)`);

        // Trim acceleration data
        this.sensorData.acceleration.x = accel.x.slice(startIndex, endIndex + 1);
        this.sensorData.acceleration.y = accel.y.slice(startIndex, endIndex + 1);
        this.sensorData.acceleration.z = accel.z.slice(startIndex, endIndex + 1);
        this.sensorData.acceleration.timestamps = accel.timestamps.slice(startIndex, endIndex + 1);

        // Adjust timestamps to start from 0
        const startTime = this.sensorData.acceleration.timestamps[0];
        this.sensorData.acceleration.timestamps = this.sensorData.acceleration.timestamps.map(t => t - startTime);

        // Trim gyroscope data (matching indices)
        if (gyro.x.length > 0) {
            this.sensorData.gyroscope.x = gyro.x.slice(startIndex, endIndex + 1);
            this.sensorData.gyroscope.y = gyro.y.slice(startIndex, endIndex + 1);
            this.sensorData.gyroscope.z = gyro.z.slice(startIndex, endIndex + 1);
            this.sensorData.gyroscope.timestamps = gyro.timestamps.slice(startIndex, endIndex + 1).map(t => t - startTime);
        }
    }

    calculateVelocity() {
        const accel = this.sensorData.acceleration;
        const velocity = { x: [0], timestamps: [accel.timestamps[0] || 0] };
        
        // Integrate forward acceleration to get velocity
        for (let i = 1; i < accel.x.length; i++) {
            const dt = accel.timestamps[i] - accel.timestamps[i-1];
            const prevVel = velocity.x[velocity.x.length - 1];
            const avgAccel = (accel.x[i] + accel.x[i-1]) / 2;
            
            // Remove gravity component and integrate
            const newVel = prevVel + (avgAccel * dt);
            velocity.x.push(newVel);
            velocity.timestamps.push(accel.timestamps[i]);
        }
        
        this.sensorData.velocity = velocity;
    }

    createCharts() {
        if (!this.hasData()) return;

        document.getElementById('chartsSection').style.display = 'block';

        this.createAccelerationChart();
        this.createGyroscopeChart();
        this.createVelocityChart();
    }

    createAccelerationChart() {
        const ctx = document.getElementById('accelerationChart').getContext('2d');
        
        if (this.charts.acceleration) {
            this.charts.acceleration.destroy();
        }

        this.charts.acceleration = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.sensorData.acceleration.timestamps,
                datasets: [
                    {
                        label: 'Forward (push-off & drag)',
                        data: this.sensorData.acceleration.x,
                        borderColor: '#f56565',
                        backgroundColor: 'rgba(245, 101, 101, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Velocity',
                        data: this.sensorData.velocity.x,
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        tension: 0.1,
                        borderWidth: 3,
                        pointRadius: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time (seconds)'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Acceleration (m/s²)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Velocity (m/s)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }

    createGyroscopeChart() {
        const ctx = document.getElementById('gyroscopeChart').getContext('2d');
        
        if (this.charts.gyroscope) {
            this.charts.gyroscope.destroy();
        }

        this.charts.gyroscope = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.sensorData.gyroscope.timestamps,
                datasets: [
                    {
                        label: 'Pitch (forward/back tilt)',
                        data: this.sensorData.gyroscope.x,
                        borderColor: '#ed8936',
                        backgroundColor: 'rgba(237, 137, 54, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 1
                    },
                    {
                        label: 'Roll (side-to-side tilt)',
                        data: this.sensorData.gyroscope.y,
                        borderColor: '#9f7aea',
                        backgroundColor: 'rgba(159, 122, 234, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 1
                    },
                    {
                        label: 'Yaw (torso rotation)',
                        data: this.sensorData.gyroscope.z,
                        borderColor: '#38b2ac',
                        backgroundColor: 'rgba(56, 178, 172, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time (seconds)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Angular Velocity (°/s)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }

    createVelocityChart() {
        const ctx = document.getElementById('velocityChart').getContext('2d');
        
        if (this.charts.velocity) {
            this.charts.velocity.destroy();
        }

        // Calculate RMS stability index
        const stabilityIndex = this.calculateStabilityIndex();

        this.charts.velocity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.sensorData.velocity.timestamps,
                datasets: [
                    {
                        label: 'Forward Velocity',
                        data: this.sensorData.velocity.x,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true,
                        tension: 0.1,
                        borderWidth: 3,
                        pointRadius: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Stability Index',
                        data: stabilityIndex,
                        borderColor: '#f56565',
                        backgroundColor: 'rgba(245, 101, 101, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time (seconds)'
                        }
                    },
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
                            text: 'Instability (°/s)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }

    calculateStabilityIndex() {
        const gyro = this.sensorData.gyroscope;
        const windowSize = 5; // 5-point moving window for RMS
        const stabilityIndex = [];

        for (let i = 0; i < gyro.x.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(gyro.x.length, i + Math.floor(windowSize / 2) + 1);
            
            let rmsSum = 0;
            let count = 0;
            
            for (let j = start; j < end; j++) {
                const pitchSq = Math.pow(gyro.x[j] || 0, 2);
                const rollSq = Math.pow(gyro.y[j] || 0, 2);
                rmsSum += pitchSq + rollSq; // Don't include yaw in stability calc
                count++;
            }
            
            const rms = Math.sqrt(rmsSum / count);
            stabilityIndex.push(rms);
        }
        
        return stabilityIndex;
    }

    showAnalysis() {
        if (!this.hasData()) return;

        const analysisResults = document.getElementById('analysisResults');
        
        // Calculate analysis metrics
        const analysis = this.calculateAnalysisMetrics();
        
        // Save throw to session
        this.saveThrowToSession(analysis);
        
        // Track analysis completion
        if (window.analytics) {
            window.analytics.trackEvent('analysis_complete', {
                pushoffStrength: analysis.pushoffStrength,
                peakVelocity: analysis.peakVelocity,
                slideDuration: analysis.slideDuration,
                stabilityScore: analysis.stabilityScore,
                glideEfficiency: analysis.glideEfficiency,
                timestamp: new Date().toISOString()
            });
        }
        
        // Update analysis display
        document.getElementById('pushoffStrength').textContent = analysis.pushoffStrength.toFixed(2);
        document.getElementById('peakVelocity').textContent = analysis.peakVelocity.toFixed(2);
        document.getElementById('slideDuration').textContent = analysis.slideDuration.toFixed(2);
        document.getElementById('decelRate').textContent = analysis.decelRate.toFixed(3);
        document.getElementById('stabilityScore').textContent = analysis.stabilityScore.toFixed(0);
        document.getElementById('glideEfficiency').textContent = analysis.glideEfficiency;

        analysisResults.style.display = 'block';
    }

    calculateAnalysisMetrics() {
        const accel = this.sensorData.acceleration;
        const velocity = this.sensorData.velocity;
        const gyro = this.sensorData.gyroscope;

        // Push-off strength: peak forward acceleration in first 20% of delivery
        const pushoffPeriod = Math.floor(accel.x.length * 0.2);
        const pushoffData = accel.x.slice(0, pushoffPeriod);
        const pushoffStrength = Math.max(...pushoffData.map(Math.abs));

        // Peak velocity
        const peakVelocity = Math.max(...velocity.x.map(Math.abs));

        // Slide duration
        const slideDuration = accel.timestamps.length > 0 ? 
            accel.timestamps[accel.timestamps.length - 1] - accel.timestamps[0] : 0;

        // Deceleration rate: average negative acceleration during slide
        const slideData = accel.x.slice(pushoffPeriod);
        const negativeAccel = slideData.filter(a => a < 0);
        const decelRate = negativeAccel.length > 0 ? 
            negativeAccel.reduce((a, b) => a + b, 0) / negativeAccel.length : 0;

        // Stability score: inverse of RMS pitch/roll variance
        const pitchRoll = gyro.x.map((pitch, i) => 
            Math.sqrt(Math.pow(pitch, 2) + Math.pow(gyro.y[i] || 0, 2))
        );
        const stabilityVariance = this.calculateVariance(pitchRoll);
        
        // Scale the stability score more appropriately for gyroscope data
        // Use a logarithmic scale since gyro variance can be quite high
        const stabilityScore = Math.max(0, Math.min(100, 100 - Math.log10(stabilityVariance + 1) * 20));
        
        console.log('Stability debug:', {
            pitchRollSamples: pitchRoll.length,
            variance: stabilityVariance,
            score: stabilityScore
        });

        // Glide efficiency assessment
        let glideEfficiency = 'Good';
        const avgDecel = Math.abs(decelRate);
        if (avgDecel > 2.0) glideEfficiency = 'Poor (High Drag)';
        else if (avgDecel < 0.5) glideEfficiency = 'Excellent';
        else if (avgDecel < 1.0) glideEfficiency = 'Very Good';

        return {
            pushoffStrength,
            peakVelocity,
            slideDuration,
            decelRate: Math.abs(decelRate),
            stabilityScore,
            glideEfficiency
        };
    }

    calculateVariance(data) {
        if (data.length === 0) return 0;
        
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
        return variance;
    }

    saveThrowToSession(analysis) {
        try {
            // Create throw data object
            const throwData = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                ...analysis
            };

            // Get or create current session
            let currentSession = null;
            try {
                const sessionData = localStorage.getItem('curling_current_session');
                currentSession = sessionData ? JSON.parse(sessionData) : null;
            } catch (e) {
                currentSession = null;
            }

            // Create new session if none exists
            if (!currentSession) {
                currentSession = {
                    id: 'session_' + Date.now(),
                    startTime: new Date().toISOString(),
                    name: `Session ${new Date().toLocaleDateString()}`
                };
                localStorage.setItem('curling_current_session', JSON.stringify(currentSession));
            }

            // Add session ID to throw data
            throwData.sessionId = currentSession.id;

            // Get existing throws array
            let throws = [];
            try {
                const throwsData = localStorage.getItem('curling_session_throws');
                throws = throwsData ? JSON.parse(throwsData) : [];
            } catch (e) {
                throws = [];
            }

            // Add new throw to array
            throws.push(throwData);

            // Save updated throws array
            localStorage.setItem('curling_session_throws', JSON.stringify(throws));
            
            // Also save as latest throw for immediate pickup
            localStorage.setItem('curling_latest_throw', JSON.stringify(throwData));

            // Trigger storage event for comparison page if it's open
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'curling_session_throws',
                newValue: JSON.stringify(throws)
            }));

            console.log('Throw saved to session:', throwData);
            console.log('Total throws in session:', throws.length);
            
            // Add visual feedback that save worked
            this.showSaveConfirmation(throws.length);
        } catch (error) {
            console.error('Error saving throw to session:', error);
            alert('Error saving throw data: ' + error.message);
        }
    }

    showSaveConfirmation(throwCount) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        notification.textContent = `✅ Throw saved! (${throwCount} total)`;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new CurlingSlideAnalyzer();
    
    // Make it globally accessible for debugging
    window.curlingAnalyzer = analyzer;
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.curlingAnalyzer && window.curlingAnalyzer.isRecording) {
        // Auto-stop recording if user leaves the page
        window.curlingAnalyzer.stopRecording();
    }
});

// Prevent phone from sleeping during recording
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock activated');
        } catch (err) {
            console.log('Wake lock failed:', err);
        }
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake lock released');
    }
}