/**
 * Zips release\win-unpacked into release\ParqEdit-win-x64.zip
 * Uses the bundled 7za.exe from 7zip-bin (already installed by electron-builder).
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sevenZip = path.join(root, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
const src = path.join(root, 'release', 'win-unpacked')
const dest = path.join(root, 'release', 'ParqEdit-win-x64.zip')

if (!fs.existsSync(src)) {
  console.error('win-unpacked not found. Run: npm run build:dir first')
  process.exit(1)
}

if (!fs.existsSync(sevenZip)) {
  console.error('7za.exe not found at', sevenZip)
  process.exit(1)
}

if (fs.existsSync(dest)) fs.rmSync(dest)

console.log('Zipping with 7-Zip...')
// a = add to archive, -tzip = zip format, -mx=5 = compression level
execSync(`"${sevenZip}" a -tzip -mx=5 "${dest}" "${src}\\*"`, {
  shell: 'cmd.exe',
  stdio: 'inherit'
})

const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(1)
console.log(`\nDone! ${sizeMB} MB → ${dest}`)
console.log('Share this zip with your friends.')
console.log('They unzip it and double-click ParqEdit.exe — no install needed.')
