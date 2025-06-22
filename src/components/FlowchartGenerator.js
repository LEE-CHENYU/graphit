/**
 * Professional flowchart generator with clean, monotone styling
 * Focuses on logic flow, important functions, and clear layered architecture
 */
class FlowchartGenerator {
	constructor(anthropicClient, config, webviewMessageCallback = null) {
		this.anthropicClient = anthropicClient;
		this.config = config;
		this.webviewMessageCallback = webviewMessageCallback;
	}

	async generateUnifiedFlowchart(analysisData) {
		if (this.anthropicClient && this.config?.flowchart?.enableClaudeGeneration) {
			return await this.generateClaudeFlowchart(analysisData);
		}
		return this.generateLocalFlowchart(analysisData);
	}

	async generateDetailedFunctionFlowchart(functionAnalysis) {
		if (this.anthropicClient && this.config?.flowchart?.enableClaudeGeneration) {
			return await this.generateClaudeFunctionFlowchart(functionAnalysis);
		}
		return this.generateLocalFunctionFlowchart(functionAnalysis);
	}

	async generateClaudeFlowchart(analysisData) {
		const prompt = this.buildClaudePrompt(analysisData);

		try {
			const response = await this.anthropicClient.messages.create({
				model: this.config.anthropic?.model || 'claude-3-5-sonnet-20241022',
				max_tokens: this.config.anthropic?.maxTokens || 4000,
				temperature: 0.3,
				messages: [{ role: 'user', content: prompt }]
			});

			const claudeResponse = response.content[0].text.trim();
			const mermaidMatch = claudeResponse.match(/```(?:mermaid)?\s*\n?(flowchart\s+TD[\s\S]*?)```/i);
			
			if (mermaidMatch) {
				return mermaidMatch[1].trim();
			}
			
			return this.generateLocalFlowchart(analysisData);
			
		} catch (error) {
			console.error('GraphIt: Claude API error:', error);
			this.handleApiError(error, 'repository flowchart');
			return this.generateLocalFlowchart(analysisData);
		}
	}

