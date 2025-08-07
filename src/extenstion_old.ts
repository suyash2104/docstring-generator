import * as vscode from 'vscode';

interface DocstringResponse {
    docstring: string;
}

// Dynamic imports for ESM modules
let getLlama: any = null;
let LlamaChatSession: any = null;
let llamaModel: any = null;
let chatSession: any = null;
let isModelLoaded = false;

async function loadNodeLlamaCpp() {
    try {
        console.log('Loading node-llama-cpp module...');
        const nodeLlamaCpp = await import('node-llama-cpp');
        getLlama = nodeLlamaCpp.getLlama;
        LlamaChatSession = nodeLlamaCpp.LlamaChatSession;
        console.log('node-llama-cpp module loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load node-llama-cpp:', error);
        return false;
    }
}

export async function initializeModel() {
    try {
        console.log('Initializing Llama model...');
        
        // First, load the ESM module
        const moduleLoaded = await loadNodeLlamaCpp();
        if (!moduleLoaded) {
            throw new Error('Failed to load node-llama-cpp module');
        }
        
        const modelPath = "/home/suyash/Documents/Transformer/docstring-generator/models/Llama-3.2-1B.Q4_0.gguf";
        
        // Check if file exists
        const fs = require('fs');
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Model file not found at: ${modelPath}`);
        }
        
        const stats = fs.statSync(modelPath);
        console.log(`Model file size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
        
        // Get llama instance
        console.log('Getting Llama instance...');
        const llama = await getLlama();
        console.log('Llama instance created successfully');
        
        // Load the model
        console.log('Loading model...');
        llamaModel = await llama.loadModel({
            modelPath: modelPath,
            gpuLayers: 0, // Use CPU only for compatibility
        });
        console.log('Model loaded successfully');
        
        // Create context
        console.log('Creating context...');
        const context = await llamaModel.createContext({
            contextSize: 2048, // Reasonable context size
        });
        
        // Create chat session
        console.log('Creating chat session...');
        chatSession = new LlamaChatSession({
            contextSequence: context.getSequence(),
        });
        
        isModelLoaded = true;
        console.log('Model initialization completed successfully!');
        
    } catch (error) {
        console.error('Failed to initialize model:', error);
        isModelLoaded = false;
        throw new Error(`Model initialization failed: ${error}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Docstring Generator extension is now active!');
    
    // Initialize model asynchronously without blocking activation
    setTimeout(async () => {
        try {
            await initializeModel();
            vscode.window.showInformationMessage('Docstring Generator: Model loaded successfully!');
        } catch (err) {
            console.error('Model initialization failed:', err);
            vscode.window.showErrorMessage(`Failed to initialize model: ${err}`);
        }
    }, 1000); // Small delay to let extension finish activating

    const disposable = vscode.commands.registerCommand('docstringGenerator.generateDocstring', async () => {
        console.log('Generate docstring command triggered!');
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        if (!isModelLoaded) {
            // Try to initialize if not already loaded
            if (!llamaModel) {
                vscode.window.showInformationMessage('Model is loading... Please wait.');
                try {
                    await initializeModel();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to load model: ${error}`);
                    return;
                }
            } else {
                vscode.window.showErrorMessage('Model is not ready yet. Please wait a moment and try again.');
                return;
            }
        }

        const selection = editor.selection;
        const position = selection.active;
        
        // Get the function code around the cursor
        const functionCode = extractFunctionCode(editor.document, position);
        
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
        } catch (error) {
            console.error('Error generating docstring:', error);
            vscode.window.showErrorMessage(`Failed to generate docstring: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

interface FunctionInfo {
    code: string;
    insertPosition: vscode.Position;
}

function extractFunctionCode(document: vscode.TextDocument, position: vscode.Position): FunctionInfo | null {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = position.line;
    
    // Look for function definition starting from current line and going up/down
    let functionStartLine = -1;
    let functionEndLine = -1;
    
    // Search backwards for function definition
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.match(/^(def|function|class)\s+\w+/)) {
            functionStartLine = i;
            break;
        }
    }
    
    if (functionStartLine === -1) {
        // Search forwards for function definition
        for (let i = currentLine; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.match(/^(def|function|class)\s+\w+/)) {
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
    while (insertLine < functionEndLine && 
           (lines[insertLine].trim().startsWith('"""') || 
            lines[insertLine].trim().startsWith("'''") ||
            lines[insertLine].trim().startsWith('#') ||
            lines[insertLine].trim() === '')) {
        insertLine++;
    }
    
    return {
        code: functionCode,
        insertPosition: new vscode.Position(insertLine, 0)
    };
}

async function generateDocstring(functionCode: string): Promise<string> {
    if (!isModelLoaded || !chatSession) {
        throw new Error("Model not initialized or chat session not available");
    }

    const prompt = `Generate a concise Python docstring for the following function. Return only the docstring content without triple quotes:

${functionCode}

Docstring:`;

    try {
        console.log('Generating docstring with prompt...');
        
        const response = await chatSession.prompt(prompt, {
            maxTokens: 200,
            temperature: 0.3,
            topP: 0.8,
        });
        
        console.log('Raw model response:', response);
        
        // Clean up the response
        let docstring = response.trim();
        
        // Remove any unwanted prefixes or suffixes
        docstring = docstring.replace(/^(Docstring:|```|```python)/i, '').trim();
        docstring = docstring.replace(/(```|```)$/i, '').trim();
        
        if (!docstring) {
            throw new Error('Model returned empty response');
        }
        
        console.log('Cleaned docstring:', docstring);
        return docstring;
        
    } catch (error) {
        console.error('Error in generateDocstring:', error);
        throw new Error(`Failed to generate docstring: ${error}`);
    }
}

async function insertDocstring(editor: vscode.TextEditor, position: vscode.Position, docstring: string) {
    const indentation = getIndentation(editor.document, position.line);
    
    // Format the docstring with proper indentation
    const formattedDocstring = formatDocstring(docstring, indentation);
    
    await editor.edit(editBuilder => {
        editBuilder.insert(position, formattedDocstring + '\n');
    });
}

function getIndentation(document: vscode.TextDocument, line: number): string {
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

function formatDocstring(docstring: string, indentation: string): string {
    // Clean up the docstring and format it properly
    let cleaned = docstring.trim();
    
    // Remove any existing triple quotes
    cleaned = cleaned.replace(/^["']{3}|["']{3}$/g, '');
    
    // Split into lines and add proper indentation
    const lines = cleaned.split('\n');
    const formattedLines = lines.map((line, index) => {
        if (index === 0) {
            return `${indentation}"""${line}`;
        } else if (index === lines.length - 1) {
            return `${indentation}${line}"""`;
        } else {
            return `${indentation}${line}`;
        }
    });
    
    // If it's a single line, format differently
    if (lines.length === 1) {
        return `${indentation}"""${cleaned}"""`;
    }
    
    return formattedLines.join('\n');
}

export function deactivate() {
    // Clean up resources
    if (chatSession) {
        chatSession = null;
    }
    if (llamaModel) {
        llamaModel = null;
    }
    isModelLoaded = false;
    console.log('Extension deactivated and resources cleaned up');
}