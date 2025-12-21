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




        const translations = {
            'Focus': vscode.l10n.t('Focus'),
            'Set as Root': vscode.l10n.t('Set as Root'),
            'Reset Root': vscode.l10n.t('Reset Root'),
            'New Folder': vscode.l10n.t('New Folder'),
            'New File': vscode.l10n.t('New File'),
            'Rename': vscode.l10n.t('Rename'),
            'Delete': vscode.l10n.t('Delete'),
            'Search structures...': vscode.l10n.t('Search structures...')
        };

        this._panel.webview.html = getHtmlForWebview(this._panel.webview, this._extensionUri, translations);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                try {
                    if (message.command === 'log') {
                        return;
                    }


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
                    this._outputChannel.appendLine(`Error in Panel message handler: ${err}`);
                }
            },
            null,
            this._disposables
        );

    }

    public search(query: string) {
        if (this._panel) {
            this._panel.webview.postMessage({ command: 'search', query });
        }
    }

    public toggleLabels() {
        if (this._panel) {
            this._panel.webview.postMessage({ command: 'toggleLabels' });
        }
    }

    public async refresh() {
        try {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                const data = await getWorkspaceData(folders[0].uri.fsPath, this._outputChannel);
                this._panel.webview.postMessage({ command: 'setData', data });
            } else {
                this._outputChannel.appendLine('Panel Refresh: No workspace folders found');
            }
        } catch (err) {
            this._outputChannel.appendLine(`Panel Refresh Error: ${err}`);
        }
    }

    public notifyFileChange(uri: string, gitStatus: string | undefined) {
        if (this._panel) {
            this._panel.webview.postMessage({
                command: 'updateNodeStatus',
                id: uri,
                gitStatus: gitStatus
            });
        }
    }

    public notifyFileChanges(changes: Map<string, string | undefined>) {
        if (this._panel && changes.size > 0) {
            const changesObj: Record<string, string | undefined> = {};
            changes.forEach((v, k) => { changesObj[k] = v; });

            this._panel.webview.postMessage({
                command: 'updateNodeStatusBatch',
                changes: changesObj
            });
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
