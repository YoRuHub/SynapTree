
export const DEBUG = false; // Set to false for release

export const ICONS = {
    focus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"/></svg>',
    setRoot: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/></svg>', // Simplified target/clock style
    resetRoot: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5z"/></svg>', // Back arrow
    folderAdd: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7 2l2 2h5v10H2V2h5zm.5-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H9.5L7.5 1zm4 6.5h-2v-2h-1v2h-2v1h2v2h1v-2h2v-1z"/></svg>',
    fileAdd: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5l-4-4zm-1 5V2.5L11.5 6H8zm3.5 3h-2v-2h-1v2h-2v1h2v2h1v-2h2v-1z"/></svg>',
    rename: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.23 2.667a1.67 1.67 0 0 0-2.36 0L2.5 11.043v2.36h2.36l8.37-8.376a1.67 1.67 0 0 0 0-2.36zm-2 1a.67.67 0 0 1 0 .942L4.666 11.233l-.946-.946 6.564-6.564a.67.67 0 0 1 .946 0z"/></svg>',
    delete: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11 2H9c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1H5c-.55 0-1 .45-1 1v1h8V3c0-.55-.45-1-1-1zM3.5 5h9l-1 9.5c0 .28-.22.5-.5.5H5c-.28 0-.5-.22-.5-.5L3.5 5z"/></svg>'
};

export const GIT_STATUS_CONFIG = {
    modified: {
        color: '#ffaa00', // Orange (VS Code Modified)
        opacityGlow: 0.4,
        opacityAura: 0.2
    },
    untracked: {
        color: '#73c991', // Light Green (VS Code Untracked)
        opacityGlow: 0.4,
        opacityAura: 0.2
    },
    staged: {
        color: '#55ff55', // Bright Green (Staged)
        opacityGlow: 0.4,
        opacityAura: 0.2
    },
    default: {
        color: '#ffffff', // Fallback
        opacityGlow: 0.15,
        opacityAura: 0.06
    }
};
