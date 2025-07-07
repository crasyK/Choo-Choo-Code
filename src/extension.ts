import * as vscode from 'vscode';
import { createClient } from 'db-vendo-client';
import { profile as dbnavProfile } from 'db-vendo-client/p/dbnav/index.js';

// --- Types and Configuration ---
type ChooChooConfig = {
    train?: string;
    from?: string;
    poll: number;
    notify?: boolean;
};

let timer: NodeJS.Timeout | undefined;
let lastState = '';

// --- Main Activation Function ---
export function activate(context: vscode.ExtensionContext) {
    // --- Core Components ---
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.tooltip = 'Choo-Choo-Code Journey Status';
    context.subscriptions.push(item);

    // Create the db-vendo-client with the correct syntax
    const client = createClient(dbnavProfile, 'choo-choo-code-vscode-extension');

    // --- Helper Functions ---
    function loadConfig(): ChooChooConfig {
        const cfg = vscode.workspace.getConfiguration('choochoo');
        return {
            train: cfg.get<string>('trainNumber'),
            from: cfg.get<string>('origin'),
            poll: cfg.get<number>('pollIntervalSec', 60) * 1000,
            notify: cfg.get<boolean>('notify')
        };
    }

    async function resolveStationId(term: string): Promise<string> {
        try {
            const res = await client.locations(term, { results: 1 });
            if (!res?.length || !res[0].id) {
                throw new Error(`Station "${term}" not found`);
            }
            return res[0].id; // EVA ID
        } catch (e) {
            throw new Error(`Could not find station: ${term}`);
        }
    }

    async function updateStatus() {
        const cfg = loadConfig();
        if (!cfg.train || !cfg.from) {
            item.text = '$(gear) Set Choo-Choo-Code';
            item.tooltip = 'Please set your journey details in the settings.';
            item.command = 'workbench.action.openSettings';
            item.show();
            return;
        }

        // Give visual feedback that an update is in progress
        item.text = `$(sync~spin) Checking ${cfg.train}...`;
        item.show();

        try {
            const fromId = await resolveStationId(cfg.from);
            // Extended duration to 6 hours for long train rides
            const response = await client.departures(fromId, { duration: 360 }) as any;
            
            // Handle different possible response structures
            let depBoard: any[] = [];
            
            if (Array.isArray(response)) {
                depBoard = response;
            } else if (response && (response as any).departures && Array.isArray((response as any).departures)) {
                depBoard = (response as any).departures;
            } else if (response && Array.isArray((response as any).results)) {
                depBoard = (response as any).results;
            } else {
                throw new Error('Unexpected response format from departures API');
            }

            if (!depBoard || depBoard.length === 0) {
                item.text = `$(zap) No departures`;
                item.tooltip = `No departures found for ${cfg.from}.`;
                item.backgroundColor = undefined;
                item.show();
                return;
            }

            const row = depBoard.find((b: any) => b.line?.name?.includes(cfg.train!));
            
            if (!row) {
                item.text = `$(zap) ${cfg.train}?`;
                item.tooltip = `Train ${cfg.train} not found on departure board for ${cfg.from}.`;
                item.backgroundColor = undefined;
                item.show();
                return;
            }

            // Convert delay from seconds to minutes (HAFAS APIs return delay in seconds)
            const delaySeconds = row.delay || 0;
            const delay = Math.round(delaySeconds / 60); // Convert seconds to minutes
            const cancelled = row.cancelled;

            // Format departure time if available
            let departureTime = '';
            if (row.when) {
                const depTime = new Date(row.when);
                departureTime = depTime.toLocaleTimeString('de-DE', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }

            // Create status text with departure time + delay
            let statusText = '';
            let state = '';

            if (cancelled) {
                statusText = '$(error) Cancelled';
                state = 'cancelled';
            } else if (delay === 0) {
                statusText = departureTime ? `$(check) ${departureTime}` : '$(check) On time';
                state = 'on-time';
            } else {
                statusText = departureTime ? 
                    `$(clock) ${departureTime} +${delay}min` : 
                    `$(clock) +${delay} min`;
                state = `+${delay} min`;
            }

            // Update status bar text, color, and icon based on status
            item.text = statusText;

            if (cancelled) {
                item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (delay === 0) {
                item.backgroundColor = undefined;
            } else {
                item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }

            item.tooltip = `Train: ${cfg.train}\nFrom: ${cfg.from}\nTo: ${row.direction}\nStatus: ${state}`;
            item.show();

            // Send a notification if the status has changed since the last check
            if (cfg.notify && state !== lastState && lastState !== '') {
                vscode.window.showInformationMessage(`Train ${cfg.train} is now ${state}.`);
            }

            lastState = state;

        } catch (e: any) {
            item.text = '$(warning) API Error';
            item.tooltip = `Error fetching train data: ${e.message}`;
            item.backgroundColor = undefined;
            item.show();
            console.error(`Choo-Choo-Code Error: ${e}`);
        }
    }

    function restartPolling() {
        if (timer) {
            clearInterval(timer);
        }
        const cfg = loadConfig();
        if (cfg.train && cfg.from) {
            updateStatus();
            timer = setInterval(updateStatus, cfg.poll);
        } else {
            updateStatus();
        }
    }

    // --- COMMAND REGISTRATION ---
    const changeTrainCommand = vscode.commands.registerCommand('choochoo.changeTrain', async () => {
        const cfg = loadConfig();
        
        // Get current values for defaults
        const currentTrain = cfg.train || '';
        const currentStation = cfg.from || '';

        // Ask for train number
        const trainNumber = await vscode.window.showInputBox({
            prompt: 'Enter train number (e.g., ICE 76, RE 1)',
            value: currentTrain,
            placeHolder: 'ICE 76'
        });

        if (!trainNumber) {
            return; // User cancelled
        }

        // Ask for station
        const station = await vscode.window.showInputBox({
            prompt: 'Enter station name (e.g., Berlin Hbf, München Hbf)',
            value: currentStation,
            placeHolder: 'Berlin Hbf'
        });

        if (!station) {
            return; // User cancelled
        }

        // Update configuration
        const config = vscode.workspace.getConfiguration('choochoo');
        await config.update('trainNumber', trainNumber, vscode.ConfigurationTarget.Global);
        await config.update('origin', station, vscode.ConfigurationTarget.Global);

        // Show success message and restart polling
        vscode.window.showInformationMessage(`Now tracking ${trainNumber} from ${station}`);
        lastState = ''; // Reset state to trigger notification on next update
        restartPolling();
    });

    context.subscriptions.push(changeTrainCommand);

    // --- EVENT LISTENERS AND INITIAL START ---
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('choochoo')) {
            lastState = '';
            restartPolling();
        }
    });

    context.subscriptions.push(configListener);

    context.subscriptions.push({
        dispose: () => {
            if (timer) {
                clearInterval(timer);
            }
        }
    });

    // Initial start
    restartPolling();
}

export function deactivate() {
    if (timer) {
        clearInterval(timer);
    }
}
