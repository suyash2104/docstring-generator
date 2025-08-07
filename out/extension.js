"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeModel = initializeModel;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_json_1 = __importDefault(require("./config.json"));
const hub_1 = require("@huggingface/hub");
// Dynamic imports for ESM modules
let getLlama = null;
let LlamaChatSession = null;
let llamaModel = null;
let chatSession = null;
let isModelLoaded = false;
let modelLoadingPromise = null;
function isModelDownloaded(modelPath) {
    return fs.existsSync(modelPath);
}
async function downloadModel(options) {
    const { repo, filename, revision = "main", token, localDir = "./models" } = options;
    try {
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
            console.log(`Created directory: ${localDir}`);
        }
        if (filename) {
            // Download a specific file
            console.log(`Downloading ${filename} from ${repo}...`);
            const response = await (0, hub_1.downloadFile)({
                repo,
                path: filename,
                revision,
                ...(token && { accessToken: token })
            });
            if (response) {
                const buffer = Buffer.from(await response.arrayBuffer());
                const localPath = path.join(localDir, filename);
                const dir = path.dirname(localPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(localPath, buffer);
                console.log(`Downloaded ${filename} to ${localPath}`);
            }
        }
    }
    catch (error) {
        console.error(`Failed to download model from ${repo}:`, error);
        throw new Error(`Model download failed: ${error}`);
    }
    console.log(`Model downloaded successfully to ${localDir}`);
    vscode.window.showInformationMessage(`Model downloaded successfully to ${localDir}`);
}
async function loadNodeLlamaCpp() {
    try {
        console.log('Loading node-llama-cpp module...');
        // Use dynamic import with proper ESM handling
        const nodeLlamaCpp = await eval('import("node-llama-cpp")');
        getLlama = nodeLlamaCpp.getLlama;
        LlamaChatSession = nodeLlamaCpp.LlamaChatSession;
        console.log('node-llama-cpp module loaded successfully');
        return true;
    }
    catch (error) {
        console.error('Failed to load node-llama-cpp:', error);
        // Try alternative import method
        try {
            console.log('Trying alternative import method...');
            const importPath = 'node-llama-cpp';
            const nodeLlamaCpp = await Function('return import("' + importPath + '")')();
            getLlama = nodeLlamaCpp.getLlama;
            LlamaChatSession = nodeLlamaCpp.LlamaChatSession;
            console.log('node-llama-cpp module loaded successfully (alternative method)');
            return true;
        }
        catch (altError) {
            console.error('Alternative import also failed:', altError);
            return false;
        }
    }
}
async function initializeModel() {
    // Prevent multiple initialization attempts
    if (modelLoadingPromise) {
        await modelLoadingPromise;
        return;
    }
    modelLoadingPromise = (async () => {
        try {
            console.log('Initializing Llama model...');
            // First, load the ESM module
            const moduleLoaded = await loadNodeLlamaCpp();
            if (!moduleLoaded) {
                throw new Error('Failed to load node-llama-cpp module');
            }
            const modelPath = path.join(__dirname, config_json_1.default.modelPath, config_json_1.default.modelName);
            // if (!isModelDownloaded(modelPath)) {
            //     vscode.window.showInformationMessage('Downloading AI model...');
            //     await downloadModel({
            //         repo: config.repo,
            //         filename: config.filename,
            //         localDir: config.modelPath,
            //     });
            //     console.log('Initializing Llama model...');
            //     vscode.window.showInformationMessage('Model downloaded successfully.');
            // }
            if (!isModelDownloaded(modelPath)) {
                try {
                    // Show progress indicator
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Downloading AI model...',
                        cancellable: false
                    }, async (progress) => {
                        await downloadModel({
                            repo: config_json_1.default.repo,
                            filename: config_json_1.default.filename,
                            localDir: path.join(__dirname, config_json_1.default.modelPath),
                        });
                    });
                    vscode.window.showInformationMessage('Model downloaded successfully.');
                }
                catch (error) {
                    console.error('Error generating docstring:', error);
                    vscode.window.showErrorMessage(`Failed to generate docstring: ${error.message || error}`);
                }
            }
            // Check if file exists
            if (!fs.existsSync(modelPath)) {
                throw new Error(`Model file not found at: ${modelPath}`);
            }
            const stats = fs.statSync(modelPath);
            console.log(`Model file size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
            // Get llama instance
            console.log('Getting Llama instance...');
            const llama = await getLlama();
            console.log('Llama instance created successfully');
            // Load the model with more conservative settings
            console.log('Loading model...');
            llamaModel = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: config_json_1.default.gpuLayers, // Use CPU only for compatibility - parametrize this as needed
                // Add more conservative settings
                threads: Math.max(1, Math.floor(require('os').cpus().length / 2)),
            });
            console.log('Model loaded successfully');
            // Create context with smaller size initially
            console.log('Creating context...');
            const context = await llamaModel.createContext({
                contextSize: config_json_1.default.contextSize, // Smaller context size for initial load - parameter
            });
            // Create chat session
            console.log('Creating chat session...');
            ``;
            chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
            });
            isModelLoaded = true;
            console.log('Model initialization completed successfully!');
            return true;
        }
        catch (error) {
            console.error('Failed to initialize model:', error);
            isModelLoaded = false;
            modelLoadingPromise = null; // Reset so we can try again
            throw new Error(`Model initialization failed: ${error}`);
        }
    })();
    await modelLoadingPromise;
}
function activate(context) {
    console.log('Docstring Generator extension is now active!');
    // Initialize model asynchronously without blocking activation
    setTimeout(async () => {
        try {
            await initializeModel();
            vscode.window.showInformationMessage('Docstring Generator: Model loaded successfully!');
        }
        catch (err) {
            console.error('Model initialization failed:', err);
            vscode.window.showErrorMessage(`Failed to initialize model: ${err.message || err}`);
        }
    }, 2000); // Slightly longer delay to ensure extension is fully activated
    const disposable = vscode.commands.registerCommand('docstringGenerator.generateDocstring', async () => {
        console.log('Generate docstring command triggered!');
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        // Check if model is loading
        if (modelLoadingPromise && !isModelLoaded) {
            vscode.window.showInformationMessage('Model is still loading... Please wait.');
            try {
                await modelLoadingPromise;
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to load model: ${error.message || error}`);
                return;
            }
        }
        if (!isModelLoaded) {
            // Try to initialize if not already loaded
            try {
                vscode.window.showInformationMessage('Initializing model... Please wait.');
                await initializeModel();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to load model: ${error.message || error}`);
                return;
            }
        }
        const selection = editor.selection;
        const position = selection.active;
        // Get the function code around the cursor
        const functionCode = extractFunctionCode(editor.document, position);
        console.log('functionCode', functionCode);
        console.log('position', position);
        if (!functionCode) {
            vscode.window.showErrorMessage('No function found at cursor position');
            return;
        }
        try {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating docstring...",
                cancellable: false
            }, async (progress) => {
                const docstring = await generateDocstring(functionCode.code);
                await insertDocstring(editor, functionCode.insertPosition, docstring);
            });
            vscode.window.showInformationMessage('Docstring generated successfully!');
        }
        catch (error) {
            console.error('Error generating docstring:', error);
            vscode.window.showErrorMessage(`Failed to generate docstring: ${error.message || error}`);
        }
    });
    context.subscriptions.push(disposable);
}
function extractFunctionCode(document, position) {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = position.line;
    // Look for function definition starting from current line and going up/down
    let functionStartLine = -1;
    let functionEndLine = -1;
    // Search backwards for function definition
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.match(/^(def|function|class|async\s+def)\s+\w+/)) {
            functionStartLine = i;
            break;
        }
    }
    if (functionStartLine === -1) {
        // Search forwards for function definition
        for (let i = currentLine; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.match(/^(def|function|class|async\s+def)\s+\w+/)) {
                functionStartLine = i;
                break;
            }
        }
    }
    if (functionStartLine === -1) {
        return null;
    }
    // Find the end of the function by looking for the next function or end of indentation
    const functionIndentation = lines[functionStartLine].search(/\S/);
    functionEndLine = functionStartLine;
    for (let i = functionStartLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            continue; // Skip empty lines
        }
        const currentIndentation = line.search(/\S/);
        if (currentIndentation <= functionIndentation && line.trim() !== '') {
            break;
        }
        functionEndLine = i;
    }
    // Extract function code
    const functionLines = lines.slice(functionStartLine, functionEndLine + 1);
    const functionCode = functionLines.join('\n');
    // Determine where to insert the docstring (after function definition line)
    let insertLine = functionStartLine + 1;
    // Skip any existing docstring or comments
    // while (insertLine < functionEndLine && 
    //        (lines[insertLine].trim().startsWith('"""') || 
    //         lines[insertLine].trim().startsWith("'''") ||
    //         lines[insertLine].trim().startsWith('#') ||
    //         lines[insertLine].trim() === '')) {
    //     insertLine++;
    // 
    // }
    return {
        code: functionCode,
        insertPosition: new vscode.Position(insertLine, 0)
    };
}
async function generateDocstring(functionCode) {
    const context = await llamaModel.createContext({
        contextSize: config_json_1.default.contextSize, // Smaller context size for initial load - parameter
    });
    chatSession = new LlamaChatSession({
        contextSequence: context.getSequence(),
    });
    if (!isModelLoaded || !chatSession) {
        throw new Error("Model not initialized or chat session not available");
    }
    const prompt = `You are an AI that generates ONLY Python-style docstrings. 
Given Python function, output its docstring following these strict instructions:
- Exactly one-line summary.
- List all parameters with their types.
- List the return type.
- Do NOT include any code blocks, extra explanation, or text before or after the docstring.
- Give docstring inside the triple quotes.

Example:

def add(a: int, b: int) -> int:
    return a + b

Docstring:
"""
Adds two integers.

Args:
    a (int): First integer.
    b (int): Second integer.

Returns:
    int: The sum of a and b.
"""

Now, generate a docstring for following function:

${functionCode}

Docstring:
`;
    try {
        console.log('Generating docstring with prompt...', prompt);
        const response = await chatSession.prompt(prompt, {
            maxTokens: config_json_1.default.maxTokens,
            temperature: config_json_1.default.temperature,
            topP: config_json_1.default.topP,
            stop: config_json_1.default.stopSequences,
            repeatPenalty: config_json_1.default.repeatPenalty,
        });
        console.log('Raw model response:', response);
        // Clean up the response
        let docstring = response.trim();
        // Remove any unwanted prefixes or suffixes
        docstring = docstring.replace(/^(Docstring:|```|```python)/i, '').trim();
        docstring = docstring.replace(/(```|```)$/i, '').trim();
        const match = docstring.match(/"""([\s\S]*?)"""/);
        docstring = match ? match[1].trim() : "";
        if (!docstring) {
            throw new Error('Model returned empty response');
        }
        console.log('Cleaned docstring:', docstring);
        return docstring;
    }
    catch (error) {
        console.error('Error in generateDocstring:', error);
        throw new Error(`Failed to generate docstring: ${error.message || error}`);
    }
}
async function insertDocstring(editor, position, docstring) {
    const indentation = getIndentation(editor.document, position.line);
    // Format the docstring with proper indentation
    const formattedDocstring = formatDocstring(docstring, indentation);
    await editor.edit(editBuilder => {
        editBuilder.insert(position, formattedDocstring + '\n');
    });
}
function getIndentation(document, line) {
    // Look for the previous non-empty line to get indentation
    for (let i = line - 1; i >= 0; i--) {
        const lineText = document.lineAt(i).text;
        if (lineText.trim() !== '') {
            const match = lineText.match(/^(\s*)/);
            return match ? match[1] + '    ' : '    '; // Add extra indentation for docstring
        }
    }
    return '    ';
}
function formatDocstring(docstring, indentation) {
    // Clean up the docstring and format it properly
    let cleaned = docstring.trim();
    // Remove any existing triple quotes
    cleaned = cleaned.replace(/^["']{3}|["']{3}$/g, '');
    // Split into lines and add proper indentation
    const lines = cleaned.split('\n');
    const formattedLines = lines.map((line, index) => {
        if (index === 0) {
            return `\n${indentation}"""${line}`;
        }
        else if (index === lines.length - 1) {
            return `${indentation}${line}"""\n`;
        }
        else {
            return `${indentation}${line}`;
        }
    });
    // If it's a single line, format differently
    if (lines.length === 1) {
        return `${indentation}"""${cleaned}"""`;
    }
    return formattedLines.join('\n');
}
function deactivate() {
    // Clean up resources
    if (chatSession) {
        chatSession = null;
    }
    if (llamaModel) {
        llamaModel = null;
    }
    isModelLoaded = false;
    modelLoadingPromise = null;
    console.log('Extension deactivated and resources cleaned up');
}
//# sourceMappingURL=extension.js.map