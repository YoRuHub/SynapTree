import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    // 1. Panel Command
    let disposable = vscode.commands.registerCommand('synaptree.visualize', () => {
        SynapTreePanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(disposable);

    // 2. Sidebar View
    const provider = new SynapTreeViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SynapTreeViewProvider.viewType, provider)
    );
}

/**
 * Sidebar View Provider
 */
class SynapTreeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'synaptree-view';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'openFile':
                    if (message.path) {
                        vscode.window.showTextDocument(vscode.Uri.file(message.path));
                    }
                    break;
                case 'refresh':
                    this._updateData();
                    break;
            }
        });

        // Initial Data
        this._updateData();

        // Watch for workspace changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        watcher.onDidCreate(() => this._updateData());
        watcher.onDidChange(() => this._updateData());
        watcher.onDidDelete(() => this._updateData());
    }

    private _updateData() {
        if (!this._view) { return; }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const data = this._getWorkspaceData(workspaceFolders[0].uri.fsPath);
            this._view.webview.postMessage({ command: 'setData', data });
        }
    }

    private _getWorkspaceData(rootPath: string) {
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
                    val: isDir ? 5 : 2
                });

                if (parentId) {
                    links.push({ source: parentId, target: id });
                }

                if (isDir) {
                    if (name === 'node_modules' || name === '.git') { return; }
                    const files = fs.readdirSync(currentPath);
                    files.forEach(file => traverse(path.join(currentPath, file), id));
                }
            } catch (err) { console.error(err); }
        }

        traverse(rootPath);
        return { nodes, links };
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'main.js'));
        const htmlUri = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'index.html');
        let html = fs.readFileSync(htmlUri.fsPath, 'utf8');
        return html.replace('${scriptUri}', scriptUri.toString());
    }
}

/**
 * Standalone Panel (for the command)
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

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'openFile' && message.path) {
                vscode.window.showTextDocument(vscode.Uri.file(message.path));
            }
        }, null, this._disposables);
    }

    public dispose() {
        SynapTreePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        this._updateData();
    }

    private _updateData() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const data = this._getWorkspaceData(workspaceFolders[0].uri.fsPath);
            this._panel.webview.postMessage({ command: 'setData', data });
        }
    }

    private _getWorkspaceData(rootPath: string) {
        // Reuse logic or shared util if this was a larger project
        const nodes: any[] = [];
        const links: any[] = [];
        function traverse(currentPath: string, parentId?: string) {
            try {
                const stats = fs.statSync(currentPath);
                const isDir = stats.isDirectory();
                const node = { id: currentPath, name: path.basename(currentPath), path: currentPath, type: isDir ? 'directory' : 'file', val: isDir ? 5 : 2 };
                nodes.push(node);
                if (parentId) links.push({ source: parentId, target: currentPath });
                if (isDir && !['node_modules', '.git'].includes(path.basename(currentPath))) {
                    fs.readdirSync(currentPath).forEach(f => traverse(path.join(currentPath, f), currentPath));
                }
            } catch { }
        }
        traverse(rootPath);
        return { nodes, links };
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'main.js'));
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'index.html');
        return fs.readFileSync(htmlPath, 'utf8').replace('${scriptUri}', scriptUri.toString());
    }
}
