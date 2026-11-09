import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Dist directory does not exist!');
  process.exit(1);
}

const copyRecursive = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

// Copy dist items to root for direct unpacked loading
const filesToSync = ['manifest.json', 'background.js', 'content.js', 'index.html', 'assets', 'icons'];

// Clean old root assets to avoid dangling chunks
const rootAssets = path.join(rootDir, 'assets');
if (fs.existsSync(rootAssets)) {
  fs.rmSync(rootAssets, { recursive: true, force: true });
}

for (const item of filesToSync) {
  const srcPath = path.join(distDir, item);
  const destPath = path.join(rootDir, item);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
  }
}

// Ensure popup.html also exists pointing to index.html content (backward compatibility)
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, path.join(rootDir, 'popup.html'));
}

console.log('Successfully synced dist to root directory!');
