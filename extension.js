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

// Function-level analysis utilities
class FunctionAnalyzer {
	constructor(workspaceRoot) {
		this.workspaceRoot = workspaceRoot;
		this.functions = new Map();
		this.callGraph = new Map();
		this.classes = new Map();
		this.imports = new Map();
		this.controlFlow = new Map();
	}

	async analyzeFunctions() {
		console.log('GraphIt: Starting function-level analysis...');
		await this.scanCodeFiles();
		this.buildCallGraph();
		this.identifyControlFlow();
		
		return {
			functions: Array.from(this.functions.values()),
			callGraph: this.callGraph,
			classes: Array.from(this.classes.values()),
			imports: Array.from(this.imports.values()),
			controlFlow: this.controlFlow,
			metadata: {
				analyzedAt: new Date().toISOString(),
				totalFunctions: this.functions.size,
				totalClasses: this.classes.size
			}
		};
	}

	async scanCodeFiles() {
		const codeExtensions = ['.js', '.ts', '.py', '.java', '.cs', '.cpp', '.c', '.go', '.rs'];
		await this.walkDirectory(this.workspaceRoot, codeExtensions);
	}

	async walkDirectory(dirPath, extensions, level = 0) {
		if (level > 5) return;
		
		try {
			const entries = fs.readdirSync(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				if (this.shouldIgnore(entry.name)) continue;
				
				const fullPath = path.join(dirPath, entry.name);
				
				if (entry.isDirectory()) {
					await this.walkDirectory(fullPath, extensions, level + 1);
				} else if (extensions.includes(path.extname(entry.name))) {
					await this.analyzeCodeFile(fullPath);
				}
			}
		} catch (error) {
			console.error(`GraphIt: Error reading directory ${dirPath}:`, error);
		}
	}