	async generateClaudeFunctionFlowchart(functionAnalysis) {
		const prompt = this.buildFunctionFlowchartPrompt(functionAnalysis);

		try {
			const response = await this.anthropicClient.messages.create({
				model: this.config.anthropic?.model || 'claude-3-5-sonnet-20241022',
				max_tokens: this.config.anthropic?.maxTokens || 6000,
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
			this.handleApiError(error, 'function flowchart');
			return this.generateLocalFunctionFlowchart(functionAnalysis);
		}
	}

	generateLocalFlowchart(analysisData) {
		const { structure, stats, functionAnalysis } = analysisData;
		
		let flowchart = 'flowchart TD\n';
		let nodeCounter = 0;
		const getNodeId = () => String.fromCharCode(65 + (nodeCounter++)); // A, B, C, etc.
		
		// Entry point
		const userEntry = getNodeId();
		flowchart += `    ${userEntry}[User opens VSCode extension]\n\n`;
		
		// Main initialization
		const mainInit = getNodeId();
		flowchart += `    %% Main initialization\n`;
		flowchart += `    ${userEntry} --> ${mainInit}[Extension activation]\n`;
		
		// Add function analysis if available
		if (functionAnalysis && functionAnalysis.functions.length > 0) {
			const keyFunctions = functionAnalysis.functions.slice(0, 8);
			
			flowchart += `\n    %% Core execution flow\n`;
			let prevNode = mainInit;
			
			for (let i = 0; i < keyFunctions.length; i++) {
				const func = keyFunctions[i];
				const nodeId = getNodeId();
				const cleanName = this.cleanFunctionName(func.name);
				
				// Add decision points for important functions
				if (func.importance > 5 && this.hasDecisionLogic(func)) {
					const decisionId = getNodeId();
					const yesPath = getNodeId();
					const noPath = getNodeId();
					
					flowchart += `    ${prevNode} --> ${decisionId}{${this.getDecisionLabel(func.name)}}\n`;
					flowchart += `    ${decisionId} -->|Yes| ${yesPath}[${cleanName}]\n`;
					flowchart += `    ${decisionId} -->|No| ${noPath}[Handle alternative]\n`;
					
					prevNode = yesPath;
				} else {
					flowchart += `    ${prevNode} --> ${nodeId}[${cleanName}]\n`;
					prevNode = nodeId;
				}
			}
			
			// Add architectural layers
			const layers = this.identifyLayers(functionAnalysis.functions);
			this.addLayeredSubgraphs(flowchart, layers);
		}
		
		// Result processing
		const resultNode = getNodeId();
		flowchart += `\n    %% Result processing\n`;
		flowchart += `    ${resultNode}[Generate flowchart result]\n`;
		
		// Add professional monotone styling
		flowchart += this.addProfessionalStyling();
		
		return flowchart;
	}

	generateLocalFunctionFlowchart(functionAnalysis) {
		const { functions, decisionPoints, layerAnalysis } = functionAnalysis;
		
		console.log(`GraphIt: Generating professional function flowchart for ${functions.length} functions`);
		
		let flowchart = 'flowchart TD\n';
		let nodeCounter = 0;
		const getNodeId = () => String.fromCharCode(65 + (nodeCounter++));
		
		// Entry point
		const userEntry = getNodeId();
		flowchart += `    %% User Entry Point\n`;
		
		// Find the most important entry function
		const entryFunction = functions.find(f => f.isEntryPoint && f.importance > 10) || 
						   functions.find(f => f.name.includes('activate')) ||
						   functions[0];
		
		if (entryFunction) {
			const entryInit = getNodeId();
			flowchart += `    ${userEntry}[User triggers ${this.cleanFunctionName(entryFunction.name)}] --> ${entryInit}[${this.cleanFunctionName(entryFunction.name)}]\n\n`;
			
			// Main execution flow
			flowchart += `    %% Main execution flow\n`;
			const executionFunctions = functions
				.filter(f => f.isBusinessLogic || f.importance > 8)
				.slice(0, 6);
			
			let prevNode = entryInit;
			for (const func of executionFunctions) {
				const nodeId = getNodeId();
				const cleanName = this.cleanFunctionName(func.name);
				
				// Add decision points for complex functions
				if (this.hasDecisionLogic(func)) {
					const decisionId = getNodeId();
					const truePath = getNodeId();
					const falsePath = getNodeId();
					
					flowchart += `    ${prevNode} --> ${decisionId}{${this.getDecisionLabel(func.name)}}\n`;
					flowchart += `    ${decisionId} -->|Yes| ${truePath}[${cleanName}]\n`;
					flowchart += `    ${decisionId} -->|No| ${falsePath}[Handle error]\n`;
					
					prevNode = truePath;
				} else {
					flowchart += `    ${prevNode} --> ${nodeId}[${cleanName}]\n`;
					prevNode = nodeId;
				}
			}
			
			// Result handling
			const resultNode = getNodeId();
			const completeNode = getNodeId();
			flowchart += `\n    %% Result processing\n`;
			flowchart += `    ${prevNode} --> ${resultNode}[Process results]\n`;
			flowchart += `    ${resultNode} --> ${completeNode}[Return to user]\n`;
		}
		
		// Add layered architecture with square subgraphs
		flowchart += this.addArchitecturalLayers(layerAnalysis, functions);
		
		// Add professional styling
		flowchart += this.addProfessionalStyling();
		
		return flowchart;
	}

	addArchitecturalLayers(layerAnalysis, functions) {
		let layerCode = '\n    %% Architectural Layers\n';
		
		// Group functions by architectural layers
		const layers = [
			{ name: 'Entry Layer', functions: functions.filter(f => f.isEntryPoint || f.importance > 12) },
			{ name: 'Business Logic Layer', functions: functions.filter(f => f.isBusinessLogic) },
			{ name: 'Service Layer', functions: functions.filter(f => f.name.toLowerCase().includes('service')) },
			{ name: 'Data Layer', functions: functions.filter(f => f.name.toLowerCase().includes('data') || f.name.toLowerCase().includes('store')) }
		];
		
		for (const layer of layers) {
			if (layer.functions.length > 1) {
				const layerName = layer.name.replace(/\s/g, '');
				layerCode += `    subgraph ${layerName}["${layer.name}"]\n`;
				
				// Add key functions to this layer
				const keyFunctions = layer.functions.slice(0, 3);
				for (const func of keyFunctions) {
					layerCode += `        ${this.cleanFunctionName(func.name)}\n`;
				}
				
				layerCode += '    end\n\n';
			}
		}
		
		return layerCode;
	}

	addLayeredSubgraphs(flowchart, layers) {
		for (const [layerName, functions] of layers) {
			if (functions.length > 2) {
				const safeLayerName = layerName.replace(/\s/g, '');
				flowchart += `\n    subgraph ${safeLayerName}["${layerName}"]\n`;
				
				const keyFunctions = functions.slice(0, 3);
				for (const func of keyFunctions) {
					flowchart += `        ${this.cleanFunctionName(func.name)}\n`;
				}
				
				flowchart += '    end\n';
			}
		}
	}

	identifyLayers(functions) {
		const layers = new Map();
		
		const layerTypes = [
			{ name: 'Entry Layer', filter: f => f.isEntryPoint },
			{ name: 'Business Logic', filter: f => f.isBusinessLogic },
			{ name: 'Event Handling', filter: f => f.isEventHandler },
			{ name: 'Utility Layer', filter: f => f.name.toLowerCase().includes('util') }
		];
		
		for (const layerType of layerTypes) {
			const layerFunctions = functions.filter(layerType.filter);
			if (layerFunctions.length > 0) {
				layers.set(layerType.name, layerFunctions);
			}
		}
		
		return layers;
	}

	hasDecisionLogic(func) {
		return func.importance > 8 || 
			   func.name.toLowerCase().includes('validate') ||
			   func.name.toLowerCase().includes('check') ||
			   func.name.toLowerCase().includes('verify') ||
			   func.name.toLowerCase().includes('handle');
	}

	getDecisionLabel(funcName) {
		if (funcName.toLowerCase().includes('validate')) return 'Valid input?';
		if (funcName.toLowerCase().includes('check')) return 'Check passed?';
		if (funcName.toLowerCase().includes('verify')) return 'Verification OK?';
		if (funcName.toLowerCase().includes('handle')) return 'Handle request?';
		if (funcName.toLowerCase().includes('process')) return 'Process data?';
		return 'Continue execution?';
	}

	cleanFunctionName(name) {
		return name
			.replace(/^__/, '')
			.replace(/__$/, '')
			.replace(/_/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/\b\w/g, l => l.toUpperCase());
	}

	addProfessionalStyling() {
		return `
    %% Professional semitransparent gray styling for dark mode compatibility
    classDef default fill:rgba(128,128,128,0.15),stroke:rgba(128,128,128,0.6),stroke-width:2px,color:rgba(200,200,200,0.9),font-weight:500
    classDef entryPoint fill:rgba(128,128,128,0.2),stroke:rgba(128,128,128,0.8),stroke-width:3px,color:rgba(200,200,200,0.95),font-weight:600
    classDef process fill:rgba(112,112,112,0.12),stroke:rgba(128,128,128,0.6),stroke-width:2px,color:rgba(200,200,200,0.9),font-weight:500
    classDef decision fill:rgba(96,96,96,0.15),stroke:rgba(128,128,128,0.7),stroke-width:2px,color:rgba(200,200,200,0.9),font-weight:500
    classDef service fill:rgba(120,120,120,0.12),stroke:rgba(128,128,128,0.6),stroke-width:2px,color:rgba(200,200,200,0.9),font-weight:500
    classDef result fill:rgba(104,104,104,0.15),stroke:rgba(128,128,128,0.7),stroke-width:2px,color:rgba(200,200,200,0.9),font-weight:500
    classDef complete fill:rgba(128,128,128,0.2),stroke:rgba(128,128,128,0.8),stroke-width:3px,color:rgba(200,200,200,0.95),font-weight:600

    style A fill:rgba(128,128,128,0.2),stroke:rgba(128,128,128,0.8),stroke-width:3px,color:rgba(200,200,200,0.95)
    style B fill:rgba(112,112,112,0.12),stroke:rgba(128,128,128,0.6),stroke-width:2px,color:rgba(200,200,200,0.9)
    style C fill:rgba(96,96,96,0.15),stroke:rgba(128,128,128,0.7),stroke-width:2px,color:rgba(200,200,200,0.9)`;
	}

	buildClaudePrompt(analysisData) {
		const { structure, stats, functionAnalysis } = analysisData;
		
		let prompt = `Create a professional, clean flowchart representing the code execution flow and architecture.

REQUIREMENTS - CRITICAL TO FOLLOW:
1. Use 'flowchart TD' syntax for top-down layout
2. NO ICONS or emojis - use only text labels
3. MONOTONE GRAY STYLING - professional, minimal color palette
4. SQUARE SUBGRAPHS for architectural layers
5. Focus on LOGIC FLOW and DECISION POINTS
6. Include only the MOST IMPORTANT functions (max 8-12)

Repository Statistics:
- Total Files: ${stats.totalFiles}
- Total Directories: ${stats.totalDirectories}
- Total Lines of Code: ${stats.totalLines}`;

		if (functionAnalysis && functionAnalysis.functions.length > 0) {
			const importantFunctions = functionAnalysis.functions.slice(0, 8);
			prompt += `

IMPORTANT FUNCTIONS TO INCLUDE:
${importantFunctions.map(func => 
	`- ${func.name} (importance: ${func.importance}) in ${func.file}`
).join('\n')}

DECISION POINTS:
${functionAnalysis.decisionPoints.slice(0, 5).map(dp => 
	`- ${dp.type} in ${dp.function || 'global'}: ${dp.content}`
).join('\n')}`;
		}

		prompt += `

VISUAL STYLE REQUIREMENTS:
- Start with "User triggers [action]" as entry point
- Use clear, descriptive labels without icons
- Add decision diamonds {} for important conditional logic
- Use square subgraphs for architectural layers:
  * subgraph EntryLayer["Entry Layer"]
  * subgraph BusinessLayer["Business Logic Layer"] 
  * subgraph ServiceLayer["Service Layer"]
- Professional monotone gray color scheme
- Simple, clean node connections with descriptive edge labels

STRUCTURE PATTERN:
1. User entry point
2. Main initialization/setup
3. Core execution loop with decision points
4. Layer-specific processing
5. Result handling and completion

Generate ONLY the Mermaid flowchart code with professional gray styling.`;

		return prompt;
	}

	buildFunctionFlowchartPrompt(functionAnalysis) {
		const { functions, decisionPoints, layerAnalysis, metadata } = functionAnalysis;
		
		return `Create a professional function-level execution flowchart showing the most important functions and their relationships.

STYLE REQUIREMENTS (CRITICAL):
- Use 'flowchart TD' syntax
- NO ICONS - clean text labels only
- MONOTONE GRAY styling for professional appearance
- SQUARE subgraphs for architectural layers
- Focus on EXECUTION FLOW and DECISION POINTS

FUNCTION ANALYSIS:
- Total Functions: ${metadata.totalFunctions}
- Important Functions: ${metadata.importantFunctions}

KEY FUNCTIONS TO INCLUDE:
${functions.slice(0, 10).map(func => 
	`- ${func.name} (importance: ${func.importance}) [${func.type}] ${func.isEntryPoint ? '(ENTRY)' : ''}`
).join('\n')}

DECISION POINTS:
${decisionPoints.slice(0, 6).map(dp => 
	`- ${dp.type} in ${dp.function}: ${dp.content.substring(0, 50)}...`
).join('\n')}

ARCHITECTURAL LAYERS:
${Array.from(layerAnalysis.entries()).map(([layer, funcs]) => 
	`- ${layer}: ${funcs.length} functions`
).join('\n')}

STRUCTURE REQUIREMENTS:
1. Start with user entry point
2. Show initialization sequence
3. Main execution loop with step functions
4. Decision points for different action types
5. Branching to specific handlers
6. Result processing and completion
7. Error handling paths
8. Square subgraphs for each architectural layer

VISUAL STYLE:
- Professional monotone gray color scheme
- Clean decision diamonds {} with specific labels
- Descriptive edge labels |Yes|, |No|, |Error|
- No decorative elements - focus on clarity and logic

Generate ONLY the complete Mermaid flowchart code with gray styling.`;
	}

	async generateIncrementalMermaidCode(analysisData, updatePlan) {
		// Simple fallback for incremental updates
		return await this.generateLocalFlowchart(analysisData);
	}

	handleApiError(error, context = 'flowchart generation') {
		const vscode = require('vscode');
		
		// Extract error details
		const errorMessage = error.message || 'Unknown error';
		const errorType = error.type || 'unknown';
		const statusCode = error.status || error.statusCode;
		
		console.log(`GraphIt: API Error Details - Type: ${errorType}, Status: ${statusCode}, Message: ${errorMessage}`);

		// Determine error type for both VS Code dialogs and webview notifications
		let notificationType = 'generic';
		
		if (this.isInsufficientCreditError(error)) {
			notificationType = 'insufficient-credits';
			this.showInsufficientCreditDialog();
		} else if (this.isRateLimitError(error)) {
			notificationType = 'rate-limit';
			this.showRateLimitDialog();
		} else if (this.isAuthenticationError(error)) {
			notificationType = 'auth-error';
			this.showAuthenticationErrorDialog();
		} else if (this.isQuotaExceededError(error)) {
			notificationType = 'quota-exceeded';
			this.showQuotaExceededDialog();
		} else {
			this.showGenericApiErrorDialog(error, context);
		}

		// Also send notification to webview if panel is open
		this.sendErrorToWebview(notificationType, errorMessage, context);
	}

	sendErrorToWebview(errorType, errorMessage, context) {
		// Send error notification to webview if callback is available
		if (this.webviewMessageCallback) {
			this.webviewMessageCallback({
				command: 'apiError',
				data: {
					type: errorType,
					message: errorMessage,
					context: context
				}
			});
		}
	}

	isInsufficientCreditError(error) {
		const errorMessage = (error.message || '').toLowerCase();
		const errorType = (error.type || '').toLowerCase();
		
		return errorMessage.includes('insufficient') ||
			   errorMessage.includes('credit') ||
			   errorMessage.includes('billing') ||
			   errorMessage.includes('payment') ||
			   errorType.includes('billing') ||
			   error.status === 402 ||
			   error.statusCode === 402;
	}

	isRateLimitError(error) {
		const errorMessage = (error.message || '').toLowerCase();
		const errorType = (error.type || '').toLowerCase();
		
		return errorMessage.includes('rate limit') ||
			   errorMessage.includes('too many requests') ||
			   errorType.includes('rate_limit') ||
			   error.status === 429 ||
			   error.statusCode === 429;
	}

	isAuthenticationError(error) {
		const errorMessage = (error.message || '').toLowerCase();
		const errorType = (error.type || '').toLowerCase();
		
		return errorMessage.includes('unauthorized') ||
			   errorMessage.includes('authentication') ||
			   errorMessage.includes('invalid api key') ||
			   errorType.includes('authentication') ||
			   error.status === 401 ||
			   error.statusCode === 401;
	}

	isQuotaExceededError(error) {
		const errorMessage = (error.message || '').toLowerCase();
		
		return errorMessage.includes('quota') ||
			   errorMessage.includes('limit exceeded') ||
			   errorMessage.includes('usage limit');
	}

	showInsufficientCreditDialog() {
		const vscode = require('vscode');
		
		const message = `💳 Insufficient Anthropic API Credits

Your Anthropic account doesn't have enough credits to generate AI-powered flowcharts.

🔄 GraphIt will automatically use local generation instead.

💡 To continue using AI features:
• Add credits to your Anthropic account at console.anthropic.com
• Check your billing and usage limits
• Consider upgrading your plan for higher limits`;

		vscode.window.showWarningMessage(message, { modal: true }, 'Open Anthropic Console', 'Configure API Key', 'Continue Locally')
		.then(selection => {
			switch (selection) {
				case 'Open Anthropic Console':
					vscode.env.openExternal(vscode.Uri.parse('https://console.anthropic.com/account/billing'));
					break;
				case 'Configure API Key':
					vscode.commands.executeCommand('graphit.configureApiKey');
					break;
				case 'Continue Locally':
					vscode.window.showInformationMessage('GraphIt will use local generation. You can reconfigure your API key anytime.');
					break;
			}
		});
	}

	showRateLimitDialog() {
		const vscode = require('vscode');
		
		const message = `⏰ Anthropic API Rate Limit Exceeded

You've hit the rate limit for API requests. This is temporary.

🔄 GraphIt will use local generation for now.

💡 What you can do:
• Wait a few minutes before trying AI generation again
• Upgrade your Anthropic plan for higher rate limits
• Continue with local generation (works offline)`;

		vscode.window.showWarningMessage(message, 'Retry in 5 Minutes', 'Continue Locally', 'Check Account')
		.then(selection => {
			switch (selection) {
				case 'Retry in 5 Minutes':
					setTimeout(() => {
						vscode.window.showInformationMessage('You can now try AI-powered flowcharts again!');
					}, 5 * 60 * 1000);
					break;
				case 'Continue Locally':
					vscode.window.showInformationMessage('Using local generation. AI features will be available when rate limit resets.');
					break;
				case 'Check Account':
					vscode.env.openExternal(vscode.Uri.parse('https://console.anthropic.com/account/usage'));
					break;
			}
		});
	}

	showAuthenticationErrorDialog() {
		const vscode = require('vscode');
		
		const message = `🔐 Anthropic API Authentication Failed

Your API key may be invalid or expired.

🔄 GraphIt will use local generation instead.

💡 To fix this:
• Check if your API key is correct
• Verify your key hasn't expired
• Reconfigure with a new API key`;

		vscode.window.showErrorMessage(message, 'Reconfigure API Key', 'Continue Locally', 'Check Console')
		.then(selection => {
			switch (selection) {
				case 'Reconfigure API Key':
					vscode.commands.executeCommand('graphit.configureApiKey');
					break;
				case 'Continue Locally':
					vscode.window.showInformationMessage('Using local generation. Reconfigure your API key when ready.');
					break;
				case 'Check Console':
					vscode.env.openExternal(vscode.Uri.parse('https://console.anthropic.com/account/keys'));
					break;
			}
		});
	}

	showQuotaExceededDialog() {
		const vscode = require('vscode');
		
		const message = `📊 Anthropic API Quota Exceeded

You've reached your monthly usage quota.

🔄 GraphIt will use local generation instead.

💡 Options:
• Upgrade your Anthropic plan for higher quotas
• Wait for quota reset next month
• Continue with local generation (fully functional)`;

		vscode.window.showWarningMessage(message, 'Upgrade Plan', 'Continue Locally', 'View Usage')
		.then(selection => {
			switch (selection) {
				case 'Upgrade Plan':
					vscode.env.openExternal(vscode.Uri.parse('https://console.anthropic.com/account/billing'));
					break;
				case 'Continue Locally':
					vscode.window.showInformationMessage('Local generation works great! AI features return when quota resets.');
					break;
				case 'View Usage':
					vscode.env.openExternal(vscode.Uri.parse('https://console.anthropic.com/account/usage'));
					break;
			}
		});
	}

	showGenericApiErrorDialog(error, context) {
		const vscode = require('vscode');
		
		const errorDetails = error.message || 'Unknown error occurred';
		const message = `⚠️ Anthropic API Error

Failed to generate AI-powered ${context}.

Error: ${errorDetails}

🔄 GraphIt will use local generation instead.

💡 This might be a temporary issue:
• Check your internet connection
• Verify Anthropic service status
• Try again in a few minutes`;

		vscode.window.showWarningMessage(message, 'Retry', 'Continue Locally', 'Check Status')
		.then(selection => {
			switch (selection) {
				case 'Retry':
					vscode.window.showInformationMessage('Try generating the flowchart again to retry with AI.');
					break;
				case 'Continue Locally':
					vscode.window.showInformationMessage('Using local generation. You can retry AI features anytime.');
					break;
				case 'Check Status':
					vscode.env.openExternal(vscode.Uri.parse('https://status.anthropic.com/'));
					break;
			}
		});
	}
}

module.exports = FlowchartGenerator; 