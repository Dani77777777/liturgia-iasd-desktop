import { app, BrowserWindow, Menu, screen, MenuItemConstructorOptions, shell, Display, dialog, nativeImage, autoUpdater } from 'electron';
import * as path from 'path';
// import Store from 'electron-store'; // Setup later if needed for persistence

// const store = new Store();

// Configuration
const DEV_URL = 'http://localhost:3000';
const PROD_URL = 'https://liturgia-iasd.vercel.app'; // Replace with actual URL later
const USE_DEV = process.env.NODE_ENV === 'development';
const BASE_URL = USE_DEV ? DEV_URL : PROD_URL;


// Auto-Update Configuration
// Using GitHub Releases for automatic updates
const UPDATE_SERVER_URL = 'https://github.com/Dani77777777/liturgia-iasd-desktop/releases/latest/download';
const AUTO_UPDATE_ENABLED = !USE_DEV && process.platform === 'win32'; // Only on Windows production builds

let mainWindow: BrowserWindow | null = null;
let presentationWindow: BrowserWindow | null = null;
let store: any; // e.g. let store = new Store(); (initialized dynamically)

// ============================================
// AUTO-UPDATE SYSTEM
// ============================================

/**
 * Initialize and configure the auto-updater
 */
function setupAutoUpdater() {
  if (!AUTO_UPDATE_ENABLED) {
    console.log('Auto-update disabled (dev mode or non-Windows platform)');
    return;
  }

  console.log('Setting up auto-updater...');
  console.log('Update server:', UPDATE_SERVER_URL);

  // Configure the update feed URL
  autoUpdater.setFeedURL({
    url: UPDATE_SERVER_URL
  });

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  // Event: Update available
  autoUpdater.on('update-available', () => {
    console.log('Update available! Downloading...');
    
    // Optional: Show notification to user
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização Disponível',
        message: 'Uma nova versão está sendo baixada em segundo plano.',
        buttons: ['OK']
      });
    }
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', () => {
    console.log('App is up to date.');
  });

  // Event: Update downloaded (ready to install)
  autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
    console.log('Update downloaded:', releaseName);
    console.log('Release notes:', releaseNotes);
    console.log('Release date:', releaseDate);

    // Notify user and ask to restart
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização Pronta',
        message: `Uma nova versão (${releaseName}) foi instalada.\n\nDeseja reiniciar a aplicação agora para aplicar a atualização?`,
        detail: releaseNotes || 'Melhorias e correções de bugs.',
        buttons: ['Reiniciar Agora', 'Reiniciar Depois'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          // User chose to restart now
          console.log('User chose to restart now');
          autoUpdater.quitAndInstall();
        } else {
          // User chose to restart later
          console.log('User chose to restart later');
        }
      });
    }
  });

  // Event: Error during update
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
    
    // Optional: Show error to user (only in dev or if critical)
    // Uncomment if you want to show errors to users:
    /*
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Erro na Atualização',
        message: 'Não foi possível verificar atualizações.',
        detail: error.message,
        buttons: ['OK']
      });
    }
    */
  });

  // Check for updates on startup (after 3 seconds delay)
  setTimeout(() => {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdates();
  }, 3000);

  // Check for updates every 4 hours
  setInterval(() => {
    console.log('Periodic update check...');
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000); // 4 hours in milliseconds
}

/**
 * Manually trigger update check (can be called from menu)
 */
function checkForUpdatesManually() {
  if (!AUTO_UPDATE_ENABLED) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualizações Automáticas',
        message: 'As atualizações automáticas estão disponíveis apenas na versão de produção para Windows.',
        buttons: ['OK']
      });
    }
    return;
  }

  console.log('Manual update check triggered');
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Verificando Atualizações',
      message: 'Verificando se há atualizações disponíveis...',
      buttons: ['OK']
    });
  }

  autoUpdater.checkForUpdates();
}

// ============================================
// END AUTO-UPDATE SYSTEM
// ============================================


function createMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Liturgia IASD - Painel de Controlo",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    autoHideMenuBar: true, // Hide menu bar (press Alt to show)
    icon: appIcon,
  });

  // Load the Control Panel (Agenda with live events view)
  mainWindow.loadURL(`${BASE_URL}/liturgia/agenda?view=hoje`).catch((e: unknown) => {
    console.error('Failed to load URL:', e);
    // You could load a local error page here if you wanted
    // mainWindow.loadFile(path.join(__dirname, 'error.html'));
  });

  mainWindow.on('closed', () => {
    // Close presentation window when main window closes
    if (presentationWindow && !presentationWindow.isDestroyed()) {
      presentationWindow.close();
      presentationWindow = null;
    }
    mainWindow = null;
  });
  
  // Handle new window requests (e.g. target="_blank")
  // Handle new window requests (e.g. target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    // Check if it's a presentation URL (contains /present/)
    if (url.includes('/present/')) {
        console.log('Intercepted presentation URL:', url);
        let displayId = store ? store.get('projectionDisplayId') : null;
        
        if (!displayId) {
            // Auto-detect secondary display
            const displays = screen.getAllDisplays();
            if (displays.length > 1) {
                // Pick the last one (usually the external one)
                const secondary = displays[displays.length - 1];
                displayId = secondary.id;
                if (store) store.set('projectionDisplayId', displayId);
                console.log('Auto-detected secondary display:', displayId);
            } else {
                // Verify if we should use the primary or show error
                 dialog.showMessageBox(mainWindow!, {
                    type: 'info',
                    title: 'Configuração de Projeção',
                    message: 'Nenhum segundo monitor detetado. A abrir no monitor principal para testes.',
                    buttons: ['OK']
                });
                displayId = screen.getPrimaryDisplay().id;
            }
        }

        if (displayId) {
            createPresentationWindow(displayId, url);
        }
        
        return { action: 'deny' };
    }

    // Allow external links to open in browser
    if (url.startsWith('http')) {
        shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  updateMenu();
}

