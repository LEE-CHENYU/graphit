// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Configuration and API client
let anthropicClient = null;
let config = null;

// Load configuration
function loadConfig(extensionPath) {
	try {
		const configPath = path.join(extensionPath, 'config.json');
		if (fs.existsSync(configPath)) {
			config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			
			// Initialize Anthropic client if API key is provided
			if (config.anthropic?.apiKey && config.anthropic.apiKey !== 'YOUR_ANTHROPIC_API_KEY_HERE') {
				const Anthropic = require('@anthropic-ai/sdk').default;
				anthropicClient = new Anthropic({
					apiKey: config.anthropic.apiKey,
				});
				console.log('GraphIt: Anthropic client initialized successfully');
			}
		} else {
			console.log('GraphIt: No config.json found, using local generation only');
		}
	} catch (error) {
		console.error('GraphIt: Error loading config:', error);
		vscode.window.showWarningMessage('GraphIt: Could not load config.json. Using local generation only.');
	}
}

// Repository analysis utilities
class RepositoryAnalyzer {
	constructor(workspaceRoot) {
		this.workspaceRoot = workspaceRoot;
		this.ignoredDirs = new Set([
			'node_modules', '.git', '.vscode', 'dist', 'build', 
			'.next', '.nuxt', 'coverage', '.nyc_output', 'logs',
			'.DS_Store', 'Thumbs.db'
		]);
		this.ignoredFiles = new Set([
			'.gitignore', '.env', '.env.local', '.env.production',
			'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
		]);
	}

	async analyzeRepository() {
		console.log('GraphIt: Starting repository analysis...');
		const structure = await this.buildDirectoryStructure(this.workspaceRoot);
		const stats = this.calculateStats(structure);
		
		return {
			structure,
			stats,
			metadata: {
				analyzedAt: new Date().toISOString(),
				workspaceRoot: this.workspaceRoot
			}
		};
	}

	async buildDirectoryStructure(dirPath, level = 0) {
		if (level > 5) return null; // Prevent infinite recursion
		
		const items = [];
		
		try {
			const entries = fs.readdirSync(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				if (this.shouldIgnore(entry.name)) continue;
				
				const fullPath = path.join(dirPath, entry.name);
				const relativePath = path.relative(this.workspaceRoot, fullPath);
				
				if (entry.isDirectory()) {
					const children = await this.buildDirectoryStructure(fullPath, level + 1);
					items.push({
						name: entry.name,
						type: 'directory',
						path: relativePath,
						children: children || []
					});
				} else {
					const fileInfo = this.analyzeFile(fullPath);
					items.push({
						name: entry.name,
						type: 'file',
						path: relativePath,
						extension: path.extname(entry.name),
						...fileInfo
					});
				}
			}
		} catch (error) {
			console.error(`GraphIt: Error reading directory ${dirPath}:`, error);
		}
		
		return items;
	}

	analyzeFile(filePath) {
		try {
			const stats = fs.statSync(filePath);
			const content = fs.readFileSync(filePath, 'utf8');
			const lines = content.split('\n').length;
			
			return {
				size: stats.size,
				lines,
				lastModified: stats.mtime.toISOString()
			};
		} catch (err) {
			return {
				size: 0,
				lines: 0,
				lastModified: null,
				error: 'Could not read file: ' + err.message
			};
		}
	}

	calculateStats(structure) {
		let totalFiles = 0;
		let totalDirectories = 0;
		let totalLines = 0;
		let fileTypes = {};

		const traverse = (items) => {
			for (const item of items) {
				if (item.type === 'directory') {
					totalDirectories++;
					if (item.children) {
						traverse(item.children);
					}
				} else {
					totalFiles++;
					totalLines += item.lines || 0;
					
					const ext = item.extension || 'no-extension';
					fileTypes[ext] = (fileTypes[ext] || 0) + 1;
				}
			}
		};

		traverse(structure);

		return {
			totalFiles,
			totalDirectories,
			totalLines,
			fileTypes
		};
	}

