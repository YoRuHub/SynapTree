import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface GraphNode {
    id: string;
    name: string;
    path: string;
    type: 'directory' | 'file' | 'root';
    level: number;
    color?: string;
    gitStatus?: string; // 'modified' | 'staged' | 'untracked'
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export async function getWorkspaceData(rootPath: string, outputChannel?: vscode.OutputChannel): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // --- 1. Pure File System Scan (Git-agnostic) ---
    // Git status will be synced asynchronously by the GitWatcher in extension.ts
    // This ensures instant loading without waiting for Git extension activation or repository scanning.

    // Load configuration
    const config = vscode.workspace.getConfiguration('synaptree.colors');
    const dirColor = config.get<string>('directory', '#0088ff'); // Blue
    const rootColor = config.get<string>('root', '#ffffff'); // White
    const defaultFileColor = config.get<string>('defaultFile', '#aaaaaa'); // Gray

    // Robust check: handle both legacy object format and new array format
    const extensionsConfig = config.get<any>('extensions', []);
    const extensionMap: Record<string, string> = {};

    if (Array.isArray(extensionsConfig)) {
        extensionsConfig.forEach(item => {
            if (item && item.extension && item.color) {
                extensionMap[item.extension.toLowerCase()] = item.color;
            }
        });
    } else if (typeof extensionsConfig === 'object' && extensionsConfig !== null) {
        // Legacy support
        for (const [ext, color] of Object.entries(extensionsConfig)) {
            extensionMap[ext.toLowerCase()] = color as string;
        }
    }

    // Load ignore patterns
    const generalConfig = vscode.workspace.getConfiguration('synaptree.general');
    const ignorePatterns = generalConfig.get<string[]>('ignorePatterns', []);

    // Concurrency Limiter
    const MAX_CONCURRENT = 50;
    let activeScans = 0;
    const queue: (() => Promise<void>)[] = [];

    function runWithLimit<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const task = async () => {
                try {
                    const res = await fn();
                    resolve(res);
                } catch (e) {
                    reject(e);
                } finally {
                    activeScans--;
                    if (queue.length > 0) {
                        const next = queue.shift();
                        if (next) {
                            activeScans++; // Re-occupy slot immediately for the next task
                            next();
                        }
                    }
                }
            };

            if (activeScans < MAX_CONCURRENT) {
                activeScans++;
                task();
            } else {
                queue.push(task);
            }
        });
    }

    // Helper to limit concurrency ONLY for FS operations
    function limit<T>(fn: () => Promise<T>): Promise<T> {
        return runWithLimit(fn) as Promise<T>;
    }

    async function traverse(currentPath: string, parentId?: string): Promise<void> {
        try {
            // Limit FS operation
            const stats = await limit(() => fs.promises.stat(currentPath));
            
            const isDir = stats.isDirectory();
            const name = path.basename(currentPath);
            const id = currentPath;

            // Check ignore patterns
            const shouldIgnore = ignorePatterns.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');
                    return regex.test(name);
                }
                return name === pattern;
            });

            if (shouldIgnore) {
                return;
            }

            // Determine color
            let color = defaultFileColor;
            if (isDir) {
                color = (!parentId) ? rootColor : dirColor;
            } else {
                const ext = path.extname(name).toLowerCase();
                if (extensionMap[ext]) {
                    color = extensionMap[ext];
                }
            }

            nodes.push({
                id,
                name,
                path: currentPath,
                type: (!parentId && isDir) ? 'root' : (isDir ? 'directory' : 'file'),
                level: parentId ? 1 : 0,
                color,
                // gitStatus is purposely undefined here. It will be patched by main.js via events.
            });

            if (parentId) {
                links.push({ source: parentId, target: id });
            }

            if (isDir) {
                // Limit FS operation
                const children = await limit(() => fs.promises.readdir(currentPath));
                
                // Parallelize children processing WITHOUT wrapping the wait in the limiter
                // This prevents deadlock where parents hold slots waiting for children
                await Promise.all(children.map(child => traverse(path.join(currentPath, child), id)));
            }
        } catch (err) {
            // Ignore access errors or races
            if (outputChannel) {
                outputChannel.appendLine(`Error scanning ${currentPath}: ${err}`);
            }
        }
    }

    await traverse(rootPath);

    return { nodes, links };
}
