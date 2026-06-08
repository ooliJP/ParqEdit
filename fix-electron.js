const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const zipPath = 'C:\\Users\\mamis\\AppData\\Local\\electron\\Cache\\4b092cc678b6ff8448c5ab35fabca1710dccc91cfbff065280601a184126b0fe\\electron-v33.4.11-win32-x64.zip'
const distDir = path.join(__dirname, 'node_modules', 'electron', 'dist')
const pathTxt = path.join(__dirname, 'node_modules', 'electron', 'path.txt')

console.log('Clearing partial extraction...')
try { execSync(`rmdir /s /q "${distDir}"`, { shell: 'cmd.exe' }) } catch {}
fs.mkdirSync(distDir, { recursive: true })

console.log('Extracting via PowerShell Expand-Archive...')
execSync(
  `powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${distDir}'"`,
  { shell: 'cmd.exe', stdio: 'inherit' }
)

console.log('Writing path.txt...')
fs.writeFileSync(pathTxt, 'electron.exe')

console.log('Done! Electron is ready.')
console.log('Run: npm run dev')
