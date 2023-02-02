const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { release } = require('node:os')
const { join, dirname } = require('node:path')
const { createReadStream, existsSync, exists } = require('node:fs')
const { readFile, writeFile, mkdir, unlink } = require('node:fs/promises');
const { readLine } = require('node:readline')
const { exec } = require('node:child_process');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cacheFileName = "cache.json";
var mpvPath = "mpv";
var mpvProcesses = [];

fixMPV();

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win = null
const preload = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
const url = "http://localhost:4200";
const indexHtml = join(__dirname, 'index.html');

async function createWindow() {
  win = new BrowserWindow({
    title: 'Open-TV (made by Frédéric Lachapelle)',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.DEVMODE) {
    win.loadURL(url);
  } else {
    win.loadURL(`file://${indexHtml}`);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

ipcMain.handle("selectFile", selectFile);
ipcMain.handle("getCache", getCache);
ipcMain.handle("playChannel", async (event, url) => await playChannel(url));
ipcMain.handle("deleteCache", deleteCache)

async function deleteCache() {
  let cachePath = `${getHomeDirectory()}/${cacheFileName}`;
  await unlink(cachePath);
}

async function selectFile() {
  let dialogResult = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (dialogResult.canceled) return;
  let channels = await parsePlaylist(dialogResult.filePaths[0]);
  SaveToCache(channels);
  return channels;
}

async function getCache() {
  let cachePath = `${getHomeDirectory()}/${cacheFileName}`;
  if (!existsSync(cachePath))
    return [];
  let json = await readFile(cachePath, { encoding: "utf-8" });
  return JSON.parse(json);
}

async function SaveToCache(channels) {
  let json = JSON.stringify(channels);
  let path = getHomeDirectory();
  let cachePath = `${path}/${cacheFileName}`
  if (!existsSync(path))
    mkdir(path, { recursive: true });
  await writeFile(cachePath, json);
}

function getHomeDirectory() {
  let appdataPath = process.env.APPDATA ||
    (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' :
      process.env.HOME + "/.local/share")
  return `${appdataPath}/open-tv`;
}

async function parsePlaylist(filePath) {
  const nameRegExp = /tvg-name="{1}(?<name>[^"]*)"{1}/;
  const logoRegExp = /tvg-logo="{1}(?<logo>[^"]*)"{1}/;
  const groupRegExp = /group-title="{1}(?<group>[^"]*)"{1}/;

  const inputStream = createReadStream(filePath);
  var lineReader = readLine.createInterface({
    input: inputStream,
    terminal: false,
  });
  let skippedFirstLine = false;
  let twoLines = [];
  let channels = [];
  for await (const line of lineReader) {
    if (!skippedFirstLine) {
      skippedFirstLine = true;
      continue;
    }
    twoLines.push(line);
    if (twoLines.length === 2) {
      let firstLine = twoLines[0];
      let secondLine = twoLines[1];
      try {
        channels.push({
          name: firstLine.match(nameRegExp).groups.name,
          image: firstLine.match(logoRegExp).groups.logo,
          group: firstLine.match(groupRegExp).groups.group,
          url: secondLine
        });
      }
      catch (e) { }

      twoLines = [];
    }
  }
  return channels;
}

async function playChannel(url) {
  mpvProcesses.forEach(x => x.kill());
  let child = await exec(`${mpvPath} ${url} --fs`);
  mpvProcesses.push(child);
  await waitForProcessStart(child);
}

function waitForProcessStart(proc) {
  return new Promise(function (resolve, reject) {
    const timeout = 20000;
    const timer = setTimeout(() => {
      reject(new Error(`Promise timed out after ${timeout} ms`));
    }, timeout);
    proc.stdout.on('data', function (data) {
      clearTimeout(timer);
      let line = data.toString();
      if (line.includes("AO") || line.includes("VO") || line.includes("AV")) {
        resolve(true);
      }
    });
    proc.on('close', function (code) {
      clearTimeout(timer);
      reject(code);
    });
  })
}

function fixMPV() {
  if (process.platform == 'darwin') {
    if (existsSync("/opt/homebrew/bin/mpv"))
      mpvPath = "/opt/homebrew/bin/mpv";
    else if (existsSync("/opt/local/mpv"))
      mpvPath = "/opt/local/mpv";
  }
}