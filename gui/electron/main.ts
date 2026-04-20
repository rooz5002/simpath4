import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import { checkLicense, machineId } from './licenseCheck'

// ── Config ────────────────────────────────────────────────────────────────────
const ENGINE_PORT    = 8765
const ENGINE_PORT_3D = 8766
const WEB_PORT       = 3001
const SPLASH_MS      = 2500
const PACKAGED       = app.isPackaged
const VITE_DEV       = !PACKAGED && process.env.VITE_DEV === '1'
const EXTERNAL_ENGINES = process.env.SIMPATH_ENGINES_EXTERNAL === '1'

// ── Engine process ────────────────────────────────────────────────────────────
let engineProc:   ChildProcess | null = null
let engineProc3D: ChildProcess | null = null

function engineBinPath(): string {
  if (!PACKAGED) {
    return path.join(__dirname, '../../engine-build/engine/simpath4_engine')
  }
  return path.join(process.resourcesPath, 'engine', 'simpath4_engine')
}

function methodsDir(): string {
  if (!PACKAGED) {
    // __dirname = gui/electron-compiled/ → ../../methods = ver-4/methods
    return path.join(__dirname, '../../methods')
  }
  return path.join(process.resourcesPath, 'methods')
}

function startEngine(): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = engineBinPath()
    if (!fs.existsSync(bin)) {
      reject(new Error(`Engine binary not found: ${bin}`))
      return
    }

    engineProc = spawn(bin, [String(ENGINE_PORT), methodsDir()], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let ready = false
    engineProc.stdout?.on('data', (d: Buffer) => {
      const line = d.toString()
      process.stdout.write('[engine] ' + line)
      // Engine prints "Listening on ws://..." when ready
      if (!ready && line.includes('Listening')) {
        ready = true
        resolve()
      }
    })
    engineProc.stderr?.on('data', (d: Buffer) => {
      process.stderr.write('[engine] ' + d.toString())
    })
    engineProc.on('exit', code => {
      console.log('[engine] exited with code', code)
      if (!ready) reject(new Error('Engine exited before becoming ready'))
    })

    // Fallback timeout — resolve after 3 s even if no "Listening" line
    setTimeout(() => { if (!ready) { ready = true; resolve() } }, 3000)
  })
}

function engineBinPath3D(): string {
  if (!PACKAGED) {
    return path.join(__dirname, '../../engine-build/engine3d/simpath4_engine3d')
  }
  return path.join(process.resourcesPath, 'engine3d', 'simpath4_engine3d')
}

function methodsDir3D(): string {
  if (!PACKAGED) {
    return path.join(__dirname, '../../methods3d')
  }
  return path.join(process.resourcesPath, 'methods3d')
}

function startEngine3D(): void {
  const bin = engineBinPath3D()
  if (!fs.existsSync(bin)) {
    console.warn('[main] 3D engine binary not found:', bin)
    return
  }
  engineProc3D = spawn(bin, [String(ENGINE_PORT_3D), methodsDir3D()], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  engineProc3D.stdout?.on('data', (d: Buffer) => process.stdout.write('[engine3D] ' + d.toString()))
  engineProc3D.stderr?.on('data', (d: Buffer) => process.stderr.write('[engine3D] ' + d.toString()))
  engineProc3D.on('exit', code => console.log('[engine3D] exited with code', code))
}

// ── Static web server (serves dist/ for the "Open in Browser" button) ─────────
function startWebServer(): void {
  const distDir = PACKAGED
    ? path.join(process.resourcesPath, 'dist')
    : path.join(__dirname, '../dist')

  const mimeTypes: Record<string, string> = {
    '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css',   '.png': 'image/png',
    '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  }

  http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url!)
    if (!fs.existsSync(filePath)) filePath = path.join(distDir, 'index.html')
    const ext  = path.extname(filePath)
    const mime = mimeTypes[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    fs.createReadStream(filePath).pipe(res)
  }).listen(WEB_PORT)
}

