import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, nativeImage } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as os from 'os'

// In dev, require duckdb from node_modules. When packaged, it lives outside the
// asar bundle in extraResources so the native addon can be loaded by path.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const duckdb = app.isPackaged
  ? require(join(process.resourcesPath, 'duckdb'))
  : require('duckdb')

interface ColumnInfo {
  name: string
  type: string
}

interface ViewParams {
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string[]>
  sqlQuery?: string
}

interface GetPageParams extends ViewParams {
  offset: number
  limit: number
}

interface SaveFileParams extends ViewParams {
  filePath: string
  sqlMode?: boolean
  format?: string
  compression?: string
}

interface WindowState {
  db: any
  conn: any
  currentFilePath: string | null
  tableSchema: ColumnInfo[]
  totalRows: number
  // current_data is a lazy VIEW over the file until the first edit
  // materializes it into a real table (always a table for CSV).
  isMaterialized: boolean
  // Identity of the sort/filter/SQL combination currently snapshotted in the
  // view_cache temp table, plus its row count. null = no snapshot.
  viewKey: string | null
  viewCount: number
  // Serializes DB operations per window so concurrent block fetches can't
  // race a view_cache rebuild.
  opChain: Promise<unknown>
}

const windowStates = new Map<number, WindowState>()

// ---------------------------------------------------------------------------
// Themed app icon — switches between orange (light) and blue (dark) based on
// the Windows system colour scheme. The PNG files are shipped as extraResources
// so they're accessible in both dev and packaged builds.
// ---------------------------------------------------------------------------

function getIconPath(isDark: boolean): string {
  const file = isDark ? 'icon_dark.png' : 'icon_light.png'
  return app.isPackaged
    ? join(process.resourcesPath, 'icons', file)
    : join(__dirname, '../../assets', file)
}

function updateAllWindowIcons() {
  const isDark = nativeTheme.shouldUseDarkColors
  const icon = nativeImage.createFromPath(getIconPath(isDark))
  for (const win of BrowserWindow.getAllWindows()) {
    win.setIcon(icon)
  }
}

function getState(id: number): WindowState {
  if (!windowStates.has(id)) {
    windowStates.set(id, {
      db: null,
      conn: null,
      currentFilePath: null,
      tableSchema: [],
      totalRows: 0,
      isMaterialized: false,
      viewKey: null,
      viewCount: 0,
      opChain: Promise.resolve(),
    })
  }
  return windowStates.get(id)!
}

function withLock<T>(state: WindowState, fn: () => Promise<T>): Promise<T> {
  const run = state.opChain.then(fn, fn)
  state.opChain = run.catch(() => undefined)
  return run
}

