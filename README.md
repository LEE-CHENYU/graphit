# 🔗 GraphIt - AI-Powered Repository Visualization

**Visualize your repository structure instantly with beautiful, interactive flowcharts powered by Claude 4 Sonnet AI.**

## ✨ Features

### 🎨 **Intelligent Flowchart Generation**
- **Claude 4 Sonnet Integration**: AI-powered flowchart generation for superior architectural insights
- **Local Fallback**: Smart local generation when API is unavailable
- **Real-time Rendering**: Beautiful Mermaid.js flowcharts rendered directly in VS Code

### 📊 **Repository Analysis**
- **Smart Directory Scanning**: Analyzes your entire workspace structure
- **File Type Grouping**: Intelligently categorizes and groups related files
- **Statistics Dashboard**: Comprehensive metrics (files, directories, lines of code)
- **Configurable Filtering**: Ignores common directories like `node_modules`, `.git`

### 🚀 **Export & Share**
- **Copy Mermaid Code**: Share or customize flowchart syntax
- **Download SVG**: High-quality vector graphics export
- **Claude Prompts**: Enhanced AI prompts for further customization

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Claude API (Optional)
1. Copy `config.template.json` to `config.json`
2. Add your Anthropic API key:
```json
{
  "anthropic": {
    "apiKey": "your-api-key-here",
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4000
  },
  "flowchart": {
    "enableClaudeGeneration": true,
    "fallbackToLocal": true,
    "timeout": 30000
  }
}
```

### 3. Launch Extension
Press `F5` to open in Extension Development Host

## 🎯 Usage

1. **Open Command Palette**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. **Run Command**: Type "GraphIt: Show Repository Flowchart"
3. **Analyze**: Click "📊 Analyze Repository"
4. **Generate**: Click "🎨 Generate Flowchart"
5. **Enjoy**: Beautiful flowchart with export options!

## 🤖 AI Integration

### With Claude API
- **Enhanced Analysis**: AI understands your project architecture
- **Smart Grouping**: Intelligent component relationships
- **Beautiful Styling**: Professional-grade flowchart design
- **Context Awareness**: Adapts to different project types

### Local Generation
- **No API Required**: Works without external dependencies
- **Fast Generation**: Instant local flowchart creation
- **Smart Defaults**: Reasonable structure analysis
- **Privacy First**: All analysis stays local

## 📋 Commands

- `GraphIt: Show Repository Flowchart` - Main flowchart interface
- `GraphIt: Hello World` - Test command
- `GraphIt: Hello Silicon Creature` - Fun Easter egg 🤖

## 🔧 Configuration

The extension supports flexible configuration through `config.json`:

```json
{
  "anthropic": {
    "apiKey": "your-key",
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4000
  },
  "flowchart": {
    "enableClaudeGeneration": true,
    "fallbackToLocal": true,
    "timeout": 30000
  }
}
```

## 🔒 Security

- `config.json` is automatically gitignored
- API keys never leave your machine except for Claude API calls
- Local generation works completely offline
- No telemetry or data collection

## 🏗️ Architecture

GraphIt uses a modular architecture:
- **RepositoryAnalyzer**: Scans and analyzes file structure
- **GraphItPanel**: Manages the webview interface
- **Claude Integration**: AI-powered flowchart enhancement
- **Mermaid Renderer**: Beautiful diagram visualization

## 🚧 Development

### Building
```bash
npm run lint
npm run test
```

### Debugging
1. Set breakpoints in `extension.js`
2. Press `F5` to launch debug session
3. Check Debug Console for logs

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add your enhancements
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🎉 Enjoy!

Transform your repository visualization with AI-powered insights! 🚀
