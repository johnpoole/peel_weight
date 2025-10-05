# 🥌 Curling Slide Analyzer

A mobile web application that uses your phone's built-in sensors (accelerometer and gyroscope) to record and analyze curling delivery biomechanics. The app provides real-time visualization and detailed analysis of your slide technique, body stability, and kinetic chain efficiency.

## Features

- **Real-time Sensor Data**: Records acceleration and gyroscope data during your curling delivery
- **Live Data Display**: Shows current sensor readings while recording
- **Interactive Charts**: Visualizes forward acceleration, velocity, and body stability data
- **Delivery Analysis**: Provides metrics including:
  - Push-off strength
  - Peak slide velocity
  - Slide duration
  - Deceleration rate (drag detection)
  - Body stability score
  - Glide efficiency assessment
- **Mobile Optimized**: Responsive design optimized for smartphone use
- **Cross-Platform**: Works on iOS and Android devices

## How to Use

1. **Open the App**: Navigate to the website on your smartphone's browser
2. **Grant Permissions**: Allow access to device motion sensors when prompted (especially on iOS)
3. **Secure Phone**: Place phone in chest pocket or secure to torso with strap/harness
4. **Start Recording**: Tap the "Start Recording" button just before beginning your delivery
5. **Perform Your Delivery**: Execute your complete curling delivery and slide
6. **Stop Recording**: Tap "Stop Recording" after coming to rest
7. **View Analysis**: Examine the charts and analysis metrics for your slide technique
8. **Clear Data**: Use the "Clear Data" button to reset and record a new delivery

## Technical Requirements

- **Modern Web Browser**: Chrome, Safari, Firefox, or Edge
- **HTTPS Connection**: Required for sensor access (use a secure hosting service)
- **Device Sensors**: Accelerometer and gyroscope (available on most modern smartphones)
- **Permissions**: Device motion access must be granted

## File Structure

```
peel_weight/
├── index.html          # Main recording page
├── comparison.html     # Training session analysis page
├── styles.css          # Main CSS styling and responsive design
├── comparison.css      # Additional CSS for comparison page
├── script.js           # Main application logic for recording
├── comparison.js       # Session analysis and comparison logic
├── analytics.js        # Lightweight usage tracking
└── README.md           # This documentation file
```

## Sensor Data Collected

### Accelerometer (Torso-Mounted)
- **X-axis**: Forward-backward movement (push-off force, slide deceleration, drag)
- **Y-axis**: Side-to-side movement (lateral wobble, weight shifts)
- **Z-axis**: Up-down movement (bounce, toe dragging events)
- **Units**: meters per second squared (m/s²)

### Gyroscope (Body Stability)
- **Pitch**: Forward-backward tilt (weight transfer, toe dragging detection)
- **Roll**: Side-to-side tilt (balance stability, lateral wobble)
- **Yaw**: Torso rotation (hip alignment, body twist)
- **Units**: degrees per second (°/s)

## Analysis Metrics

- **Push-off Strength**: Peak forward acceleration during initial drive phase
- **Peak Velocity**: Maximum slide speed achieved during delivery
- **Slide Duration**: Total time from start to end of delivery
- **Deceleration Rate**: Rate of speed loss due to drag/friction
- **Stability Score**: Body control metric based on pitch/roll consistency (0-100%)
- **Glide Efficiency**: Qualitative assessment (Excellent, Very Good, Good, Poor)

## Installation & Deployment

### Local Development
1. Clone or download the files to a local directory
2. Serve the files using a local HTTPS server (required for sensor access)
3. Access via `https://localhost:PORT` on your mobile device

### Hosting Options
- **GitHub Pages**: Enable HTTPS by default
- **Netlify**: Free hosting with automatic HTTPS
- **Vercel**: Simple deployment with HTTPS
- **Firebase Hosting**: Google's hosting platform

### Example Local Server (Python)
```bash
# Python 3
python -m http.server 8000

# For HTTPS (recommended)
python -m ssl_server 8000
```

## Browser Compatibility

- ✅ **iOS Safari** (iOS 13+): Requires permission prompt
- ✅ **Chrome Mobile**: Full support
- ✅ **Firefox Mobile**: Full support
- ✅ **Samsung Internet**: Full support
- ⚠️ **Older Browsers**: May have limited sensor support

## Privacy & Security

- **No Data Collection**: All sensor data stays on your device
- **No External Requests**: App works completely offline after loading
- **Local Processing**: All analysis performed locally in the browser
- **Temporary Storage**: Data is cleared when you refresh the page

## Troubleshooting

### Sensors Not Working
- Ensure you're using HTTPS (required for sensor access)
- Grant permission when prompted
- Try refreshing the page and granting permission again
- Check that your device has the required sensors

### Permission Issues on iOS
- Go to Settings > Safari > Motion & Orientation Access
- Enable for the website domain
- Refresh the page and try again

### Poor Data Quality
- Secure the phone more firmly to your torso during delivery
- Ensure the phone is properly oriented (screen facing up/out)
- Try recording a longer delivery for better analysis
- Check that sensor placement is consistent between recordings

## Future Enhancements

- Data export functionality (CSV, JSON)
- Comparison between multiple deliveries
- Advanced biomechanics analytics and coaching insights
- Integration with video analysis
- Team/club performance tracking
- Ice condition correlation analysis

## Contributing

Feel free to submit issues and enhancement requests. Pull requests are welcome for bug fixes and new features.

## License

This project is open source and available under the MIT License.