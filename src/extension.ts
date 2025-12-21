import * as vscode from 'vscode';
import { SynapTreeViewProvider } from './SynapTreeViewProvider';
import { SynapTreePanel } from './SynapTreePanel';

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
            // Toggle webview state
            sidebarProvider.toggleLabels();
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.toggleLabels();
            }
        }),
        vscode.commands.registerCommand('synaptree.showLabels', () => {
            // Set context to true (switch to "Hide" icon)
            vscode.commands.executeCommand('setContext', 'synaptree:labelsVisible', true);
            // Toggle webview state
            sidebarProvider.toggleLabels();
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.toggleLabels();
            }
        }),
        vscode.commands.registerCommand('synaptree.resetSettings', async () => {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to reset all SynapTree settings to their defaults?',
                'Yes', 'No'
            );

            if (result === 'Yes') {
                const config = vscode.workspace.getConfiguration('synaptree');
                // Inspect details to find what keys exist, but easier to just reset known keys
                // Or loop through properties in package.json (runtime safe way: reset specific sections)

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

    // Initialize context
    vscode.commands.executeCommand('setContext', 'synaptree:labelsVisible', true);

    // 3. Git State Watcher
    const gitRefresh = setupGitWatcher(context, sidebarProvider, outputChannel);
    if (gitRefresh) {
        triggerGitBroadcast = gitRefresh;
    }
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

export function deactivate() {
    if (SynapTreePanel.currentPanel) {
        SynapTreePanel.currentPanel.dispose();
    }
}
