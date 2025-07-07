# Choo-Choo-Code 🚂

Real-time Deutsche Bahn delay alerts directly in your VS Code status bar.

## Features

- **Real-time tracking**: Monitor your train's departure time and delays
- **Status bar integration**: See departure times and delays at a glance
- **Smart notifications**: Get notified when your train's status changes
- **Quick train switching**: Change trains instantly with the command palette
- **Extended coverage**: Tracks trains up to 6 hours in advance

## How to Use

1. **Install the extension**
2. **Configure your train**:
   - Open VS Code settings (`Ctrl+,`)
   - Search for "Choo-Choo-Code"
   - Set your train number (e.g., "ICE 76")
   - Set your departure station (e.g., "Berlin Hbf")

3. **Quick switching**:
   - Press `Ctrl+Shift+P`
   - Type "Choo-Choo-Code: Change Train"
   - Enter new train and station

## Status Bar Display

- `✓ 14:35` - Train on time
- `🕐 14:35 +3min` - Train delayed by 3 minutes
- `❌ Cancelled` - Train cancelled

## Requirements

- Internet connection for real-time data
- VS Code 1.90.0 or higher

## Extension Settings

- `choochoo.trainNumber`: Train number to track
- `choochoo.origin`: Departure station name
- `choochoo.pollIntervalSec`: Update interval (default: 60 seconds)
- `choochoo.notify`: Enable/disable notifications

## Release Notes

### 1.0.0

Initial release of Choo-Choo-Code
- Real-time Deutsche Bahn delay tracking
- Status bar integration
- Quick train switching
- Departure time + delay display

## License

MIT
