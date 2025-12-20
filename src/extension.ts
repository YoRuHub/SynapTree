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
        }),
        vscode.commands.registerCommand('synaptree.search', () => {
            sidebarProvider.search('');
            if (SynapTreePanel.currentPanel) {
                SynapTreePanel.currentPanel.search('');
            }
        })
    );
}

export function deactivate() {
    if (SynapTreePanel.currentPanel) {
        SynapTreePanel.currentPanel.dispose();
    }
}
