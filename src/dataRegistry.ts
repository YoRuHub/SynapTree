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

export async function createSingleNode(currentPath: string, parentId?: string): Promise<GraphNode | null> {
    try {
        const stats = await fs.promises.stat(currentPath);
        const isDir = stats.isDirectory();
        const name = path.basename(currentPath);
        const id = currentPath;

        // Load configuration (Duplicate load for now to ensure fresh config on single update)
        // In real app, might want to cache this or pass it in.
        const config = vscode.workspace.getConfiguration('synaptree.colors');
        const dirColor = config.get<string>('directory', '#0088ff');
        const rootColor = config.get<string>('root', '#ffffff');
        const defaultFileColor = config.get<string>('defaultFile', '#aaaaaa');
        const extensionsConfig = config.get<any>('extensions', []);

        const generalConfig = vscode.workspace.getConfiguration('synaptree.general');
        const ignorePatterns = generalConfig.get<string[]>('ignorePatterns', []);

        // Ignore Check
        const shouldIgnore = ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');
                return regex.test(name);
            }
            return name === pattern;
        });

        if (shouldIgnore) return null;

        // Color Logic
        let color = defaultFileColor;
        if (isDir) {
            color = (!parentId) ? rootColor : dirColor;
        } else {
            const ext = path.extname(name).toLowerCase();
            const extensionMap: Record<string, string> = {};

            if (Array.isArray(extensionsConfig)) {
                extensionsConfig.forEach(item => {
                    if (item && item.extension && item.color) {
                        extensionMap[item.extension.toLowerCase()] = item.color;
                    }
                });
            } else if (typeof extensionsConfig === 'object' && extensionsConfig !== null) {
                for (const [ext, color] of Object.entries(extensionsConfig)) {
                    extensionMap[ext.toLowerCase()] = color as string;
                }
            }

            if (extensionMap[ext]) {
                color = extensionMap[ext];
            }
        }

        return {
            id,
            name,
            path: currentPath,
            type: (!parentId && isDir) ? 'root' : (isDir ? 'directory' : 'file'),
            level: parentId ? 1 : 0,
            color
        };
    } catch (e) {
        return null;
    }
}

export async function getWorkspaceData(rootPath: string, outputChannel?: vscode.OutputChannel): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Load configuration to pass down? 
    // For now, let's keep traverse logic mostly as is but maybe reuse createSingleNode?
    // Actually, reusing createSingleNode inside the loop is less efficient due to config reading every time.
    // Let's Keep getWorkspaceData optimized as is, but duplicate the logic in createSingleNode for single updates.
    // This is a trade-off: duplication vs performance. Here performance of full scan is critical. Single update performance is less critical but config read is fast.

    // ... (Keeping original setup for bulk scan performance) ...
    const config = vscode.workspace.getConfiguration('synaptree.colors');
    const dirColor = config.get<string>('directory', '#0088ff'); // Blue
    const rootColor = config.get<string>('root', '#ffffff'); // White
    const defaultFileColor = config.get<string>('defaultFile', '#aaaaaa'); // Gray
    const extensionsConfig = config.get<any>('extensions', []);
    const extensionMap: Record<string, string> = {};
    if (Array.isArray(extensionsConfig)) {
        extensionsConfig.forEach(item => { extensionMap[item.extension.toLowerCase()] = item.color; });
    } else if (typeof extensionsConfig === 'object' && extensionsConfig !== null) {
        for (const [ext, color] of Object.entries(extensionsConfig)) { extensionMap[ext.toLowerCase()] = color as string; }
    }
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
    function limit<T>(fn: () => Promise<T>): Promise<T> { return runWithLimit(fn) as Promise<T>; }

    async function traverse(currentPath: string, parentId?: string): Promise<void> {
        try {
            const stats = await limit(() => fs.promises.stat(currentPath));
            const isDir = stats.isDirectory();
            const name = path.basename(currentPath);
            const id = currentPath;

            const shouldIgnore = ignorePatterns.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');
                    return regex.test(name);
                }
                return name === pattern;
            });

            if (shouldIgnore) return;

            let color = defaultFileColor;
            if (isDir) {
                color = (!parentId) ? rootColor : dirColor;
            } else {
                const ext = path.extname(name).toLowerCase();
                if (extensionMap[ext]) color = extensionMap[ext];
            }

            nodes.push({
                id,
                name,
                path: currentPath,
                type: (!parentId && isDir) ? 'root' : (isDir ? 'directory' : 'file'),
                level: parentId ? 1 : 0,
                color,
            });

            if (parentId) {
                links.push({ source: parentId, target: id });
            }

            if (isDir) {
                const children = await limit(() => fs.promises.readdir(currentPath));
                await Promise.all(children.map(child => traverse(path.join(currentPath, child), id)));
            }
        } catch (err) {
            if (outputChannel) outputChannel.appendLine(`Error scanning ${currentPath}: ${err}`);
        }
    }

    await traverse(rootPath);
    return { nodes, links };
}
