/**
 * Pre-extracts winCodeSign to the electron-builder cache so it stops
 * failing on symlink creation (macOS dylib symlinks we don't need on Windows).
 * Run once: node scripts/fix-wincodesign.js
 * Then: npm run build:dir  will succeed.
 */
const { spawnSync } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')

const sevenZip = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
const cacheBase = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const targetDir = path.join(cacheBase, 'winCodeSign-2.6.0')

// Already done?
if (fs.existsSync(path.join(targetDir, 'windows'))) {
  console.log('✓ winCodeSign already cached — you can run npm run build:dir now.')
  process.exit(0)
}

// Find the cached 7z (downloaded by previous failed attempts)
let zipPath = null
if (fs.existsSync(cacheBase)) {
  for (const f of fs.readdirSync(cacheBase)) {
    if (f.endsWith('.7z')) { zipPath = path.join(cacheBase, f); break }
  }
}

if (!zipPath) {
  console.error('No cached 7z found. Run "npm run build:dir" once first to download it, then re-run this script.')
  process.exit(1)
}

console.log('Found zip:', zipPath)

const tempDir = path.join(cacheBase, '_temp_extract')
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
fs.mkdirSync(tempDir, { recursive: true })

console.log('Extracting (macOS symlink warnings are expected and safe to ignore)...')
const result = spawnSync(sevenZip, ['x', '-y', '-bd', zipPath, `-o${tempDir}`], {
  encoding: 'utf8',
  shell: false
})

// Exit 0 = success, 2 = warning (the macOS symlink errors) — both are fine
if (result.status !== 0 && result.status !== 2) {
  console.error('Extraction failed with unexpected exit code:', result.status)
  console.error(result.stderr)
  process.exit(1)
}

// Sanity check: rcedit-x64.exe must exist (it's at the root of the archive)
if (!fs.existsSync(path.join(tempDir, 'rcedit-x64.exe'))) {
  console.error('Extraction seemed to work but rcedit-x64.exe not found in', tempDir)
  console.error('Contents:', fs.readdirSync(tempDir))
  process.exit(1)
}

// Move to expected cache location
if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true })
fs.renameSync(tempDir, targetDir)

console.log('\n✓ winCodeSign cached successfully at:')
console.log(' ', targetDir)
console.log('\nNow run:')
console.log('  npm run build:dir')
console.log('  node scripts/make-zip.js')
