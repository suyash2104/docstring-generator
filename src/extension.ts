import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import config from './config.json';
import { downloadFile, listFiles } from '@huggingface/hub';
import { exec } from 'child_process';

interface DocstringResponse {
    docstring: string;
}

interface DownloadOptions {
  repo: string;
  filename?: string;
  revision?: string;
  token?: string;
  localDir?: string;
}

// Dynamic imports for ESM modules
let getLlama: any = null;
let LlamaChatSession: any = null;
let llamaModel: any = null;
let chatSession: any = null;
let isModelLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;


function isModelDownloaded(modelPath: string): boolean {
  return fs.existsSync(modelPath);
}

function isPythonFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'python' || document.fileName.endsWith('.py');
}

async function downloadModel(options: DownloadOptions): Promise<void> {
  const { repo, filename, revision = "main", token, localDir = "./models" } = options;

  try{
        

    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
        console.log(`Created directory: ${localDir}`);
        }

    if (filename) {
        console.log(`Downloading ${filename} from ${repo}...`);
        
        const response = await downloadFile({
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
    } catch (error) {
        console.error(`Failed to download model from ${repo}:`, error);
        throw new Error(`Model download failed: ${error}`);
    }
  console.log(`Model downloaded successfully to ${localDir}`);
//   vscode.window.showInformationMessage(`Model downloaded successfully to ${localDir}`);
}

async function loadNodeLlamaCpp(): Promise<boolean> {
    try {
        console.log('Loading node-llama-cpp module...');
        
        // Using dynamic import with proper ESM handling
        const nodeLlamaCpp = await eval('import("node-llama-cpp")');
        // const nodeLlamaCpp = require('node-llama-cpp');
        
        getLlama = nodeLlamaCpp.getLlama;
        LlamaChatSession = nodeLlamaCpp.LlamaChatSession;
        
        console.log('node-llama-cpp module loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load node-llama-cpp:', error);
        
        try {
            console.log('Trying alternative import method...');
            const importPath = 'node-llama-cpp';
            const nodeLlamaCpp = await Function('return import("' + importPath + '")')();
            
            getLlama = nodeLlamaCpp.getLlama;
            LlamaChatSession = nodeLlamaCpp.LlamaChatSession;
            
            console.log('node-llama-cpp module loaded successfully (alternative method)');
            return true;
        } catch (altError) {
            console.error('Alternative import also failed:', altError);
            return false;
        }
    }
}

export async function initializeModel(): Promise<void> {
    // Prevent multiple initialization attempts
    if (modelLoadingPromise) {
        await modelLoadingPromise;
        return;
    }

    modelLoadingPromise = (async () => {
        try {
            console.log('Initializing Llama model...');
            
            const moduleLoaded = await loadNodeLlamaCpp();
            if (!moduleLoaded) {
                throw new Error('Failed to load node-llama-cpp module');
            }
            
            const modelPath = path.join( __dirname, config.modelPath, config.modelName);

            if (!isModelDownloaded(modelPath)) {
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Downloading AI model...',
                        cancellable: false
                    }, async (progress) => {

                            await downloadModel({
                            repo: config.repo,
                            filename: config.filename,
                            localDir: path.join( __dirname, config.modelPath),
                        });
                        
                    });

                    vscode.window.showInformationMessage('Model downloaded successfully.');
                    
                } catch (error: any) {
                    console.error('Error generating docstring:', error);
                    vscode.window.showErrorMessage(`Failed to generate docstring: ${error.message || error}`);
                }
            }
            
            if (!fs.existsSync(modelPath)) {
                throw new Error(`Model file not found at: ${modelPath}`);
            }
            
            const stats = fs.statSync(modelPath);
            console.log(`Model file size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
            
            console.log('Getting Llama instance...');
            const llama = await getLlama();
            console.log('Llama instance created successfully');
            
            console.log('Loading model...');
            llamaModel = await llama.loadModel({
                modelPath: modelPath,
                gpuLayers: config.gpuLayers,
                threads: Math.max(1, Math.floor(require('os').cpus().length / 2)),
            });
            console.log('Model loaded successfully');
            
            console.log('Creating context...');
            const context = await llamaModel.createContext({
                contextSize: config.contextSize,
            });
            
            console.log('Creating chat session...');``
            chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
            });
            
            isModelLoaded = true;
            console.log('Model initialization completed successfully!');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize model:', error);
            isModelLoaded = false;
            modelLoadingPromise = null;
            throw new Error(`Model initialization failed: ${error}`);
        }
    })();

    await modelLoadingPromise;
}


export function activate(context: vscode.ExtensionContext) {
    console.log('Docstring Generator extension is now active!');

    const targetDir = path.join(context.extensionPath, 'my-package');

    vscode.window.showInformationMessage(`Running npm install in ${targetDir}...`);

    setTimeout(async () => {
        try {
            await initializeModel();
            vscode.window.showInformationMessage('Docstring Generator: Ready to use!');
        } catch (err: any) {
            console.error('Extension setup failed:', err);
            vscode.window.showErrorMessage(`Extension setup failed: ${err.message || err}`);
        }
    }, 2000);

    const disposable = vscode.commands.registerCommand('docstringGenerator.generateDocstring', async () => {
        console.log('Generate docstring command triggered!');
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        if (!isPythonFile(editor.document)) {
            vscode.window.showErrorMessage('Docstring generation is only available for Python files');
            return;
        }

        if (modelLoadingPromise && !isModelLoaded) {
            vscode.window.showInformationMessage('Model is still loading... Please wait.');
            try {
                await modelLoadingPromise;
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to load model: ${error.message || error}`);
                return;
            }
        }

        if (!isModelLoaded) {
            try {
                vscode.window.showInformationMessage('Initializing model... Please wait.');
                await initializeModel();
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to load model: ${error.message || error}`);
                return;
            }
        }

        const selection = editor.selection;
        const position = selection.active;
        
        const functionCode = extractFunctionCode(editor.document, position);
        console.log('functionCode', functionCode);
        console.log('position', position);
        if (!functionCode) {
            vscode.window.showErrorMessage('No function found at cursor position');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating docstring...",
                cancellable: false
            }, async (progress) => {
                const docstring = await generateDocstring(functionCode.code);
                await insertDocstring(editor, functionCode.insertPosition, docstring);
            });

            vscode.window.showInformationMessage('Docstring generated successfully!');
        } catch (error: any) {
            console.error('Error generating docstring:', error);
            vscode.window.showErrorMessage(`Failed to generate docstring: ${error.message || error}`);
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
    
    let functionStartLine = -1;
    let functionEndLine = -1;
    
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.match(/^(def|async\s+def)\s+\w+/)) {
            functionStartLine = i;
            break;
        }
    }
    
    if (functionStartLine === -1) {
        for (let i = currentLine; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.match(/^(def|async\s+def)\s+\w+/)) {
                functionStartLine = i;
                break;
            }
        }
    }
    
    if (functionStartLine === -1) {
        return null;
    }
    
    const functionIndentation = lines[functionStartLine].search(/\S/);
    functionEndLine = functionStartLine;
    
    for (let i = functionStartLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            continue;
        }
        
        const currentIndentation = line.search(/\S/);
        if (currentIndentation <= functionIndentation && line.trim() !== '') {
            break;
        }
        functionEndLine = i;
    }
    
    const functionLines = lines.slice(functionStartLine, functionEndLine + 1);
    const functionCode = functionLines.join('\n');
    
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

async function generateDocstring(functionCode: string): Promise<string> {

    const context = await llamaModel.createContext({
                contextSize: config.contextSize,
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
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            topP: config.topP,
            stop: config.stopSequences,
            repeatPenalty: config.repeatPenalty,
        });
        
        
        console.log('Raw model response:', response);
        
        let docstring = response.trim();
        
        docstring = docstring.replace(/^(Docstring:|```|```python)/i, '').trim();
        docstring = docstring.replace(/(```|```)$/i, '').trim();
        const match = docstring.match(/"""([\s\S]*?)"""/);
        docstring = match ? match[1].trim() : "";
        
        if (!docstring) {
            throw new Error('Model returned empty response');
        }
        
        console.log('Cleaned docstring:', docstring);
        return docstring;
        
    } catch (error: any) {
        console.error('Error in generateDocstring:', error);
        throw new Error(`Failed to generate docstring: ${error.message || error}`);
    }
}

async function insertDocstring(editor: vscode.TextEditor, position: vscode.Position, docstring: string) {
    const indentation = getIndentation(editor.document, position.line);
    
    const formattedDocstring = formatDocstring(docstring, indentation);
    
    await editor.edit(editBuilder => {
        editBuilder.insert(position, formattedDocstring + '\n');
    });
}

function getIndentation(document: vscode.TextDocument, line: number): string {
    for (let i = line - 1; i >= 0; i--) {
        const lineText = document.lineAt(i).text;
        if (lineText.trim() !== '') {
            const match = lineText.match(/^(\s*)/);
            return match ? match[1] + '    ' : '    ';
        }
    }
    return '    ';
}

function formatDocstring(docstring: string, indentation: string): string {
    let cleaned = docstring.trim();
    
    cleaned = cleaned.replace(/^["']{3}|["']{3}$/g, '');

    const lines = cleaned.split('\n');
    const formattedLines = lines.map((line, index) => {
        if (index === 0) {
            return `\n${indentation}"""${line}`;
        } else if (index === lines.length - 1) {
            return `${indentation}${line}"""\n`;
        } else {
            return `${indentation}${line}`;
        }
    });
    
    if (lines.length === 1) {
        return `${indentation}"""${cleaned}"""`;
    }
    
    return formattedLines.join('\n');
}

export function deactivate() {
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