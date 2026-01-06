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

export interface WorkspaceConfig {
    dirColor: string;
    rootColor: string;
    defaultFileColor: string;
    extensionMap: Record<string, string>;
    ignorePatterns: string[];
}

export function getWorkspaceConfig(): WorkspaceConfig {
    const config = vscode.workspace.getConfiguration('synaptree.colors');
    const dirColor = config.get<string>('directory', '#0088ff');
    const rootColor = config.get<string>('root', '#ffffff');
    const defaultFileColor = config.get<string>('defaultFile', '#aaaaaa');
    const extensionsConfig = config.get<any>('extensions', []);

    const generalConfig = vscode.workspace.getConfiguration('synaptree.general');
    const ignorePatterns = generalConfig.get<string[]>('ignorePatterns', []);

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

    return { dirColor, rootColor, defaultFileColor, extensionMap, ignorePatterns };
}

export async function createSingleNode(currentPath: string, parentId?: string, cachedConfig?: WorkspaceConfig): Promise<GraphNode | null> {
    try {
        const stats = await fs.promises.stat(currentPath);
        const isDir = stats.isDirectory();
        const name = path.basename(currentPath);
        const id = currentPath;

        const config = cachedConfig || getWorkspaceConfig();

        const shouldIgnore = config.ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');
                return regex.test(name);
            }
            return name === pattern;
        });

        if (shouldIgnore) return null;

        let color = config.defaultFileColor;
        if (isDir) {
            color = (!parentId) ? config.rootColor : config.dirColor;
        } else {
            const ext = path.extname(name).toLowerCase();
            if (config.extensionMap[ext]) {
                color = config.extensionMap[ext];
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

    const config = getWorkspaceConfig();
    const { dirColor, rootColor, defaultFileColor, extensionMap, ignorePatterns } = config;

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
                            activeScans++;
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

            const shouldIgnore = ignorePatterns.some((pattern: string) => {
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
