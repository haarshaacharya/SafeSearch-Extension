/**
 * SafeSearch Multi-Browser Build Script
 * Synchronizes files from src/ into dist/chrome and dist/firefox with their respective manifests.
 * 
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');
const MANIFESTS_DIR = path.join(ROOT_DIR, 'manifests');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_CHROME = path.join(DIST_DIR, 'chrome');
const DIST_FIREFOX = path.join(DIST_DIR, 'firefox');

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }
    const entries = fs.readdirSync(from, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(from, entry.name);
        const destPath = path.join(to, entry.name);
        if (entry.isDirectory()) {
            copyFolderSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function build() {
    console.log('🚀 Building SafeSearch Browser Extensions...\n');

    // 1. Ensure dist directories exist
    if (!fs.existsSync(DIST_CHROME)) fs.mkdirSync(DIST_CHROME, { recursive: true });
    if (!fs.existsSync(DIST_FIREFOX)) fs.mkdirSync(DIST_FIREFOX, { recursive: true });

    // 2. Copy source files into dist/chrome
    console.log('📦 Copying source files to dist/chrome...');
    copyFolderSync(SRC_DIR, DIST_CHROME);

    // 3. Copy Chrome Manifest
    console.log('📄 Writing dist/chrome/manifest.json (Chrome & Edge MV3)...');
    fs.copyFileSync(
        path.join(MANIFESTS_DIR, 'manifest.chrome.json'),
        path.join(DIST_CHROME, 'manifest.json')
    );

    // 4. Copy source files into dist/firefox
    console.log('📦 Copying source files to dist/firefox...');
    copyFolderSync(SRC_DIR, DIST_FIREFOX);

    // 5. Copy Firefox Manifest
    console.log('📄 Writing dist/firefox/manifest.json (Firefox Desktop & Android MV3)...');
    fs.copyFileSync(
        path.join(MANIFESTS_DIR, 'manifest.firefox.json'),
        path.join(DIST_FIREFOX, 'manifest.json')
    );

    console.log('\n✅ Build complete!');
    console.log(' - Chrome / Edge:   dist/chrome/');
    console.log(' - Firefox / Mobile: dist/firefox/');
}

build();
