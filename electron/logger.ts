import { BrowserWindow } from 'electron';

const logBuffer: { timestamp: string, type: 'info' | 'error', message: string }[] = [];
const MAX_LOGS = 1000;

export function addToLog(type: 'info' | 'error', ...args: any[]) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    
    const newLog = {
        timestamp: new Date().toISOString(),
        type,
        message
    };
    
    logBuffer.push(newLog);
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();

    // Broadcast the new log to all open windows
    BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
            w.webContents.send('new-log-entry', newLog);
        }
    });
}

export function getLogs() {
    return logBuffer;
}

export function clearLogs() {
    logBuffer.length = 0;
}
