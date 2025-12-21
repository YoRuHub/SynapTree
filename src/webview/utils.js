import { vscode } from './vscode-api.js';
import { DEBUG } from './constants.js';

const I18N = window.I18N || {};

export function log(msg) {
    if (DEBUG) {
        console.log('WebView:', msg);
        vscode.postMessage({ command: 'log', text: msg });
    }
}

export function t(key, def) {
    return I18N[key] || def || key;
}
