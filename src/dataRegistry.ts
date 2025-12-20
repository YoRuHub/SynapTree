import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface GraphNode {
    id: string;
    name: string;
    path: string;
    type: 'directory' | 'file';
    level: number;
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

    if (outputChannel) {
        outputChannel.appendLine(`Scanning: ${rootPath}`);
    }

    function traverse(currentPath: string, parentId?: string) {
        try {
            const stats = fs.statSync(currentPath);
            const isDir = stats.isDirectory();
            const name = path.basename(currentPath);
            const id = currentPath;

            nodes.push({
                id,
                name,
                path: currentPath,
                type: isDir ? 'directory' : 'file',
                level: parentId ? 1 : 0
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
