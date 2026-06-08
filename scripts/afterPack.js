const fs = require('fs')
const path = require('path')

/**
 * electron-builder afterPack hook.
 * Strips unused locale .pak files (keeps en-US and en-GB only) and other bloat.
 */
exports.default = async function afterPack({ appOutDir }) {
  const localesDir = path.join(appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return

  const keep = new Set(['en-US.pak', 'en-GB.pak'])
  let removed = 0
  for (const f of fs.readdirSync(localesDir)) {
    if (!keep.has(f)) {
      fs.rmSync(path.join(localesDir, f))
      removed++
    }
  }
  console.log(`afterPack: removed ${removed} unused locale files from locales/`)
}