	shouldIgnore(name) {
		return this.ignoredDirs.has(name) || this.ignoredFiles.has(name) || name.startsWith('.');
	}
}

// Webview panel manager
class GraphItPanel {
	static currentPanel = undefined;

	constructor(panel, extensionUri) {
		this.panel = panel;
		this.extensionUri = extensionUri;
		this.disposables = [];

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.html = this.getWebviewContent();
		
		this.panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'analyzeRepository':
						await this.handleAnalyzeRepository();
						break;
					case 'generateFlowchart':
						await this.handleGenerateFlowchart(message.data);
						break;
				}
			},
			null,
			this.disposables
		);
	}

	static createOrShow(extensionUri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (GraphItPanel.currentPanel) {
			GraphItPanel.currentPanel.panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'graphitFlowchart',
			'GraphIt - Repository Flowchart',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		GraphItPanel.currentPanel = new GraphItPanel(panel, extensionUri);
	}

	async handleAnalyzeRepository() {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('No workspace folder open');
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const analyzer = new RepositoryAnalyzer(workspaceRoot);
		
		try {
			const analysis = await analyzer.analyzeRepository();
			this.panel.webview.postMessage({
				command: 'repositoryAnalyzed',
				data: {
					...analysis,
					hasClaudeApi: !!anthropicClient && !!config?.flowchart?.enableClaudeGeneration
				}
			});
		} catch (error) {
			console.error('GraphIt: Repository analysis failed:', error);
			vscode.window.showErrorMessage('Failed to analyze repository: ' + error.message);
		}
	}

	async handleGenerateFlowchart(analysisData) {
		try {
			// Try to generate with Claude first, fallback to local if needed
			const mermaidCode = await this.generateClaudeFlowchart(analysisData);
			const claudePrompt = this.buildClaudePrompt(analysisData);
			
			const message = anthropicClient && config?.flowchart?.enableClaudeGeneration 
				? 'Flowchart generated with Claude 4 Sonnet!' 
				: 'Flowchart generated locally!';
			
			this.panel.webview.postMessage({
				command: 'flowchartGenerated',
				data: {
					mermaidCode,
					claudePrompt,
					message,
					source: anthropicClient ? 'claude' : 'local'
				}
			});
		} catch (error) {
			console.error('GraphIt: Error generating flowchart:', error);
			vscode.window.showErrorMessage('Failed to generate flowchart: ' + error.message);
		}
	}

	buildClaudePrompt(analysisData) {
		const { structure, stats } = analysisData;
		
		return `Please create a detailed flowchart/diagram representing the structure of this repository:

Repository Statistics:
- Total Files: ${stats.totalFiles}
- Total Directories: ${stats.totalDirectories}
- Total Lines of Code: ${stats.totalLines}
- File Types: ${JSON.stringify(stats.fileTypes, null, 2)}

Repository Structure:
${JSON.stringify(structure, null, 2)}

Please create a visual flowchart that shows:
1. The main directory structure
2. Key file relationships
3. Project architecture flow
4. Important configuration files
5. Main code organization

Use Mermaid syntax for the flowchart so it can be easily rendered. Focus on the most important files and directories, grouping similar files together for clarity.`;
	}

	generateMermaidFlowchart(analysisData) {
		const { structure, stats } = analysisData;
		
		let mermaidCode = `graph TD\n`;
		let nodeId = 0;
		const nodeMap = new Map();
		
		// Helper function to get or create node ID
		const getNodeId = (name) => {
			if (!nodeMap.has(name)) {
				nodeMap.set(name, `n${nodeId++}`);
			}
			return nodeMap.get(name);
		};
		
		// Helper function to sanitize names for Mermaid
		const sanitizeName = (name) => {
			return name.replace(/[^a-zA-Z0-9_]/g, '_');
		};
		
		// Add root node
		const rootId = getNodeId('Repository');
		mermaidCode += `    ${rootId}[📁 Repository]\n`;
		
		// Add stats summary
		const statsId = getNodeId('Stats');
		mermaidCode += `    ${statsId}[📊 ${stats.totalFiles} files, ${stats.totalDirectories} dirs]\n`;
		mermaidCode += `    ${rootId} --> ${statsId}\n`;
		
		// Process directory structure
		const processItems = (items, parentId, level = 0) => {
			if (level > 3) return; // Limit depth for readability
			
			const importantDirs = ['src', 'lib', 'components', 'pages', 'utils', 'config', 'tests', 'test'];
			const configFiles = ['.gitignore', 'package.json', 'README.md', 'tsconfig.json', 'webpack.config.js'];
			
			// First pass: Add important directories and config files
			for (const item of items) {
				if (item.type === 'directory' && (importantDirs.includes(item.name.toLowerCase()) || level === 0)) {
					const nodeId = getNodeId(sanitizeName(item.name));
					const icon = item.name.toLowerCase().includes('test') ? '🧪' : 
							   item.name.toLowerCase().includes('config') ? '⚙️' : '📁';
					mermaidCode += `    ${nodeId}[${icon} ${item.name}]\n`;
					mermaidCode += `    ${parentId} --> ${nodeId}\n`;
					
					if (item.children && level < 2) {
						processItems(item.children, nodeId, level + 1);
					}
				} else if (item.type === 'file' && (configFiles.includes(item.name) || item.extension === '.md')) {
					const nodeId = getNodeId(sanitizeName(item.name));
					const icon = item.extension === '.md' ? '📝' : 
							   item.name.includes('package') ? '📦' : 
							   item.name.includes('config') ? '⚙️' : '📄';
					mermaidCode += `    ${nodeId}[${icon} ${item.name}]\n`;
					mermaidCode += `    ${parentId} --> ${nodeId}\n`;
				}
			}
			
			// Second pass: Group file types
			const fileTypeGroups = {};
			for (const item of items) {
				if (item.type === 'file' && !configFiles.includes(item.name) && item.extension !== '.md') {
					const ext = item.extension || 'no-ext';
					if (!fileTypeGroups[ext]) {
						fileTypeGroups[ext] = [];
					}
					fileTypeGroups[ext].push(item);
				}
			}
			
			// Add file type groups if they have multiple files
			Object.entries(fileTypeGroups).forEach(([ext, files]) => {
				if (files.length > 2) {
					const groupId = getNodeId(`${sanitizeName(ext)}_files`);
					const icon = ext === '.js' ? '🔷' : 
							   ext === '.ts' ? '🔵' : 
							   ext === '.py' ? '🐍' : 
							   ext === '.json' ? '📋' : '📄';
					mermaidCode += `    ${groupId}[${icon} ${files.length} ${ext} files]\n`;
					mermaidCode += `    ${parentId} --> ${groupId}\n`;
				}
			});
		};
		
		processItems(structure, rootId);
		
		// Add styling
		mermaidCode += `\n    classDef dirStyle fill:#e1f5fe,stroke:#01579b,stroke-width:2px\n`;
		mermaidCode += `    classDef fileStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:2px\n`;
		mermaidCode += `    classDef configStyle fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px\n`;
		
		return mermaidCode;
	}

	async generateClaudeFlowchart(analysisData) {
		if (!anthropicClient || !config?.flowchart?.enableClaudeGeneration) {
			console.log('GraphIt: Claude API not available, using local generation');
			return this.generateMermaidFlowchart(analysisData);
		}

		const { structure, stats } = analysisData;
		
		const prompt = `You are an expert at creating beautiful, informative Mermaid flowcharts for software repositories. 

Please analyze this repository structure and create a comprehensive Mermaid flowchart that shows:
1. The main architectural components and their relationships
2. Key directories and their purposes
3. File type groupings and dependencies
4. Configuration and build processes
5. Data flow between components

Repository Statistics:
- Total Files: ${stats.totalFiles}
- Total Directories: ${stats.totalDirectories}
- Total Lines of Code: ${stats.totalLines}
- File Types: ${JSON.stringify(stats.fileTypes, null, 2)}

Repository Structure:
${JSON.stringify(structure, null, 2)}

Requirements:
- Use 'graph TD' syntax for top-down flowchart
- Include meaningful icons using emojis
- Group related components logically
- Show clear relationships with arrows
- Use descriptive node labels
- Add styling with classDef for visual appeal
- Focus on the most important architectural elements
- Keep it readable and not overly complex

Return ONLY the Mermaid code, starting with 'graph TD' and including styling at the end.`;

		try {
			console.log('GraphIt: Requesting flowchart from Claude...');
			
			const response = await anthropicClient.messages.create({
				model: config.anthropic?.model || 'claude-3-5-sonnet-20241022',
				max_tokens: config.anthropic?.maxTokens || 4000,
				temperature: 0.3,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			});

			const claudeResponse = response.content[0].text.trim();
			console.log('GraphIt: Claude response received successfully');
			
			// Extract Mermaid code if it's wrapped in code blocks
			const mermaidMatch = claudeResponse.match(/```(?:mermaid)?\s*\n?(graph\s+TD[\s\S]*?)```/i);
			if (mermaidMatch) {
				return mermaidMatch[1].trim();
			}
			
			// If no code blocks, check if it starts with graph TD
			if (claudeResponse.toLowerCase().includes('graph td')) {
				return claudeResponse;
			}
			
			console.log('GraphIt: Claude response format unexpected, falling back to local generation');
			return this.generateMermaidFlowchart(analysisData);
			
		} catch (error) {
			console.error('GraphIt: Claude API error:', error);
			vscode.window.showWarningMessage(`GraphIt: Claude API error (${error.message}). Using local generation.`);
			
			// Fallback to local generation
			if (config?.flowchart?.fallbackToLocal) {
				return this.generateMermaidFlowchart(analysisData);
			}
			
			throw error;
		}
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
			font-family: var(--vscode-font-family);
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			margin: 0;
			padding: 0;
			line-height: 1.6;
			overflow-x: hidden;
		}
		
		.main-container {
			display: flex;
			flex-direction: column;
			height: 100vh;
		}
		
		.header {
			background: var(--vscode-titleBar-activeBackground);
			padding: 12px 20px;
			border-bottom: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: space-between;
			align-items: center;
			flex-shrink: 0;
		}
		
		.header h1 {
			color: var(--vscode-titleBar-activeForeground);
			margin: 0;
			font-size: 1.4em;
			font-weight: 600;
		}
		
		.header-controls {
			display: flex;
			gap: 10px;
			align-items: center;
		}
		
		.zoom-indicator {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			background: var(--vscode-badge-background);
			padding: 2px 6px;
			border-radius: 3px;
			margin-right: 10px;
		}
		
		.btn {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 6px 12px;
			border-radius: 3px;
			cursor: pointer;
			font-size: 12px;
			display: flex;
			align-items: center;
			gap: 5px;
		}
		
		.btn:hover {
			background: var(--vscode-button-hoverBackground);
		}
		
		.btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		
		.btn-small {
			padding: 4px 8px;
			font-size: 11px;
		}
		
		.status-indicator {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			display: flex;
			align-items: center;
			gap: 5px;
		}
		
		.flowchart-container {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		
		.diagram-viewport {
			flex: 1;
			background: var(--vscode-editor-background);
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: auto;
			position: relative;
			min-height: 400px;
		}
		
		#mermaid-diagram {
			max-width: 100%;
			max-height: 100%;
			transition: transform 0.1s ease;
			transform-origin: center center;
			cursor: grab;
		}
		
		#mermaid-diagram.zoomed {
			cursor: grab;
		}
		
		#mermaid-diagram.dragging {
			cursor: grabbing;
		}
		
		.loading-overlay {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--vscode-editor-background);
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
			border: 2px solid var(--vscode-panel-border);
			border-top: 2px solid var(--vscode-textLink-foreground);
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
			background: var(--vscode-panel-background);
			border-top: 1px solid var(--vscode-panel-border);
			flex-shrink: 0;
		}
		
		.details-toggle {
			width: 100%;
			background: transparent;
			border: none;
			padding: 12px 20px;
			color: var(--vscode-editor-foreground);
			cursor: pointer;
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 13px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		.details-toggle:hover {
			background: var(--vscode-list-hoverBackground);
		}
		
		.details-content {
			max-height: 0;
			overflow: hidden;
			transition: max-height 0.3s ease;
		}
		
		.details-content.expanded {
			max-height: 50vh;
			overflow-y: auto;
		}
		
		.details-inner {
			padding: 20px;
		}
		
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 15px;
			margin-bottom: 20px;
		}
		
		.stat-card {
			background: var(--vscode-editor-background);
			padding: 12px;
			border-radius: 4px;
			text-align: center;
			border: 1px solid var(--vscode-panel-border);
		}
		
		.stat-number {
			font-size: 1.5em;
			font-weight: bold;
			color: var(--vscode-textLink-foreground);
		}
		
		.stat-label {
			color: var(--vscode-descriptionForeground);
			font-size: 0.8em;
		}
		
		.tabs {
			display: flex;
			border-bottom: 1px solid var(--vscode-panel-border);
			margin-bottom: 15px;
		}
		
		.tab {
			background: transparent;
			border: none;
			padding: 8px 16px;
			cursor: pointer;
			color: var(--vscode-descriptionForeground);
			border-bottom: 2px solid transparent;
			font-size: 12px;
		}
		
		.tab.active {
			color: var(--vscode-textLink-foreground);
			border-bottom-color: var(--vscode-textLink-foreground);
		}
		
		.tab-content {
			display: none;
		}
		
		.tab-content.active {
			display: block;
		}
		
		.code-block {
			background: var(--vscode-textBlockQuote-background);
			border-left: 4px solid var(--vscode-textLink-foreground);
			padding: 15px;
			border-radius: 0 4px 4px 0;
			font-family: var(--vscode-editor-font-family);
			font-size: 11px;
			white-space: pre-wrap;
			overflow-x: auto;
			max-height: 200px;
			overflow-y: auto;
		}
		
		.file-tree {
			font-family: monospace;
			font-size: 11px;
			background: var(--vscode-editor-background);
			padding: 15px;
			border-radius: 4px;
			border: 1px solid var(--vscode-panel-border);
			max-height: 200px;
			overflow-y: auto;
		}
		
		.tree-item {
			margin: 1px 0;
			padding: 1px 0;
		}
		
		.tree-directory {
			color: var(--vscode-textLink-foreground);
			font-weight: bold;
		}
		
		.tree-file {
			color: var(--vscode-editor-foreground);
		}
		
		.error-message {
			color: var(--vscode-errorForeground);
			background: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			padding: 15px;
			border-radius: 4px;
			margin: 20px;
		}
	</style>
