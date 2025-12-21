import * as vscode from 'vscode';
import { getWorkspaceData } from './dataRegistry';
import { getHtmlForWebview } from './webviewUtils';

export class SynapTreeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'synaptree-view';
    private _view?: vscode.WebviewView;
    private _currentRootPath?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _outputChannel: vscode.OutputChannel
    ) { }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')]
        };


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

        webviewView.webview.html = getHtmlForWebview(webviewView.webview, this._extensionUri, translations);

        // Auto-refresh logic (Safety fallback)
        setTimeout(() => {
            this.refresh();
        }, 500);

        // Auto-Focus on File Switch
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && this._view) {
                const config = vscode.workspace.getConfiguration('synaptree');
                if (config.get('general.autoFocus')) {
                    const filePath = editor.document.uri.fsPath;
                    this._view.webview.postMessage({ command: 'focusNode', id: filePath });
                }
            }
        });

        webviewView.webview.onDidReceiveMessage(message => {
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
                    case 'nodeAction':
                        this.handleNodeAction(message);
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

    public toggleLabels() {
        if (this._view) {
            this._view.webview.postMessage({ command: 'toggleLabels' });
        }
    }

    public async refresh(focusTargetId?: string) {
        if (!this._view) {
            return;
        }
        try {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                const rootPath = this._currentRootPath || folders[0].uri.fsPath;

                const data = await getWorkspaceData(rootPath, this._outputChannel);

                this._view.webview.postMessage({
                    command: 'setData',
                    data,
                    focusTargetId,
                    isCustomRoot: !!this._currentRootPath
                });
            } else {
                this._outputChannel.appendLine('Refresh: No workspace folders found');
            }
        } catch (err) {
            this._outputChannel.appendLine(`Refresh: Critical Error - ${err}`);
        }
    }
    public notifyFileChange(uri: string, gitStatus: string | undefined) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateNodeStatus',
                id: uri,
                gitStatus: gitStatus
            });
        }
    }

    public notifyFileChanges(changes: Map<string, string | undefined>) {
        if (this._view && changes.size > 0) {
            // Convert Map to Object for JSON serialization
            const changesObj: Record<string, string | undefined> = {};
            changes.forEach((v, k) => { changesObj[k] = v; });

            this._view.webview.postMessage({
                command: 'updateNodeStatusBatch',
                changes: changesObj
            });
        }
    }

    private async handleNodeAction(message: any) {
        const { action, path } = message;
        if (!path) return;

        const uri = vscode.Uri.file(path);

        try {
            switch (action) {
                case 'open':
                    vscode.window.showTextDocument(uri);
                    break;

                case 'setRoot': {
                    this._currentRootPath = path;
                    this.refresh();
                    break;
                }

                case 'resetRoot': {
                    this._currentRootPath = undefined;
                    this.refresh();
                    break;
                }

                case 'createFolder': {
                    const name = await vscode.window.showInputBox({ prompt: 'New Folder Name' });
                    if (name) {
                        const newUri = vscode.Uri.joinPath(uri, name);
                        await vscode.workspace.fs.createDirectory(newUri);
                        setTimeout(() => this.refresh(newUri.fsPath), 500);
                    }
                    break;
                }

                case 'createFile': {
                    const name = await vscode.window.showInputBox({ prompt: 'New File Name' });
                    if (name) {
                        const newUri = vscode.Uri.joinPath(uri, name);
                        await vscode.workspace.fs.writeFile(newUri, new Uint8Array());
                        vscode.window.showTextDocument(newUri);
                        setTimeout(() => this.refresh(newUri.fsPath), 500);
                    }
                    break;
                }

                case 'rename': {
                    const oldName = uri.path.split('/').pop() || '';
                    const newName = await vscode.window.showInputBox({ value: oldName, prompt: 'Rename to' });
                    if (newName && newName !== oldName) {
                        const parent = vscode.Uri.file(path.substring(0, path.lastIndexOf('/')));
                        const newUri = vscode.Uri.joinPath(parent, newName);
                        await vscode.workspace.fs.rename(uri, newUri);
                        setTimeout(() => this.refresh(newUri.fsPath), 500);
                    }
                    break;
                }

                case 'delete': {
                    const confirm = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete '${uri.path.split('/').pop()}'?`,
                        { modal: true },
                        'Delete'
                    );
                    if (confirm === 'Delete') {
                        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
                        // Focus parent after delete (only if not root, otherwise refresh current root)
                        setTimeout(() => this.refresh(), 500);
                        return;
                    }
                    break;
                }
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Action failed: ${err.message}`);
        }
    }
}

