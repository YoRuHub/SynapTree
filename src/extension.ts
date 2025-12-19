import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    // 1. Sidebar View
    const provider = new SynapTreeViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SynapTreeViewProvider.viewType, provider)
    );

    // 2. Panel Command
    context.subscriptions.push(
        vscode.commands.registerCommand('synaptree.visualize', () => {
            SynapTreePanel.createOrShow(context.extensionUri);
        })
    );
}

/**
 * Shared Data Provider Logic
 */
function getWorkspaceData(rootPath: string) {
    const nodes: any[] = [];
    const links: any[] = [];

    function traverse(currentPath: string, parentId?: string) {
        try {
            const stats = fs.statSync(currentPath);
            const isDir = stats.isDirectory();
            const name = path.basename(currentPath);
            const id = currentPath;

            nodes.push({
                id,
                name,
                path: currentPath,
                type: isDir ? 'directory' : 'file',
                val: isDir ? 6 : 3 // Visual weight
            });

            if (parentId) {
                links.push({ source: parentId, target: id });
            }

            if (isDir) {
                // Ignore common noise
                if (['node_modules', '.git', 'out', 'dist', '.vscode-test'].includes(name)) { return; }

                const files = fs.readdirSync(currentPath);
                files.forEach(file => traverse(path.join(currentPath, file), id));
            }
        } catch (err) { console.error(err); }
    }

    traverse(rootPath);
    return { nodes, links };
}

function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'main.js'));
    const htmlUri = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'index.html');
    const cspSource = webview.cspSource;

    let html = fs.readFileSync(htmlUri.fsPath, 'utf8');

    console.log('SynapTree: Replacing scriptUri with', scriptUri.toString());
    html = html.replace(/\${scriptUri}/g, scriptUri.toString());
    html = html.replace(/\${cspSource}/g, cspSource);

    if (html.includes('${scriptUri}')) {
        console.error('SynapTree: Failed to replace ${scriptUri} in HTML');
    }

    return html;
}

/**
 * Sidebar View Provider
 */
class SynapTreeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'synaptree-view';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')]
        };

        webviewView.webview.html = getHtmlForWebview(webviewView.webview, this._extensionUri);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'ready':
                case 'refresh':
                    this._updateData();
                    break;
                case 'openFile':
                    if (message.path) {
                        vscode.window.showTextDocument(vscode.Uri.file(message.path));
                    }
                    break;
            }
        });

        // Watchers
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        watcher.onDidCreate(() => this._updateData());
        watcher.onDidChange(() => this._updateData());
        watcher.onDidDelete(() => this._updateData());
    }

    private _updateData() {
        if (!this._view) return;
        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            console.log('SynapTree: Sending data to Sidebar');
            const data = getWorkspaceData(folders[0].uri.fsPath);
            this._view.webview.postMessage({ command: 'setData', data });
        } else {
            console.log('SynapTree: No workspace folders found for Sidebar');
            this._view.webview.postMessage({ command: 'setData', data: { nodes: [], links: [] } });
        }
    }
}

/**
 * Standalone Panel
 */
class SynapTreePanel {
    public static currentPanel: SynapTreePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        if (SynapTreePanel.currentPanel) {
            SynapTreePanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }
        const panel = vscode.window.createWebviewPanel('synapTree', 'SynapTree 3D', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
        });
        SynapTreePanel.currentPanel = new SynapTreePanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.webview.html = getHtmlForWebview(this._panel.webview, this._extensionUri);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'ready':
                case 'refresh':
                    this._updateData();
                    break;
                case 'openFile':
                    if (message.path) {
                        vscode.window.showTextDocument(vscode.Uri.file(message.path));
                    }
                    break;
            }
        }, null, this._disposables);
    }

    public dispose() {
        SynapTreePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    private _updateData() {
        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            console.log('SynapTree: Sending data to Panel');
            const data = getWorkspaceData(folders[0].uri.fsPath);
            this._panel.webview.postMessage({ command: 'setData', data });
        } else {
            console.log('SynapTree: No workspace folders found for Panel');
            this._panel.webview.postMessage({ command: 'setData', data: { nodes: [], links: [] } });
        }
    }
}
