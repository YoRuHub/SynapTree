import * as vscode from 'vscode';
import { getWorkspaceData } from './dataRegistry';
import { getHtmlForWebview } from './webviewUtils';

export class SynapTreePanel {
    public static currentPanel: SynapTreePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _outputChannel: vscode.OutputChannel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SynapTreePanel.currentPanel) {
            SynapTreePanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'synapTree',
            'SynapTree 3D',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
            }
        );

        SynapTreePanel.currentPanel = new SynapTreePanel(panel, extensionUri, outputChannel);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._outputChannel = outputChannel;

        this._outputChannel.appendLine('Panel created...');
        this._panel.webview.html = getHtmlForWebview(this._panel.webview, this._extensionUri);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                try {
                    this._outputChannel.appendLine(`Panel received: ${message.command}`);
                    switch (message.command) {
                        case 'ready':
                            this.refresh();
                            break;
                        case 'openFile':
                            if (message.path) {
                                vscode.window.showTextDocument(vscode.Uri.file(message.path));
                            }
                            break;
                    }
                } catch (err) {
                    this._outputChannel.appendLine(`Error in Panel message handler: ${err}`);
                }
            },
            null,
            this._disposables
        );
    }

    public refresh() {
        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            const data = getWorkspaceData(folders[0].uri.fsPath, this._outputChannel);
            this._panel.webview.postMessage({ command: 'setData', data });
        }
    }

    public dispose() {
        SynapTreePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
