const fs = require('fs');
const path = require('path');

/**
 * Advanced code analyzer that identifies important functions and architectural patterns
 * Focuses on entry points, control flow, and key business logic
 */
class CodeAnalyzer {
	constructor() {
		this.functions = new Map();
		this.callGraph = new Map();
		this.classes = new Map();
		this.imports = new Map();
		this.executionPaths = new Map();
		this.decisionPoints = [];
		this.layerAnalysis = new Map();
	}

	async analyzeFunctions(workspaceRoot) {
		console.log('GraphIt: Starting intelligent function analysis...');
		
		this.workspaceRoot = workspaceRoot;
		await this.scanCodeFiles();
		this.identifyArchitecturalPatterns();
		this.analyzeExecutionFlow();
		this.categorizeByImportance();
		
		return {
			functions: this.getImportantFunctions(),
			callGraph: this.callGraph,
			classes: Array.from(this.classes.values()),
			imports: Array.from(this.imports.values()),
			executionPaths: this.executionPaths,
			decisionPoints: this.decisionPoints,
			layerAnalysis: this.layerAnalysis,
			metadata: {
				analyzedAt: new Date().toISOString(),
				totalFunctions: this.functions.size,
				totalClasses: this.classes.size,
				importantFunctions: this.getImportantFunctions().length
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
		let currentFunction = null;
		
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
					type: 'class',
					isExported: line.includes('export') || line.includes('module.exports')
				};
				this.classes.set(classMatch[1], currentClass);
			}
			
			// Function definitions with comprehensive patterns
			const funcPatterns = [
				{ pattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function', isExported: true },
				{ pattern: /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/, type: 'function', isExported: false },
				{ pattern: /(\w+)\s*:\s*(?:async\s+)?function/, type: 'method', isExported: false },
				{ pattern: /(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/, type: 'arrow-function', isExported: false },
				{ pattern: /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/, type: 'const-function', isExported: false }
			];
			
			for (const { pattern, type, isExported } of funcPatterns) {
				const match = line.match(pattern);
				if (match && !this.isKeyword(match[1])) {
					const funcName = match[1];
					const funcObj = {
						name: funcName,
						file: filePath,
						line: i + 1,
						class: currentClass?.name,
						calls: [],
						calledBy: [],
						type: line.includes('async') ? 'async-function' : type,
						isConstructor: funcName === 'constructor',
						isMethod: currentClass !== null,
						isExported: isExported || line.includes('export'),
						isEntryPoint: this.isEntryPoint(funcName),
						isEventHandler: this.isEventHandler(funcName),
						isBusinessLogic: this.isBusinessLogic(funcName),
						complexity: this.calculateComplexity(line),
						importance: 0 // Will be calculated later
					};
					
					this.functions.set(`${filePath}:${funcName}`, funcObj);
					currentFunction = funcObj;
					
					if (currentClass) {
						currentClass.methods.push(funcName);
					}
					break;
				}
			}
			
			// Analyze function calls within function body
			if (currentFunction) {
				const callMatches = line.matchAll(/(\w+)\s*\(/g);
				for (const match of callMatches) {
					if (!this.isKeyword(match[1])) {
						currentFunction.calls.push({
							function: match[1],
							line: i + 1,
							context: line.trim()
						});
					}
				}
			}
			
			// Decision points (conditions, loops, switches)
			if (this.hasDecisionPoint(line)) {
				this.decisionPoints.push({
					type: this.getDecisionType(line),
					file: filePath,
					line: i + 1,
					content: line.trim(),
					function: currentFunction?.name,
					complexity: this.calculateDecisionComplexity(line)
				});
			}
			
			// End of function (simple heuristic)
			if (line === '}' && currentFunction) {
				currentFunction = null;
			}
		}
	}

	parsePython(content, filePath) {
		const lines = content.split('\n');
		let currentClass = null;
		let currentFunction = null;
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
					isAsync: trimmed.includes('async def'),
					isEntryPoint: this.isEntryPoint(funcName),
					isEventHandler: this.isEventHandler(funcName),
					isBusinessLogic: this.isBusinessLogic(funcName),
					importance: 0
				};
				
				this.functions.set(`${filePath}:${funcName}`, funcObj);
				currentFunction = funcObj;
				
				if (currentClass && currentIndent > indentLevel) {
					currentClass.methods.push(funcName);
				}
			}
		}
	}

	parseGeneric(content, filePath) {
		const lines = content.split('\n');
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			const funcPatterns = [
				/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/,
				/(\w+)\s*\([^)]*\)\s*\{/
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
						type: 'function',
						importance: 0
					});
					break;
				}
			}
		}
	}

	identifyArchitecturalPatterns() {
		// Identify common architectural patterns
		const patterns = {
			'Entry Points': [],
			'Controllers': [],
			'Services': [],
			'Models': [],
			'Utils': [],
			'Event Handlers': [],
			'Business Logic': []
		};

		for (const [key, func] of this.functions) {
			if (func.isEntryPoint) patterns['Entry Points'].push(func);
			if (func.name.toLowerCase().includes('controller')) patterns['Controllers'].push(func);
			if (func.name.toLowerCase().includes('service')) patterns['Services'].push(func);
			if (func.name.toLowerCase().includes('model')) patterns['Models'].push(func);
			if (func.name.toLowerCase().includes('util') || func.name.toLowerCase().includes('helper')) patterns['Utils'].push(func);
			if (func.isEventHandler) patterns['Event Handlers'].push(func);
			if (func.isBusinessLogic) patterns['Business Logic'].push(func);
		}

		this.layerAnalysis = new Map(Object.entries(patterns));
	}

	analyzeExecutionFlow() {
		// Build call graph and execution paths
		for (const [funcKey, func] of this.functions) {
			for (const call of func.calls) {
				// Find matching functions
				for (const [targetKey, targetFunc] of this.functions) {
					if (targetFunc.name === call.function) {
						targetFunc.calledBy.push({
							caller: func.name,
							file: func.file,
							line: call.line,
							context: call.context
						});
					}
				}
			}
		}
	}

	categorizeByImportance() {
		// Calculate importance scores for functions
		for (const [key, func] of this.functions) {
			let importance = 0;
			
			// Entry point functions are highly important
			if (func.isEntryPoint) importance += 10;
			
			// Exported functions are important
			if (func.isExported) importance += 5;
			
			// Functions called by many others are important
			importance += func.calledBy.length * 2;
			
			// Functions with decision points are important
			const relatedDecisions = this.decisionPoints.filter(dp => dp.function === func.name);
			importance += relatedDecisions.length * 3;
			
			// Async functions often handle important operations
			if (func.type.includes('async')) importance += 3;
			
			// Business logic functions are important
			if (func.isBusinessLogic) importance += 4;
			
			// Event handlers are important for UI/interaction flow
			if (func.isEventHandler) importance += 3;
			
			// Main/init functions are critical
			if (['main', 'init', '__init__', 'activate', 'start', 'run'].includes(func.name.toLowerCase())) {
				importance += 15;
			}
			
			func.importance = importance;
		}
	}

	getImportantFunctions() {
		// Return functions sorted by importance, limited to most relevant
		const allFunctions = Array.from(this.functions.values());
		const sortedByImportance = allFunctions.sort((a, b) => b.importance - a.importance);
		
		// Intelligent selection: take top functions but ensure we have representatives from each layer
		const selected = [];
		const layerRepresentation = new Map();
		
		// First, take the top 8 most important functions
		const topFunctions = sortedByImportance.slice(0, 8);
		selected.push(...topFunctions);
		
		// Track which layers we've covered
		for (const func of topFunctions) {
			const layer = this.getFunctionLayer(func);
			layerRepresentation.set(layer, true);
		}
		
		// Add representatives from uncovered layers
		for (const [layer, functions] of this.layerAnalysis) {
			if (!layerRepresentation.has(layer) && functions.length > 0) {
				const representative = functions.sort((a, b) => b.importance - a.importance)[0];
				if (representative && selected.length < 12) {
					selected.push(representative);
				}
			}
		}
		
		// Remove duplicates and limit total
		const unique = Array.from(new Map(selected.map(f => [f.name, f])).values());
		return unique.slice(0, 12); // Limit to 12 most important functions
	}

	getFunctionLayer(func) {
		if (func.isEntryPoint) return 'Entry Points';
		if (func.name.toLowerCase().includes('controller')) return 'Controllers';
		if (func.name.toLowerCase().includes('service')) return 'Services';
		if (func.name.toLowerCase().includes('model')) return 'Models';
		if (func.isEventHandler) return 'Event Handlers';
		if (func.isBusinessLogic) return 'Business Logic';
		return 'Utils';
	}

	isEntryPoint(funcName) {
		const entryPatterns = [
			'main', 'init', '__init__', 'activate', 'start', 'run', 'execute',
			'constructor', 'create', 'register', 'setup', 'configure'
		];
		return entryPatterns.some(pattern => funcName.toLowerCase().includes(pattern));
	}

	isEventHandler(funcName) {
		const eventPatterns = [
			'handle', 'on', 'click', 'submit', 'change', 'load', 'ready',
			'resize', 'scroll', 'hover', 'focus', 'blur', 'keypress'
		];
		return eventPatterns.some(pattern => funcName.toLowerCase().includes(pattern));
	}

	isBusinessLogic(funcName) {
		const businessPatterns = [
			'process', 'calculate', 'validate', 'transform', 'convert',
			'analyze', 'generate', 'build', 'parse', 'format', 'filter'
		];
		return businessPatterns.some(pattern => funcName.toLowerCase().includes(pattern));
	}

	hasDecisionPoint(line) {
		return line.includes('if ') || line.includes('switch') || line.includes('case ') ||
			   line.includes('for ') || line.includes('while ') || line.includes('?') ||
			   line.includes('&&') || line.includes('||');
	}

	getDecisionType(line) {
		if (line.includes('if ')) return 'conditional';
		if (line.includes('switch')) return 'switch';
		if (line.includes('for ') || line.includes('while ')) return 'loop';
		if (line.includes('?')) return 'ternary';
		if (line.includes('&&') || line.includes('||')) return 'logical';
		return 'decision';
	}

	calculateComplexity(line) {
		let complexity = 1;
		complexity += (line.match(/&&/g) || []).length;
		complexity += (line.match(/\|\|/g) || []).length;
		complexity += (line.match(/if\s/g) || []).length;
		complexity += (line.match(/for\s/g) || []).length;
		complexity += (line.match(/while\s/g) || []).length;
		return complexity;
	}

	calculateDecisionComplexity(line) {
		let complexity = 1;
		complexity += (line.match(/&&/g) || []).length * 2;
		complexity += (line.match(/\|\|/g) || []).length * 2;
		complexity += (line.match(/[<>=!]+/g) || []).length;
		return complexity;
	}

	isKeyword(word) {
		const keywords = new Set([
			'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
			'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
			'var', 'let', 'const', 'function', 'class', 'extends', 'implements',
			'import', 'export', 'from', 'default', 'async', 'await', 'yield',
			'true', 'false', 'null', 'undefined', 'console', 'log', 'document',
			'window', 'require', 'module'
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

module.exports = CodeAnalyzer; 