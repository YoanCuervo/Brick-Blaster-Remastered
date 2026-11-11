import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, Menu, app, net, protocol, screen, session } from "electron";

const SCHEME = "app";
const HOST = "game";
const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 480;
// Inline style: the <style> of index.html, shared with the browser version as is.
const CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self'; connect-src 'self'; media-src 'self'";
const REMOTE_URLS = ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*", "ftp://*/*"];
const ALLOWED_PERMISSIONS = new Set(["fullscreen", "pointerLock"]);

// file:// is no option: Chromium refuses fetch() there, and the game loads everything with it.
// A fixed secure origin also gives the AudioWorklet its secure context and keeps localStorage.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function serveDist(root: string): void {
  protocol.handle(SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url);
    try {
      const path = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
      const file = resolve(root, `.${path}`);
      if (host !== HOST || !file.startsWith(root + sep)) throw new Error("outside the game");
      const res = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(res.headers);
      headers.set("Content-Security-Policy", CSP);
      return new Response(res.body, { status: res.status, headers });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}

function lockDownSession(): void {
  const { defaultSession } = session;
  defaultSession.webRequest.onBeforeRequest({ urls: REMOTE_URLS }, (_details, callback) => {
    callback({ cancel: true });
  });
  defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
}

function createWindow(root: string): void {
  const win = new BrowserWindow({
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    minWidth: LOGICAL_WIDTH,
    minHeight: LOGICAL_HEIGHT,
    useContentSize: true,
    show: false,
    backgroundColor: "#000",
    icon: join(root, "icon", "blaster.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Electron plays without a gesture by default: keep the audio unlock of the browser version.
      autoplayPolicy: "document-user-activation-required",
    },
  });

  // Same integer scale as the game computes (render/screen.ts), so no black bars at start.
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const [outerWidth = 0, outerHeight = 0] = win.getSize();
  const [innerWidth = 0, innerHeight = 0] = win.getContentSize();
  const scale = Math.floor(
    Math.min(
      (width - (outerWidth - innerWidth)) / LOGICAL_WIDTH,
      (height - (outerHeight - innerHeight)) / LOGICAL_HEIGHT,
    ),
  );
  win.setContentSize(LOGICAL_WIDTH * Math.max(1, scale), LOGICAL_HEIGHT * Math.max(1, scale));
  win.center();

  win.once("ready-to-show", () => win.show());
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  void win.loadURL(`${SCHEME}://${HOST}/`);
}

app.on("window-all-closed", () => app.quit());

void app.whenReady().then(() => {
  const root = join(app.getAppPath(), "dist");
  // Also drops the default shortcuts: zoom would break the integer scale.
  Menu.setApplicationMenu(null);
  lockDownSession();
  serveDist(root);
  createWindow(root);
});
