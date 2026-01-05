import * as vscode from 'vscode';
import { SynapTreeViewProvider } from './SynapTreeViewProvider';
import { SynapTreePanel } from './SynapTreePanel';
import { ChangeProcessor } from './services/ChangeProcessor';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('SynapTree');
    outputChannel.show(true);
    outputChannel.appendLine('SynapTree Activated (Modular Architecture)');

    // 1. Register Sidebar Provider
    const sidebarProvider = new SynapTreeViewProvider(context.extensionUri, outputChannel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SynapTreeViewProvider.viewType, sidebarProvider)
    );

    // Placeholder for Git Refresh function
    let triggerGitBroadcast = () => { };

    // 2. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('synaptree.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'synaptree');
        }),
        vscode.commands.registerCommand('synaptree.visualize', () => {
            SynapTreePanel.createOrShow(context.extensionUri, outputChannel);
        }),
        vscode.commands.registerCommand('synaptree.refresh', () => {
            sidebarProvider.refresh();
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.refresh();
            }
            outputChannel.appendLine('Workspace Refresh Triggered');

            // Re-broadcast Git Status after a slight delay to allow graph to reload
            setTimeout(() => {
                triggerGitBroadcast();
            }, 2000);
        }),
        vscode.commands.registerCommand('synaptree.search', () => {
            sidebarProvider.search('');
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.search('');
            }
        }),
        vscode.commands.registerCommand('synaptree.hideLabels', () => {
            // Set context to false (switch to "Show" icon)
            vscode.commands.executeCommand('setContext', 'synaptree:labelsVisible', false);
            // setLabels(false)
            sidebarProvider.setLabels(false);
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.setLabels(false);
            }
        }),
        vscode.commands.registerCommand('synaptree.showLabels', () => {
            // Set context to true (switch to "Hide" icon)
            vscode.commands.executeCommand('setContext', 'synaptree:labelsVisible', true);
            // setLabels(true)
            sidebarProvider.setLabels(true);
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.setLabels(true);
            }
        }),
        vscode.commands.registerCommand('synaptree.setRoot', (uri: vscode.Uri) => {
            if (uri) {
                // Update Sidebar
                sidebarProvider.setRoot(uri);

                // If Panel is open, update it too, but do NOT force open it
                if (SynapTreePanel.currentPanel) {
                    SynapTreePanel.currentPanel.setRoot(uri);
                }
            } else {
                vscode.window.showErrorMessage('Please use this command from the Explorer context menu.');
            }
        }),
        vscode.commands.registerCommand('synaptree.setRootInPanel', (uri: vscode.Uri) => {
            if (uri) {
                SynapTreePanel.createOrShow(context.extensionUri, outputChannel);
                if (SynapTreePanel.currentPanel) {
                    SynapTreePanel.currentPanel.setRoot(uri);
                }
            } else {
                vscode.window.showErrorMessage('Please use this command from the Explorer context menu.');
            }
        }),
        vscode.commands.registerCommand('synaptree.resetSettings', async () => {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to reset all SynapTree settings to their defaults?',
                'Yes', 'No'
            );

            if (result === 'Yes') {
                const config = vscode.workspace.getConfiguration('synaptree');
                // Hardcoded consistent reset for safety
                const keys = [
                    'colors.directory', 'colors.root', 'colors.defaultFile', 'colors.extensions',
                    'visuals.activeColor', 'visuals.normalOpacity', 'visuals.particleSpeed', 'visuals.particleWidth',
                    'general.language', 'general.ignorePatterns'
                ];

                for (const key of keys) {
                    await config.update(key, undefined, vscode.ConfigurationTarget.Global);
                    await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
                }

                vscode.window.showInformationMessage('SynapTree settings have been reset.');
                // Trigger refresh to apply color changes
                vscode.commands.executeCommand('synaptree.refresh');
            }
        })
    );

    // 4. Configuration Watcher
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('synaptree')) {
            outputChannel.appendLine('Configuration changed, refreshing SynapTree...');

            // Refresh both views
            sidebarProvider.refresh();
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.refresh();
            }

            // If autoFocus was just enabled, trigger focus immediately
            if (e.affectsConfiguration('synaptree.general.autoFocus')) {
                const config = vscode.workspace.getConfiguration('synaptree');
                if (config.get('general.autoFocus') && vscode.window.activeTextEditor) {
                    // Trigger focus after valid refresh
                    setTimeout(() => {
                        if (vscode.window.activeTextEditor) {
                            const filePath = vscode.window.activeTextEditor.document.uri.fsPath;
                            sidebarProvider.refresh(filePath);
                        }
                    }, 500);
                }
            }
        }
    }));

    // Initialize context
    vscode.commands.executeCommand('setContext', 'synaptree:labelsVisible', true);

    // 3. Git State Watcher
    const gitRefresh = setupGitWatcher(context, sidebarProvider, outputChannel);
    if (gitRefresh) {
        triggerGitBroadcast = gitRefresh;
    }

    // 5. File System Watcher (Auto-Refresh on Create/Delete)
    setupFileSystemWatcher(context, sidebarProvider, outputChannel, getGitFileStatus);
}

