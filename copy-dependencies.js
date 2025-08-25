const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Copying dependencies to out directory...');

const outDir = path.join(__dirname, 'out');
const nodeModulesOut = path.join(outDir, 'node_modules');

// Ensure out/node_modules exists
if (!fs.existsSync(nodeModulesOut)) {
  fs.mkdirSync(nodeModulesOut, { recursive: true });
}

// List of dependencies to copy
const dependencies = [
  '@huggingface',
  'node-llama-cpp',
  'node-llama-cpp-bindings',
  '@node-llama-cpp'
];

// Function to copy a module and its dependencies recursively
function copyModule(moduleName, visited = new Set()) {
  if (visited.has(moduleName)) {
    return;
  }
  visited.add(moduleName);

  const srcPath = path.join(__dirname, 'node_modules', moduleName);
  const destPath = path.join(nodeModulesOut, moduleName);

  if (!fs.existsSync(srcPath)) {
    console.warn(`Warning: ${moduleName} not found in node_modules`);
    return;
  }

  if (fs.existsSync(destPath)) {
    console.log(`${moduleName} already exists, skipping...`);
    return;
  }

  try {
    // Copy the module
    execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'pipe' });
    console.log(`✓ Copied: ${moduleName}`);

    // Read package.json to find dependencies
    const packageJsonPath = path.join(srcPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.peerDependencies
        };

        // Copy dependencies
        for (const depName of Object.keys(deps || {})) {
          copyModule(depName, visited);
        }
      } catch (e) {
        console.warn(`Warning: Could not read package.json for ${moduleName}`);
      }
    }
  } catch (error) {
    console.error(`Failed to copy ${moduleName}:`, error.message);
  }
}

// Copy all main dependencies
dependencies.forEach(dep => {
  copyModule(dep);
});

console.log('Dependencies copied successfully!');

// Show what was copied
console.log('\nCopied modules:');
if (fs.existsSync(nodeModulesOut)) {
  const copiedModules = fs.readdirSync(nodeModulesOut);
  copiedModules.forEach(module => {
    console.log(`  - ${module}`);
  });
}