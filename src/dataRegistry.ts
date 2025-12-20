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
    const extensionMap = config.get<Record<string, string>>('extensions', {});

    if (outputChannel) {
        outputChannel.appendLine(`Scanning: ${rootPath}`);
    }

    function traverse(currentPath: string, parentId?: string) {
        try {
            const stats = fs.statSync(currentPath);
            const isDir = stats.isDirectory();
            const name = path.basename(currentPath);
            const id = currentPath;

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
                // Ignore pattern
                if (['node_modules', '.git', 'out', 'dist', '.vscode-test', 'target', 'bin'].includes(name)) {
                    return;
                }
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
