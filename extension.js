// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Configuration and API client
let anthropicClient = null;
let config = null;
let extensionPath = null;

// Load configuration
function loadConfig(extPath) {
	extensionPath = extPath;
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
			// Create default config
			config = createDefaultConfig();
		}
	} catch (error) {
		console.error('GraphIt: Error loading config:', error);
		vscode.window.showWarningMessage('GraphIt: Could not load config.json. Using local generation only.');
		config = createDefaultConfig();
	}
}

// Create default configuration
function createDefaultConfig() {
	return {
		anthropic: {
			apiKey: '',
			model: 'claude-3-5-sonnet-20241022',
			maxTokens: 4000
		},
		flowchart: {
			enableClaudeGeneration: true,
			fallbackToLocal: true,
			timeout: 30000
		}
	};
}

// Save configuration to file
function saveConfig() {
	if (!extensionPath || !config) return false;
	
	try {
		const configPath = path.join(extensionPath, 'config.json');
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		console.log('GraphIt: Configuration saved successfully');
		return true;
	} catch (error) {
		console.error('GraphIt: Error saving config:', error);
		vscode.window.showErrorMessage('Failed to save configuration: ' + error.message);
		return false;
	}
}

// Initialize or reinitialize Anthropic client
function initializeAnthropicClient() {
	if (config?.anthropic?.apiKey && config.anthropic.apiKey !== 'YOUR_ANTHROPIC_API_KEY_HERE' && config.anthropic.apiKey.trim() !== '') {
		try {
			const Anthropic = require('@anthropic-ai/sdk').default;
			anthropicClient = new Anthropic({
				apiKey: config.anthropic.apiKey,
			});
			console.log('GraphIt: Anthropic client initialized successfully');
			return true;
		} catch (error) {
			console.error('GraphIt: Error initializing Anthropic client:', error);
			anthropicClient = null;
			return false;
		}
	} else {
		anthropicClient = null;
		return false;
	}
}

// Configure API Key command handler
async function configureApiKey() {
	const currentKey = config?.anthropic?.apiKey || '';
	const placeholder = currentKey && currentKey !== 'YOUR_ANTHROPIC_API_KEY_HERE' 
		? '••••••••••••••••••••••••••••••••••••••••' 
		: 'Enter your Anthropic API key';
	
	const apiKey = await vscode.window.showInputBox({
		prompt: 'Enter your Anthropic API key for enhanced AI-powered flowcharts',
		placeHolder: placeholder,
		password: true,
		ignoreFocusOut: true,
		validateInput: (value) => {
			if (!value || value.trim() === '') {
				return 'API key cannot be empty';
			}
			if (!value.startsWith('sk-ant-')) {
				return 'Invalid API key format. Anthropic API keys start with "sk-ant-"';
			}
			return null;
		}
	});

	if (apiKey) {
		// Update config
		if (!config) config = createDefaultConfig();
		config.anthropic.apiKey = apiKey.trim();
		
		// Save configuration
		if (saveConfig()) {
			// Initialize client
			const success = initializeAnthropicClient();
			if (success) {
				vscode.window.showInformationMessage('✅ Anthropic API key configured successfully! AI-powered flowcharts are now enabled.');
			} else {
				vscode.window.showWarningMessage('⚠️ API key saved but failed to initialize client. Please check your key and try again.');
			}
			
			// Refresh any open GraphIt panels
			if (GraphItPanel.currentPanel) {
				GraphItPanel.currentPanel.updateApiStatus();
				// Send success message to webview
				GraphItPanel.currentPanel.panel.webview.postMessage({
					command: 'apiKeyConfigured',
					data: { success: true }
				});
			}
		}
	}
}

// Core Components
const Components = {
	CodeAnalyzer: require('./src/components/CodeAnalyzer'),
	RepositoryAnalyzer: require('./src/components/RepositoryAnalyzer'),
	FlowchartGenerator: require('./src/components/FlowchartGenerator'),
	WebviewManager: require('./src/components/WebviewManager')
};