function runAll(connection: any, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    connection.all(sql, (err: Error | null, rows: any[]) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

function runExec(connection: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.exec(sql, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// Error cleanup — DuckDB errors embed the generated SQL ("LINE 1: WITH
// __user_query AS (...)" plus a caret marker), which leaks internals and
// overwhelms users. Strip that context and rephrase the common cases.
// ---------------------------------------------------------------------------

function friendlyTypeName(t: string): string {
  const T = t.toUpperCase()
  if (/INT|HUGEINT/.test(T)) return 'whole number'
  if (/DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(T)) return 'number'
  if (/TIMESTAMP/.test(T)) return 'timestamp'
  if (/DATE/.test(T)) return 'date'
  if (/TIME/.test(T)) return 'time'
  if (/BOOL/.test(T)) return 'boolean'
  return t.toLowerCase()
}

function cleanError(raw: string): string {
  let msg = (raw ?? '').trim()
  // Drop the generated-query context: "LINE 1: WITH __user_query AS (...)" + caret
  msg = msg.replace(/\s*LINE \d+:[\s\S]*$/i, '').trim()

  const conv = msg.match(/Could not convert string '([\s\S]*?)' to ([A-Z0-9_]+)/i)
  if (conv) return `"${conv[1]}" is not a valid ${friendlyTypeName(conv[2])}.`

  const cast = msg.match(/Unimplemented type for cast \((\w+) -> (\w+)\)/i)
  if (cast) return `Values of type ${cast[1].toLowerCase()} can't be converted to ${cast[2].toLowerCase()}.`

  const dateErr = msg.match(/(?:date|timestamp|time) field value out of range:?\s*"?([^",\n]*)"?/i)
  if (dateErr) return `"${dateErr[1]}" is not a valid date/time value.`

  const syn = msg.match(/syntax error at or near "([\s\S]*?)"/i)
  if (syn) return `SQL syntax error near "${syn[1]}".`

  const col = msg.match(/Referenced column "([^"]+)" not found/i)
  if (col) {
    const candidate = msg.match(/Candidate bindings:\s*"?(?:[\w]+\.)?([^",\n]+)"?/i)
    return candidate
      ? `Column "${col[1]}" doesn't exist. Did you mean "${candidate[1]}"?`
      : `Column "${col[1]}" doesn't exist.`
  }

  const tbl = msg.match(/Table with name (\S+) does not exist/i)
  if (tbl) return `Table ${tbl[1]} doesn't exist — query the table "current_data".`

  const fn = msg.match(/Scalar Function with name (\S+) does not exist/i)
  if (fn) return `Unknown function ${fn[1]}.`

  // Generic fallback: drop the DuckDB error-class prefix and keep it short.
  msg = msg.replace(/^(Parser|Binder|Catalog|Conversion|Invalid Input|Constraint|Out of Range|IO|Not implemented) Error:\s*/i, '')
  const firstLine = msg.split('\n')[0].trim()
  return firstLine || 'Something went wrong while running the query.'
}

// ---------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------

function buildFilterClause(filters?: Record<string, string[]>): string {
  if (!filters) return ''
  let clause = ''
  for (const [col, values] of Object.entries(filters)) {
    if (!values || values.length === 0) continue
    const hasNull = values.includes('__null__')
    const nonNull = values.filter((v) => v !== '__null__')
    const quoted = nonNull.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')

    if (hasNull && nonNull.length > 0) {
      clause += ` AND ("${col}" IS NULL OR "${col}"::VARCHAR IN (${quoted}))`
    } else if (hasNull) {
      clause += ` AND "${col}" IS NULL`
    } else {
      clause += ` AND "${col}"::VARCHAR IN (${quoted})`
    }
  }
  return clause
}

function buildBaseQuery(params: ViewParams, selectCols = '*'): string {
  const { sortCol, sortDir, filters, sqlQuery } = params
  let q = sqlQuery?.trim()
    ? `WITH __user_query AS (${sqlQuery}) SELECT * FROM __user_query WHERE 1=1`
    : `SELECT ${selectCols} FROM current_data WHERE 1=1`
  q += buildFilterClause(filters)
  if (sortCol) {
    q += ` ORDER BY "${sortCol}" ${sortDir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`
  }
  return q
}

function hasViewTransform(params: ViewParams): boolean {
  return Boolean(
    params.sqlQuery?.trim() ||
    params.sortCol ||
    (params.filters && Object.values(params.filters).some((v) => v && v.length > 0))
  )
}

function viewKeyOf(params: ViewParams): string {
  return JSON.stringify([
    params.sqlQuery?.trim() ?? '',
    params.sortCol ?? '',
    params.sortCol ? (params.sortDir ?? 'asc') : '',
    params.filters ?? {},
  ])
}

// Rebuilds the view_cache snapshot if the sort/filter/SQL combination changed.
// Sorting/filtering is paid once here; subsequent block fetches are
// LIMIT/OFFSET reads off the snapshot, which are fast at any offset.
async function ensureViewCache(state: WindowState, params: ViewParams): Promise<void> {
  const key = viewKeyOf(params)
  if (state.viewKey === key) return
  state.viewKey = null
  await runExec(state.conn, `CREATE OR REPLACE TEMP TABLE view_cache AS ${buildBaseQuery(params)}`)
  const cnt = await runAll(state.conn, `SELECT COUNT(*) AS cnt FROM view_cache`)
  state.viewCount = Number(cnt[0].cnt)
  state.viewKey = key
}

// Converts the lazy view into a real table (one-time, before the first edit
// or before overwriting the file we are lazily reading from).
async function materialize(state: WindowState): Promise<void> {
  if (state.isMaterialized) return
  await runExec(state.conn, `CREATE TABLE __parqedit_mat AS SELECT * FROM current_data`)
  await runExec(state.conn, `DROP VIEW current_data`)
  await runExec(state.conn, `ALTER TABLE __parqedit_mat RENAME TO current_data`)
  state.isMaterialized = true
}

function getArgvFilePath(argv: string[]): string | undefined {
  return argv.slice(app.isPackaged ? 1 : 2).find((a) => /\.(parquet|csv)$/i.test(a))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

function createWindow(initialFilePath?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#09090b',
    icon: nativeImage.createFromPath(getIconPath(nativeTheme.shouldUseDarkColors)),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))

  win.webContents.once('did-finish-load', () => {
    if (initialFilePath) win.webContents.send('open-file', initialFilePath)
  })

  // Capture the id before 'closed' fires — webContents is destroyed by then
  const wcId = win.webContents.id
  win.on('closed', () => {
    const state = windowStates.get(wcId)
    if (state) {
      try { state.conn?.close() } catch {}
      try { state.db?.close() } catch {}
      windowStates.delete(wcId)
    }
  })

  return win
}

