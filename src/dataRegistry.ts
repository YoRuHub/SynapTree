import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface GraphNode {
    id: string;
    name: string;
    path: string;
    type: 'directory' | 'file';
    level: number;
    color?: string;
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export function getWorkspaceData(rootPath: string, outputChannel?: vscode.OutputChannel): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Load configuration
    const config = vscode.workspace.getConfiguration('synaptree.colors');
    const dirColor = config.get<string>('directory', '#ff00ff');
    const defaultFileColor = config.get<string>('defaultFile', '#00ffff');

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

    if (outputChannel) {
        outputChannel.appendLine(`Scanning: ${rootPath}`);
    }

    function traverse(currentPath: string, parentId?: string) {
        try {
            const stats = fs.statSync(currentPath);
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
                color = dirColor;
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
                type: isDir ? 'directory' : 'file',
                level: parentId ? 1 : 0,
                color
            });

            if (parentId) {
                links.push({ source: parentId, target: id });
            }

            if (isDir) {
                const files = fs.readdirSync(currentPath);
                files.forEach(file => traverse(path.join(currentPath, file), id));
            }
        } catch (err) {
            if (outputChannel) {
                outputChannel.appendLine(`Error scanning ${currentPath}: ${err}`);
            }
        }
    }

    traverse(rootPath);

    if (outputChannel) {
        outputChannel.appendLine(`Found ${nodes.length} nodes`);
    }

    return { nodes, links };
}
