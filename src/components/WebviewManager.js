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
		body {
			font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			margin: 0;
			padding: 0;
			line-height: 1.6;
			overflow-x: hidden;
			--primary-accent: #666;
			--surface-primary: rgba(128, 128, 128, 0.1);
			--surface-secondary: rgba(96, 96, 96, 0.05);
			--surface-tertiary: rgba(112, 112, 112, 0.15);
			--border-subtle: rgba(128, 128, 128, 0.2);
			--text-primary: var(--vscode-editor-foreground);
			--text-secondary: var(--vscode-descriptionForeground);
			--glass-overlay: rgba(128, 128, 128, 0.08);
			--glass-border: rgba(128, 128, 128, 0.15);
		}
		
		.main-container {
			display: flex;
			flex-direction: column;
			height: 100vh;
			min-height: 600px;
		}
		
		.header {
			background: var(--surface-primary);
			backdrop-filter: blur(12px);
			padding: 16px 24px;
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
		
		.zoom-indicator {
			font-size: 11px;
			color: var(--text-primary);
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border: 1px solid var(--glass-border);
			padding: 4px 8px;
			border-radius: 6px;
			margin-right: 12px;
			font-family: monospace;
			font-weight: 500;
		}
		
		.btn {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			color: var(--text-primary);
			border: 1px solid var(--glass-border);
			padding: 8px 12px;
			border-radius: 6px;
			cursor: pointer;
			font-size: 12px;
			display: flex;
			align-items: center;
			gap: 6px;
			transition: all 0.2s ease;
			font-weight: 500;
		}
		
		.btn:hover {
			background: rgba(128, 128, 128, 0.2);
			border-color: rgba(128, 128, 128, 0.3);
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
			padding: 6px 10px;
			font-size: 11px;
		}
		
		.status-indicator {
			font-size: 11px;
			color: var(--text-secondary);
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 4px 8px;
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border-radius: 4px;
			border: 1px solid var(--glass-border);
		}
		
		.auto-refresh-toggle {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			color: var(--text-secondary);
			cursor: pointer;
			padding: 4px 8px;
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border-radius: 4px;
			border: 1px solid var(--glass-border);
			transition: all 0.2s ease;
		}
		
		.auto-refresh-toggle:hover {
			background: var(--surface-tertiary);
		}
		
		.auto-refresh-toggle input[type="checkbox"] {
			margin: 0;
			accent-color: var(--primary-accent);
		}
		
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
			margin: 8px;
			border-radius: 8px;
			cursor: grab;
		}
		
		.diagram-viewport.dragging {
			cursor: grabbing;
		}
		
		#mermaid-diagram {
			max-width: none;
			max-height: none;
			transition: transform 0.1s ease;
			transform-origin: center center;
			cursor: inherit;
			user-select: none;
		}
		
		/* Professional semitransparent styling for Mermaid diagrams */
		#mermaid-diagram svg text,
		#mermaid-diagram svg .nodeLabel,
		#mermaid-diagram svg .edgeLabel,
		#mermaid-diagram svg .label {
			font-family: 'Segoe UI', system-ui, sans-serif !important;
			font-weight: 500 !important;
			font-size: 14px !important;
			fill: rgba(255, 255, 255, 0.9) !important;
		}
		
		/* Ensure all text is visible in dark mode */
		#mermaid-diagram svg .nodeLabel text,
		#mermaid-diagram svg .edgeLabel text,
		#mermaid-diagram svg .cluster text,
		#mermaid-diagram svg .titleText,
		#mermaid-diagram svg .node text {
			fill: rgba(255, 255, 255, 0.9) !important;
			color: rgba(255, 255, 255, 0.9) !important;
		}
		
		#mermaid-diagram svg .edgePath .path {
			stroke-width: 2px !important;
			stroke: rgba(128, 128, 128, 0.8) !important;
		}
		
		/* Edge labels with transparent backgrounds */
		#mermaid-diagram svg .edgeLabel rect,
		#mermaid-diagram svg .edgeLabel .label-container {
			fill: rgba(128, 128, 128, 0.1) !important;
			stroke: rgba(128, 128, 128, 0.3) !important;
			stroke-width: 1px !important;
		}
		
		/* Semitransparent subgraph styling */
		#mermaid-diagram svg .cluster rect {
			rx: 4px !important;
			ry: 4px !important;
			fill: rgba(128, 128, 128, 0.12) !important;
			stroke: rgba(128, 128, 128, 0.4) !important;
			stroke-width: 2px !important;
		}
		
		/* Node styling with transparency */
		#mermaid-diagram svg .node rect,
		#mermaid-diagram svg .node circle,
		#mermaid-diagram svg .node polygon {
			fill: rgba(128, 128, 128, 0.15) !important;
			stroke: rgba(128, 128, 128, 0.6) !important;
			stroke-width: 2px !important;
		}
		
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
			color: var(--vscode-descriptionForeground);
			text-align: center;
		}
		
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
			padding: 16px 24px;
			color: var(--text-primary);
			cursor: pointer;
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 13px;
			font-weight: 500;
			border-bottom: 1px solid var(--border-subtle);
			transition: background-color 0.2s ease;
		}
		
		.details-toggle:hover {
			background: var(--glass-overlay);
		}
		
		.details-content {
			max-height: 0;
			overflow: hidden;
			transition: max-height 0.3s ease;
			position: relative;
		}
		
		.details-content.expanded {
			max-height: calc(50vh - 60px);
			overflow-y: auto;
		}
		
		.details-inner {
			padding: 24px;
		}
		
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 15px;
			margin-bottom: 20px;
		}
		
		.stat-card {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			padding: 16px;
			border-radius: 8px;
			text-align: center;
			border: 1px solid var(--glass-border);
			transition: transform 0.2s ease;
		}
		
		.stat-card:hover {
			transform: translateY(-2px);
			background: var(--surface-tertiary);
		}
		
		.stat-number {
			font-size: 1.8em;
			font-weight: 600;
			color: var(--primary-accent);
			margin-bottom: 4px;
		}
		
		.stat-label {
			color: var(--text-secondary);
			font-size: 0.85em;
			font-weight: 500;
		}
		
		.tabs {
			display: flex;
			border-bottom: 1px solid var(--border-subtle);
			margin-bottom: 20px;
			background: var(--glass-overlay);
			border-radius: 8px 8px 0 0;
			backdrop-filter: blur(8px);
		}
		
		.tab {
			background: transparent;
			border: none;
			padding: 12px 20px;
			cursor: pointer;
			color: var(--text-secondary);
			border-bottom: 2px solid transparent;
			font-size: 12px;
			font-weight: 500;
			transition: all 0.2s ease;
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
		
		.code-block {
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			border: 1px solid var(--glass-border);
			border-left: 3px solid var(--primary-accent);
			padding: 16px;
			border-radius: 6px;
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
			padding: 16px;
			border-radius: 6px;
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
		
		.error-message {
			color: var(--vscode-errorForeground);
			background: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			padding: 15px;
			border-radius: 4px;
			margin: 20px;
		}

		.pan-hint {
			position: absolute;
			bottom: 16px;
			left: 16px;
			font-size: 11px;
			color: var(--text-secondary);
			background: var(--glass-overlay);
			backdrop-filter: blur(8px);
			padding: 8px 12px;
			border-radius: 6px;
			border: 1px solid var(--glass-border);
			opacity: 0.7;
			pointer-events: none;
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
				<button class="btn btn-small" onclick="generateFunctionChart()" title="Generate detailed function-only flowchart">
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
		
		document.addEventListener('DOMContentLoaded', () => {
			mermaid.initialize({ 
				startOnLoad: false,
				theme: 'base',
				themeVariables: {
					// Dark mode optimized semitransparent color scheme
					primaryColor: 'rgba(128, 128, 128, 0.15)',
					primaryTextColor: 'rgba(255, 255, 255, 0.9)',
					primaryBorderColor: 'rgba(128, 128, 128, 0.6)',
					lineColor: 'rgba(128, 128, 128, 0.8)',
					secondaryColor: 'rgba(112, 112, 112, 0.12)',
					tertiaryColor: 'rgba(96, 96, 96, 0.1)',
					background: 'transparent',
					mainBkg: 'rgba(128, 128, 128, 0.15)',
					secondBkg: 'rgba(112, 112, 112, 0.12)',
					tertiaryTextColor: 'rgba(255, 255, 255, 0.8)',
					labelTextColor: 'rgba(255, 255, 255, 0.9)',
					textColor: 'rgba(255, 255, 255, 0.9)',
					nodeTextColor: 'rgba(255, 255, 255, 0.9)',
					nodeBkg: 'rgba(128, 128, 128, 0.15)',
					edgeLabelBackground: 'rgba(128, 128, 128, 0.1)',
					edgeLabelColor: 'rgba(255, 255, 255, 0.9)',
					clusterBkg: 'rgba(128, 128, 128, 0.12)',
					clusterBorder: 'rgba(128, 128, 128, 0.4)',
					altBackground: 'rgba(96, 96, 96, 0.1)',
					fontFamily: 'Segoe UI, system-ui, sans-serif',
					fontSize: '14px'
				}
			});
			
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

		function renderStats(stats) {
			const statsHtml = \`
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
					renderMermaidDiagram(message.data.mermaidCode);
					break;

				case 'functionFlowchartGenerated':
					currentMermaidCode = message.data.mermaidCode;
					document.getElementById('claudePrompt').textContent = message.data.claudePrompt;
					document.getElementById('mermaidCode').textContent = message.data.mermaidCode;
					updateStatus('Function analysis completed', 'completed');
					document.querySelector('.header h1').textContent = 'GraphIt - Function Level Analysis';
					renderMermaidDiagram(message.data.mermaidCode);
					break;
					
				case 'autoRefreshStarted':
					updateStatus('Auto-refreshing...', 'analyzing');
					break;
			}
		});
	</script>
</body>
</html>`;
	}
}

module.exports = WebviewManager; 