app.on('second-instance', (_event, argv) => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length === 0) return
  const target = wins[wins.length - 1]
  if (target.isMinimized()) target.restore()
  target.focus()
  const filePath = getArgvFilePath(argv)
  if (filePath) target.webContents.send('open-file', filePath)
})

ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())

ipcMain.handle('window:open-new', (_event, filePath: string) => {
  createWindow(filePath)
})

ipcMain.handle('dialog:open-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Parquet Files', extensions: ['parquet'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:save-file', async (event, defaultExt: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return null
  const state = getState(event.sender.id)
  const result = await dialog.showSaveDialog(win, {
    defaultPath: state.currentFilePath
      ? state.currentFilePath.replace(/\.[^.]+$/, `_edited.${defaultExt}`)
      : `export.${defaultExt}`,
    filters: [
      { name: 'Parquet Files', extensions: ['parquet'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'NDJSON Files', extensions: ['ndjson', 'jsonl'] },
      { name: 'TSV Files', extensions: ['tsv'] },
      { name: 'Arrow Files', extensions: ['arrow'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('db:open-file', async (event, filePath: string) => {
  const state = getState(event.sender.id)
  return withLock(state, async () => {
    try {
      if (state.conn) { try { state.conn.close() } catch {} }
      if (state.db) { try { state.db.close() } catch {} }

      state.db = new duckdb.Database(':memory:')
      state.conn = state.db.connect()
      state.currentFilePath = filePath
      state.viewKey = null
      state.viewCount = 0

      // Let big sorts/snapshots spill to disk instead of exhausting RAM, and
      // pin insertion-order preservation (LIMIT/OFFSET paging relies on it).
      const spillDir = normalizePath(join(os.tmpdir(), 'parqedit-spill'))
      await runExec(state.conn, `SET temp_directory='${spillDir}'`)
      await runExec(state.conn, `SET preserve_insertion_order=true`)

      const ext = filePath.split('.').pop()?.toLowerCase()
      const safeP = normalizePath(filePath)

      if (ext === 'csv') {
        // CSV: materialize up front — re-parsing the file on every query would
        // be slower than the one-time copy.
        await runExec(
          state.conn,
          `CREATE TABLE current_data AS SELECT row_number() OVER () AS __rowid__, * FROM read_csv_auto('${safeP}')`
        )
        state.isMaterialized = true
      } else {
        // Parquet: lazy view — opening reads only file metadata, so it is
        // near-instant at any file size. The parquet reader supplies a stable
        // row number for free (no single-threaded window function needed).
        try {
          await runExec(
            state.conn,
            `CREATE VIEW current_data AS
             SELECT file_row_number + 1 AS __rowid__, * EXCLUDE (file_row_number)
             FROM read_parquet('${safeP}', file_row_number = true)`
          )
          state.isMaterialized = false
        } catch {
          // Fallback (e.g. the file already has a "file_row_number" column):
          // materialize the old way.
          await runExec(
            state.conn,
            `CREATE TABLE current_data AS SELECT row_number() OVER () AS __rowid__, * FROM read_parquet('${safeP}')`
          )
          state.isMaterialized = true
        }
      }

      const schemaRows = await runAll(state.conn, `DESCRIBE current_data`)
      state.tableSchema = schemaRows
        .filter((r: any) => r.column_name !== '__rowid__')
        .map((r: any) => ({ name: r.column_name, type: r.column_type }))

      // For parquet views this is a metadata-only read — effectively free.
      const countRows = await runAll(state.conn, `SELECT COUNT(*) AS cnt FROM current_data`)
      state.totalRows = Number(countRows[0].cnt)

      return { success: true, schema: state.tableSchema, totalRows: state.totalRows }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
})

ipcMain.handle('db:get-page', async (event, params: GetPageParams) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { rows: [], total: 0 }

  return withLock(state, async () => {
    try {
      const { offset, limit } = params
      let rows: any[]
      let total: number

      if (!hasViewTransform(params)) {
        // Untransformed data: page straight off the source. Insertion order is
        // preserved, so LIMIT/OFFSET is deterministic and fast at any offset.
        rows = await runAll(state.conn, `SELECT * FROM current_data LIMIT ${limit} OFFSET ${offset}`)
        total = state.totalRows
      } else {
        await ensureViewCache(state, params)
        rows = await runAll(state.conn, `SELECT * FROM view_cache LIMIT ${limit} OFFSET ${offset}`)
        total = state.viewCount
      }

      for (const r of rows) {
        if (r.__rowid__ !== undefined && r.__rowid__ !== null) r.__rowid__ = Number(r.__rowid__)
      }

      return { rows, total }
    } catch (err: any) {
      return { error: cleanError(err.message) }
    }
  })
})

ipcMain.handle('db:get-metadata', async (event) => {
  const state = getState(event.sender.id)
  if (!state.conn || !state.currentFilePath) return null
  try {
    const stats = fs.statSync(state.currentFilePath)
    const ext = state.currentFilePath.split('.').pop()?.toLowerCase()
    const safeP = normalizePath(state.currentFilePath)

    let parquetMeta: any = null
    if (ext === 'parquet') {
      try {
        const kv = await runAll(state.conn, `SELECT * FROM parquet_kv_metadata('${safeP}')`)
        const schema = await runAll(state.conn, `SELECT * FROM parquet_schema('${safeP}')`)
        parquetMeta = { kv, schema }
      } catch {}
    }

    return {
      filePath: state.currentFilePath,
      fileName: state.currentFilePath.split(/[\\/]/).pop(),
      fileSize: stats.size,
      totalRows: state.totalRows,
      schema: state.tableSchema,
      parquetMeta,
    }
  } catch (err: any) {
    return { error: cleanError(err.message) }
  }
})

ipcMain.handle('db:get-distinct-values', async (event, column: string) => {
  const state = getState(event.sender.id)
  if (!state.conn) return []
  return withLock(state, async () => {
    try {
      const rows = await runAll(
        state.conn,
        `SELECT DISTINCT "${column}"::VARCHAR AS val FROM current_data ORDER BY val NULLS LAST LIMIT 1000`
      )
      return rows.map((r: any) => (r.val === null ? '__null__' : String(r.val)))
    } catch (err: any) {
      return { error: cleanError(err.message) }
    }
  })
})

ipcMain.handle('db:update-cell', async (event, { rowId, column, value }: { rowId: number; column: string; value: any }) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { error: 'No connection' }

  return withLock(state, async () => {
    try {
      const col = state.tableSchema.find((c) => c.name === column)
      let setVal: string

      if (value === null || value === undefined || value === '__null__') {
        setVal = 'NULL'
      } else if (col && /^(INTEGER|BIGINT|DOUBLE|FLOAT|HUGEINT|UBIGINT|UINTEGER|SMALLINT|TINYINT|DECIMAL|NUMERIC|REAL)/i.test(col.type)) {
        const s = String(value).trim()
        if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
          return { error: `"${value}" is not a valid number for column "${column}" (${col.type.toLowerCase()}).` }
        }
        setVal = s
      } else if (col && /^BOOLEAN/i.test(col.type)) {
        const s = String(value).trim().toLowerCase()
        if (!['true', 'false', '1', '0'].includes(s)) {
          return { error: `"${value}" is not a valid boolean for column "${column}" — use true or false.` }
        }
        setVal = s === 'true' || s === '1' ? 'true' : 'false'
      } else {
        setVal = `'${String(value).replace(/'/g, "''")}'`
      }

      // First edit on a lazy view: copy into a real table once, then edit that.
      await materialize(state)

      await runExec(state.conn, `UPDATE current_data SET "${column}" = ${setVal} WHERE __rowid__ = ${rowId}`)

      // Mirror the edit into the snapshot so the visible (sorted/filtered)
      // view stays consistent without a full rebuild. If the snapshot can't
      // take the update (e.g. a SQL projection without that column), drop it
      // so the next fetch rebuilds.
      if (state.viewKey) {
        try {
          await runExec(state.conn, `UPDATE view_cache SET "${column}" = ${setVal} WHERE __rowid__ = ${rowId}`)
        } catch {
          state.viewKey = null
        }
      }

      return { success: true }
    } catch (err: any) {
      return { error: cleanError(err.message) }
    }
  })
})

ipcMain.handle('db:save-file', async (event, params: SaveFileParams) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { error: 'No connection' }
  const { filePath, sortCol, sortDir, filters, sqlMode, sqlQuery, format, compression } = params

  return withLock(state, async () => {
    try {
      const safeP = normalizePath(filePath)

      // Overwriting the file we are lazily reading from would corrupt it —
      // pull the data into memory first.
      if (
        !state.isMaterialized &&
        state.currentFilePath &&
        safeP.toLowerCase() === normalizePath(state.currentFilePath).toLowerCase()
      ) {
        await materialize(state)
      }

      const cols = state.tableSchema.map((c) => `"${c.name}"`).join(', ')
      const selectQuery = buildBaseQuery(
        {
          sortCol,
          sortDir,
          filters,
          sqlQuery: sqlMode && sqlQuery?.trim() ? sqlQuery : undefined,
        },
        cols
      )

      const fmt = format ?? (filePath.endsWith('.csv') ? 'csv' : 'parquet')
      const comp = (compression ?? 'snappy').toUpperCase()

      switch (fmt) {
        case 'csv':
          await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT CSV, HEADER true)`)
          break
        case 'tsv':
          await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT CSV, HEADER true, DELIMITER '\t')`)
          break
        case 'json':
          await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT JSON)`)
          break
        case 'ndjson':
          await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT JSON, ARRAY false)`)
          break
        case 'arrow':
          await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT ARROW)`)
          break
        default: // parquet
          await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT PARQUET, COMPRESSION ${comp})`)
      }

      return { success: true }
    } catch (err: any) {
      return { error: cleanError(err.message) }
    }
  })
})

ipcMain.handle('db:create-new', async (event, columns: { name: string; type: string }[]) => {
  const state = getState(event.sender.id)
  return withLock(state, async () => {
    try {
      if (state.conn) { try { state.conn.close() } catch {} }
      if (state.db) { try { state.db.close() } catch {} }

      state.db = new duckdb.Database(':memory:')
      state.conn = state.db.connect()
      state.currentFilePath = null
      state.viewKey = null
      state.viewCount = 0
      state.isMaterialized = true

      const spillDir = normalizePath(join(os.tmpdir(), 'parqedit-spill'))
      await runExec(state.conn, `SET temp_directory='${spillDir}'`)
      await runExec(state.conn, `SET preserve_insertion_order=true`)

      // Whitelist allowed types to prevent SQL injection via column definition
      const SAFE_TYPES = /^(VARCHAR|TEXT|INTEGER|INT|BIGINT|SMALLINT|TINYINT|HUGEINT|DOUBLE|FLOAT|REAL|DECIMAL|NUMERIC|BOOLEAN|DATE|TIMESTAMP|TIME)(\(\d+(,\d+)?\))?$/i
      const safeCols = columns.map((c) => ({
        name: c.name.replace(/"/g, '""'),
        type: SAFE_TYPES.test(c.type.trim()) ? c.type.trim() : 'VARCHAR',
      }))

      const colDefs = safeCols.map((c) => `"${c.name}" ${c.type}`).join(', ')
      await runExec(state.conn, `CREATE TABLE current_data (__rowid__ BIGINT, ${colDefs})`)

      for (let i = 1; i <= 5; i++) {
        const colList = ['__rowid__', ...safeCols.map((c) => `"${c.name}"`)].join(', ')
        const vals = [i, ...safeCols.map(() => 'NULL')].join(', ')
        await runExec(state.conn, `INSERT INTO current_data (${colList}) VALUES (${vals})`)
      }

      state.tableSchema = safeCols.map((c) => ({ name: c.name.replace(/""/g, '"'), type: c.type }))
      state.totalRows = 5

      return { success: true, schema: state.tableSchema, totalRows: 5 }
    } catch (err: any) {
      return { success: false, error: cleanError(err.message) }
    }
  })
})

ipcMain.handle('db:append-row', async (event) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { error: 'No connection' }
  return withLock(state, async () => {
    try {
      await materialize(state)
      const res = await runAll(state.conn, `SELECT COALESCE(MAX(__rowid__), 0) + 1 AS next FROM current_data`)
      const nextId = Number(res[0].next)
      const colList = ['__rowid__', ...state.tableSchema.map((c) => `"${c.name.replace(/"/g, '""')}"`)].join(', ')
      const vals = [nextId, ...state.tableSchema.map(() => 'NULL')].join(', ')
      await runExec(state.conn, `INSERT INTO current_data (${colList}) VALUES (${vals})`)
      state.totalRows++
      // Invalidate the snapshot so the new row appears on next filtered/sorted fetch.
      state.viewKey = null
      return { success: true, rowId: nextId, totalRows: state.totalRows }
    } catch (err: any) {
      return { error: cleanError(err.message) }
    }
  })
})

ipcMain.handle('shell:show-item', async (_, filePath: string) => {
  shell.showItemInFolder(filePath)
})

app.whenReady().then(() => {
  const initialFile = getArgvFilePath(process.argv)
  createWindow(initialFile)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  // Live-update the taskbar icon when Windows switches between light and dark
  nativeTheme.on('updated', updateAllWindowIcons)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
