// Lightweight privacy-friendly analytics
class SimpleAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        this.endpoint = 'https://your-analytics-endpoint.com/track'; // Replace with your endpoint
        this.enabled = true; // Set to false to disable tracking
        
        this.init();
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    init() {
        if (!this.enabled) return;
        
        // Track page load
        this.track('page_load', {
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            screenSize: `${screen.width}x${screen.height}`,
            timestamp: new Date().toISOString()
        });

        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.track('page_hidden');
            } else {
                this.track('page_visible');
            }
        });

        // Track before page unload
        window.addEventListener('beforeunload', () => {
            this.track('page_unload', {
                timeOnPage: Date.now() - this.startTime
            });
            this.flush(); // Send any pending events
        });

        // Flush events periodically
        setInterval(() => {
            this.flush();
        }, 30000); // Every 30 seconds
    }

    track(event, data = {}) {
        if (!this.enabled) return;

        const eventData = {
            sessionId: this.sessionId,
            event: event,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            ...data
        };

        this.events.push(eventData);

        // Auto-flush on certain events
        if (['page_load', 'page_unload', 'recording_start', 'recording_stop'].includes(event)) {
            setTimeout(() => this.flush(), 100);
        }
    }

    flush() {
        if (!this.enabled || this.events.length === 0) return;

        const eventsToSend = [...this.events];
        this.events = [];

        // Try to send events (replace with your actual endpoint)
        this.sendEvents(eventsToSend);
    }

    async sendEvents(events) {
        try {
            // Option 1: Send to your own analytics endpoint
            if (this.endpoint && this.endpoint !== 'https://your-analytics-endpoint.com/track') {
                await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ events }),
                    keepalive: true
                });
            }

            // Option 2: Log to console for development
            console.log('Analytics Events:', events);

            // Option 3: Store in localStorage for later retrieval
            this.storeEventsLocally(events);

        } catch (error) {
            console.error('Analytics error:', error);
            // Re-add events back to queue on failure
            this.events.unshift(...events);
        }
    }

    storeEventsLocally(events) {
        try {
            const stored = JSON.parse(localStorage.getItem('curling_analytics') || '[]');
            stored.push(...events);
            
            // Keep only last 1000 events to avoid storage bloat
            const trimmed = stored.slice(-1000);
            localStorage.setItem('curling_analytics', JSON.stringify(trimmed));
        } catch (error) {
            console.error('Local storage error:', error);
        }
    }

    // Public method to track custom events
    trackEvent(eventName, data = {}) {
        this.track(eventName, data);
    }

    // Get stored analytics data (for debugging or manual export)
    getStoredData() {
        try {
            return JSON.parse(localStorage.getItem('curling_analytics') || '[]');
        } catch (error) {
            return [];
        }
    }

    // Clear stored data
    clearStoredData() {
        localStorage.removeItem('curling_analytics');
    }

    // Privacy-friendly user info (no PII)
    getUserInfo() {
        return {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            platform: navigator.platform,
            isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            screenSize: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            cookieEnabled: navigator.cookieEnabled
        };
    }
}

// Initialize analytics
const analytics = new SimpleAnalytics();

// Make it globally available for the curling app
window.analytics = analytics;

// Track common curling app events
document.addEventListener('DOMContentLoaded', () => {
    // Track when the app is ready
    analytics.trackEvent('app_ready', analytics.getUserInfo());
    
    // Track sensor support
    if ('DeviceMotionEvent' in window) {
        analytics.trackEvent('sensor_support', { 
            accelerometer: true,
            gyroscope: 'DeviceOrientationEvent' in window
        });
    } else {
        analytics.trackEvent('sensor_support', { 
            accelerometer: false,
            gyroscope: false
        });
    }
});

// Add tracking hooks for curling app events
window.addEventListener('load', () => {
    // Hook into the curling analyzer if it exists
    if (window.curlingAnalyzer) {
        const originalStartRecording = window.curlingAnalyzer.startRecording;
        const originalStopRecording = window.curlingAnalyzer.stopRecording;
        const originalClearData = window.curlingAnalyzer.clearData;

        window.curlingAnalyzer.startRecording = function() {
            analytics.trackEvent('recording_start');
            return originalStartRecording.call(this);
        };

        window.curlingAnalyzer.stopRecording = function() {
            const result = originalStopRecording.call(this);
            analytics.trackEvent('recording_stop', {
                dataPoints: this.sensorData.acceleration.x.length,
                duration: this.sensorData.acceleration.timestamps.length > 0 ? 
                    this.sensorData.acceleration.timestamps[this.sensorData.acceleration.timestamps.length - 1] - 
                    this.sensorData.acceleration.timestamps[0] : 0
            });
            return result;
        };

        window.curlingAnalyzer.clearData = function(updateUI = true) {
            analytics.trackEvent('data_cleared');
            return originalClearData.call(this, updateUI);
        };
    }
});

// Privacy notice and opt-out functionality
window.analyticsOptOut = function() {
    analytics.enabled = false;
    analytics.clearStoredData();
    localStorage.setItem('curling_analytics_opted_out', 'true');
    console.log('Analytics tracking disabled');
};

window.analyticsOptIn = function() {
    analytics.enabled = true;
    localStorage.removeItem('curling_analytics_opted_out');
    console.log('Analytics tracking enabled');
};

// Check if user previously opted out
if (localStorage.getItem('curling_analytics_opted_out') === 'true') {
    analytics.enabled = false;
}