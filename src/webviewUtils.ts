import * as vscode from 'vscode';
import * as fs from 'fs';

export function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, translations: Record<string, string> = {}): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'main.js'));
    const htmlUri = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'index.html');
    const cspSource = webview.cspSource;
    const i18nScript = `<script>window.I18N = ${JSON.stringify(translations)};</script>`;

    try {
        let html = fs.readFileSync(htmlUri.fsPath, 'utf8');
        return html
            .replace(/\${scriptUri}/g, scriptUri.toString())
            .replace(/\${cspSource}/g, cspSource)
            .replace('<!-- I18N -->', i18nScript) // Fallback or strict injection point
            .replace('</body>', `${i18nScript}</body>`); // Inject before body end for safety if placeholder missing
    } catch (err) {
        return `<html><body><h1>Error loading Webview HTML</h1><p>${err}</p></body></html>`;
    }
}
