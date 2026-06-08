# ParqEdit — Setup

## Prerequisites

- **Node.js 20+ LTS** — https://nodejs.org (download the LTS installer)
- **Python** (needed by node-gyp to rebuild DuckDB) — usually already on Windows. If rebuild fails, install via Microsoft Store or python.org.
- **Visual Studio Build Tools** (C++ workload, needed for DuckDB native rebuild) — during Node.js install, check "Automatically install necessary tools" OR install from https://visualstudio.microsoft.com/downloads/ → "Build Tools for Visual Studio" → select "Desktop development with C++".

## Quick start

```bash
# 1. Install dependencies (also rebuilds DuckDB for Electron)
npm install

# 2. Start in development mode
npm run dev
```

## If the DuckDB rebuild fails

```bash
# Manually trigger rebuild
npm run rebuild
```

## Build for distribution

```bash
npm run build
```

## Features

| Feature | How |
|---------|-----|
| Open file | Toolbar → Open, or drag & drop |
| Sort column | Click column header |
| Filter values | Click the filter icon (▽) on any column header |
| SQL query | Toolbar → SQL, write query using `current_data` as table name, Ctrl+Enter to run |
| Edit cell | Double-click any cell, Enter to commit, Esc to cancel |
| View metadata | Toolbar → Metadata |
| Save file | Toolbar → Save (exports as Parquet or CSV) |
| Change theme | Toolbar → Settings → Appearance |
