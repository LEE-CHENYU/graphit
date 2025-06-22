/**
 * Webview manager for GraphIt extension
 * Handles UI rendering and webview content with professional styling
 */
class WebviewManager {
	constructor(panel) {
		this.panel = panel;
	}

	getWebviewContent() {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>GraphIt - Repository Flowchart</title>
	<script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
	<style>
		/* =================================================================
		   CENTRALIZED STYLING CONFIGURATION
		   ================================================================= */
		
		:root {
			/* Core Color Palette - Monotone Professional Gray */
			--primary-gray: 128, 128, 128;
			--secondary-gray: 112, 112, 112;
			--tertiary-gray: 96, 96, 96;
			--text-light: 200, 200, 200;
			
			/* Primary Colors */
			--primary-accent: #666;
			--primary-accent-hover: #777;
			
			/* Surface Colors - All based on primary gray with varying opacity */
			--surface-primary: rgba(var(--primary-gray), 0.1);
			--surface-secondary: rgba(var(--tertiary-gray), 0.05);
			--surface-tertiary: rgba(var(--secondary-gray), 0.15);
			--surface-hover: rgba(var(--primary-gray), 0.2);
			
			/* Glass Effect System */
			--glass-overlay: rgba(var(--primary-gray), 0.08);
			--glass-overlay-hover: rgba(var(--primary-gray), 0.15);
			--glass-border: rgba(var(--primary-gray), 0.15);
			--glass-border-hover: rgba(var(--primary-gray), 0.3);
			
			/* Border System */
			--border-subtle: rgba(var(--primary-gray), 0.2);
			--border-medium: rgba(var(--primary-gray), 0.4);
			--border-strong: rgba(var(--primary-gray), 0.6);
			
			/* Text Colors */
			--text-primary: var(--vscode-editor-foreground);
			--text-secondary: var(--vscode-descriptionForeground);
			--text-muted: rgba(var(--text-light), 0.7);
			
			/* Mermaid Diagram Colors - Consistent with overall theme */
			--mermaid-node-bg: rgba(var(--primary-gray), 0.15);
			--mermaid-node-border: rgba(var(--primary-gray), 0.6);
			--mermaid-text: rgba(var(--text-light), 0.9);
			--mermaid-edge: rgba(var(--primary-gray), 0.8);
			--mermaid-cluster-bg: rgba(var(--primary-gray), 0.12);
			--mermaid-cluster-border: rgba(var(--primary-gray), 0.4);
			
			/* Component Specific */
			--button-padding-small: 6px 10px;
			--button-padding-normal: 8px 12px;
			--border-radius-small: 4px;
			--border-radius-medium: 6px;
			--border-radius-large: 8px;
			
			/* Animation & Transitions */
			--transition-fast: 0.1s ease;
			--transition-normal: 0.2s ease;
			--transition-slow: 0.3s ease;
			
			/* Spacing System */
			--spacing-xs: 4px;
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--spacing-xxl: 24px;
		}

		/* =================================================================
		   BASE STYLES
		   ================================================================= */
		
		body {
			font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
			background-color: var(--vscode-editor-background);
			color: var(--text-primary);
			margin: 0;
			padding: 0;
			line-height: 1.6;
			overflow-x: hidden;
		}
		
		/* =================================================================
		   LAYOUT COMPONENTS
		   ================================================================= */
		
		.main-container {
			display: flex;
			flex-direction: column;
			height: 100vh;
			min-height: 600px;
		}
		
		.header {
			background: var(--surface-primary);
			backdrop-filter: blur(12px);
			padding: var(--spacing-lg) var(--spacing-xxl);
			border-bottom: 1px solid var(--border-subtle);
			display: flex;
			justify-content: space-between;
			align-items: center;
			flex-shrink: 0;
		}
		
		.header h1 {
			color: var(--text-primary);
			margin: 0;
			font-size: 1.2em;
			font-weight: 500;
			letter-spacing: 0.02em;
		}
		
		.header-controls {
			display: flex;
			gap: 10px;
			align-items: center;
		}
		
		/* =================================================================
		   INTERACTIVE COMPONENTS
		   ================================================================= */
		
		.btn {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			color: var(--text-primary);
			border: 1px solid var(--glass-border);
			padding: var(--button-padding-normal);
			border-radius: var(--border-radius-medium);
			cursor: pointer;
			font-size: 12px;
			display: flex;
			align-items: center;
			gap: var(--spacing-sm);
			transition: all var(--transition-normal);
			font-weight: 500;
		}
		
		.btn:hover {
			background: var(--glass-overlay-hover);
			border-color: var(--glass-border-hover);
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		}
		
		.btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			transform: none;
			box-shadow: none;
		}
		
		.btn-small {
			padding: var(--button-padding-small);
			font-size: 11px;
		}
		
		/* =================================================================
		   UTILITY COMPONENTS
		   ================================================================= */
		
		.zoom-indicator {
			font-size: 11px;
			color: var(--text-primary);
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border: 1px solid var(--glass-border);
			padding: var(--spacing-xs) var(--spacing-sm);
			border-radius: var(--border-radius-medium);
			margin-right: var(--spacing-md);
			font-family: monospace;
			font-weight: 500;
		}
		
		.status-indicator {
			font-size: 11px;
			color: var(--text-secondary);
			display: flex;
			align-items: center;
			gap: var(--spacing-sm);
			padding: var(--spacing-xs) var(--spacing-sm);
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border-radius: var(--border-radius-small);
			border: 1px solid var(--glass-border);
		}
		
		.auto-refresh-toggle {
			display: flex;
			align-items: center;
			gap: var(--spacing-sm);
			font-size: 11px;
			color: var(--text-secondary);
			cursor: pointer;
			padding: var(--spacing-xs) var(--spacing-sm);
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border-radius: var(--border-radius-small);
			border: 1px solid var(--glass-border);
			transition: all var(--transition-normal);
		}
		