	async analyzeCodeFile(filePath) {
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			const relativePath = path.relative(this.workspaceRoot, filePath);
			const ext = path.extname(filePath);
			
			switch (ext) {
				case '.js':
				case '.ts':
					this.parseJavaScript(content, relativePath);
					break;
				case '.py':
					this.parsePython(content, relativePath);
					break;
				default:
					this.parseGeneric(content, relativePath);
			}
		} catch (error) {
			console.error(`GraphIt: Error analyzing file ${filePath}:`, error);
		}
	}

	parseJavaScript(content, filePath) {
		const lines = content.split('\n');
		let currentClass = null;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// Class definitions
			const classMatch = line.match(/class\s+(\w+)/);
			if (classMatch) {
				currentClass = {
					name: classMatch[1],
					file: filePath,
					line: i + 1,
					methods: [],
					type: 'class'
				};
				this.classes.set(classMatch[1], currentClass);
			}
			
			// Function definitions
			const funcMatches = [
				line.match(/(?:async\s+)?function\s+(\w+)/),
				line.match(/(?:async\s+)?(\w+)\s*\(/),
				line.match(/(\w+)\s*:\s*(?:async\s+)?function/),
				line.match(/(\w+)\s*=\s*(?:async\s+)?\(/),
				line.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/)
			];
			
			for (const match of funcMatches) {
				if (match && !this.isKeyword(match[1])) {
					const funcName = match[1];
					const funcObj = {
						name: funcName,
						file: filePath,
						line: i + 1,
						class: currentClass?.name,
						calls: [],
						calledBy: [],
						type: line.includes('async') ? 'async-function' : 'function',
						isConstructor: funcName === 'constructor',
						isMethod: currentClass !== null
					};
					
					this.functions.set(`${filePath}:${funcName}`, funcObj);
					
					if (currentClass) {
						currentClass.methods.push(funcName);
					}
					break;
				}
			}
			
			// Import statements
			const importMatch = line.match(/(?:import|require)\s*\(?[^)]*\)?\s*(?:from\s+)?['"`]([^'"`]+)['"`]/);
			if (importMatch) {
				this.imports.set(importMatch[1], {
					module: importMatch[1],
					file: filePath,
					line: i + 1
				});
			}
			
			// Function calls
			const callMatches = line.matchAll(/(\w+)\s*\(/g);
			for (const match of callMatches) {
				if (!this.isKeyword(match[1])) {
					// Store for later call graph building
					if (!this.callGraph.has(filePath)) {
						this.callGraph.set(filePath, []);
					}
					this.callGraph.get(filePath).push({
						caller: 'current-context',
						callee: match[1],
						line: i + 1
					});
				}
			}
			
			// Control flow patterns
			if (line.includes('if') || line.includes('switch') || line.includes('for') || line.includes('while')) {
				if (!this.controlFlow.has(filePath)) {
					this.controlFlow.set(filePath, []);
				}
				this.controlFlow.get(filePath).push({
					type: this.getControlFlowType(line),
					line: i + 1,
					content: line
				});
			}
		}
	}

	parsePython(content, filePath) {
		const lines = content.split('\n');
		let currentClass = null;
		let indentLevel = 0;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			const currentIndent = line.length - line.trimStart().length;
			
			// Class definitions
			const classMatch = trimmed.match(/class\s+(\w+)/);
			if (classMatch) {
				currentClass = {
					name: classMatch[1],
					file: filePath,
					line: i + 1,
					methods: [],
					type: 'class'
				};
				this.classes.set(classMatch[1], currentClass);
				indentLevel = currentIndent;
			}
			
			// Function/method definitions
			const funcMatch = trimmed.match(/def\s+(\w+)/);
			if (funcMatch) {
				const funcName = funcMatch[1];
				const funcObj = {
					name: funcName,
					file: filePath,
					line: i + 1,
					class: currentClass?.name,
					calls: [],
					calledBy: [],
					type: 'function',
					isMethod: currentClass !== null && currentIndent > indentLevel,
					isAsync: trimmed.includes('async def')
				};
				
				this.functions.set(`${filePath}:${funcName}`, funcObj);
				
				if (currentClass && currentIndent > indentLevel) {
					currentClass.methods.push(funcName);
				}
			}
		}
	}

	parseGeneric(content, filePath) {
		// Basic parsing for other languages
		const lines = content.split('\n');
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// Generic function patterns
			const funcPatterns = [
				/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/,  // Java/C#
				/(\w+)\s*\([^)]*\)\s*\{/,  // Generic function with body
			];
			
			for (const pattern of funcPatterns) {
				const match = line.match(pattern);
				if (match && !this.isKeyword(match[1])) {
					this.functions.set(`${filePath}:${match[1]}`, {
						name: match[1],
						file: filePath,
						line: i + 1,
						calls: [],
						calledBy: [],
						type: 'function'
					});
					break;
				}
			}
		}
	}

	buildCallGraph() {
		// Build relationships between functions
		for (const [filePath, calls] of this.callGraph) {
			for (const call of calls) {
				// Find matching functions
				for (const [funcKey, func] of this.functions) {
					if (func.name === call.callee) {
						func.calledBy.push({
							file: filePath,
							line: call.line,
							caller: call.caller
						});
					}
				}
			}
		}
	}

	identifyControlFlow() {
		// Enhance control flow analysis
		for (const [filePath, flows] of this.controlFlow) {
			for (const flow of flows) {
				flow.complexity = this.calculateComplexity(flow);
			}
		}
	}

	getControlFlowType(line) {
		if (line.includes('if')) return 'conditional';
		if (line.includes('switch')) return 'switch';
		if (line.includes('for')) return 'loop';
		if (line.includes('while')) return 'loop';
		if (line.includes('try')) return 'exception';
		return 'unknown';
	}

	calculateComplexity(flow) {
		// Simple complexity calculation
		return flow.content.split('&&').length + flow.content.split('||').length;
	}

	isKeyword(word) {
		const keywords = new Set([
			'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
			'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
			'var', 'let', 'const', 'function', 'class', 'extends', 'implements',
			'import', 'export', 'from', 'default', 'async', 'await', 'yield',
			'true', 'false', 'null', 'undefined', 'console', 'log'
		]);
		return keywords.has(word);
	}

	shouldIgnore(name) {
		const ignoredDirs = new Set([
			'node_modules', '.git', '.vscode', 'dist', 'build', 
			'.next', '.nuxt', 'coverage', '.nyc_output', 'logs'
		]);
		return ignoredDirs.has(name) || name.startsWith('.');
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
		this.refreshTimeout = null;
		this.autoRefreshEnabled = true;
		this.gitWatcher = null;
		this.lastAnalysis = null;
		this.changedFiles = new Set();
		this.previousFlowchartState = null;
		this.currentFlowchartNodes = new Map();
		this.currentFlowchartEdges = new Set();
		this.currentViewMode = 'repository'; // 'repository' or 'function'
		this.lastFunctionAnalysis = null;

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.html = this.getWebviewContent();
		
		// Setup Git-based change tracking for auto-refresh
		this.setupGitWatcher();
		
		this.panel.webview.onDidReceiveMessage(
			async message => {
							switch (message.command) {
				case 'analyzeRepository':
					await this.handleAnalyzeRepository();
					break;
				case 'generateFlowchart':
					await this.handleGenerateFlowchart(message.data);
					break;
				case 'generateFunctionFlowchart':
					await this.handleGenerateFunctionFlowchart(message.data);
					break;
				case 'toggleAutoRefresh':
					this.toggleAutoRefresh(message.enabled);
					break;
				case 'updateIncrementalChanges':
					await this.handleIncrementalFlowchartUpdate(message.data);
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
			// Enhance repository analysis with function-level data
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders) {
				const workspaceRoot = workspaceFolders[0].uri.fsPath;
				const functionAnalyzer = new FunctionAnalyzer(workspaceRoot);
				
				console.log('GraphIt: Adding function analysis to repository flowchart...');
				const functionAnalysis = await functionAnalyzer.analyzeFunctions();
				
				// Enhance analysis data with function information
				analysisData.functionAnalysis = functionAnalysis;
				this.lastFunctionAnalysis = functionAnalysis;
			}
			
			// Try to generate with Claude first, fallback to local if needed
			const mermaidCode = await this.generateClaudeFlowchart(analysisData);
			const claudePrompt = this.buildClaudePrompt(analysisData);
			
			// Store the current flowchart state for future incremental updates
			this.storeFlowchartState(analysisData, mermaidCode);
			this.currentViewMode = 'unified'; // New mode for integrated view
			
			const functionCount = analysisData.functionAnalysis ? analysisData.functionAnalysis.functions.length : 0;
			const message = anthropicClient && config?.flowchart?.enableClaudeGeneration 
				? `Unified flowchart generated with Claude 4 Sonnet! (${functionCount} functions analyzed)` 
				: `Unified flowchart generated locally! (${functionCount} functions analyzed)`;
			
			this.panel.webview.postMessage({
				command: 'flowchartGenerated',
				data: {
					mermaidCode,
					claudePrompt,
					message,
					source: anthropicClient ? 'claude' : 'local',
					isIncremental: false,
					type: 'unified',
					functionCount
				}
			});
		} catch (error) {
			console.error('GraphIt: Error generating flowchart:', error);
			vscode.window.showErrorMessage('Failed to generate flowchart: ' + error.message);
		}
	}

	async handleIncrementalFlowchartUpdate(data) {
		try {
			if (!this.previousFlowchartState) {
				// No previous state, do full refresh
				await this.handleGenerateFlowchart(data);
				return;
			}

			console.log('GraphIt: Performing selective flowchart update...');
			
			// Calculate what parts of the flowchart need updating
			const updatePlan = this.calculateFlowchartDiff(data);
			
			if (updatePlan.hasSignificantChanges) {
				// Generate updated mermaid code with change annotations
				const updatedMermaidCode = await this.generateIncrementalMermaidCode(data, updatePlan);
				const claudePrompt = this.buildClaudePrompt(data);
				
				// Update stored state
				this.storeFlowchartState(data, updatedMermaidCode);
				
				this.panel.webview.postMessage({
					command: 'flowchartUpdatedIncremental',
					data: {
						mermaidCode: updatedMermaidCode,
						claudePrompt,
						updatePlan,
						message: `Updated ${updatePlan.changedNodes.length} nodes, ${updatePlan.changedEdges.length} edges`,
						source: anthropicClient ? 'claude' : 'local',
						isIncremental: true
					}
				});
			} else {
				console.log('GraphIt: No significant changes detected, keeping flowchart frozen');
			}
		} catch (error) {
			console.error('GraphIt: Error in incremental flowchart update:', error);
			// Fallback to full refresh on error
			await this.handleGenerateFlowchart(data);
		}
	}

	async handleGenerateFunctionFlowchart(analysisData) {
		try {
			console.log('GraphIt: Generating function-level flowchart...');
			
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				vscode.window.showErrorMessage('No workspace folder open');
				return;
			}

			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const functionAnalyzer = new FunctionAnalyzer(workspaceRoot);
			
			// Perform function-level analysis
			const functionAnalysis = await functionAnalyzer.analyzeFunctions();
			
			// Generate detailed function flowchart
			const mermaidCode = await this.generateDetailedFunctionFlowchart(functionAnalysis);
			const claudePrompt = this.buildFunctionFlowchartPrompt(functionAnalysis);
			
			// Store function analysis for auto-refresh
			this.lastFunctionAnalysis = functionAnalysis;
			this.currentViewMode = 'function';
			
			const totalFunctions = functionAnalysis.functions.length;
			const displayedFunctions = Math.min(totalFunctions, 50);
			const message = totalFunctions > 50 
				? `Generated function flowchart with ${displayedFunctions} of ${totalFunctions} functions (limited for readability)`
				: `Generated detailed function flowchart with ${totalFunctions} functions`;

			this.panel.webview.postMessage({
				command: 'functionFlowchartGenerated',
				data: {
					mermaidCode,
					claudePrompt,
					functionAnalysis,
					message,
					source: anthropicClient ? 'claude' : 'local',
					type: 'function-level'
				}
			});
		} catch (error) {
			console.error('GraphIt: Error generating function flowchart:', error);
			vscode.window.showErrorMessage('Failed to generate function flowchart: ' + error.message);
		}
	}

	storeFlowchartState(analysisData, mermaidCode) {
		this.previousFlowchartState = {
			analysis: JSON.parse(JSON.stringify(analysisData)),
			mermaidCode,
			timestamp: Date.now()
		};
		
		// Parse and store the current flowchart structure
		this.parseFlowchartStructure(mermaidCode);
	}

	parseFlowchartStructure(mermaidCode) {
		this.currentFlowchartNodes.clear();
		this.currentFlowchartEdges.clear();
		
		const lines = mermaidCode.split('\n');
		for (const line of lines) {
			const trimmed = line.trim();
			
			// Parse node definitions (e.g., "n1[📁 Repository]")
			const nodeMatch = trimmed.match(/^\s*(\w+)\[(.*?)\]/);
			if (nodeMatch) {
				this.currentFlowchartNodes.set(nodeMatch[1], {
					id: nodeMatch[1],
					label: nodeMatch[2],
					line: trimmed
				});
			}
			
			// Parse edges (e.g., "n1 --> n2")
			const edgeMatch = trimmed.match(/^\s*(\w+)\s*-->\s*(\w+)/);
			if (edgeMatch) {
				this.currentFlowchartEdges.add(`${edgeMatch[1]}->${edgeMatch[2]}`);
			}
		}
	}

	calculateFlowchartDiff(newAnalysisData) {
		if (!this.previousFlowchartState) {
			return { hasSignificantChanges: true, changedNodes: [], changedEdges: [], newNodes: [], removedNodes: [] };
		}

		const changedFiles = Array.from(this.changedFiles);
		const changedNodes = [];
		const changedEdges = [];
		const newNodes = [];
		const removedNodes = [];

		// Identify which parts of the flowchart correspond to changed files
		for (const filePath of changedFiles) {
			const fileName = path.basename(filePath);
			const dirName = path.dirname(filePath).split(path.sep).pop();
			
			// Find nodes that represent this file or directory
			for (const [nodeId, nodeData] of this.currentFlowchartNodes) {
				if (nodeData.label.includes(fileName) || nodeData.label.includes(dirName)) {
					changedNodes.push(nodeId);
				}
			}
		}

		// Check for structural changes (new/removed directories)
		const oldStats = this.previousFlowchartState.analysis.stats;
		const newStats = newAnalysisData.stats;
		
		const hasStructuralChanges = 
			oldStats.totalDirectories !== newStats.totalDirectories ||
			Object.keys(oldStats.fileTypes).length !== Object.keys(newStats.fileTypes).length;

		return {
			hasSignificantChanges: changedNodes.length > 0 || hasStructuralChanges,
			changedNodes,
			changedEdges,
			newNodes,
			removedNodes,
			changedFiles,
			hasStructuralChanges
		};
	}

	async generateIncrementalMermaidCode(analysisData, updatePlan) {
		if (!anthropicClient || !config?.flowchart?.enableClaudeGeneration) {
			return this.generateIncrementalMermaidLocal(analysisData, updatePlan);
		}

		const { structure, stats } = analysisData;
		
		const prompt = `You are updating an existing Mermaid flowchart. ONLY modify the parts that have changed.

PREVIOUS FLOWCHART STATE:
${this.previousFlowchartState.mermaidCode}

CHANGED FILES (${updatePlan.changedFiles.length}):
${updatePlan.changedFiles.map(file => `- ${file}`).join('\n')}

CURRENT REPOSITORY STRUCTURE:
${JSON.stringify(structure, null, 2)}

INSTRUCTIONS:
1. Keep ALL unchanged nodes and edges EXACTLY as they were
2. Only update nodes that correspond to the changed files: ${updatePlan.changedNodes.join(', ')}
3. Add visual indicators (colors/styling) to highlight changed elements
4. Preserve the overall layout and structure
5. Use the same node IDs where possible

Generate the updated Mermaid code that freezes unchanged parts and only updates the modified sections.`;

		try {
			const response = await anthropicClient.messages.create({
				model: config.anthropic?.model || 'claude-3-5-sonnet-20241022',
				max_tokens: config.anthropic?.maxTokens || 4000,
				temperature: 0.1, // Lower temperature for more consistent updates
				messages: [{ role: 'user', content: prompt }]
			});

			const claudeResponse = response.content[0].text.trim();
			const mermaidMatch = claudeResponse.match(/```(?:mermaid)?\s*\n?(graph\s+TD[\s\S]*?)```/i);
			
			if (mermaidMatch) {
				return this.addChangeHighlighting(mermaidMatch[1].trim(), updatePlan);
			}
			
			return this.generateIncrementalMermaidLocal(analysisData, updatePlan);
		} catch (error) {
			console.error('GraphIt: Claude incremental update failed:', error);
			return this.generateIncrementalMermaidLocal(analysisData, updatePlan);
		}
	}

	generateIncrementalMermaidLocal(analysisData, updatePlan) {
		if (!this.previousFlowchartState) {
			return this.generateMermaidFlowchart(analysisData);
		}

		let mermaidCode = this.previousFlowchartState.mermaidCode;
		
		// Add change highlighting to the existing flowchart
		mermaidCode = this.addChangeHighlighting(mermaidCode, updatePlan);
		
		return mermaidCode;
	}

	addChangeHighlighting(mermaidCode, updatePlan) {
		let highlightedCode = mermaidCode;
		
		// Add styling for changed nodes
		if (updatePlan.changedNodes.length > 0) {
			highlightedCode += `\n\n    %% Change highlighting\n`;
			highlightedCode += `    classDef changed fill:#ffe6e6,stroke:#ff4444,stroke-width:3px,stroke-dasharray: 5 5\n`;
			highlightedCode += `    classDef unchanged fill:#f0f8f0,stroke:#28a745,stroke-width:2px\n`;
			
			// Apply changed styling to modified nodes
			for (const nodeId of updatePlan.changedNodes) {
				highlightedCode += `    class ${nodeId} changed\n`;
			}
		}
		
		return highlightedCode;
	}

	async generateDetailedFunctionFlowchart(functionAnalysis) {
		if (!anthropicClient || !config?.flowchart?.enableClaudeGeneration) {
			return this.generateLocalFunctionFlowchart(functionAnalysis);
		}

		const prompt = this.buildFunctionFlowchartPrompt(functionAnalysis);

		try {
			const response = await anthropicClient.messages.create({
				model: config.anthropic?.model || 'claude-3-5-sonnet-20241022',
				max_tokens: config.anthropic?.maxTokens || 6000, // More tokens for complex function charts
				temperature: 0.2,
				messages: [{ role: 'user', content: prompt }]
			});

			const claudeResponse = response.content[0].text.trim();
			const mermaidMatch = claudeResponse.match(/```(?:mermaid)?\s*\n?(flowchart\s+TD[\s\S]*?)```/i);
			
			if (mermaidMatch) {
				return mermaidMatch[1].trim();
			}
			
			return this.generateLocalFunctionFlowchart(functionAnalysis);
		} catch (error) {
			console.error('GraphIt: Claude function flowchart generation failed:', error);
			return this.generateLocalFunctionFlowchart(functionAnalysis);
		}
	}

	generateLocalFunctionFlowchart(functionAnalysis) {
		const { functions, classes, controlFlow, metadata } = functionAnalysis;
		
		console.log(`GraphIt: Generating clean function flowchart based on actual codebase`);
		
		// Use simple letter-based node IDs like in the example (A, B, C, etc.)
		let mermaidCode = 'flowchart TD\n';
		let nodeCounter = 0;
		const getNextNodeId = () => String.fromCharCode(65 + (nodeCounter++)); // A, B, C, etc.
		
		// Create a clean execution flow based on actual functions found
		mermaidCode += '    %% User Entry Point\n';
		const userEntry = getNextNodeId();
		
		// Find actual key functions from the codebase
		const mainFunction = functions.find(func => 
			func.name === 'activate' || func.name === 'main' || func.name === '__init__' || 
			func.name === 'init' || func.name.includes('start') || func.name === 'constructor'
		) || functions[0];
		
		const mainInit = getNextNodeId();
		mermaidCode += `    ${userEntry}[User creates ${mainFunction ? mainFunction.name.replace('__', '') : 'Extension'}] --> ${mainInit}[${mainFunction ? this.cleanFunctionName(mainFunction.name) : 'Extension.activate'}]\n\n`;
		
		// Find initialization functions
		const initFunctions = functions.filter(func => 
			func.name.includes('init') || func.name.includes('setup') || func.name.includes('create') ||
			func.name.includes('load') || func.name.includes('config') || func.name.includes('register')
		).slice(0, 3);
		
		if (initFunctions.length > 0) {
			mermaidCode += '    %% Initialization\n';
			for (const initFunc of initFunctions) {
				const nodeId = getNextNodeId();
				mermaidCode += `    ${mainInit} --> ${nodeId}[${this.cleanFunctionName(initFunc.name)}]\n`;
			}
			mermaidCode += '\n';
		}
		
		// Find main execution functions
		const execFunctions = functions.filter(func => 
			func.name.includes('run') || func.name.includes('execute') || func.name.includes('handle') ||
			func.name.includes('process') || func.name.includes('analyze') || func.name.includes('generate')
		).slice(0, 6);
		
		if (execFunctions.length > 0) {
			mermaidCode += '    %% Main execution flow\n';
			const mainRun = getNextNodeId();
			mermaidCode += `    ${userEntry} --> ${mainRun}[${this.cleanFunctionName(execFunctions[0].name)}]\n`;
			
			let prevNode = mainRun;
			for (let i = 1; i < execFunctions.length; i++) {
				const nodeId = getNextNodeId();
				mermaidCode += `    ${prevNode} --> ${nodeId}[${this.cleanFunctionName(execFunctions[i].name)}]\n`;
				prevNode = nodeId;
			}
			mermaidCode += '\n';
		}
		
		// Add decision points if we have conditional functions
		const decisionFunctions = functions.filter(func => 
			func.name.includes('check') || func.name.includes('validate') || func.name.includes('test') ||
			func.name.includes('verify') || func.name.includes('should')
		).slice(0, 2);
		
		if (decisionFunctions.length > 0) {
			mermaidCode += '    %% Decision points\n';
			for (const decisionFunc of decisionFunctions) {
				const decisionNode = getNextNodeId();
				const yesPath = getNextNodeId();
				const noPath = getNextNodeId();
				
				mermaidCode += `    ${decisionNode}{${this.getCleanDecisionLabel(decisionFunc.name)}}\n`;
				mermaidCode += `    ${decisionNode} -->|Yes| ${yesPath}[Continue processing]\n`;
				mermaidCode += `    ${decisionNode} -->|No| ${noPath}[Handle alternative]\n`;
			}
			mermaidCode += '\n';
		}
		
		// Add result processing
		const resultFunctions = functions.filter(func => 
			func.name.includes('return') || func.name.includes('result') || func.name.includes('output') ||
			func.name.includes('response') || func.name.includes('complete')
		).slice(0, 2);
		
		if (resultFunctions.length > 0) {
			mermaidCode += '    %% Result processing\n';
			for (const resultFunc of resultFunctions) {
				const nodeId = getNextNodeId();
				mermaidCode += `    ${nodeId}[${this.cleanFunctionName(resultFunc.name)}]\n`;
			}
			mermaidCode += '\n';
		}
		
		// Add simplified subgraphs only if we have enough functions
		if (functions.length > 10) {
			const layers = this.identifySimpleLayers(functions);
			
			for (const [layerName, layerFunctions] of layers) {
				if (layerFunctions.length > 2) {
					mermaidCode += `    subgraph "${layerName}"\n`;
					// Just reference a few key functions without overwhelming detail
					const keyFunctions = layerFunctions.slice(0, 3);
					for (const func of keyFunctions) {
						mermaidCode += `        ${this.cleanFunctionName(func.name)}\n`;
					}
					mermaidCode += '    end\n\n';
				}
			}
		}
		
		// Clean, minimal styling like the example
		const totalNodes = nodeCounter;
		if (totalNodes > 0) {
			mermaidCode += `    style A fill:#e1f5fe\n`; // User entry
			if (totalNodes > 2) mermaidCode += `    style C fill:#e8f5e8\n`; // Main execution
			if (totalNodes > 5) mermaidCode += `    style F fill:#fff3e0\n`; // Decision/AI
			if (totalNodes > 7) mermaidCode += `    style H fill:#f3e5f5\n`; // Special function
		}
		
		return mermaidCode;
	}

	cleanFunctionName(name) {
		// Clean up function names for better readability
		return name
			.replace(/^__/, '')
			.replace(/__$/, '')
			.replace(/_/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to words
			.replace(/\b\w/g, l => l.toUpperCase()); // Title case
	}

	getCleanDecisionLabel(funcName) {
		if (funcName.includes('check') || funcName.includes('validate')) return 'Valid input?';
		if (funcName.includes('test')) return 'Test passed?';
		if (funcName.includes('should') || funcName.includes('can')) return 'Should proceed?';
		if (funcName.includes('verify')) return 'Verified?';
		return 'Continue?';
	}

	identifySimpleLayers(functions) {
		const layers = new Map();
		
		for (const func of functions) {
			let layer = 'Core';
			
			if (func.name.includes('web') || func.name.includes('http') || func.name.includes('request')) {
				layer = 'Network';
			} else if (func.name.includes('ui') || func.name.includes('view') || func.name.includes('render')) {
				layer = 'UI';
			} else if (func.name.includes('data') || func.name.includes('store') || func.name.includes('save')) {
				layer = 'Data';
			} else if (func.name.includes('util') || func.name.includes('helper')) {
				layer = 'Utils';
			}
			
			if (!layers.has(layer)) {
				layers.set(layer, []);
			}
			layers.get(layer).push(func);
		}
		
		return layers;
	}

	getDescriptiveLabel(funcName) {
		// Convert function names to more descriptive labels
		if (funcName.includes('init') || funcName.includes('__init__')) return 'Initialize Controller with action registry';
		if (funcName.includes('create') && funcName.includes('browser')) return 'Create BrowserContext';
		if (funcName.includes('setup') && funcName.includes('message')) return 'Setup MessageManager';
		if (funcName.includes('create') && funcName.includes('action')) return 'Create action models from registry';
		if (funcName.includes('run')) return 'agent.run max_steps=100';
		if (funcName.includes('execute')) return 'Execute actions';
		return funcName; // fallback to original name
	}

	buildFunctionFlowchartPrompt(functionAnalysis) {
		const { functions, classes, controlFlow, metadata } = functionAnalysis;
		
		return `You are an expert at creating professional, highly detailed function-level flowcharts with sophisticated visual design that show execution flow, decision points, and component interactions.

FUNCTION ANALYSIS DATA:
- Total Functions: ${metadata.totalFunctions}
- Total Classes: ${metadata.totalClasses}

FUNCTIONS:
${functions.slice(0, 20).map(func => `- ${func.name} (${func.type}) in ${func.file}:${func.line}${func.class ? ` [${func.class}]` : ''}`).join('\n')}

CLASSES:
${classes.slice(0, 10).map(cls => `- ${cls.name} in ${cls.file} with methods: [${cls.methods.join(', ')}]`).join('\n')}

VISUAL STYLE REQUIREMENTS (CRITICAL - MATCH EXACTLY):
Use this EXACT professional dark theme styling:
\\\`\\\`\\\`
classDef default fill:#2d3748,stroke:#4a5568,stroke-width:2px,color:#e2e8f0,font-weight:500
classDef entryPoint fill:#2b6cb0,stroke:#3182ce,stroke-width:3px,color:#ffffff,font-weight:600
classDef process fill:#38a169,stroke:#48bb78,stroke-width:2px,color:#ffffff,font-weight:500
classDef decision fill:#d69e2e,stroke:#ed8936,stroke-width:2px,color:#ffffff,font-weight:500
classDef service fill:#805ad5,stroke:#9f7aea,stroke-width:2px,color:#ffffff,font-weight:500
classDef result fill:#e53e3e,stroke:#f56565,stroke-width:2px,color:#ffffff,font-weight:500
classDef complete fill:#38a169,stroke:#48bb78,stroke-width:3px,color:#ffffff,font-weight:600
\\\`\\\`\\\`

FLOWCHART STRUCTURE REQUIREMENTS:
1. Start with "User creates Agent with task" as the entry point
2. Use 'flowchart TD' syntax for professional top-down flow
3. Create logical execution sequence: Entry → Initialization → Main Loop → Decision Points → Results
4. Include decision diamonds {} with specific labels like "Action Type?", "Task complete?", "Error occurred?"
5. Add branching with descriptive edge labels like |Yes|, |No|, |click_element|, |input_text|
6. Create organized subgraphs for layers:
   - subgraph BrowserLayer_["Browser Layer"]
   - subgraph AILayer_["AI Layer"] 
   - subgraph ActionLayer_["Action Layer"]
   - subgraph ServiceLayer_["Service Layer"]
7. Show clear execution paths and loops
8. Include error handling and completion flows
9. Use clean, descriptive node labels without icons
10. Apply the exact styling classes to nodes based on their function

EXPECTED STRUCTURE PATTERN:
- Entry point → Main initialization
- Initialization → Setup functions
- Main execution loop with step functions
- Decision points for different action types
- Branching to specific handlers
- Result processing and completion checks
- Error handling paths
- Final completion or loop back

Generate a professional flowchart that matches the sophisticated visual style of enterprise software architecture diagrams, with clean subgraph organization and consistent dark theme styling.

Return ONLY the complete Mermaid flowchart code with all styling included.`;
	}

	buildClaudePrompt(analysisData) {
		const { structure, stats, functionAnalysis } = analysisData;
		
		let prompt = `Please create a detailed, unified flowchart representing both the repository structure and key functions of this codebase:

Repository Statistics:
- Total Files: ${stats.totalFiles}
- Total Directories: ${stats.totalDirectories}
- Total Lines of Code: ${stats.totalLines}
- File Types: ${JSON.stringify(stats.fileTypes, null, 2)}`;

		// Add function analysis if available
		if (functionAnalysis && functionAnalysis.functions.length > 0) {
			const totalFunctions = functionAnalysis.functions.length;
			const keyFunctions = functionAnalysis.functions
				.filter(func => 
					func.name.includes('main') || func.name.includes('init') || 
					func.name.includes('handle') || func.name.includes('process') ||
					func.name.includes('generate') || func.name.includes('analyze') ||
					func.name.includes('create') || func.name.includes('run')
				)
				.slice(0, 12); // Intelligent limit based on importance

			prompt += `

Function Analysis:
- Total Functions: ${totalFunctions}
- Total Classes: ${functionAnalysis.metadata.totalClasses}
- Key Functions to Include:
${keyFunctions.map(func => `  • ${func.name} (${func.type}) in ${func.file}${func.class ? ` [${func.class}]` : ''}`).join('\n')}`;

			if (totalFunctions > 12) {
				prompt += `
- Note: Showing ${keyFunctions.length} most important functions out of ${totalFunctions} total for clarity`;
			}
		}

		prompt += `

Repository Structure:
${JSON.stringify(structure, null, 2)}

Please create a unified visual flowchart that shows:
1. **Repository Architecture**: Main directory structure and file organization
2. **Key Function Flow**: Entry points, main execution paths, and important functions
3. **Component Relationships**: How directories, files, and functions interact
4. **Data Flow**: Show how information moves through the system

Requirements:
- Use 'graph TD' syntax for top-down flowchart
- Include meaningful icons using emojis for visual appeal
- **Smart Function Integration**: Include ${functionAnalysis ? 'the key functions listed above' : 'any identifiable code patterns'} as execution nodes
- Group related components logically using subgraphs
- Show clear relationships with descriptive arrows
- Use clean, professional styling with classDef
- Balance detail with readability - focus on the most important architectural elements
- **Intelligent Scope**: Show enough detail to understand the system without overwhelming complexity

Return ONLY the Mermaid code, starting with 'graph TD' and including professional styling at the end.`;

		return prompt;
	}

	generateMermaidFlowchart(analysisData) {
		const { structure, stats, functionAnalysis } = analysisData;
		
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
		
		// Add stats summary with function info
		const statsId = getNodeId('Stats');
		const functionCount = functionAnalysis ? functionAnalysis.functions.length : 0;
		const functionText = functionCount > 0 ? `, ${functionCount} functions` : '';
		mermaidCode += `    ${statsId}[📊 ${stats.totalFiles} files, ${stats.totalDirectories} dirs${functionText}]\n`;
		mermaidCode += `    ${rootId} --> ${statsId}\n`;
		
		// Add key functions section if available
		if (functionAnalysis && functionAnalysis.functions.length > 0) {
			const keyFunctions = this.selectKeyFunctions(functionAnalysis.functions, stats.totalFiles);
			
			if (keyFunctions.length > 0) {
				const functionsId = getNodeId('KeyFunctions');
				mermaidCode += `    ${functionsId}[⚡ Key Functions (${keyFunctions.length})]\n`;
				mermaidCode += `    ${rootId} --> ${functionsId}\n`;
				
				// Add individual key functions
				keyFunctions.forEach(func => {
					const funcId = getNodeId(sanitizeName(func.name));
					const cleanName = this.cleanFunctionName(func.name);
					const icon = this.getFunctionIcon(func);
					mermaidCode += `    ${funcId}[${icon} ${cleanName}]\n`;
					mermaidCode += `    ${functionsId} --> ${funcId}\n`;
				});
				
				// Add execution flow between key functions if detectable
				this.addFunctionFlow(mermaidCode, keyFunctions, getNodeId, sanitizeName);
			}
		}

		// Process directory structure (existing logic)
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
		
		// Add enhanced styling for unified view
		mermaidCode += `\n    classDef dirStyle fill:#e1f5fe,stroke:#01579b,stroke-width:2px\n`;
		mermaidCode += `    classDef fileStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:2px\n`;
		mermaidCode += `    classDef configStyle fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px\n`;
		mermaidCode += `    classDef functionStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px\n`;
		mermaidCode += `    classDef keyFunctionStyle fill:#fce4ec,stroke:#880e4f,stroke-width:3px\n`;
		
		return mermaidCode;
	}

	// Helper method to intelligently select key functions based on repository size
	selectKeyFunctions(functions, totalFiles) {
		// Determine how many functions to show based on repository size
		let maxFunctions;
		if (totalFiles < 10) {
			maxFunctions = Math.min(8, functions.length); // Small repos: show more detail
		} else if (totalFiles < 50) {
			maxFunctions = Math.min(6, functions.length); // Medium repos: balanced view
		} else {
			maxFunctions = Math.min(4, functions.length); // Large repos: focus on essentials
		}

		// Priority-based selection
		const priorities = [
			func => func.name === 'main' || func.name === 'activate' || func.name === '__init__',
			func => func.name.includes('init') || func.name.includes('setup'),
			func => func.name.includes('handle') || func.name.includes('process'),
			func => func.name.includes('generate') || func.name.includes('create'),
			func => func.name.includes('analyze') || func.name.includes('build'),
			func => func.name.includes('run') || func.name.includes('execute'),
			func => func.isMethod && func.class,
			func => func.type === 'async-function'
		];

		const selected = [];
		const used = new Set();

		// Select functions by priority
		for (const priority of priorities) {
			if (selected.length >= maxFunctions) break;
			
			const candidates = functions.filter(func => 
				!used.has(func.name) && priority(func)
			);
			
			for (const func of candidates) {
				if (selected.length >= maxFunctions) break;
				selected.push(func);
				used.add(func.name);
			}
		}

		// Fill remaining slots with any important-looking functions
		if (selected.length < maxFunctions) {
			const remaining = functions.filter(func => 
				!used.has(func.name) && 
				!func.name.startsWith('_') && 
				func.name.length > 2
			).slice(0, maxFunctions - selected.length);
			
			selected.push(...remaining);
		}

		return selected;
	}

	// Helper method to get appropriate icon for function type
	getFunctionIcon(func) {
		if (func.name === 'main' || func.name === 'activate') return '🚀';
		if (func.name.includes('init') || func.name.includes('setup')) return '🔧';
		if (func.name.includes('handle') || func.name.includes('process')) return '⚙️';
		if (func.name.includes('generate') || func.name.includes('create')) return '✨';
		if (func.name.includes('analyze') || func.name.includes('build')) return '🔍';
		if (func.type === 'async-function') return '⚡';
		if (func.isMethod) return '🔗';
		return '📝';
	}

	// Helper method to add execution flow between functions (simplified)
	addFunctionFlow(mermaidCode, keyFunctions, getNodeId, sanitizeName) {
		// Simple heuristic: connect functions that might call each other
		for (let i = 0; i < keyFunctions.length - 1; i++) {
			const current = keyFunctions[i];
			const next = keyFunctions[i + 1];
			
			// Connect if there's a logical flow (init -> handle -> process, etc.)
			if (this.shouldConnectFunctions(current, next)) {
				const currentId = getNodeId(sanitizeName(current.name));
				const nextId = getNodeId(sanitizeName(next.name));
				mermaidCode += `    ${currentId} -.-> ${nextId}\n`;
			}
		}
	}

	// Helper method to determine if functions should be connected
	shouldConnectFunctions(func1, func2) {
		const initKeywords = ['init', 'setup', 'create', 'load'];
		const processKeywords = ['handle', 'process', 'execute', 'run'];
		
		const func1IsInit = initKeywords.some(kw => func1.name.includes(kw));
		const func2IsProcess = processKeywords.some(kw => func2.name.includes(kw));
		
		return func1IsInit && func2IsProcess;
	}

	async generateClaudeFlowchart(analysisData) {
		if (!anthropicClient || !config?.flowchart?.enableClaudeGeneration) {
			console.log('GraphIt: Claude API not available, using local generation');
			return this.generateMermaidFlowchart(analysisData);
		}

		const { structure, stats, isIncremental, changedFiles } = analysisData;
		
		let prompt;
		
		if (isIncremental && changedFiles && changedFiles.length > 0) {
			// Optimized prompt for incremental updates
			prompt = `You are an expert at creating beautiful, informative Mermaid flowcharts for software repositories. 

This is an INCREMENTAL UPDATE for a repository flowchart. Focus on efficiently updating the existing structure to reflect recent changes.

Recent Changes (${changedFiles.length} files):
${changedFiles.map(file => `- ${file}`).join('\n')}

Current Repository Statistics:
- Total Files: ${stats.totalFiles}
- Total Directories: ${stats.totalDirectories}
- Total Lines of Code: ${stats.totalLines}
- File Types: ${JSON.stringify(stats.fileTypes, null, 2)}

Repository Structure:
${JSON.stringify(structure, null, 2)}

Requirements for INCREMENTAL UPDATE:
- Use 'graph TD' syntax for top-down flowchart
- Focus on changes and their impact on architecture
- Maintain existing structure but highlight new/modified components
- Show relationships between changed files and existing architecture
- Use descriptive node labels
- Keep it efficient and focused on the changes
- Add styling with classDef for visual appeal

Return ONLY the Mermaid code, starting with 'graph TD' and including styling at the end.`;
		} else {
			// Full analysis prompt
			prompt = `You are an expert at creating beautiful, informative Mermaid flowcharts for software repositories. 

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
		}

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
			--primary-accent: #0078d4;
			--surface-primary: var(--vscode-panel-background);
			--surface-secondary: var(--vscode-editor-background);
			--border-subtle: var(--vscode-panel-border);
			--text-primary: var(--vscode-editor-foreground);
			--text-secondary: var(--vscode-descriptionForeground);
		}
		
		.main-container {
			display: flex;
			flex-direction: column;
			height: 100vh;
			min-height: 600px;
		}
		
		.header {
			background: var(--surface-primary);
			padding: 16px 24px;
			border-bottom: 1px solid var(--border-subtle);
			display: flex;
			justify-content: space-between;
			align-items: center;
			flex-shrink: 0;
			backdrop-filter: blur(10px);
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
			background: var(--surface-secondary);
			border: 1px solid var(--border-subtle);
			padding: 4px 8px;
			border-radius: 6px;
			margin-right: 12px;
			font-family: monospace;
			font-weight: 500;
		}
		
		.btn {
			background: var(--surface-secondary);
			color: var(--text-primary);
			border: 1px solid var(--border-subtle);
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
			background: var(--primary-accent);
			color: white;
			border-color: var(--primary-accent);
			transform: translateY(-1px);
			box-shadow: 0 2px 8px rgba(0, 120, 212, 0.3);
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
			background: var(--surface-secondary);
			border-radius: 4px;
			border: 1px solid var(--border-subtle);
		}
		
		.auto-refresh-toggle {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			color: var(--text-secondary);
			cursor: pointer;
			padding: 4px 8px;
			background: var(--surface-secondary);
			border-radius: 4px;
			border: 1px solid var(--border-subtle);
			transition: all 0.2s ease;
		}
		
		.auto-refresh-toggle:hover {
			background: var(--surface-primary);
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
			overflow: auto;
			position: relative;
			min-height: 400px;
			border: 1px solid var(--border-subtle);
			margin: 8px;
			border-radius: 8px;
		}
		
		#mermaid-diagram {
			max-width: 100%;
			max-height: 100%;
			transition: transform 0.1s ease;
			transform-origin: center center;
			cursor: grab;
		}
		
		/* Professional dark theme styling for Mermaid diagrams */
		#mermaid-diagram svg text,
		#mermaid-diagram svg .nodeLabel,
		#mermaid-diagram svg .edgeLabel,
		#mermaid-diagram svg .label {
			font-family: Inter, system-ui, sans-serif !important;
			font-weight: 500 !important;
			font-size: 14px !important;
		}
		
		/* Enhance readability with proper contrast */
		#mermaid-diagram svg .edgePath .path {
			stroke-width: 2px !important;
		}
		
		/* Subgraph styling for professional appearance */
		#mermaid-diagram svg .cluster rect {
			rx: 8px !important;
			ry: 8px !important;
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
		
		@keyframes pulse {
			0% { transform: scale(1); opacity: 1; }
			50% { transform: scale(1.05); opacity: 0.8; }
			100% { transform: scale(1); opacity: 1; }
		}
		
		.loading-text {
			color: var(--vscode-descriptionForeground);
			text-align: center;
		}
		
		.details-panel {
			background: var(--surface-primary);
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
			background: var(--surface-secondary);
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
			background: var(--surface-secondary);
			padding: 16px;
			border-radius: 8px;
			text-align: center;
			border: 1px solid var(--border-subtle);
			transition: transform 0.2s ease;
		}
		
		.stat-card:hover {
			transform: translateY(-2px);
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
			background: rgba(45, 45, 48, 0.6);
			border-radius: 8px 8px 0 0;
			backdrop-filter: blur(8px);
		}
		
		.tab {
			background: rgba(255, 255, 255, 0.05);
			border: none;
			padding: 12px 20px;
			cursor: pointer;
			color: var(--text-secondary);
			border-bottom: 2px solid transparent;
			font-size: 12px;
			font-weight: 500;
			transition: all 0.2s ease;
			backdrop-filter: blur(4px);
		}
		
		.tab:hover {
			color: var(--text-primary);
			background: rgba(255, 255, 255, 0.1);
		}
		
		.tab.active {
			color: var(--primary-accent);
			border-bottom-color: var(--primary-accent);
			background: rgba(0, 120, 212, 0.2);
		}
		
		.tab-content {
			display: none;
		}
		
		.tab-content.active {
			display: block;
		}
		
		.code-block {
			background: var(--surface-secondary);
			border: 1px solid var(--border-subtle);
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
			background: var(--surface-secondary);
			padding: 16px;
			border-radius: 6px;
			border: 1px solid var(--border-subtle);
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
		
		/* Responsive design for different VS Code panel sizes */
		@media (max-height: 600px) {
			.details-content.expanded {
				max-height: 200px !important;
			}
			
			.header {
				padding: 12px 16px;
			}
			
			.btn-small {
				padding: 4px 8px;
				font-size: 10px;
			}
		}
		
		@media (max-height: 400px) {
			.details-content.expanded {
				max-height: 150px !important;
			}
			
			.stat-card {
				padding: 8px;
			}
			
			.tabs {
				margin-bottom: 10px;
			}
		}
	</style>
</head>
<body>
	<div class="main-container">
		<div class="header">
			<h1>GraphIt</h1>
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
					Detailed Functions
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
			<div class="diagram-viewport">
				<div id="mermaid-diagram"></div>
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
		let currentZoom = 2.0; // Start at 200% zoom
		let panX = 0;
		let panY = 0;
		let initialTouchDistance = 0;
		let isDragging = false;
		let lastMouseX = 0;
		let lastMouseY = 0;
		
		// Initialize Mermaid and responsive handling
		document.addEventListener('DOMContentLoaded', () => {
			mermaid.initialize({ 
				startOnLoad: false,
				theme: 'dark',
				themeVariables: {
					// Professional dark theme matching the example image
					primaryColor: '#2d3748',
					primaryTextColor: '#e2e8f0',
					primaryBorderColor: '#4a5568',
					lineColor: '#718096',
					secondaryColor: '#374151',
					tertiaryColor: '#4a5568',
					background: '#1a202c',
					mainBkg: '#2d3748',
					secondBkg: '#374151',
					tertiaryTextColor: '#e2e8f0',
					labelTextColor: '#ffffff',
					textColor: '#e2e8f0',
					nodeTextColor: '#ffffff',
					// Dark theme colors
					cScale0: '#2d3748',
					cScale1: '#374151',
					cScale2: '#4a5568',
					// Node styling for dark theme
					nodeBkg: '#2d3748',
					nodeTextColor: '#ffffff',
					// Arrow and line colors for dark theme
					edgeLabelBackground: 'rgba(45, 55, 72, 0.9)',
					edgeLabelColor: '#ffffff',
					// Subgraph styling
					clusterBkg: '#374151',
					clusterBorder: '#4a5568',
					// Decision node colors
					altBackground: '#d69e2e',
					// Additional professional styling
					fontFamily: 'Inter, system-ui, sans-serif',
					fontSize: '14px'
				}
			});
			
			// Auto-start analysis
			setTimeout(autoStartAnalysis, 500);
			
			// Setup zoom event listeners
			setupZoomControls();
			
			// Setup responsive handling
			setupResponsiveHandling();
		});

		function autoStartAnalysis() {
			updateStatus('Analyzing repository...', 'analyzing');
			updateLoadingText('Analyzing repository structure...', 'Scanning files and directories...');
			
			vscode.postMessage({
				command: 'analyzeRepository'
			});
		}

		function regenerateFlowchart() {
			if (!currentAnalysis) {
				autoStartAnalysis();
				return;
			}
			
			updateStatus('Generating flowchart...', 'generating');
			updateLoadingText('Generating flowchart...', 'Creating visual representation...');
			showLoading();
			
			vscode.postMessage({
				command: 'generateFlowchart',
				data: currentAnalysis
			});
		}

		function generateFunctionChart() {
			updateStatus('Analyzing functions...', 'generating');
			updateLoadingText('Performing function-level analysis...', 'Scanning code files and building call graph...');
			showLoading();
			
			vscode.postMessage({
				command: 'generateFunctionFlowchart',
				data: {}
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
				
				currentZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 6.0);
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
					
					currentZoom = Math.min(Math.max(currentZoom * scaleFactor, 0.2), 6.0);
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

		async function renderMermaidDiagram(mermaidCode, preserveState = false, updatePlan = null) {
			const element = document.getElementById('mermaid-diagram');
			
			// Store current visual state for preservation
			const previousZoom = currentZoom;
			const previousPanX = panX;
			const previousPanY = panY;
			
			element.innerHTML = '';
			
			try {
				// Validate mermaid code before rendering
				if (!mermaidCode || mermaidCode.trim().length === 0) {
					throw new Error('Empty Mermaid code provided');
				}
				
				console.log('GraphIt: Rendering Mermaid diagram...');
				console.log('GraphIt: Mermaid code length:', mermaidCode.length);
				
				const { svg } = await mermaid.render('mermaid-svg', mermaidCode);
				element.innerHTML = svg;
				
				if (preserveState) {
					// Preserve visual state for incremental updates
					currentZoom = previousZoom;
					panX = previousPanX;
					panY = previousPanY;
					console.log('GraphIt: Visual state preserved during incremental update');
					
					// Add subtle animation to highlight changes
					if (updatePlan && updatePlan.changedNodes.length > 0) {
						highlightChangedElements(updatePlan.changedNodes);
					}
				} else {
					// Reset zoom and pan when new diagram is loaded
					currentZoom = 2.0; // Start new diagrams at 200% zoom
					panX = 0;
					panY = 0;
				}
				
				applyTransform();
				hideLoading();
				console.log('GraphIt: Mermaid diagram rendered successfully');
			} catch (error) {
				console.error('GraphIt: Error rendering Mermaid diagram:', error);
				console.error('GraphIt: Mermaid code that failed:', mermaidCode);
				
				let errorMessage = 'Failed to render diagram';
				if (error.message.includes('Parse error')) {
					errorMessage += ': Invalid Mermaid syntax';
				} else if (error.message.includes('Too many')) {
					errorMessage += ': Diagram too complex';
				} else {
					errorMessage += ': ' + error.message;
				}
				
				showError(errorMessage + '. Check console for details.');
			}
		}

		function highlightChangedElements(changedNodeIds) {
			// Add a temporary pulse animation to changed elements
			setTimeout(() => {
				const svgElement = document.querySelector('#mermaid-diagram svg');
				if (!svgElement) return;
				
				changedNodeIds.forEach(nodeId => {
					const nodeElement = svgElement.querySelector(\`[id*="\${nodeId}"]\`);
					if (nodeElement) {
						nodeElement.style.animation = 'pulse 2s ease-in-out 3';
						nodeElement.style.filter = 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.6))';
						
						// Remove animation after completion
						setTimeout(() => {
							nodeElement.style.animation = '';
							nodeElement.style.filter = '';
						}, 6000);
					}
				});
				
				console.log(\`GraphIt: Highlighted \${changedNodeIds.length} changed elements\`);
			}, 100); // Small delay to ensure SVG is rendered
		}
		
		function toggleDetails() {
			detailsExpanded = !detailsExpanded;
			const content = document.getElementById('detailsContent');
			const icon = document.getElementById('toggleIcon');
			
			if (detailsExpanded) {
				content.classList.add('expanded');
				icon.textContent = '▼';
				// Trigger responsive adjustment
				setTimeout(() => {
					const event = new Event('resize');
					window.dispatchEvent(event);
				}, 50);
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

		function toggleAutoRefresh() {
			const checkbox = document.getElementById('autoRefreshToggle');
			const enabled = checkbox.checked;
			
			vscode.postMessage({
				command: 'toggleAutoRefresh',
				enabled: enabled
			});
			
			// Update status indicator
			if (enabled) {
				console.log('Auto-refresh enabled - will update when files change');
			} else {
				console.log('Auto-refresh disabled');
			}
		}

		function setupResponsiveHandling() {
			function adjustDetailsPanel() {
				const detailsContent = document.getElementById('detailsContent');
				const mainContainer = document.querySelector('.main-container');
				
				if (detailsContent && mainContainer) {
					const containerHeight = mainContainer.clientHeight;
					const headerHeight = document.querySelector('.header').clientHeight;
					const diagramMinHeight = 300; // Minimum height for diagram
					const availableHeight = containerHeight - headerHeight - diagramMinHeight;
					
					// Ensure details panel doesn't take more than 40% of available space
					const maxDetailsHeight = Math.max(200, availableHeight * 0.4);
					detailsContent.style.maxHeight = detailsExpanded ? \`\${maxDetailsHeight}px\` : '0px';
				}
			}

			// Handle window resize
			window.addEventListener('resize', adjustDetailsPanel);
			
			// Handle VS Code panel resize
			const resizeObserver = new ResizeObserver(() => {
				adjustDetailsPanel();
			});
			
			const mainContainer = document.querySelector('.main-container');
			if (mainContainer) {
				resizeObserver.observe(mainContainer);
			}
			
			// Initial adjustment
			setTimeout(adjustDetailsPanel, 100);
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

		function renderFunctionStats(metadata) {
			const statsHtml = \`
				<div class="stat-card">
					<div class="stat-number">\${metadata.totalFunctions}</div>
					<div class="stat-label">Functions</div>
				</div>
				<div class="stat-card">
					<div class="stat-number">\${metadata.totalClasses}</div>
					<div class="stat-label">Classes</div>
				</div>
				<div class="stat-card">
					<div class="stat-number">📊</div>
					<div class="stat-label">Function-Level</div>
				</div>
				<div class="stat-card">
					<div class="stat-number">🔄</div>
					<div class="stat-label">Call Graph</div>
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
					
					// Check if this is an incremental update
					if (message.data.isIncremental) {
						updateStatus(\`Incremental update: \${message.data.changedFiles.length} files changed\`, 'generating');
						updateLoadingText('Smart update in progress...', 'Analyzing only changed files for efficiency...');
						console.log('GraphIt: Incremental update - changed files:', message.data.changedFiles);
					} else {
						updateStatus('Generating flowchart...', 'generating');
						updateLoadingText('Generating flowchart...', 'Creating visual representation...');
					}
					
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
					const sourceText = message.data.source === 'claude' ? 'Generated with Claude AI' : 'Generated locally';
					updateStatus(sourceText, 'completed');
					
					renderMermaidDiagram(message.data.mermaidCode, false);
					break;

				case 'flowchartUpdatedIncremental':
					currentMermaidCode = message.data.mermaidCode;
					
					document.getElementById('claudePrompt').textContent = message.data.claudePrompt;
					document.getElementById('mermaidCode').textContent = message.data.mermaidCode;
					
					// Show selective update status
					updateStatus(message.data.message, 'completed');
					console.log('GraphIt: Selective update applied - preserving visual state');
					
					renderMermaidDiagram(message.data.mermaidCode, true, message.data.updatePlan);
					break;

				case 'functionFlowchartGenerated':
					currentMermaidCode = message.data.mermaidCode;
					
					document.getElementById('claudePrompt').textContent = message.data.claudePrompt;
					document.getElementById('mermaidCode').textContent = message.data.mermaidCode;
					
					// Show function chart generation status
					updateStatus(message.data.message, 'completed');
					console.log('GraphIt: Function-level flowchart generated');
					
					// Update title to indicate function-level mode
					document.querySelector('.header h1').textContent = 'GraphIt - Function Level Analysis';
					
					// Render the detailed function flowchart with dark theme
					renderMermaidDiagram(message.data.mermaidCode, false);
					
					// Update stats with function data
					if (message.data.functionAnalysis) {
						renderFunctionStats(message.data.functionAnalysis.metadata);
					}
					break;
					
				case 'autoRefreshStarted':
					updateStatus('Auto-refreshing from file changes...', 'analyzing');
					break;
			}
		});
	</script>
</body>
</html>`;
	}

	setupGitWatcher() {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		try {
			// Check if Git extension is available and activated
			const gitExtension = vscode.extensions.getExtension('vscode.git');
			
			if (!gitExtension) {
				console.log('GraphIt: Git extension not installed, using file system watcher');
				this.setupFallbackWatcher();
				return;
			}

			if (!gitExtension.isActive) {
				console.log('GraphIt: Git extension not activated, trying to activate...');
				Promise.resolve(gitExtension.activate()).then(() => {
					console.log('GraphIt: Git extension activated, setting up Git watcher');
					this.initializeGitWatcher();
				}, () => {
					console.log('GraphIt: Failed to activate Git extension, using file system watcher');
					this.setupFallbackWatcher();
				});
				return;
			}

			this.initializeGitWatcher();
		} catch (error) {
			console.log('GraphIt: Error accessing Git extension, using file system watcher:', error.message);
			this.setupFallbackWatcher();
		}
	}

	initializeGitWatcher() {
		try {
			const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
			if (!gitExtension) {
				this.setupFallbackWatcher();
				return;
			}

			const git = gitExtension.getAPI(1);
			if (!git || !git.repositories || git.repositories.length === 0) {
				console.log('GraphIt: No Git repository found in workspace, using file system watcher');
				this.setupFallbackWatcher();
				return;
			}

			const repository = git.repositories[0];

			const debouncedRefresh = () => {
				// Only refresh if auto-refresh is enabled
				if (!this.autoRefreshEnabled) return;
				
				// Clear existing timeout
				if (this.refreshTimeout) {
					clearTimeout(this.refreshTimeout);
				}
				
				// Set new timeout - refresh after 2 seconds of inactivity
				this.refreshTimeout = setTimeout(async () => {
					console.log('GraphIt: Auto-refreshing due to Git changes...');
					
					// Get changed files from Git
					const changes = repository.state.workingTreeChanges;
					const stagedChanges = repository.state.indexChanges;
					
					this.changedFiles.clear();
					[...changes, ...stagedChanges].forEach(change => {
						this.changedFiles.add(change.uri.fsPath);
					});
					
					console.log(`GraphIt: Detected ${this.changedFiles.size} changed files`);
					
					// Notify the webview that auto-refresh is happening
					this.panel.webview.postMessage({
						command: 'autoRefreshStarted'
					});
					
					await this.handleIncrementalUpdate();
				}, 2000);
			};

			// Listen to Git repository state changes
			repository.state.onDidChange(debouncedRefresh, null, this.disposables);
			
			this.disposables.push(repository);
			console.log('GraphIt: Git-based change tracking activated');
			this.gitWatcher = repository;
		} catch (error) {
			console.log('GraphIt: Error initializing Git watcher, using file system watcher:', error.message);
			this.setupFallbackWatcher();
		}
	}

	setupFallbackWatcher() {
		// Fallback to file system watcher if Git is not available
		const watcher = vscode.workspace.createFileSystemWatcher('**/*');
		
		const debouncedRefresh = () => {
			if (!this.autoRefreshEnabled) return;
			
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout);
			}
			
			this.refreshTimeout = setTimeout(() => {
				console.log('GraphIt: Auto-refreshing due to file changes (fallback)...');
				this.panel.webview.postMessage({
					command: 'autoRefreshStarted'
				});
				this.handleAnalyzeRepository();
			}, 3000);
		};

		watcher.onDidCreate(debouncedRefresh);
		watcher.onDidChange(debouncedRefresh);
		watcher.onDidDelete(debouncedRefresh);

		this.disposables.push(watcher);
		console.log('GraphIt: File system watcher activated as fallback');
	}

	toggleAutoRefresh(enabled) {
		this.autoRefreshEnabled = enabled;
		console.log(`GraphIt: Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
		
		if (!enabled && this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	async handleIncrementalUpdate() {
		try {
			if (this.changedFiles.size === 0) {
				// No specific changes, do full refresh
				await this.handleAnalyzeRepository();
				return;
			}

			console.log('GraphIt: Performing incremental update for changed files');
			
			// Analyze only changed files for efficiency
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) return;

			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const analyzer = new RepositoryAnalyzer(workspaceRoot);
			
			// Get current analysis
			const currentAnalysis = await analyzer.analyzeRepository();
			
			// Check if changes are significant enough to regenerate
			const significantChanges = Array.from(this.changedFiles).some(filePath => {
				const relativePath = path.relative(workspaceRoot, filePath);
				return !analyzer.shouldIgnore(path.basename(filePath)) && 
					   (relativePath.includes('.js') || relativePath.includes('.ts') || 
						relativePath.includes('.py') || relativePath.includes('.json') ||
						relativePath.includes('.md') || relativePath.includes('.yml'));
			});

			if (significantChanges) {
				console.log('GraphIt: Significant changes detected, performing selective update');
				
				if (this.currentViewMode === 'function') {
					// Auto-refresh function flowchart
					console.log('GraphIt: Auto-refreshing function flowchart...');
					await this.handleGenerateFunctionFlowchart({});
				} else if (this.currentViewMode === 'unified') {
					// Auto-refresh unified view (repository + functions)
					console.log('GraphIt: Auto-refreshing unified flowchart...');
					await this.handleGenerateFlowchart(currentAnalysis);
				} else {
					// Use the new incremental update mechanism for repository view
					this.panel.webview.postMessage({
						command: 'updateIncrementalChanges',
						data: {
							...currentAnalysis,
							hasClaudeApi: !!anthropicClient && !!config?.flowchart?.enableClaudeGeneration,
							isIncremental: true,
							changedFiles: Array.from(this.changedFiles)
						}
					});
				}
				
				this.lastAnalysis = currentAnalysis;
			} else {
				console.log('GraphIt: No significant changes, keeping flowchart frozen');
			}
		} catch (error) {
			console.error('GraphIt: Error in incremental update:', error);
			// Fallback to full refresh on error
			await this.handleAnalyzeRepository();
		}
	}

	dispose() {
		GraphItPanel.currentPanel = undefined;
		
		// Clear any pending refresh timeout
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		
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

