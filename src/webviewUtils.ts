import * as vscode from 'vscode';
import * as fs from 'fs';

export function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'main.js'));
    const htmlUri = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'index.html');
    const cspSource = webview.cspSource;

    try {
        let html = fs.readFileSync(htmlUri.fsPath, 'utf8');
        return html
            .replace(/\${scriptUri}/g, scriptUri.toString())
            .replace(/\${cspSource}/g, cspSource);
    } catch (err) {
        return `<html><body><h1>Error loading Webview HTML</h1><p>${err}</p></body></html>`;
    }
}