		.auto-refresh-toggle:hover {
			background: var(--surface-tertiary);
		}
		
		.auto-refresh-toggle input[type="checkbox"] {
			margin: 0;
			accent-color: var(--primary-accent);
		}
		
		/* =================================================================
		   DIAGRAM AREA
		   ================================================================= */
		
		.flowchart-container {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		
		.diagram-viewport {
			flex: 1;
			background: var(--surface-secondary);
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			position: relative;
			min-height: 400px;
			border: 1px solid var(--border-subtle);
			margin: var(--spacing-sm);
			border-radius: var(--border-radius-large);
			cursor: grab;
		}
		
		.diagram-viewport.dragging {
			cursor: grabbing;
		}
		
		#mermaid-diagram {
			max-width: none;
			max-height: none;
			transition: transform var(--transition-fast);
			transform-origin: center center;
			cursor: inherit;
			user-select: none;
		}
		
		/* =================================================================
		   MERMAID DIAGRAM STYLING - CENTRALIZED & COMPREHENSIVE
		   ================================================================= */
		
		/* UNIVERSAL TEXT VISIBILITY - Covers all possible Mermaid text elements */
		#mermaid-diagram svg text,
		#mermaid-diagram svg .nodeLabel,
		#mermaid-diagram svg .edgeLabel,
		#mermaid-diagram svg .label,
		#mermaid-diagram svg .nodeLabel text,
		#mermaid-diagram svg .edgeLabel text,
		#mermaid-diagram svg .cluster text,
		#mermaid-diagram svg .titleText,
		#mermaid-diagram svg .node text,
		#mermaid-diagram svg tspan,
		#mermaid-diagram svg .label text,
		#mermaid-diagram svg .edgeLabels text,
		#mermaid-diagram svg .nodeLabels text,
		#mermaid-diagram svg g text,
		#mermaid-diagram svg foreignObject text,
		#mermaid-diagram svg .flowchart text,
		#mermaid-diagram svg .subgraph text,
		#mermaid-diagram svg .flowchart-label text,
		#mermaid-diagram svg .flowchartTitleText,
		#mermaid-diagram svg .node .label,
		#mermaid-diagram svg .node span,
		#mermaid-diagram svg .edgeLabel span,
		#mermaid-diagram svg .nodeLabel span,
		#mermaid-diagram svg g.nodes text,
		#mermaid-diagram svg g.node text,
		#mermaid-diagram svg g.edgeLabels text,
		#mermaid-diagram svg g.edgeLabel text {
			font-family: 'Segoe UI', system-ui, sans-serif !important;
			font-weight: 500 !important;
			font-size: 14px !important;
			fill: rgba(220, 220, 220, 0.98) !important;
			color: rgba(220, 220, 220, 0.98) !important;
			stroke: none !important;
			opacity: 1 !important;
			visibility: visible !important;
		}
		
		/* MAXIMUM SPECIFICITY TEXT OVERRIDES - For stubborn elements */
		#mermaid-diagram svg g.nodes text,
		#mermaid-diagram svg g.node text,
		#mermaid-diagram svg .nodeLabel,
		#mermaid-diagram svg .node .label,
		#mermaid-diagram svg .flowchart .nodeLabel,
		#mermaid-diagram svg .flowchart .node text,
		#mermaid-diagram svg .flowchart g.node text,
		#mermaid-diagram svg .flowchart g.nodes text {
			fill: rgba(220, 220, 220, 0.98) !important;
			color: rgba(220, 220, 220, 0.98) !important;
			opacity: 1 !important;
			visibility: visible !important;
			stroke: none !important;
		}
		
		/* EDGE TEXT VISIBILITY - Consistent across all analysis types */
		#mermaid-diagram svg .edgeLabels text,
		#mermaid-diagram svg .edgeLabel text,
		#mermaid-diagram svg g.edgeLabels text,
		#mermaid-diagram svg g.edgeLabel text,
		#mermaid-diagram svg .flowchart .edgeLabel text {
			fill: rgba(200, 200, 200, 0.9) !important;
			color: rgba(200, 200, 200, 0.9) !important;
			opacity: 1 !important;
			visibility: visible !important;
		}
		
		/* SUBGRAPH/CLUSTER TEXT - For function analysis layers */
		#mermaid-diagram svg .cluster text,
		#mermaid-diagram svg .subgraph text,
		#mermaid-diagram svg .cluster .label,
		#mermaid-diagram svg .subgraph .label,
		#mermaid-diagram svg g.clusters text,
		#mermaid-diagram svg g.cluster text {
			fill: rgba(200, 200, 200, 0.95) !important;
			color: rgba(200, 200, 200, 0.95) !important;
			font-weight: 600 !important;
			opacity: 1 !important;
			visibility: visible !important;
		}
		
		/* EDGES - Consistent styling */
		#mermaid-diagram svg .edgePath .path,
		#mermaid-diagram svg .flowchart .edgePath .path,
		#mermaid-diagram svg g.edgePaths .path {
			stroke-width: 2px !important;
			stroke: rgba(128, 128, 128, 0.8) !important;
		}
		
		/* EDGE LABELS BACKGROUND - Consistent across analysis types */
		#mermaid-diagram svg .edgeLabel rect,
		#mermaid-diagram svg .edgeLabel .label-container,
		#mermaid-diagram svg .flowchart .edgeLabel rect,
		#mermaid-diagram svg g.edgeLabels rect {
			fill: rgba(128, 128, 128, 0.1) !important;
			stroke: rgba(128, 128, 128, 0.3) !important;
			stroke-width: 1px !important;
		}
		
		/* SUBGRAPHS/CLUSTERS BACKGROUND - For function analysis architectural layers */
		#mermaid-diagram svg .cluster rect,
		#mermaid-diagram svg .subgraph rect,
		#mermaid-diagram svg .flowchart .cluster rect,
		#mermaid-diagram svg g.clusters rect {
			rx: 4px !important;
			ry: 4px !important;
			fill: rgba(128, 128, 128, 0.12) !important;
			stroke: rgba(128, 128, 128, 0.4) !important;
			stroke-width: 2px !important;
		}
		
		/* NODES - Universal node styling for all analysis types */
		#mermaid-diagram svg .node rect,
		#mermaid-diagram svg .node circle,
		#mermaid-diagram svg .node polygon,
		#mermaid-diagram svg rect,
		#mermaid-diagram svg .nodeLabel rect,
		#mermaid-diagram svg .label rect,
		#mermaid-diagram svg .node .label-container,
		#mermaid-diagram svg .flowchart-label rect,
		#mermaid-diagram svg .flowchart .node rect,
		#mermaid-diagram svg .flowchart .nodeLabel rect,
		#mermaid-diagram svg g.nodes rect,
		#mermaid-diagram svg g.node rect {
			fill: rgba(128, 128, 128, 0.15) !important;
			stroke: rgba(128, 128, 128, 0.6) !important;
			stroke-width: 2px !important;
		}
		
		/* DECISION DIAMONDS - Special styling for function analysis decision points */
		#mermaid-diagram svg .node polygon,
		#mermaid-diagram svg .flowchart .node polygon,
		#mermaid-diagram svg g.node polygon {
			fill: rgba(128, 128, 128, 0.18) !important;
			stroke: rgba(128, 128, 128, 0.7) !important;
			stroke-width: 2px !important;
		}
		
		/* OVERRIDE ANY WHITE/TRANSPARENT BACKGROUNDS */
		#mermaid-diagram svg [fill="#ffffff"],
		#mermaid-diagram svg [fill="white"],
		#mermaid-diagram svg [fill="rgb(255,255,255)"],
		#mermaid-diagram svg [fill="transparent"],
		#mermaid-diagram svg [fill="none"] {
			fill: rgba(128, 128, 128, 0.15) !important;
		}
		
		/* FORCE VISIBILITY FOR ANY HIDDEN TEXT */
		#mermaid-diagram svg [opacity="0"],
		#mermaid-diagram svg [visibility="hidden"],
		#mermaid-diagram svg text[fill="transparent"],
		#mermaid-diagram svg text[fill="none"],
		#mermaid-diagram svg .label[fill="transparent"],
		#mermaid-diagram svg .nodeLabel[fill="transparent"] {
			fill: rgba(220, 220, 220, 0.98) !important;
			opacity: 1 !important;
			visibility: visible !important;
		}
		
		/* ENSURE ALL TEXT IS VISIBLE - Final catch-all */
		#mermaid-diagram svg * {
			--text-color: rgba(220, 220, 220, 0.98);
		}
		
		#mermaid-diagram svg text,
		#mermaid-diagram svg .label,
		#mermaid-diagram svg .nodeLabel {
			fill: var(--text-color) !important;
			color: var(--text-color) !important;
		}
		
		/* =================================================================
		   LOADING & ERROR STATES
		   ================================================================= */
		
		.loading-overlay {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--surface-secondary);
			backdrop-filter: blur(8px);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			z-index: 10;
		}
		
		.loading-overlay.hidden {
			display: none;
		}
		
		.spinner {
			border: 2px solid var(--border-subtle);
			border-top: 2px solid var(--primary-accent);
			border-radius: 50%;
			width: 24px;
			height: 24px;
			animation: spin 1s linear infinite;
			margin-bottom: 15px;
		}
		
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
		
		.loading-text {
			color: var(--text-secondary);
			text-align: center;
		}
		
		.error-message {
			color: var(--vscode-errorForeground);
			background: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			padding: 15px;
			border-radius: var(--border-radius-small);
			margin: var(--spacing-xl);
		}

		.pan-hint {
			position: absolute;
			bottom: var(--spacing-lg);
			left: var(--spacing-lg);
			font-size: 11px;
			color: var(--text-secondary);
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			padding: var(--spacing-sm) var(--spacing-md);
			border-radius: var(--border-radius-medium);
			border: 1px solid var(--glass-border);
			opacity: 0.7;
			pointer-events: none;
		}
		
		/* =================================================================
		   DETAILS PANEL
		   ================================================================= */
		
		.details-panel {
			background: var(--surface-primary);
			backdrop-filter: blur(12px);
			border-top: 1px solid var(--border-subtle);
			flex-shrink: 0;
		}
		
		.details-toggle {
			width: 100%;
			background: transparent;
			border: none;
			padding: var(--spacing-lg) var(--spacing-xxl);
			color: var(--text-primary);
			cursor: pointer;
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 13px;
			font-weight: 500;
			border-bottom: 1px solid var(--border-subtle);
			transition: background-color var(--transition-normal);
		}
		
		.details-toggle:hover {
			background: var(--glass-overlay);
		}
		
		.details-content {
			max-height: 0;
			overflow: hidden;
			transition: max-height var(--transition-slow);
			position: relative;
		}
		
		.details-content.expanded {
			max-height: calc(50vh - 60px);
			overflow-y: auto;
		}
		
		.details-inner {
			padding: var(--spacing-xxl);
		}
		
		/* =================================================================
		   STATS CARDS
		   ================================================================= */
		
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 15px;
			margin-bottom: var(--spacing-xl);
		}
		
		.stat-card {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			padding: var(--spacing-lg);
			border-radius: var(--border-radius-large);
			text-align: center;
			border: 1px solid var(--glass-border);
			transition: transform var(--transition-normal);
		}
		
		.stat-card:hover {
			transform: translateY(-2px);
			background: var(--surface-tertiary);
		}
		
		.stat-number {
			font-size: 1.8em;
			font-weight: 600;
			color: var(--primary-accent);
			margin-bottom: var(--spacing-xs);
		}
		
		.stat-label {
			color: var(--text-secondary);
			font-size: 0.85em;
			font-weight: 500;
		}
		
		/* =================================================================
		   TABS SYSTEM
		   ================================================================= */
		
		.tabs {
			display: flex;
			border-bottom: 1px solid var(--border-subtle);
			margin-bottom: var(--spacing-xl);
			background: var(--glass-overlay);
			border-radius: var(--border-radius-large) var(--border-radius-large) 0 0;
			backdrop-filter: blur(8px);
		}
		
		.tab {
			background: transparent;
			border: none;
			padding: var(--spacing-md) var(--spacing-xl);
			cursor: pointer;
			color: var(--text-secondary);
			border-bottom: 2px solid transparent;
			font-size: 12px;
			font-weight: 500;
			transition: all var(--transition-normal);
		}
		
		.tab:hover {
			color: var(--text-primary);
			background: var(--glass-overlay);
		}
		
		.tab.active {
			color: var(--primary-accent);
			border-bottom-color: var(--primary-accent);
			background: var(--surface-tertiary);
		}
		
		.tab-content {
			display: none;
		}
		
		.tab-content.active {
			display: block;
		}
		
		/* =================================================================
		   CODE BLOCKS & FILE TREE
		   ================================================================= */
		
		.code-block {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border: 1px solid var(--glass-border);
			border-left: 3px solid var(--primary-accent);
			padding: var(--spacing-lg);
			border-radius: var(--border-radius-medium);
			font-family: var(--vscode-editor-font-family);
			font-size: 11px;
			white-space: pre-wrap;
			overflow-x: auto;
			max-height: 200px;
			overflow-y: auto;
			line-height: 1.4;
		}
		
		.file-tree {
			font-family: monospace;
			font-size: 11px;
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			padding: var(--spacing-lg);
			border-radius: var(--border-radius-medium);
			border: 1px solid var(--glass-border);
			max-height: 200px;
			overflow-y: auto;
			line-height: 1.4;
		}
		
		.tree-item {
			margin: 1px 0;
			padding: 1px 0;
		}
		
		.tree-directory {
			color: var(--primary-accent);
			font-weight: 600;
		}
		
		.tree-file {
			color: var(--text-primary);
		}

		/* =================================================================
		   API STATUS COMPONENTS
		   ================================================================= */
		
		.api-status-card {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border: 1px solid var(--glass-border);
			border-radius: var(--border-radius-medium);
			padding: var(--spacing-lg);
		}

		.api-status-indicator {
			display: flex;
			align-items: center;
			gap: var(--spacing-md);
			margin-bottom: var(--spacing-sm);
		}

		.api-status-indicator span:first-child {
			font-size: 18px;
		}

		.api-status-indicator span:last-child {
			font-weight: 500;
			color: var(--text-primary);
		}

		.api-status-description {
			color: var(--text-secondary);
			font-size: 12px;
			line-height: 1.4;
		}

		.api-status-configured {
			border-color: rgba(34, 197, 94, 0.4);
			background: rgba(34, 197, 94, 0.08);
		}

		.api-status-not-configured {
			border-color: rgba(251, 191, 36, 0.4);
			background: rgba(251, 191, 36, 0.08);
		}

		.api-actions {
			display: flex;
			align-items: center;
			gap: var(--spacing-md);
		}

		/* =================================================================
		   ERROR NOTIFICATION SYSTEM
		   ================================================================= */
		
		.api-error-notification {
			position: fixed;
			top: 20px;
			right: 20px;
			background: var(--glass-overlay);
			backdrop-filter: blur(12px);
			border: 1px solid rgba(239, 68, 68, 0.4);
			border-radius: var(--border-radius-medium);
			padding: var(--spacing-lg);
			max-width: 400px;
			z-index: 1000;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
			transform: translateX(100%);
			transition: transform var(--transition-slow);
		}

		.api-error-notification.show {
			transform: translateX(0);
		}

		.api-error-notification.insufficient-credits {
			border-color: rgba(251, 191, 36, 0.4);
			background: rgba(251, 191, 36, 0.08);
		}

		.api-error-notification.rate-limit {
			border-color: rgba(59, 130, 246, 0.4);
			background: rgba(59, 130, 246, 0.08);
		}

		.api-error-notification.auth-error {
			border-color: rgba(239, 68, 68, 0.4);
			background: rgba(239, 68, 68, 0.08);
		}

		.error-notification-header {
			display: flex;
			align-items: center;
			gap: var(--spacing-md);
			margin-bottom: var(--spacing-sm);
		}

		.error-notification-icon {
			font-size: 18px;
		}

		.error-notification-title {
			font-weight: 600;
			color: var(--text-primary);
		}

		.error-notification-close {
			margin-left: auto;
			background: none;
			border: none;
			color: var(--text-secondary);
			cursor: pointer;
			font-size: 16px;
			padding: 2px;
		}

		.error-notification-body {
			font-size: 12px;
			color: var(--text-secondary);
			line-height: 1.4;
			margin-bottom: var(--spacing-md);
		}

		.error-notification-actions {
			display: flex;
			gap: var(--spacing-sm);
		}

		.error-notification-btn {
			background: var(--glass-overlay);
			border: 1px solid var(--glass-border);
			color: var(--text-primary);
			padding: 6px 10px;
			border-radius: var(--border-radius-small);
			cursor: pointer;
			font-size: 11px;
			transition: all var(--transition-normal);
		}

		.error-notification-btn:hover {
			background: var(--glass-overlay-hover);
		}

		.error-notification-btn.primary {
			background: var(--primary-accent);
			border-color: var(--primary-accent);
			color: white;
		}
	</style>
