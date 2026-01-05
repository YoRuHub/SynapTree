import * as vscode from 'vscode';
import * as path from 'path';
import pLimit from 'p-limit';
import { SynapTreeViewProvider } from '../SynapTreeViewProvider';
import { SynapTreePanel } from '../SynapTreePanel';
import { createSingleNode, getWorkspaceConfig } from '../dataRegistry';

interface FileEvent {
    type: 'create' | 'delete';
    uri: vscode.Uri;
}

export class ChangeProcessor {
    private queue: FileEvent[] = [];
    private processing = false;
    private limit = pLimit(5); // Max 5 concurrent node creations (fs stats)
    private bufferTimeout: NodeJS.Timeout | undefined;
    private readonly FLUSH_DELAY = 100; // 100ms debounce
    private readonly CHUNK_SIZE = 50; // Process 50 events per tick

    // Dependencies
    private sidebarProvider: SynapTreeViewProvider;
    private outputChannel: vscode.OutputChannel;
    private getGitStatus: (uri: vscode.Uri) => string | undefined;

    private watchdogTimer: NodeJS.Timeout | undefined;

    constructor(
        sidebarProvider: SynapTreeViewProvider,
        outputChannel: vscode.OutputChannel,
        getGitStatus: (uri: vscode.Uri) => string | undefined
    ) {
        this.sidebarProvider = sidebarProvider;
        this.outputChannel = outputChannel;
        this.getGitStatus = getGitStatus;
        this.startWatchdog();
    }

    private lastHeartbeat: number = Date.now();

    private startWatchdog() {
        // Check every 5 seconds
        this.watchdogTimer = setInterval(() => {
            if (this.processing && (Date.now() - this.lastHeartbeat > 15000)) {
                this.outputChannel.appendLine('[Processor] Watchdog: Stalled process detected (Active Monitor). Resetting lock.');
                this.processing = false;
                // Optional: Try to kickstart queue if items exist
                if (this.queue.length > 0) {
                    this.processQueue();
                }
            }
        }, 5000);
    }

    public dispose() {
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = undefined;
        }
    }

    public queueFileEvent(type: 'create' | 'delete', uri: vscode.Uri) {
        // Active Watchdog is running via setInterval, so we don't need the check here anymore.


        // Optimize: If creating a file that is already pending delete, just remove from delete queue?
        // Or if deleting a file pending create, remove from create queue.
        if (type === 'delete') {
            this.queue = this.queue.filter(e => !(e.type === 'create' && e.uri.fsPath === uri.fsPath));
        } else if (type === 'create') {
            this.queue = this.queue.filter(e => !(e.type === 'delete' && e.uri.fsPath === uri.fsPath));
        }

        this.queue.push({ type, uri });
        this.scheduleProcess();
    }

    private scheduleProcess() {
        if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
        this.bufferTimeout = setTimeout(() => {
            this.processQueue();
        }, this.FLUSH_DELAY);
    }

    private async processQueue() {
        this.lastHeartbeat = Date.now();
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        try {
            // Take a chunk
            const chunk = this.queue.splice(0, this.CHUNK_SIZE);
            const creates = chunk.filter(e => e.type === 'create').map(e => e.uri);
            const deletes = chunk.filter(e => e.type === 'delete').map(e => e.uri.fsPath);

            // 1. Process Deletes
            if (deletes.length > 0) {
                // this.outputChannel.appendLine(`[Processor] Processing ${deletes.length} deletes`);
                this.notifyDeletes(deletes);
            }

            // 2. Process Creates
            if (creates.length > 0) {
                // this.outputChannel.appendLine(`[Processor] Processing ${creates.length} creates`);

                // Fetch config once for this batch
                const config = getWorkspaceConfig();

                const newNodes: any[] = [];
                const tasks = creates.map(uri => this.limit(async () => {
                    try {
                        const parentPath = path.dirname(uri.fsPath);
                        // Pass cached config
                        const node: any = await createSingleNode(uri.fsPath, parentPath, config);
                        if (node) {
                            node.gitStatus = this.getGitStatus(uri);
                            node.parentId = parentPath;
                            newNodes.push(node);
                        }
                    } catch (e) {
                        // ignore
                    }
                }));

                await Promise.all(tasks);

                if (newNodes.length > 0) {
                    this.notifyAdds(newNodes);
                }
            }


        } catch (err) {
            this.outputChannel.appendLine(`[Processor] Error: ${err}`);
        } finally {
            if (this.queue.length > 0) {
                // Determine if we should continue processing immediately or wait
                setTimeout(() => {
                    this.processing = false;
                    this.processQueue();
                }, 10);
            } else {
                this.processing = false;
            }
        }
    }

    private notifyAdds(nodes: any[]) {
        this.sidebarProvider.notifyNodesAdded(nodes);
        if (SynapTreePanel.currentPanel) {
            SynapTreePanel.currentPanel.notifyNodesAdded(nodes);
        }
    }

    private notifyDeletes(ids: string[]) {
        this.sidebarProvider.notifyNodesDeleted(ids);
        if (SynapTreePanel.currentPanel) {
            SynapTreePanel.currentPanel.notifyNodesDeleted(ids);
        }
    }
}