function createPresentationWindow(displayId: number, targetUrl?: string) {
  // If presentation window already exists, focus it and cancel creation
  if (presentationWindow && !presentationWindow.isDestroyed()) {
    presentationWindow.focus();
    console.log('Presentation window already open, focusing existing window');
    
    // Optionally show a message to the user
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Apresentação Já Aberta',
        message: 'A janela de apresentação já está aberta. Clique ALT para abrir o menu. Use o menu "Projeção > Fechar Projeção" para fechá-la primeiro.',
        buttons: ['OK']
      });
    }
    
    return; // Cancel creation
  }

  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find((d: Display) => d.id === displayId);

  if (!targetDisplay) {
    console.error('Display not found');
    return;
  }

  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  presentationWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    frame: false, // Frameless for projection
    title: "Liturgia IASD - Projeção",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: appIcon,
  });

  // Presentation URL - we need a way to know WHICH event ID.
  // For now, let's load the flexible generic present page or ask the user.
  // Ideally: The user clicks "Open Projection" in Main Window -> we intercept -> open here.
  // Since we don't have the ID here easily, let's load the creation/landing page or a specific hardcoded one for testing.
  // Better approach: Just open the base present URL, and the user might need to navigate?
  // Or: Input Prompt? 
  // Let's default to a "waiting" screen or the last known ID?
  // Let's just load the root present path if it exists, or maybe we can't without ID.
  // Let's load the Agenda for now so they can click, OR...
  // Wait, let's assume the user copies the link from the main window.
  
  // For MVP: Let's just load the base URL and let them navigate, or maybe hardcode an ID for testing?
  // Let's try to load the generic presentation intro if available, or just the home page.
  
  // IMPORTANT: The user wants to "select window to open the presentation".
  // Let's load the URL that was requested? 
  // Let's just load the home for now, but maybe we can communicate via IPC to send the URL.
  
  // Load the requested URL or default demo
  const urlToLoad = targetUrl || `${BASE_URL}/present/demo`;
  presentationWindow.loadURL(urlToLoad);

  presentationWindow.on('closed', () => {
    presentationWindow = null;
    updateMenu(); // Update menu to disable close button
  });

  updateMenu(); // Update menu to enable close button
}

function updateMenu() {
  const displays = screen.getAllDisplays();
  
  const currentDisplayId = store ? store.get('projectionDisplayId') : null;

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Arquivo',
      submenu: [
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
        label: 'Projeção',
        submenu: [
            { label: 'Definir Ecrã de Projeção', enabled: false },
            { type: 'separator' },
            ...displays.map((display: Display, index: number) => ({
                label: `Ecrã ${index + 1}: ${display.bounds.width}x${display.bounds.height} ${display.id === screen.getPrimaryDisplay().id ? '(Principal)' : ''}`,
                type: 'radio' as const,
                checked: currentDisplayId === display.id,
                click: () => {
                    if (store) {
                        store.set('projectionDisplayId', display.id);
                        updateMenu(); // Refresh checkmark
                    }
                }
            })),
            { type: 'separator' },
            { 
                label: 'Fechar Projeção', 
                enabled: !!presentationWindow,
                click: () => {
                    if (presentationWindow) {
                        presentationWindow.close();
                        presentationWindow = null;
                        updateMenu(); // Refresh menu state
                    }
                }
            }
        ]
    },
    {
       label: 'Janela',
       submenu: [
           { label: 'Recarregar', role: 'reload' },
           { label: 'Ferramentas de Desenvolvedor', role: 'toggleDevTools' }
       ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Verificar Atualizações',
          click: () => {
            checkForUpdatesManually();
          }
        },
        { type: 'separator' },
        {
          label: 'Sobre',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Liturgia IASD Desktop',
                message: `Liturgia IASD Desktop\nVersão ${app.getVersion()}`,
                detail: 'Desktop wrapper para gestão de liturgia da IASD com suporte multi-janela.',
                buttons: ['OK']
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


app.whenReady().then(async () => {
  // Initialize Electron Store dynamically (ESM workaround)
  try {
      const { default: Store } = await import('electron-store');
      store = new Store();
      console.log('Store initialized:', store.path);
  } catch (err) {
      console.error('Failed to init store:', err);
  }

  createMainWindow();

  // Initialize auto-updater
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  
  // Refresh menu when displays change
  screen.on('display-added', updateMenu);
  screen.on('display-removed', updateMenu);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
