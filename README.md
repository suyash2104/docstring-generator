# Python Docstring Generator

A Visual Studio Code extension that automatically generates Python docstrings using local AI models. This extension runs entirely offline after initial setup, ensuring your code privacy while providing intelligent docstring generation.

## Features

- **Local AI Processing**: Uses local Llama models with no internet dependency after setup
- **Intelligent Function Detection**: Automatically identifies Python functions, methods, and classes
- **Standard Compliance**: Generates Google/NumPy style docstrings with proper formatting
- **Type-Aware**: Analyzes function signatures, parameters, and return type annotations
- **Privacy-Focused**: All processing happens locally on your machine
- **Contextual Analysis**: Understands function complexity and generates appropriate documentation

## Installation

1. Install the extension from the VS Code Marketplace
2. The extension will automatically download the required AI model on first use


### Parameters Used (Not Configurable right now)

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `modelPath` | string | Directory path for model storage | `"./models"` |
| `modelName` | string | Filename of the model file | Required |
| `repo` | string | HuggingFace repository identifier | Required |
| `filename` | string | Specific model file to download | Required |
| `gpuLayers` | number | GPU layers (0 for CPU-only processing) | `0` |
| `contextSize` | number | Model context window size in tokens | `2048` |
| `maxTokens` | number | Maximum tokens in generated output | `512` |
| `temperature` | number | Generation randomness (0.0-1.0) | `0.1` |
| `topP` | number | Nucleus sampling threshold | `0.9` |
| `repeatPenalty` | number | Repetition penalty multiplier | `1.1` |
| `stopSequences` | array | Sequences that terminate generation | See above |


### Basic Usage

1. Open a Python file in VS Code
2. Position your cursor inside or near a function definition
3. Execute the command using one of these methods:
   - **Command Palette**: Press `Ctrl+Shift+P` and search for "Generate Docstring"
   - **Context Menu**: Right-click in the editor and select "Generate Docstring"
   - **Keyboard Shortcut**: Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (macOS)

### Example Output

**Input:**
```python
def calculate_area(length: float, width: float) -> float:
    return length * width
```

**Generated Output:**
```python
def calculate_area(length: float, width: float) -> float:

    """Calculates the area of a rectangle given its length and width.
    
    Args:
        length (float): The length of the rectangle.
        width (float): The width of the rectangle.
    
    Returns:
        float: The area of the rectangle."""

    return length * width
```

## Supported Python Constructs

The extension recognizes and generates appropriate docstrings for:

- Regular functions
- Asynchronous functions (`async def`)
- Class methods and instance methods
- Functions with type hints
- Functions with default parameters
- Nested functions within classes

## System Requirements

### Minimum Requirements
- **VS Code**: Version 1.60.0 or higher
- **Node.js**: Version 16.0.0 or higher
- **RAM**: 4GB available memory
- **Storage**: 2-8GB free space for model files
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)

### Recommended Requirements
- **RAM**: 8GB or higher
- **Storage**: SSD with 10GB+ free space
- **CPU**: Multi-core processor for faster generation

## Performance Considerations

### Initial Setup
- Model download may take 5-15 minutes depending on internet speed
- First initialization can take 30-60 seconds
- Subsequent startups are significantly faster with cached models


## Troubleshooting

### Common Issues

**Model Download Failures**
```
Error: Failed to download model
```
- Verify internet connection stability
- Check available disk space (models range 2-8GB)
- Ensure write permissions in the model directory
- Try clearing the models directory and re-downloading

**Extension Activation Problems**
```
Extension Host terminated unexpectedly
```
- Restart VS Code completely
- Check VS Code Developer Console for detailed error messages
- Verify Node.js installation and version compatibility
- Reinstall extension dependencies

**Function Detection Issues**
```
No Python function found at cursor position
```
- Ensure cursor is positioned within function boundaries
- Verify Python syntax is correct
- Try positioning cursor on the `def` line
- Check that file is saved with `.py` extension


### Advanced Troubleshooting

**Debug Mode**
Enable debug logging by adding to your VS Code settings:
```json
{
  "docstringGenerator.debug": true
}
```

**Memory Monitoring**
Check memory usage in VS Code Developer Console:
- Open with `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (macOS)
- Monitor Console tab during generation

## Contributing

We welcome contributions to improve this extension. Please follow these guidelines:

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Open in VS Code: `code .`
4. Run extension: Press `F5` to launch Extension Development Host

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for complete terms.

## Changelog

### Version 1.0.0
- Initial release with basic docstring generation
- Support for Python functions and methods
- Local AI model integration
- Configuration management


### Resources
- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/suyash2104/docstring-generator/issues)
- **Documentation**: Additional documentation available in the [wiki](https://github.com/suyash2104/docstring-generator/wiki)
- **Discussions**: Join community discussions on [GitHub Discussions](https://github.com/suyash2104/docstring-generator/discussions)

---

## Acknowledgments

This extension is built using the following open-source technologies:

- [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) - Node.js bindings for llama.cpp
- [Hugging Face Hub](https://huggingface.co/docs/huggingface_hub/) - Model distribution and management
- [VS Code Extension API](https://code.visualstudio.com/api) - Microsoft Visual Studio Code extensibility platform