// ── Blocked window ────────────────────────────────────────────────────────────
function createBlockedWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width:           420,
    height:          440,
    frame:           true,
    resizable:       false,
    center:          true,
    title:           'SIMPATH 4 — Access Blocked',
    backgroundColor: '#0d0d1a',
    webPreferences:  { contextIsolation: true },
  })
  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, '../blocked.html'))
  win.once('ready-to-show', () => {
    win.show()
    // Pass machine ID so user can quote it in a support request
    win.webContents.executeJavaScript(
      `window.postMessage({ machineId: ${JSON.stringify(machineId())} }, '*')`
    )
  })
  return win
}

// ── Windows ───────────────────────────────────────────────────────────────────
let splashWin: BrowserWindow | null = null
let mainWin:   BrowserWindow | null = null

function createSplash(): BrowserWindow {
  splashWin = new BrowserWindow({
    width:           340,
    height:          380,
    frame:           false,
    transparent:     true,
    resizable:       false,
    alwaysOnTop:     true,
    center:          true,
    skipTaskbar:     true,
    backgroundColor: '#0d0d1a',
    webPreferences:  { contextIsolation: true },
  })
  splashWin.loadFile(path.join(__dirname, '../splash.html'))
  return splashWin
}

function setSplashStatus(text: string, cls: 'ok' | 'err' | '' = '') {
  splashWin?.webContents.executeJavaScript(
    `window.postMessage({ text: ${JSON.stringify(text)}, cls: "${cls}" }, '*')`
  )
}

function createMainWindow(): BrowserWindow {
  mainWin = new BrowserWindow({
    width:           1400,
    height:          900,
    show:            false,
    backgroundColor: '#0d0d1a',
    title:           'SIMPATH 4',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  if (VITE_DEV) {
    mainWin.loadURL('http://localhost:5173')
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWin.once('ready-to-show', () => {
    mainWin?.show()
    mainWin?.setAlwaysOnTop(true)
    mainWin?.focus()
    mainWin?.moveTop()
    splashWin?.close()
    splashWin = null
    setTimeout(() => mainWin?.setAlwaysOnTop(false), 500)
    // Start update check after main window is shown
    if (!VITE_DEV) {
      setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000)
    }
  })

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return mainWin
}

// ── autoUpdater ───────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload    = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWin?.webContents.send('update:checking')
  })
  autoUpdater.on('update-available', (info) => {
    mainWin?.webContents.send('update:available', info)
  })
  autoUpdater.on('update-not-available', () => {
    mainWin?.webContents.send('update:not-available')
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWin?.webContents.send('update:progress', progress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWin?.webContents.send('update:downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    mainWin?.webContents.send('update:error', err.message)
  })

  // IPC: renderer asks to install the downloaded update
  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall()
  })

}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const splash     = createSplash()
  const splashStart = Date.now()

  setupAutoUpdater()

  // Step 1 — start engine (skip if launched externally via simpath4.sh)
  startWebServer()
  if (EXTERNAL_ENGINES) {
    setSplashStatus('Engine ready', 'ok')
  } else {
    setSplashStatus('Starting engine…')
    try {
      await startEngine()
      startEngine3D()
      setSplashStatus('Engine ready', 'ok')
    } catch (err: unknown) {
      setSplashStatus('Engine failed: ' + String(err), 'err')
      console.error('[main] Engine failed to start:', err)
    }
  }

  // Step 2 — validate license with server
  setSplashStatus('Checking license…')
  const licResult = await checkLicense()
  console.log('[main] License status:', licResult.status)

  if (licResult.status === 'blocked') {
    splashWin?.close()
    splashWin = null
    createBlockedWindow()
    return
  }

  // Step 3 — ensure minimum splash time feels intentional
  const elapsed = Date.now() - splashStart
  if (elapsed < SPLASH_MS) {
    setSplashStatus('Loading interface…')
    await new Promise(r => setTimeout(r, SPLASH_MS - elapsed))
  }

  // Step 4 — open main window (splash closes in ready-to-show)
  createMainWindow()
  void splash  // splash reference held; closed by mainWin ready-to-show
})

app.on('window-all-closed', () => {
  engineProc?.kill()
  engineProc3D?.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})
