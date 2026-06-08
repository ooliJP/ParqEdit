const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const duckdbDir = path.join(__dirname, 'node_modules', 'duckdb')
const preGyp = path.join(__dirname, 'node_modules', '@mapbox', 'node-pre-gyp', 'bin', 'node-pre-gyp')
const bindingJs = path.join(duckdbDir, 'lib', 'duckdb-binding.js')

// DuckDB uses N-API (node-addon-api) so the Node.js binary is ABI-stable and
// works with Electron without needing a separate Electron-specific build.
console.log('Downloading DuckDB prebuilt binary (N-API / Node.js)...')
try {
  execSync(
    `node "${preGyp}" install --fallback-to-build=false`,
    { cwd: duckdbDir, stdio: 'inherit', shell: 'cmd.exe' }
  )
  console.log('Binary downloaded.')
} catch (e) {
  console.error('node-pre-gyp failed:', e.message)
  process.exit(1)
}

// Patch duckdb-binding.js to remove @mapbox/node-pre-gyp runtime dependency.
// The packaged app won't have node-pre-gyp available, so we resolve the path directly.
const patched = `var path = require('path');
var binding_path = path.join(__dirname, 'binding', 'duckdb.node');
module.exports = exports = require(binding_path);
`
fs.writeFileSync(bindingJs, patched)
console.log('Patched duckdb-binding.js (removed node-pre-gyp dependency).')
console.log('Done! Run: npm run dist')
