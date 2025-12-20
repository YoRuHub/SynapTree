import * as vscode from 'vscode';
import { getWorkspaceData } from './dataRegistry';
import { getHtmlForWebview } from './webviewUtils';

export class SynapTreeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'synaptree-view';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _outputChannel: vscode.OutputChannel
    ) { }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        this._outputChannel.appendLine('Sidebar View resolving...');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')]
        };

        webviewView.webview.html = getHtmlForWebview(webviewView.webview, this._extensionUri);

        webviewView.webview.onDidReceiveMessage(message => {
            try {
                if (message.command === 'log') {
                    this._outputChannel.appendLine(`[WebView Log] ${message.text}`);
                    return;
                }

                this._outputChannel.appendLine(`Sidebar received: ${message.command}`);
                switch (message.command) {
                    case 'ready':
                        this.refresh();
                        break;
                    case 'openFile':
                        if (message.path) {
                            vscode.window.showTextDocument(vscode.Uri.file(message.path));
                        }
                        break;
                        break;
                }
            } catch (err) {
                this._outputChannel.appendLine(`Error in Sidebar message handler: ${err}`);
            }
        });
    }

    public search(query: string) {
        if (this._view) {
            this._view.webview.postMessage({ command: 'search', query });
        }
    }

    public refresh() {
        if (!this._view) {
            this._outputChannel.appendLine('Refresh: View is not ready yet');
            return;
        }
        try {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                this._outputChannel.appendLine(`Refresh: Fetching data for ${folders[0].uri.fsPath}`);
                const data = getWorkspaceData(folders[0].uri.fsPath, this._outputChannel);
                this._view.webview.postMessage({ command: 'setData', data });
                this._outputChannel.appendLine(`Refresh: Data sent (${data.nodes.length} nodes)`);
            } else {
                this._outputChannel.appendLine('Refresh: No workspace folders found');
            }
        } catch (err) {
            this._outputChannel.appendLine(`Refresh: Critical Error - ${err}`);
        }
    }

}