</head>
<body>
	<div class="main-container">
		<div class="header">
			<h1>GraphIt - Professional Code Analysis</h1>
			<div class="header-controls">
				<span class="zoom-indicator" id="zoomIndicator">200%</span>
				<div class="status-indicator" id="statusIndicator">
					<span>Initializing...</span>
				</div>
				<label class="auto-refresh-toggle">
					<input type="checkbox" id="autoRefreshToggle" checked onchange="toggleAutoRefresh()">
					<span>Auto-refresh</span>
				</label>
				<button class="btn btn-small" id="refreshBtn" onclick="regenerateFlowchart()">
					Refresh
				</button>
				<button class="btn btn-small" id="analysisToggleBtn" onclick="toggleAnalysisMode()" title="Switch between repository and function analysis">
					Function Analysis
				</button>
				<button class="btn btn-small" onclick="copyMermaidCode()">
					Copy Code
				</button>
				<button class="btn btn-small" onclick="downloadSVG()">
					Download SVG
				</button>
				<button class="btn btn-small" onclick="resetZoom()" title="Reset to 200% zoom (double-click diagram)">
					Reset View
				</button>
				<button class="btn btn-small" id="configApiBtn" onclick="configureApiKey()" title="Configure Anthropic API key for AI-powered flowcharts">
					⚙️ API Key
				</button>
			</div>
		</div>
		
		<div class="flowchart-container">
			<div class="diagram-viewport" id="diagramViewport">
				<div id="mermaid-diagram"></div>
				<div class="pan-hint">Drag to pan • Scroll to zoom • Double-click to reset</div>
				<div id="loadingOverlay" class="loading-overlay">
					<div class="spinner"></div>
					<div class="loading-text" id="loadingText">
						<div>Analyzing repository structure...</div>
						<div style="font-size: 11px; margin-top: 5px;">This may take a moment for large repositories</div>
					</div>
				</div>
				<div id="errorMessage" class="error-message" style="display: none;"></div>
			</div>
		</div>
		
		<div class="details-panel">
			<button class="details-toggle" onclick="toggleDetails()">
				<span>Repository & Function Analysis</span>
				<span id="toggleIcon">▲</span>
			</button>
			<div class="details-content" id="detailsContent">
				<div class="details-inner">
					<div id="stats" class="stats-grid"></div>
					
					<div class="tabs">
						<button class="tab active" onclick="switchTab('structure')">Structure</button>
						<button class="tab" onclick="switchTab('mermaid')">Mermaid Code</button>
						<button class="tab" onclick="switchTab('claude')">Claude Prompt</button>
						<button class="tab" onclick="switchTab('api')">API Settings</button>
					</div>
					
					<div id="structure-tab" class="tab-content active">
						<div id="structure" class="file-tree"></div>
					</div>
					
					<div id="mermaid-tab" class="tab-content">
						<div id="mermaidCode" class="code-block"></div>
					</div>
					
					<div id="claude-tab" class="tab-content">
						<p style="margin-top: 0; font-size: 12px; color: var(--vscode-descriptionForeground);">
							Copy this prompt to use with Claude for enhanced flowchart generation:
						</p>
						<div id="claudePrompt" class="code-block"></div>
						<button class="btn btn-small" onclick="copyPrompt()" style="margin-top: 10px;">
							Copy Claude Prompt
						</button>
					</div>

					<div id="api-tab" class="tab-content">
						<div id="apiSettings">
							<h3 style="margin-top: 0; margin-bottom: 15px; color: var(--text-primary);">Anthropic API Configuration</h3>
							
							<div id="apiStatus" class="api-status-card">
								<div class="api-status-indicator">
									<span id="apiStatusIcon">⚙️</span>
									<span id="apiStatusText">Checking API status...</span>
								</div>
								<div class="api-status-description">
									<p id="apiStatusDescription">Loading configuration...</p>
								</div>
							</div>

							<div class="api-actions" style="margin-top: 15px;">
								<button class="btn" onclick="configureApiKey()" style="margin-right: 10px;">
									Configure API Key
								</button>
								<button class="btn btn-small" onclick="vscode.postMessage({ command: 'checkApiStatus' })">
									Refresh Status
								</button>
							</div>

							<div class="api-info" style="margin-top: 20px; padding: 15px; background: var(--glass-overlay); border-radius: var(--border-radius-medium); border: 1px solid var(--glass-border);">
								<h4 style="margin-top: 0; margin-bottom: 10px; color: var(--text-primary);">Benefits of AI-Powered Flowcharts:</h4>
								<ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 12px; line-height: 1.5;">
									<li>Enhanced architectural insights</li>
									<li>Intelligent component relationships</li>
									<li>Professional-grade flowchart styling</li>
									<li>Context-aware project analysis</li>
								</ul>
								<p style="margin-top: 10px; margin-bottom: 0; font-size: 11px; color: var(--text-muted);">
									Get your API key from <a href="https://console.anthropic.com" style="color: var(--primary-accent); text-decoration: none;">console.anthropic.com</a>
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let currentAnalysis = null;
		let currentMermaidCode = null;
		let detailsExpanded = false;
		let currentZoom = 2.0;
		let panX = 0;
		let panY = 0;
		let isDragging = false;
		let lastMouseX = 0;
		let lastMouseY = 0;
		let currentViewMode = 'repository'; // 'repository' or 'function'
		let currentFunctionAnalysis = null;
		
		document.addEventListener('DOMContentLoaded', () => {
			mermaid.initialize({ 
				startOnLoad: false,
				theme: 'base',
				themeVariables: {
					// Use direct color values for reliable text visibility
					primaryColor: 'rgba(128, 128, 128, 0.15)',
					primaryTextColor: 'rgba(220, 220, 220, 0.98)',
					primaryBorderColor: 'rgba(128, 128, 128, 0.6)',
					lineColor: 'rgba(128, 128, 128, 0.8)',
					secondaryColor: 'rgba(112, 112, 112, 0.12)',
					tertiaryColor: 'rgba(96, 96, 96, 0.1)',
					background: 'transparent',
					mainBkg: 'rgba(128, 128, 128, 0.15)',
					secondBkg: 'rgba(112, 112, 112, 0.12)',
					tertiaryTextColor: 'rgba(200, 200, 200, 0.9)',
					labelTextColor: 'rgba(220, 220, 220, 0.98)',
					textColor: 'rgba(220, 220, 220, 0.98)',
					nodeTextColor: 'rgba(220, 220, 220, 0.98)',
					nodeBkg: 'rgba(128, 128, 128, 0.15)',
					edgeLabelBackground: 'rgba(128, 128, 128, 0.1)',
					edgeLabelColor: 'rgba(200, 200, 200, 0.9)',
					clusterBkg: 'rgba(128, 128, 128, 0.12)',
					clusterBorder: 'rgba(128, 128, 128, 0.4)',
					altBackground: 'rgba(96, 96, 96, 0.1)',
					fontFamily: 'Segoe UI, system-ui, sans-serif',
					fontSize: '14px'
				}
			});
			
			// Initialize button state and check API status
			updateAnalysisButton();
			vscode.postMessage({ command: 'checkApiStatus' });
			
			setTimeout(autoStartAnalysis, 500);
			setupZoomAndPanControls();
		});

		function autoStartAnalysis() {
			updateStatus('Analyzing repository...', 'analyzing');
			vscode.postMessage({ command: 'analyzeRepository' });
		}

		function regenerateFlowchart() {
			if (!currentAnalysis) {
				autoStartAnalysis();
				return;
			}
			updateStatus('Generating flowchart...', 'generating');
			showLoading();
			vscode.postMessage({ command: 'generateFlowchart', data: currentAnalysis });
		}

		function generateFunctionChart() {
			updateStatus('Analyzing functions...', 'generating');
			showLoading();
			vscode.postMessage({ command: 'generateFunctionFlowchart', data: {} });
		}

		function toggleAnalysisMode() {
			if (currentViewMode === 'repository') {
				// Switch to function analysis
				updateStatus('Analyzing functions...', 'generating');
				showLoading();
				vscode.postMessage({ command: 'generateFunctionFlowchart', data: {} });
			} else {
				// Switch back to repository analysis
				if (currentAnalysis) {
					updateStatus('Generating repository flowchart...', 'generating');
					showLoading();
					vscode.postMessage({ command: 'generateFlowchart', data: currentAnalysis });
				} else {
					autoStartAnalysis();
				}
			}
		}

		function updateAnalysisButton() {
			const button = document.getElementById('analysisToggleBtn');
			if (currentViewMode === 'repository') {
				button.textContent = 'Function Analysis';
				button.title = 'Switch to detailed function-level analysis';
			} else {
				button.textContent = 'Repository Analysis';
				button.title = 'Switch back to repository structure analysis';
			}
		}

		function updateStatus(text, state) {
			const indicator = document.getElementById('statusIndicator');
			indicator.innerHTML = \`<span>\${text}</span>\`;
			document.getElementById('refreshBtn').disabled = (state === 'analyzing' || state === 'generating');
		}

		function showLoading() {
			document.getElementById('loadingOverlay').classList.remove('hidden');
		}

		function hideLoading() {
			document.getElementById('loadingOverlay').classList.add('hidden');
		}

		function setupZoomAndPanControls() {
			const diagramViewport = document.getElementById('diagramViewport');
			
			// Mouse wheel zoom
			diagramViewport.addEventListener('wheel', (e) => {
				e.preventDefault();
				const rect = diagramViewport.getBoundingClientRect();
				const mouseX = e.clientX - rect.left;
				const mouseY = e.clientY - rect.top;
				
				const zoomSensitivity = 0.001;
				const zoomDirection = e.deltaY > 0 ? -1 : 1;
				const zoomFactor = 1 + (zoomDirection * zoomSensitivity * Math.abs(e.deltaY));
				
				const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 6.0);
				
				// Zoom towards mouse position
				const zoomRatio = newZoom / currentZoom;
				panX = mouseX - (mouseX - panX) * zoomRatio;
				panY = mouseY - (mouseY - panY) * zoomRatio;
				
				currentZoom = newZoom;
				applyTransform();
			});

			// Mouse drag for panning
			diagramViewport.addEventListener('mousedown', (e) => {
				isDragging = true;
				lastMouseX = e.clientX;
				lastMouseY = e.clientY;
				diagramViewport.classList.add('dragging');
				e.preventDefault();
			});

			document.addEventListener('mousemove', (e) => {
				if (!isDragging) return;
				
				const deltaX = e.clientX - lastMouseX;
				const deltaY = e.clientY - lastMouseY;
				
				panX += deltaX;
				panY += deltaY;
				
				lastMouseX = e.clientX;
				lastMouseY = e.clientY;
				
				applyTransform();
			});

			document.addEventListener('mouseup', () => {
				isDragging = false;
				diagramViewport.classList.remove('dragging');
			});

			// Double-click to reset
			diagramViewport.addEventListener('dblclick', () => {
				resetZoom();
			});

			// Prevent text selection during drag
			diagramViewport.addEventListener('selectstart', (e) => {
				if (isDragging) e.preventDefault();
			});
		}

		function applyTransform() {
			const diagram = document.getElementById('mermaid-diagram');
			diagram.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${currentZoom})\`;
			document.getElementById('zoomIndicator').textContent = \`\${Math.round(currentZoom * 100)}%\`;
		}

		function resetZoom() {
			currentZoom = 2.0;
			panX = 0;
			panY = 0;
			applyTransform();
		}

		async function renderMermaidDiagram(mermaidCode) {
			const element = document.getElementById('mermaid-diagram');
			element.innerHTML = '';
			
			try {
				const { svg } = await mermaid.render('mermaid-svg', mermaidCode);
				element.innerHTML = svg;
				hideLoading();
			} catch (error) {
				console.error('GraphIt: Error rendering Mermaid diagram:', error);
				document.getElementById('errorMessage').textContent = 'Failed to render diagram: ' + error.message;
				document.getElementById('errorMessage').style.display = 'block';
				hideLoading();
			}
		}

		function toggleDetails() {
			detailsExpanded = !detailsExpanded;
			const content = document.getElementById('detailsContent');
			const icon = document.getElementById('toggleIcon');
			
			if (detailsExpanded) {
				content.classList.add('expanded');
				icon.textContent = '▼';
			} else {
				content.classList.remove('expanded');
				icon.textContent = '▲';
			}
		}
		
		function switchTab(tabName) {
			document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
			event.target.classList.add('active');
			document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
			document.getElementById(tabName + '-tab').classList.add('active');
		}

		function copyMermaidCode() {
			if (currentMermaidCode) {
				navigator.clipboard.writeText(currentMermaidCode);
			}
		}

		function copyPrompt() {
			const promptElement = document.getElementById('claudePrompt');
			navigator.clipboard.writeText(promptElement.textContent);
		}

		function downloadSVG() {
			const svgElement = document.querySelector('#mermaid-diagram svg');
			if (svgElement) {
				const svgData = new XMLSerializer().serializeToString(svgElement);
				const blob = new Blob([svgData], { type: 'image/svg+xml' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'repository-flowchart.svg';
				a.click();
				URL.revokeObjectURL(url);
			}
		}

		function toggleAutoRefresh() {
			const checkbox = document.getElementById('autoRefreshToggle');
			vscode.postMessage({ command: 'toggleAutoRefresh', enabled: checkbox.checked });
		}

		function configureApiKey() {
			vscode.postMessage({ command: 'configureApiKey' });
		}

		function updateApiStatus(statusData) {
			// Update header button
			const button = document.getElementById('configApiBtn');
			if (statusData.hasApiKey && statusData.isConfigured) {
				button.textContent = '✅ API Key';
				button.title = 'Anthropic API key configured - AI-powered flowcharts enabled';
				button.style.background = 'rgba(34, 197, 94, 0.15)';
				button.style.borderColor = 'rgba(34, 197, 94, 0.4)';
			} else {
				button.textContent = '⚙️ API Key';
				button.title = 'Configure Anthropic API key for AI-powered flowcharts';
				button.style.background = '';
				button.style.borderColor = '';
			}

			// Update API settings tab
			const apiStatusCard = document.getElementById('apiStatus');
			const apiStatusIcon = document.getElementById('apiStatusIcon');
			const apiStatusText = document.getElementById('apiStatusText');
			const apiStatusDescription = document.getElementById('apiStatusDescription');

			if (statusData.hasApiKey && statusData.isConfigured) {
				apiStatusCard.className = 'api-status-card api-status-configured';
				apiStatusIcon.textContent = '✅';
				apiStatusText.textContent = 'API Key Configured';
				apiStatusDescription.innerHTML = 'Your Anthropic API key is configured and ready. AI-powered flowcharts are enabled for enhanced analysis and beautiful diagrams.';
			} else {
				apiStatusCard.className = 'api-status-card api-status-not-configured';
				apiStatusIcon.textContent = '⚠️';
				apiStatusText.textContent = 'API Key Not Configured';
				apiStatusDescription.innerHTML = 'Configure your Anthropic API key to unlock AI-powered flowcharts with enhanced architectural insights and professional styling.';
			}
		}

		function showApiErrorNotification(errorType, title, message, actions = []) {
			// Remove any existing notifications
			const existingNotification = document.querySelector('.api-error-notification');
			if (existingNotification) {
				existingNotification.remove();
			}

			// Create notification element
			const notification = document.createElement('div');
			notification.className = \`api-error-notification \${errorType}\`;

			const iconMap = {
				'insufficient-credits': '💳',
				'rate-limit': '⏰',
				'auth-error': '🔐',
				'quota-exceeded': '📊',
				'generic': '⚠️'
			};

			const icon = iconMap[errorType] || iconMap['generic'];

			// Build actions HTML
			let actionsHtml = '';
			if (actions.length > 0) {
				actionsHtml = '<div class="error-notification-actions">';
				actions.forEach((action, index) => {
					const isPrimary = index === 0 ? 'primary' : '';
					actionsHtml += \`<button class="error-notification-btn \${isPrimary}" onclick="\${action.action}">\${action.label}</button>\`;
				});
				actionsHtml += '</div>';
			}

			notification.innerHTML = \`
				<div class="error-notification-header">
					<span class="error-notification-icon">\${icon}</span>
					<span class="error-notification-title">\${title}</span>
					<button class="error-notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
				</div>
				<div class="error-notification-body">\${message}</div>
				\${actionsHtml}
			\`;

			// Add to DOM and show
			document.body.appendChild(notification);
			setTimeout(() => notification.classList.add('show'), 100);

			// Auto-hide after 10 seconds
			setTimeout(() => {
				if (notification.parentElement) {
					notification.classList.remove('show');
					setTimeout(() => notification.remove(), 300);
				}
			}, 10000);
		}

		function showInsufficientCreditsNotification() {
			showApiErrorNotification(
				'insufficient-credits',
				'Insufficient API Credits',
				'Your Anthropic account doesn\\'t have enough credits. GraphIt will use local generation instead.',
				[
					{ label: 'Add Credits', action: 'openAnthropicBilling()' },
					{ label: 'Configure Key', action: 'configureApiKey()' }
				]
			);
		}

		function showRateLimitNotification() {
			showApiErrorNotification(
				'rate-limit',
				'Rate Limit Exceeded',
				'You\\'ve hit the API rate limit. This is temporary - GraphIt will use local generation for now.',
				[
					{ label: 'Check Usage', action: 'openAnthropicUsage()' },
					{ label: 'Continue Local', action: 'acknowledgeLocalGeneration()' }
				]
			);
		}

		function showAuthErrorNotification() {
			showApiErrorNotification(
				'auth-error',
				'Authentication Failed',
				'Your API key may be invalid or expired. GraphIt will use local generation instead.',
				[
					{ label: 'Reconfigure', action: 'configureApiKey()' },
					{ label: 'Check Console', action: 'openAnthropicKeys()' }
				]
			);
		}

		function showQuotaExceededNotification() {
			showApiErrorNotification(
				'quota-exceeded',
				'Monthly Quota Exceeded',
				'You\\'ve reached your monthly usage quota. GraphIt will use local generation until reset.',
				[
					{ label: 'Upgrade Plan', action: 'openAnthropicBilling()' },
					{ label: 'View Usage', action: 'openAnthropicUsage()' }
				]
			);
		}

		function openAnthropicBilling() {
			vscode.postMessage({ command: 'openExternal', url: 'https://console.anthropic.com/account/billing' });
		}

		function openAnthropicUsage() {
			vscode.postMessage({ command: 'openExternal', url: 'https://console.anthropic.com/account/usage' });
		}

		function openAnthropicKeys() {
			vscode.postMessage({ command: 'openExternal', url: 'https://console.anthropic.com/account/keys' });
		}

		function acknowledgeLocalGeneration() {
			const notification = document.querySelector('.api-error-notification');
			if (notification) notification.remove();
			updateStatus('Using local generation', 'completed');
		}

		function renderStats(stats, functionAnalysis = null) {
			let statsHtml = '';
			
			if (currentViewMode === 'function' && functionAnalysis) {
				// Function analysis stats
				const metadata = functionAnalysis.metadata || {};
				const functions = functionAnalysis.functions || [];
				const importantFunctions = functions.filter(f => f.importance > 5);
				const entryPoints = functions.filter(f => f.isEntryPoint);
				
				statsHtml = \`
					<div class="stat-card">
						<div class="stat-number">\${metadata.totalFunctions || 0}</div>
						<div class="stat-label">Total Functions</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">\${importantFunctions.length}</div>
						<div class="stat-label">Important Functions</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">\${entryPoints.length}</div>
						<div class="stat-label">Entry Points</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">\${metadata.totalClasses || 0}</div>
						<div class="stat-label">Classes</div>
					</div>
				\`;
			} else {
				// Repository analysis stats
				statsHtml = \`
					<div class="stat-card">
						<div class="stat-number">\${stats.totalFiles}</div>
						<div class="stat-label">Files</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">\${stats.totalDirectories}</div>
						<div class="stat-label">Directories</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">\${stats.totalLines.toLocaleString()}</div>
						<div class="stat-label">Lines of Code</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">\${Object.keys(stats.fileTypes).length}</div>
						<div class="stat-label">File Types</div>
					</div>
				\`;
			}
			
			document.getElementById('stats').innerHTML = statsHtml;
		}

		function renderStructure(structure, level = 0) {
			let html = '';
			const indent = '  '.repeat(level);
			
			for (const item of structure) {
				const className = item.type === 'directory' ? 'tree-directory' : 'tree-file';
				html += \`<div class="tree-item \${className}">\${indent}\${item.name}</div>\`;
				
				if (item.children && item.children.length > 0) {
					html += renderStructure(item.children, level + 1);
				}
			}
			return html;
		}

		// Message handling
		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.command) {
				case 'repositoryAnalyzed':
					currentAnalysis = message.data;
					updateStatus('Generating flowchart...', 'generating');
					renderStats(message.data.stats);
					document.getElementById('structure').innerHTML = renderStructure(message.data.structure);
					vscode.postMessage({ command: 'generateFlowchart', data: currentAnalysis });
					break;
					
				case 'flowchartGenerated':
					currentMermaidCode = message.data.mermaidCode;
					document.getElementById('claudePrompt').textContent = message.data.claudePrompt;
					document.getElementById('mermaidCode').textContent = message.data.mermaidCode;
					updateStatus('Generated successfully', 'completed');
					currentViewMode = 'repository';
					document.querySelector('.header h1').textContent = 'GraphIt - Repository Analysis';
					updateAnalysisButton();
					// Re-render repository stats
					if (currentAnalysis && currentAnalysis.stats) {
						renderStats(currentAnalysis.stats);
					}
					renderMermaidDiagram(message.data.mermaidCode);
					break;

				case 'functionFlowchartGenerated':
					currentMermaidCode = message.data.mermaidCode;
					currentFunctionAnalysis = message.data.functionAnalysis;
					document.getElementById('claudePrompt').textContent = message.data.claudePrompt;
					document.getElementById('mermaidCode').textContent = message.data.mermaidCode;
					updateStatus('Function analysis completed', 'completed');
					currentViewMode = 'function';
					document.querySelector('.header h1').textContent = 'GraphIt - Function Level Analysis';
					updateAnalysisButton();
					// Render function analysis stats
					renderStats(currentAnalysis?.stats || {}, currentFunctionAnalysis);
					renderMermaidDiagram(message.data.mermaidCode);
					break;
					
				case 'autoRefreshStarted':
					updateStatus('Auto-refreshing...', 'analyzing');
					break;

				case 'apiStatusUpdate':
					updateApiStatus(message.data);
					break;

				case 'apiKeyConfigured':
					if (message.data.success) {
						// Show temporary success indicator
						const button = document.getElementById('configApiBtn');
						const originalText = button.textContent;
						button.textContent = '✅ Saved!';
						setTimeout(() => {
							button.textContent = originalText;
						}, 2000);
					}
					break;

				case 'apiError':
					const errorType = message.data.type;
					switch (errorType) {
						case 'insufficient-credits':
							showInsufficientCreditsNotification();
							break;
						case 'rate-limit':
							showRateLimitNotification();
							break;
						case 'auth-error':
							showAuthErrorNotification();
							break;
						case 'quota-exceeded':
							showQuotaExceededNotification();
							break;
						default:
							showApiErrorNotification('generic', 'API Error', message.data.message || 'An error occurred with the Anthropic API');
					}
					break;

				case 'openExternal':
					// This is handled by extension.js but we define it here for completeness
					break;
			}
		});
	</script>
</body>
</html>`;
	}
}

module.exports = WebviewManager; 