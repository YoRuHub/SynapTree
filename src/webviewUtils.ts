import * as vscode from 'vscode';
import * as fs from 'fs';

export function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, translations: Record<string, string> = {}): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'main.js'));
    const iconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'icons'));
    const htmlUri = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'index.html');
    const cspSource = webview.cspSource;
    const i18nScript = `<script>window.I18N = ${JSON.stringify(translations)};</script>`;
    const configScript = `<script>window.synapTreeConfig = { iconsUri: "${iconsUri.toString()}" };</script>`;

    try {
        let html = fs.readFileSync(htmlUri.fsPath, 'utf8');
        // Inject Config and I18N BEFORE main script runs. 
        // Although module is deferred, putting it in head or before script tag is safer.
        // We replace <!-- CONFIG --> if exists, or prepend to head/body.
        // Let's inject it before </head> to be safe globally.
        if (html.includes('</head>')) {
            html = html.replace('</head>', `${configScript}${i18nScript}</head>`);
        } else {
            html = html.replace('</body>', `${configScript}${i18nScript}</body>`);
        }
        
        return html
            .replace(/\${scriptUri}/g, scriptUri.toString())
            .replace(/\${cspSource}/g, cspSource);
    } catch (err) {
        return `<html><body><h1>Error loading Webview HTML</h1><p>${err}</p></body></html>`;
    }
}
