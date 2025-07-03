import * as vscode from 'vscode';
import fetch from 'node-fetch';
import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// A global variable for our status bar item
let statusBarItem: vscode.StatusBarItem;

/**
 * This is the main function that gets called when your extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
    // Create the status bar item with a higher priority (shows more to the left)
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);

    // Register the command that will be called from the Command Palette
    const commandId = 'gtfs-realtime-vscode.getTripDelay';
    const commandHandler = async () => {
        vscode.window.showInformationMessage('Fetching latest trip delay...');
        await updateTripDelay();
    };
    context.subscriptions.push(vscode.commands.registerCommand(commandId, commandHandler));

    // Set an interval to automatically update the delay every 30 seconds
    setInterval(async () => {
        await updateTripDelay();
    }, 30000);

    // Run the update function once at the start
    updateTripDelay();
}

/**
 * Fetches data from the GTFS-RT feed, finds the trip, and updates the status bar.
 */
async function updateTripDelay() {
    // Get the user's configuration from settings
    const config = vscode.workspace.getConfiguration('gtfs-realtime-vscode');
    const feedUrl = config.get<string>('feedUrl');
    const tripId = config.get<string>('tripId');

    // Stop if the configuration is missing
    if (!feedUrl || !tripId) {
        statusBarItem.text = 'GTFS: Config Missing';
        statusBarItem.tooltip = 'Please set the GTFS Feed URL and Trip ID in your VS Code settings.';
        statusBarItem.show();
        return;
    }

    try {
        // Fetch the GTFS-realtime data
        const response = await fetch(feedUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();

        // Decode the Protocol Buffer message
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

        let tripFound = false;
        // Loop through the feed entities to find our trip
        for (const entity of feed.entity) {
            // Check if the entity is a trip update and if the trip ID matches
            if (entity.tripUpdate?.trip.tripId === tripId) {
                const tripUpdate = entity.tripUpdate;

                // Handle CANCELED trips first
                if (tripUpdate.trip.scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.CANCELED) {
                    statusBarItem.text = `🚆 Trip ${tripId}: CANCELLED`;
                    statusBarItem.tooltip = `Trip ${tripId} has been cancelled.`;
                    tripFound = true;
                    break;
                }

                // Find the first stop update to get the delay
                const firstStopUpdate = tripUpdate.stopTimeUpdate?.[0];
                const delayInSeconds = firstStopUpdate?.departure?.delay ?? firstStopUpdate?.arrival?.delay;

                if (delayInSeconds !== null && delayInSeconds !== undefined) {
                    const delayInMinutes = Math.round(delayInSeconds / 60);
                    if (delayInMinutes > 0) {
                        statusBarItem.text = `🚆 ${delayInMinutes} min late`;
                        statusBarItem.tooltip = `Trip ${tripId} is running ${delayInMinutes} minutes late.`;
                    } else if (delayInMinutes < 0) {
                        statusBarItem.text = `🚆 ${-delayInMinutes} min early`;
                        statusBarItem.tooltip = `Trip ${tripId} is running ${-delayInMinutes} minutes early.`;
                    } else {
                        statusBarItem.text = '🚆 On Time';
                        statusBarItem.tooltip = `Trip ${tripId} is on time.`;
                    }
                } else {
                    // Trip was found, but no delay info is available in the first stop update
                    statusBarItem.text = '🚆 On Time';
                    statusBarItem.tooltip = `Trip ${tripId} is running as scheduled.`;
                }
                
                tripFound = true;
                break; // Exit loop once trip is found
            }
        }

        if (!tripFound) {
            statusBarItem.text = '🚆 Trip not found';
            statusBarItem.tooltip = `Trip ID '${tripId}' was not found in the live feed. It may have already finished or not started yet.`;
        }

    } catch (error) {
        console.error('Failed to update trip delay:', error);
        statusBarItem.text = '🚆 GTFS Error';
        statusBarItem.tooltip = 'Could not fetch or parse the GTFS-RT feed. Check the URL and your connection.';
    }
    
    // Make sure the status bar item is visible
    statusBarItem.show();
}

/**
 * This function is called when your extension is deactivated.
 */
export function deactivate() {}
