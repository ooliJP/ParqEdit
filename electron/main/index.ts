import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

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

interface GetPageParams {
  offset: number
  limit: number
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string[]>
  sqlQuery?: string
}

interface SaveFileParams {
  filePath: string
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string[]>
  sqlMode?: boolean
  sqlQuery?: string
}

interface WindowState {
  db: any
  conn: any
  currentFilePath: string | null
  tableSchema: ColumnInfo[]
  totalRows: number
}

const windowStates = new Map<number, WindowState>()

function getState(id: number): WindowState {
  if (!windowStates.has(id)) {
    windowStates.set(id, { db: null, conn: null, currentFilePath: null, tableSchema: [], totalRows: 0 })
  }
  return windowStates.get(id)!
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
    icon: join(__dirname, '../../assets/app_icon.ico'),
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
    ],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('db:open-file', async (event, filePath: string) => {
  const state = getState(event.sender.id)
  try {
    if (state.conn) { try { state.conn.close() } catch {} }
    if (state.db) { try { state.db.close() } catch {} }

    state.db = new duckdb.Database(':memory:')
    state.conn = state.db.connect()
    state.currentFilePath = filePath

    const ext = filePath.split('.').pop()?.toLowerCase()
    const safeP = normalizePath(filePath)
    const readExpr =
      ext === 'csv'
        ? `read_csv_auto('${safeP}')`
        : `read_parquet('${safeP}')`

    await runExec(
      state.conn,
      `CREATE TABLE current_data AS SELECT row_number() OVER () AS __rowid__, * FROM ${readExpr}`
    )

    const schemaRows = await runAll(state.conn, `DESCRIBE current_data`)
    state.tableSchema = schemaRows
      .filter((r: any) => r.column_name !== '__rowid__')
      .map((r: any) => ({ name: r.column_name, type: r.column_type }))

    const countRows = await runAll(state.conn, `SELECT COUNT(*) AS cnt FROM current_data`)
    state.totalRows = Number(countRows[0].cnt)

    return { success: true, schema: state.tableSchema, totalRows: state.totalRows }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('db:get-page', async (event, params: GetPageParams) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { rows: [], total: 0 }
  const { offset, limit, sortCol, sortDir, filters, sqlQuery } = params

  try {
    // Build the base source — either the user's SQL or the raw table
    let baseQuery = sqlQuery?.trim()
      ? `WITH __user_query AS (${sqlQuery}) SELECT * FROM __user_query WHERE 1=1`
      : `SELECT * FROM current_data WHERE 1=1`

    // Apply column filters (works on top of SQL results too)
    if (filters) {
      for (const [col, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue
        const hasNull = values.includes('__null__')
        const nonNull = values.filter((v) => v !== '__null__')
        const quoted = nonNull.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')

        if (hasNull && nonNull.length > 0) {
          baseQuery += ` AND ("${col}" IS NULL OR "${col}"::VARCHAR IN (${quoted}))`
        } else if (hasNull) {
          baseQuery += ` AND "${col}" IS NULL`
        } else {
          baseQuery += ` AND "${col}"::VARCHAR IN (${quoted})`
        }
      }
    }

    if (sortCol) {
      baseQuery += ` ORDER BY "${sortCol}" ${sortDir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`
    }

    const rows = await runAll(state.conn, `${baseQuery} LIMIT ${limit} OFFSET ${offset}`)

    const clean = rows.map((r: any) => {
      const { __rowid__, ...rest } = r
      return { ...rest, __rowid__: Number(__rowid__) }
    })

    // Recount when SQL or filters are active (result set differs from raw table)
    let pageTotal = state.totalRows
    if (sqlQuery?.trim() || (filters && Object.keys(filters).length > 0)) {
      const cntRows = await runAll(state.conn, `SELECT COUNT(*) AS cnt FROM (${baseQuery}) __counted`)
      pageTotal = Number(cntRows[0].cnt)
    }

    return { rows: clean, total: pageTotal }
  } catch (err: any) {
    return { error: err.message }
  }
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
    return { error: err.message }
  }
})

ipcMain.handle('db:get-distinct-values', async (event, column: string) => {
  const state = getState(event.sender.id)
  if (!state.conn) return []
  try {
    const rows = await runAll(
      state.conn,
      `SELECT DISTINCT "${column}"::VARCHAR AS val FROM current_data ORDER BY val NULLS LAST LIMIT 1000`
    )
    return rows.map((r: any) => (r.val === null ? '__null__' : String(r.val)))
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('db:update-cell', async (event, { rowId, column, value }: { rowId: number; column: string; value: any }) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { error: 'No connection' }
  try {
    const col = state.tableSchema.find((c) => c.name === column)
    let setVal: string

    if (value === null || value === undefined || value === '__null__') {
      setVal = 'NULL'
    } else if (col && /^(INTEGER|BIGINT|DOUBLE|FLOAT|HUGEINT|UBIGINT|UINTEGER|SMALLINT|TINYINT|DECIMAL|NUMERIC|REAL)/i.test(col.type)) {
      setVal = String(value)
    } else if (col && /^BOOLEAN/i.test(col.type)) {
      setVal = value === 'true' || value === true ? 'true' : 'false'
    } else {
      setVal = `'${String(value).replace(/'/g, "''")}'`
    }

    await runExec(state.conn, `UPDATE current_data SET "${column}" = ${setVal} WHERE __rowid__ = ${rowId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('db:save-file', async (event, params: SaveFileParams) => {
  const state = getState(event.sender.id)
  if (!state.conn) return { error: 'No connection' }
  const { filePath, sortCol, sortDir, filters, sqlMode, sqlQuery } = params
  try {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const safeP = normalizePath(filePath)

    const cols = state.tableSchema.map((c) => `"${c.name}"`).join(', ')

    let selectQuery = sqlMode && sqlQuery?.trim()
      ? `WITH __user_query AS (${sqlQuery}) SELECT * FROM __user_query WHERE 1=1`
      : `SELECT ${cols} FROM current_data WHERE 1=1`

    if (filters) {
      for (const [col, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue
        const hasNull = values.includes('__null__')
        const nonNull = values.filter((v) => v !== '__null__')
        const quoted = nonNull.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')
        if (hasNull && nonNull.length > 0) {
          selectQuery += ` AND ("${col}" IS NULL OR "${col}"::VARCHAR IN (${quoted}))`
        } else if (hasNull) {
          selectQuery += ` AND "${col}" IS NULL`
        } else {
          selectQuery += ` AND "${col}"::VARCHAR IN (${quoted})`
        }
      }
    }
    if (sortCol) {
      selectQuery += ` ORDER BY "${sortCol}" ${sortDir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`
    }

    if (ext === 'csv') {
      await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT CSV, HEADER true)`)
    } else {
      await runExec(state.conn, `COPY (${selectQuery}) TO '${safeP}' (FORMAT PARQUET)`)
    }

    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('shell:show-item', async (_, filePath: string) => {
  shell.showItemInFileManager(filePath)
})

app.whenReady().then(() => {
  const initialFile = getArgvFilePath(process.argv)
  createWindow(initialFile)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
