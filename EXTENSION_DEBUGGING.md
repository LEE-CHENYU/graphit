# VS Code Extension Debugging Guide

## Issue: Extension Not Loading/Activating

### Problem Description
When developing a VS Code extension, you may encounter situations where:
- The extension doesn't appear to load at all
- No activation messages appear in console
- F5 doesn't seem to work
- Extension Development Host shows "No workspace folders found"

### Root Causes & Solutions

#### 1. **Missing Publisher Field** (Critical)
**Problem**: VS Code extensions require a `publisher` field in `package.json`
```json
// ❌ Missing publisher - extension won't be recognized
{
  "name": "my-extension",
  "version": "0.0.1"
}
```

**Solution**: Add publisher field
```json
// ✅ Fixed
{
  "name": "my-extension",
  "version": "0.0.1",
  "publisher": "local"
}
```

#### 2. **Empty Activation Events** (Critical)
**Problem**: Extension never activates
```json
// ❌ Never activates
"activationEvents": []
```

**Solutions**:
```json
// ✅ Activates immediately on startup
"activationEvents": ["*"]

// ✅ Or activates when command is executed
"activationEvents": ["onCommand:my-extension.myCommand"]
```

#### 3. **VS Code Engine Version Compatibility**
**Problem**: Required VS Code version too new for Cursor/older VS Code
```json
// ❌ May be too new
"engines": {
  "vscode": "^1.101.0"
}
```

**Solution**: Use more compatible version
```json
// ✅ More compatible
"engines": {
  "vscode": "^1.74.0"
}
```

#### 4. **Missing Dependencies**
**Problem**: Extension dependencies not installed

**Solution**: 
```bash
npm install
```

#### 5. **Launch Configuration Issues**
**Problem**: Extension Development Host not opening with workspace

**Check**: `.vscode/launch.json`
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "${workspaceFolder}"
      ]
    }
  ]
}
```

### Debugging Steps

#### 1. **Validate package.json**
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')))"
```

#### 2. **Check for syntax errors**
```bash
node -c extension.js
```

#### 3. **Manual launch test**
```bash
cursor --extensionDevelopmentPath=. --new-window
```

#### 4. **Add verbose logging**
```javascript
const vscode = require('vscode');

console.log('Extension file loaded!');

function activate(context) {
    console.log('Activate function called!');
    
    try {
        console.log('Extension is now active!');
        
        // Add visible notification for confirmation
        vscode.window.showInformationMessage('🎉 Extension Activated!');
        
        // Your extension code here
        
        console.log('Extension activation complete!');
    } catch (error) {
        console.error('Extension activation error:', error);
        vscode.window.showErrorMessage('Extension failed: ' + error.message);
    }
}

console.log('Module exports setup!');
module.exports = { activate, deactivate };
```

### What Success Looks Like

When everything works correctly, you should see:

1. **New Extension Development Host window opens**
2. **Console logs appear in the correct order**:
   ```
   Extension file loaded!
   Module exports setup!
   Activate function called!
   Extension is now active!
   Extension activation complete!
   ```
3. **Popup notification appears** (if added)
4. **Commands work** in Command Palette

### Important Notes

- **Two Windows**: Original development window + Extension Development Host
- **Check the RIGHT window**: Debug output appears in the Extension Development Host
- **Required Fields**: `name`, `version`, `publisher`, `engines`, `main`
- **Activation Events**: Must not be empty for extension to activate

### Manual Testing Commands

```bash
# Validate JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')))"

# Check syntax
node -c extension.js

# Install dependencies
npm install

# Manual launch
cursor --extensionDevelopmentPath=. --new-window
```

### Common Error Messages

- **"No workspace folders found"**: Launch config issue or wrong window
- **Extension not appearing**: Missing publisher or invalid package.json
- **No activation**: Empty activationEvents or wrong engine version
- **Command not found**: Command not registered in contributes.commands

---

*Created: [Date] - Last Updated: [Date]* 