</head>
<body>
	<div class="main-container">
		<div class="header">
			<h1>🔗 GraphIt</h1>
			<div class="header-controls">
				<span class="zoom-indicator" id="zoomIndicator">200%</span>
				<div class="status-indicator" id="statusIndicator">
					<span>🔄 Initializing...</span>
				</div>
				<button class="btn btn-small" id="refreshBtn" onclick="regenerateFlowchart()">
					🔄 Refresh
				</button>
				<button class="btn btn-small" onclick="copyMermaidCode()">
					📋 Copy Code
				</button>
				<button class="btn btn-small" onclick="downloadSVG()">
					⬇️ Download SVG
				</button>
				<button class="btn btn-small" onclick="resetZoom()" title="Reset to 200% zoom (double-click diagram)">
					⌂ Reset
				</button>
			</div>
		</div>
		
		<div class="flowchart-container">
			<div class="diagram-viewport">
				<div id="mermaid-diagram"></div>
				<div id="loadingOverlay" class="loading-overlay">
					<div class="spinner"></div>
					<div class="loading-text" id="loadingText">
						<div>🔍 Analyzing repository structure...</div>
						<div style="font-size: 11px; margin-top: 5px;">This may take a moment for large repositories</div>
					</div>
				</div>
				<div id="errorMessage" class="error-message" style="display: none;"></div>
			</div>
		</div>
		
		<div class="details-panel">
			<button class="details-toggle" onclick="toggleDetails()">
				<span>📊 Repository Details & Analysis</span>
				<span id="toggleIcon">▲</span>
			</button>
			<div class="details-content" id="detailsContent">
				<div class="details-inner">
					<div id="stats" class="stats-grid"></div>
					
					<div class="tabs">
						<button class="tab active" onclick="switchTab('structure')">📁 Structure</button>
						<button class="tab" onclick="switchTab('mermaid')">💻 Mermaid Code</button>
						<button class="tab" onclick="switchTab('claude')">🤖 Claude Prompt</button>
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
							📋 Copy Claude Prompt
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
		let currentZoom = 2.0; // Start at 200% zoom
		let panX = 0;
		let panY = 0;
		let initialTouchDistance = 0;
		let isDragging = false;
		let lastMouseX = 0;
		let lastMouseY = 0;
		
		// Initialize Mermaid
		document.addEventListener('DOMContentLoaded', () => {
			mermaid.initialize({ 
				startOnLoad: false,
				theme: 'base',
				themeVariables: {
					primaryColor: '#007acc',
					primaryTextColor: '#ffffff',
					primaryBorderColor: '#005a9e',
					lineColor: '#007acc',
					sectionBkgColor: '#f0f8ff',
					altSectionBkgColor: '#e6f3ff',
					gridColor: '#cccccc',
					tertiaryColor: '#f9f9f9'
				}
			});
			
			// Auto-start analysis
			setTimeout(autoStartAnalysis, 500);
			
			// Setup zoom event listeners
			setupZoomControls();
		});

		function autoStartAnalysis() {
			updateStatus('🔍 Analyzing repository...', 'analyzing');
			updateLoadingText('🔍 Analyzing repository structure...', 'Scanning files and directories...');
			
			vscode.postMessage({
				command: 'analyzeRepository'
			});
		}

		function regenerateFlowchart() {
			if (!currentAnalysis) {
				autoStartAnalysis();
				return;
			}
			
			updateStatus('🎨 Generating flowchart...', 'generating');
			updateLoadingText('🎨 Generating flowchart...', 'Creating visual representation...');
			showLoading();
			
			vscode.postMessage({
				command: 'generateFlowchart',
				data: currentAnalysis
			});
		}

		function updateStatus(text, state) {
			const indicator = document.getElementById('statusIndicator');
			indicator.innerHTML = \`<span>\${text}</span>\`;
			
			const refreshBtn = document.getElementById('refreshBtn');
			refreshBtn.disabled = (state === 'analyzing' || state === 'generating');
		}

		function updateLoadingText(primary, secondary) {
			const loadingText = document.getElementById('loadingText');
			loadingText.innerHTML = \`
				<div>\${primary}</div>
				<div style="font-size: 11px; margin-top: 5px;">\${secondary}</div>
			\`;
		}

		function showLoading() {
			document.getElementById('loadingOverlay').classList.remove('hidden');
			document.getElementById('errorMessage').style.display = 'none';
		}

		function hideLoading() {
			document.getElementById('loadingOverlay').classList.add('hidden');
		}

		function showError(message) {
			hideLoading();
			const errorEl = document.getElementById('errorMessage');
			errorEl.textContent = \`Error: \${message}\`;
			errorEl.style.display = 'block';
		}

		function setupZoomControls() {
			const diagramViewport = document.querySelector('.diagram-viewport');
			
			// Mouse wheel zoom (faster sensitivity)
			diagramViewport.addEventListener('wheel', (e) => {
				e.preventDefault();
				
				const zoomSensitivity = 0.005; // Even faster zoom for better responsiveness
				const zoomDirection = e.deltaY > 0 ? -1 : 1;
				const zoomFactor = 1 + (zoomDirection * zoomSensitivity * Math.abs(e.deltaY));
				
				currentZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 3.0);
				applyTransform();
			});
			
			// Mouse drag to pan
			diagramViewport.addEventListener('mousedown', (e) => {
				if (currentZoom > 1.0) { // Allow panning when zoomed beyond 100%
					isDragging = true;
					lastMouseX = e.clientX;
					lastMouseY = e.clientY;
					document.getElementById('mermaid-diagram').classList.add('dragging');
					e.preventDefault();
				}
			});
			
			document.addEventListener('mousemove', (e) => {
				if (isDragging && currentZoom > 1.0) {
					const deltaX = e.clientX - lastMouseX;
					const deltaY = e.clientY - lastMouseY;
					
					panX += deltaX;
					panY += deltaY;
					
					lastMouseX = e.clientX;
					lastMouseY = e.clientY;
					
					applyTransform();
					e.preventDefault();
				}
			});
			
			document.addEventListener('mouseup', () => {
				if (isDragging) {
					isDragging = false;
					document.getElementById('mermaid-diagram').classList.remove('dragging');
				}
			});
			
			// Touch pinch-to-zoom
			diagramViewport.addEventListener('touchstart', (e) => {
				if (e.touches.length === 2) {
					e.preventDefault();
					initialTouchDistance = getTouchDistance(e.touches);
				} else if (e.touches.length === 1 && currentZoom > 1.0) {
					// Single touch pan
					isDragging = true;
					lastMouseX = e.touches[0].clientX;
					lastMouseY = e.touches[0].clientY;
				}
			});
			
			diagramViewport.addEventListener('touchmove', (e) => {
				if (e.touches.length === 2) {
					e.preventDefault();
					const currentDistance = getTouchDistance(e.touches);
					const scaleFactor = currentDistance / initialTouchDistance;
					
					currentZoom = Math.min(Math.max(currentZoom * scaleFactor, 0.2), 3.0);
					applyTransform();
					
					initialTouchDistance = currentDistance;
				} else if (e.touches.length === 1 && isDragging && currentZoom > 1.0) {
					e.preventDefault();
					const deltaX = e.touches[0].clientX - lastMouseX;
					const deltaY = e.touches[0].clientY - lastMouseY;
					
					panX += deltaX;
					panY += deltaY;
					
					lastMouseX = e.touches[0].clientX;
					lastMouseY = e.touches[0].clientY;
					
					applyTransform();
				}
			});
			
			diagramViewport.addEventListener('touchend', () => {
				isDragging = false;
			});
			
			// Double-click to reset zoom and pan
			diagramViewport.addEventListener('dblclick', () => {
				resetZoomAndPan();
			});
		}

		function getTouchDistance(touches) {
			const dx = touches[0].clientX - touches[1].clientX;
			const dy = touches[0].clientY - touches[1].clientY;
			return Math.sqrt(dx * dx + dy * dy);
		}

		function resetZoomAndPan() {
			currentZoom = 2.0; // Reset to 200% default zoom
			panX = 0;
			panY = 0;
			applyTransform();
		}

		function resetZoom() {
			resetZoomAndPan();
		}

		function applyTransform() {
			const diagram = document.getElementById('mermaid-diagram');
			diagram.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${currentZoom})\`;
			
			// Update cursor based on zoom level
			if (currentZoom > 1.0) {
				diagram.classList.add('zoomed');
			} else {
				diagram.classList.remove('zoomed');
			}
			
			const zoomIndicator = document.getElementById('zoomIndicator');
			zoomIndicator.textContent = \`\${Math.round(currentZoom * 100)}%\`;
		}

		async function renderMermaidDiagram(mermaidCode) {
			const element = document.getElementById('mermaid-diagram');
			element.innerHTML = '';
			
			try {
				const { svg } = await mermaid.render('mermaid-svg', mermaidCode);
				element.innerHTML = svg;
				
				// Reset zoom and pan when new diagram is loaded
				currentZoom = 2.0; // Start new diagrams at 200% zoom
				panX = 0;
				panY = 0;
				applyTransform();
				
				hideLoading();
			} catch (error) {
				console.error('Error rendering Mermaid diagram:', error);
				showError('Failed to render diagram. Check console for details.');
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
			// Update tab buttons
			document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
			event.target.classList.add('active');
			
			// Update tab content
			document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
			document.getElementById(tabName + '-tab').classList.add('active');
		}
		
		function copyMermaidCode() {
			if (currentMermaidCode) {
				navigator.clipboard.writeText(currentMermaidCode).then(() => {
					showTemporaryMessage(event.target, '✅ Copied!');
				});
			}
		}
		
		function copyPrompt() {
			const promptElement = document.getElementById('claudePrompt');
			navigator.clipboard.writeText(promptElement.textContent).then(() => {
				showTemporaryMessage(event.target, '✅ Copied!');
			});
		}
		
		function showTemporaryMessage(button, message) {
			const originalText = button.textContent;
			button.textContent = message;
			setTimeout(() => {
				button.textContent = originalText;
			}, 2000);
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
				const icon = item.type === 'directory' ? '📁' : '📄';
				const className = item.type === 'directory' ? 'tree-directory' : 'tree-file';
				
				html += \`<div class="tree-item \${className}">\${indent}\${icon} \${item.name}</div>\`;
				
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
					
					updateStatus('🎨 Generating flowchart...', 'generating');
					updateLoadingText('🎨 Generating flowchart...', 'Creating visual representation...');
					
					renderStats(message.data.stats);
					document.getElementById('structure').innerHTML = renderStructure(message.data.structure);
					
					// Auto-generate flowchart
					vscode.postMessage({
						command: 'generateFlowchart',
						data: currentAnalysis
					});
					break;
					
				case 'flowchartGenerated':
					currentMermaidCode = message.data.mermaidCode;
					
					document.getElementById('claudePrompt').textContent = message.data.claudePrompt;
					document.getElementById('mermaidCode').textContent = message.data.mermaidCode;
					
					// Show generation source in status
					const sourceIcon = message.data.source === 'claude' ? '🤖' : '🏠';
					const sourceText = message.data.source === 'claude' ? 'Generated with Claude AI' : 'Generated locally';
					updateStatus(\`\${sourceIcon} \${sourceText}\`, 'completed');
					
					renderMermaidDiagram(message.data.mermaidCode);
					break;
			}
		});
	</script>
</body>
</html>`;
	}

	dispose() {
		GraphItPanel.currentPanel = undefined;
		this.panel.dispose();
		
		while (this.disposables.length) {
			const disposable = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('GraphIt Extension: Starting activation...');
	
	// Load configuration for Claude API integration
	loadConfig(context.extensionPath);
	
	try {

	// Register the original hello world command
	const helloWorldDisposable = vscode.commands.registerCommand('graphit.helloWorld', function () {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from GraphIt!');
	});

	// Register the new repository flowchart command
	const showFlowchartDisposable = vscode.commands.registerCommand('graphit.showRepoFlowchart', function () {
		console.log('GraphIt: Showing repository flowchart...');
		vscode.window.showInformationMessage('GraphIt: Command triggered!');
		GraphItPanel.createOrShow(context.extensionUri);
	});

	// Register the hello silicon creature command
	const showHelloSiliconCreatureDisposable = vscode.commands.registerCommand('graphit.showHelloSiliconCreature', function () {
		console.log('GraphIt: Hello Silicon Creature command triggered!');
		vscode.window.showInformationMessage('Hello Silicon Creature! 🤖✨ Welcome to the digital realm!');
	});

	context.subscriptions.push(helloWorldDisposable, showFlowchartDisposable, showHelloSiliconCreatureDisposable);
	
	console.log('GraphIt Extension: Successfully activated! Commands registered.');
	
	} catch (error) {
		console.error('GraphIt Extension: Failed to activate:', error);
		vscode.window.showErrorMessage('GraphIt Extension failed to activate: ' + error.message);
	}
}

// This method is called when your extension is deactivated
function deactivate() {
	if (GraphItPanel.currentPanel) {
		GraphItPanel.currentPanel.dispose();
	}
}

module.exports = {
	activate,
	deactivate
}