// --- File System Watcher ---
function setupFileSystemWatcher(context: vscode.ExtensionContext, sidebarProvider: SynapTreeViewProvider, outputChannel: vscode.OutputChannel, getGitStatus: (uri: vscode.Uri) => string | undefined) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');

    // Initialize Processor
    const processor = new ChangeProcessor(sidebarProvider, outputChannel, getGitStatus);

    // Check ignore helper
    const isIgnored = (pathStr: string) => {
        return pathStr.includes('/.git/') || pathStr.includes('/.gemini/') || pathStr.includes('node_modules');
    };

    const handleCreate = (uri: vscode.Uri) => {
        if (isIgnored(uri.path)) return;
        processor.queueFileEvent('create', uri);
    };

    const handleDelete = (uri: vscode.Uri) => {
        if (isIgnored(uri.path)) return;
        processor.queueFileEvent('delete', uri);
    };

    const handleRename = async (e: vscode.FileRenameEvent) => {
        for (const file of e.files) {
            if (isIgnored(file.oldUri.path) && isIgnored(file.newUri.path)) continue;

            processor.queueFileEvent('delete', file.oldUri);
            processor.queueFileEvent('create', file.newUri);
        }
    };

    context.subscriptions.push(
        watcher.onDidCreate(handleCreate),
        watcher.onDidDelete(handleDelete),
        vscode.workspace.onDidRenameFiles(handleRename),
        watcher, // Dispose watcher
        processor // Dispose processor (Watchdog)
    );
}

// --- New Architecture: Git State Watcher ---
// Returns a function to force broadcast
function setupGitWatcher(context: vscode.ExtensionContext, sidebarProvider: SynapTreeViewProvider, outputChannel: vscode.OutputChannel): (() => void) | undefined {
    const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
    if (!gitExtension) return undefined;

    const git = gitExtension.exports.getAPI(1);

    // Store last known state to detect changes (Diffing)
    // Map<fsPath, statusString>
    const lastKnownStatus = new Map<string, string>();

    const updateGitStatus = (forceBroadcast: boolean = false) => {
        if (!git.repositories || git.repositories.length === 0) return;
        const repo = git.repositories[0]; // Assuming single repo for now
        if (!repo) return;

        const currentStatus = new Map<string, string>();

        // 1. Collect current state
        const mapStatus = (c: any, type: 'index' | 'working' | 'merge') => {
            if (type === 'index') {
                currentStatus.set(c.uri.fsPath, 'staged');
                return;
            }

            // Working Tree / Merge
            // Status code mapping (heuristic based on common VS Code Git API behavior)
            // 7 and 8 are often used for Untracked or Intent-to-add
            if (c.status === 7 || c.status === 8) {
                currentStatus.set(c.uri.fsPath, 'untracked');
            } else {
                currentStatus.set(c.uri.fsPath, 'modified');
            }
        };

        repo.state.workingTreeChanges.forEach((c: any) => mapStatus(c, 'working'));
        repo.state.indexChanges.forEach((c: any) => mapStatus(c, 'index'));
        repo.state.mergeChanges.forEach((c: any) => mapStatus(c, 'merge'));

        // 2. Broadcast or Diff
        if (forceBroadcast) {
            const batchChanges = new Map<string, string | undefined>();
            currentStatus.forEach((newStatus, fsPath) => {
                lastKnownStatus.set(fsPath, newStatus); // Sync cache
                batchChanges.set(fsPath, newStatus);
            });
            sidebarProvider.notifyFileChanges(batchChanges);
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.notifyFileChanges(batchChanges);
            }
        } else {
            // Check for New or Changed statuses
            const batchChanges = new Map<string, string | undefined>();
            currentStatus.forEach((newStatus, fsPath) => {
                const oldStatus = lastKnownStatus.get(fsPath);
                if (newStatus !== oldStatus) {
                    lastKnownStatus.set(fsPath, newStatus);
                    batchChanges.set(fsPath, newStatus);
                }
            });

            // Check for Resolved (Cleaned) files
            lastKnownStatus.forEach((_, fsPath) => {
                if (!currentStatus.has(fsPath)) {
                    lastKnownStatus.delete(fsPath);
                    batchChanges.set(fsPath, undefined);
                }
            });

            // Notify Batch
            if (batchChanges.size > 0) {
                sidebarProvider.notifyFileChanges(batchChanges);
                if (SynapTreePanel.currentPanel) {
                    SynapTreePanel.currentPanel.notifyFileChanges(batchChanges);
                }
            }
        }
    };

    // Subscriptions
    if (git.repositories.length > 0) {
        git.repositories[0].state.onDidChange(() => updateGitStatus(false));

        // Initial FULL sync - Short delay
        setTimeout(() => updateGitStatus(true), 1500);
    } else {
        git.onDidOpenRepository((repo: any) => {
            repo.state.onDidChange(() => updateGitStatus(false));
            setTimeout(() => {
                outputChannel.appendLine('[GitWatcher] Repo opened. performing initial scan...');
                updateGitStatus(true);
            }, 1500);
        });
    }

    context.subscriptions.push(new vscode.Disposable(() => {
        lastKnownStatus.clear();
    }));

    return () => updateGitStatus(true);
}

// Helper to get status of a single file
function getGitFileStatus(uri: vscode.Uri): string | undefined {
    const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
    if (!gitExtension) return undefined;
    const git = gitExtension.exports.getAPI(1);
    if (!git.repositories || git.repositories.length === 0) return undefined;

    // Check all repos (usually just one)
    for (const repo of git.repositories) {
        // Check Index
        const indexChange = repo.state.indexChanges.find((c: any) => c.uri.fsPath === uri.fsPath);
        if (indexChange) return 'staged';

        // Check Working Tree
        const workingChange = repo.state.workingTreeChanges.find((c: any) => c.uri.fsPath === uri.fsPath);
        if (workingChange) {
            if (workingChange.status === 7 || workingChange.status === 8) {
                return 'untracked';
            }
            return 'modified';
        }
    }
    return undefined;
}

export function deactivate() {
    if (SynapTreePanel.currentPanel) {
        SynapTreePanel.currentPanel.dispose();
    }
}