// Main Panel Manager
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
		this.currentViewMode = 'repository';
		this.lastFunctionAnalysis = null;

		// Initialize components
		this.codeAnalyzer = new Components.CodeAnalyzer();
		this.repositoryAnalyzer = new Components.RepositoryAnalyzer();
		this.flowchartGenerator = new Components.FlowchartGenerator(anthropicClient, config);
		this.webviewManager = new Components.WebviewManager(panel);

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.html = this.webviewManager.getWebviewContent();
		
		this.setupGitWatcher();
		this.setupMessageHandlers();
		
		// Send initial API status
		setTimeout(() => this.sendApiStatus(), 100);
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

	setupMessageHandlers() {
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
					case 'configureApiKey':
						await configureApiKey();
						break;
					case 'checkApiStatus':
						this.sendApiStatus();
						break;
				}
			},
			null,
			this.disposables
		);
	}

	sendApiStatus() {
		this.panel.webview.postMessage({
			command: 'apiStatusUpdate',
			data: {
				hasApiKey: !!anthropicClient,
				isConfigured: !!(config?.anthropic?.apiKey && config.anthropic.apiKey !== 'YOUR_ANTHROPIC_API_KEY_HERE' && config.anthropic.apiKey.trim() !== ''),
				enableClaudeGeneration: config?.flowchart?.enableClaudeGeneration || false
			}
		});
	}

	updateApiStatus() {
		// Reinitialize components with new config
		this.flowchartGenerator = new Components.FlowchartGenerator(anthropicClient, config);
		this.sendApiStatus();
	}

	async handleAnalyzeRepository() {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('No workspace folder open');
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		
		try {
			const analysis = await this.repositoryAnalyzer.analyzeRepository(workspaceRoot);
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
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders) {
				const workspaceRoot = workspaceFolders[0].uri.fsPath;
				
				console.log('GraphIt: Adding function analysis to repository flowchart...');
				const functionAnalysis = await this.codeAnalyzer.analyzeFunctions(workspaceRoot);
				
				analysisData.functionAnalysis = functionAnalysis;
				this.lastFunctionAnalysis = functionAnalysis;
			}
			
			const mermaidCode = await this.flowchartGenerator.generateUnifiedFlowchart(analysisData);
			const claudePrompt = this.flowchartGenerator.buildClaudePrompt(analysisData);
			
			this.currentViewMode = 'unified';
			
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

	async handleGenerateFunctionFlowchart(analysisData) {
		try {
			console.log('GraphIt: Generating function-level flowchart...');
			
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				vscode.window.showErrorMessage('No workspace folder open');
				return;
			}

			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const functionAnalysis = await this.codeAnalyzer.analyzeFunctions(workspaceRoot);
			
			const mermaidCode = await this.flowchartGenerator.generateDetailedFunctionFlowchart(functionAnalysis);
			const claudePrompt = this.flowchartGenerator.buildFunctionFlowchartPrompt(functionAnalysis);
			
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

	async handleIncrementalFlowchartUpdate(data) {
		try {
			console.log('GraphIt: Performing selective flowchart update...');
			
			const updatePlan = this.calculateFlowchartDiff(data);
			
			if (updatePlan.hasSignificantChanges) {
				const updatedMermaidCode = await this.flowchartGenerator.generateIncrementalMermaidCode(data, updatePlan);
				const claudePrompt = this.flowchartGenerator.buildClaudePrompt(data);
				
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
			await this.handleGenerateFlowchart(data);
		}
	}

	calculateFlowchartDiff(newAnalysisData) {
		const changedFiles = Array.from(this.changedFiles);
		const changedNodes = [];
		const changedEdges = [];
		
		for (const filePath of changedFiles) {
			const fileName = path.basename(filePath);
			changedNodes.push(fileName);
		}

		return {
			hasSignificantChanges: changedNodes.length > 0,
			changedNodes,
			changedEdges,
			newNodes: [],
			removedNodes: [],
			changedFiles
		};
	}

	setupGitWatcher() {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		try {
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
				if (!this.autoRefreshEnabled) return;
				
				if (this.refreshTimeout) {
					clearTimeout(this.refreshTimeout);
				}
				
				this.refreshTimeout = setTimeout(async () => {
					console.log('GraphIt: Auto-refreshing due to Git changes...');
					
					const changes = repository.state.workingTreeChanges;
					const stagedChanges = repository.state.indexChanges;
					
					this.changedFiles.clear();
					[...changes, ...stagedChanges].forEach(change => {
						this.changedFiles.add(change.uri.fsPath);
					});
					
					console.log(`GraphIt: Detected ${this.changedFiles.size} changed files`);
					
					this.panel.webview.postMessage({
						command: 'autoRefreshStarted'
					});
					
					await this.handleIncrementalUpdate();
				}, 2000);
			};

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
				await this.handleAnalyzeRepository();
				return;
			}

			console.log('GraphIt: Performing incremental update for changed files');
			
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) return;

			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const currentAnalysis = await this.repositoryAnalyzer.analyzeRepository(workspaceRoot);
			
			const significantChanges = Array.from(this.changedFiles).some(filePath => {
				const relativePath = path.relative(workspaceRoot, filePath);
				return !this.repositoryAnalyzer.shouldIgnore(path.basename(filePath)) && 
					   (relativePath.includes('.js') || relativePath.includes('.ts') || 
						relativePath.includes('.py') || relativePath.includes('.json') ||
						relativePath.includes('.md') || relativePath.includes('.yml'));
			});

			if (significantChanges) {
				console.log('GraphIt: Significant changes detected, performing selective update');
				
				if (this.currentViewMode === 'function') {
					await this.handleGenerateFunctionFlowchart({});
				} else if (this.currentViewMode === 'unified') {
					await this.handleGenerateFlowchart(currentAnalysis);
				} else {
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
			await this.handleAnalyzeRepository();
		}
	}

	dispose() {
		GraphItPanel.currentPanel = undefined;
		
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
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('GraphIt Extension: Starting activation...');
	
	loadConfig(context.extensionPath);
	
	try {
		// Register commands
		const helloWorldDisposable = vscode.commands.registerCommand('graphit.helloWorld', function () {
			vscode.window.showInformationMessage('Hello World from GraphIt!');
		});

		const showFlowchartDisposable = vscode.commands.registerCommand('graphit.showRepoFlowchart', function () {
			console.log('GraphIt: Showing repository flowchart...');
			vscode.window.showInformationMessage('GraphIt: Command triggered!');
			GraphItPanel.createOrShow(context.extensionUri);
		});

		const showHelloSiliconCreatureDisposable = vscode.commands.registerCommand('graphit.showHelloSiliconCreature', function () {
			console.log('GraphIt: Hello Silicon Creature command triggered!');
			vscode.window.showInformationMessage('Hello Silicon Creature! 🤖✨ Welcome to the digital realm!');
		});

		const configureApiKeyDisposable = vscode.commands.registerCommand('graphit.configureApiKey', function () {
			console.log('GraphIt: Configure API Key command triggered!');
			configureApiKey();
		});

		context.subscriptions.push(helloWorldDisposable, showFlowchartDisposable, showHelloSiliconCreatureDisposable, configureApiKeyDisposable);
		
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

