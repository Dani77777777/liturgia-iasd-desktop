import { app, BrowserWindow, Menu, screen, MenuItemConstructorOptions, shell, Display, dialog, nativeImage, autoUpdater, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

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
let controllerWindow: BrowserWindow | null = null;
let store: any; // e.g. let store = new Store(); (initialized dynamically)

let supabaseClient: any = null;
let currentEvent: { id: string, data: string, titulo: string } | null = null;

// Realtime subscription handle for the controller
let controllerSubscription: any = null;

// Latest escala state for the controller
let currentEscala: any[] = [];

// Paths
const WEB_APP_PATH = path.join(__dirname, '..', '..', 'liturgia-iasd');
const ENV_PATH = path.join(WEB_APP_PATH, '.env.local');

/**
 * Initialize Supabase client
 */
function initSupabase() {
  // Hardcoded credentials for production stability
  const supabaseUrl = 'https://qzmigrvjpanjoalsdsaa.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bWlncnZqcGFuam9hbHNkc2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Njk3MTEsImV4cCI6MjA3OTI0NTcxMX0._tK29U5QdHgTN7JvwKn7H7lQgLTDZ4Heb-l4Y9Pj5HM';

  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized with hardcoded credentials');
  } else {
    console.error('Supabase credentials missing');
  }
}

// ============================================
// SQUIRREL EVENTS HANDLER (Windows Installer)
// ============================================

/**
 * Handle Squirrel events on Windows (install, update, uninstall)
 * This ensures shortcuts are created properly
 */
function handleSquirrelEvent(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  if (process.argv.length === 1) {
    return false;
  }

  const appFolder = path.resolve(process.execPath, '..');
  const rootFolder = path.resolve(appFolder, '..');
  const updateExe = path.resolve(path.join(rootFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command: string, args: string[]) {
    let spawnedProcess;
    try {
      spawnedProcess = require('child_process').spawn(command, args, { detached: true });
    } catch (error) {
      console.error('Error spawning process:', error);
    }
    return spawnedProcess;
  };

  const spawnUpdate = function(args: string[]) {
    return spawn(updateExe, args);
  };

  const squirrelEvent = process.argv[1];
  
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated
      app.quit();
      return true;
  }

  return false;
}

// Handle Squirrel events before anything else
if (handleSquirrelEvent()) {
  // Squirrel event handled, app will quit
  // Don't do anything else
} else {
  // Normal app startup continues below
}

// ============================================
// END SQUIRREL EVENTS HANDLER
// ============================================


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
  });

  // Monitor URL changes to detect if we are in an event/schedule page
  const handleURLChange = async (url: string) => {
    console.log('Navigated to:', url);
    const eventMatch = url.match(/\/liturgia\/evento\/(\d+)/);
    
    if (eventMatch) {
      const eventId = eventMatch[1];
      if (currentEvent?.id !== eventId) {
        await fetchEventDetails(eventId);
      }
    } else {
      if (currentEvent !== null) {
        currentEvent = null;
        updateMenu();
      }
    }
  };

  mainWindow.webContents.on('did-navigate', (event, url) => handleURLChange(url));
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => handleURLChange(url));

  mainWindow.on('closed', () => {
    // Close presentation window when main window closes
    if (presentationWindow && !presentationWindow.isDestroyed()) {
      presentationWindow.close();
      presentationWindow = null;
    }
    // Close controller window when main window closes
    if (controllerWindow && !controllerWindow.isDestroyed()) {
      controllerWindow.close();
      controllerWindow = null;
    }
    // Unsubscribe from realtime
    if (controllerSubscription) {
      controllerSubscription.unsubscribe();
      controllerSubscription = null;
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

// ============================================
// CONTROLLER WINDOW
// ============================================

function createControllerWindow() {
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.focus();
    return;
  }

  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  controllerWindow = new BrowserWindow({
    width: 280,
    height: 380,
    minWidth: 240,
    minHeight: 300,
    maxWidth: 400,
    title: 'Controlo do Culto',
    alwaysOnTop: false, // Set properly below with level
    resizable: true,
    frame: false,
    transparent: false,
    skipTaskbar: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload-controller.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Use 'screen-saver' level to stay above fullscreen apps (e.g. YouTube videos)
  controllerWindow.setAlwaysOnTop(true, 'screen-saver');

  // Resolve controller.html path: compiled (dist/) in production, src/ in dev
  const controllerHtmlDist = path.join(__dirname, 'controller.html');
  const controllerHtmlSrc = path.join(__dirname, '..', 'src', 'controller.html');
  const controllerHtmlPath = fs.existsSync(controllerHtmlDist) ? controllerHtmlDist : controllerHtmlSrc;
  controllerWindow.loadFile(controllerHtmlPath);

  controllerWindow.on('closed', () => {
    controllerWindow = null;
    // Stop realtime subscription when controller closes
    if (controllerSubscription) {
      controllerSubscription.unsubscribe();
      controllerSubscription = null;
    }
    updateMenu();
  });

  // Start syncing escala from Supabase once we have an event
  startControllerSync();
  updateMenu();
}

async function fetchEscalaForController(eventId: string) {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('dbEscalas')
      .select('id, titulo, tipo, status, musica, observacoes, ordem')
      .eq('evento_id', eventId)
      .order('ordem');
    if (error) throw error;
    currentEscala = data || [];
    pushStateToController();
  } catch (e) {
    console.error('Error fetching escala for controller:', e);
  }
}

function pushStateToController() {
  if (!controllerWindow || controllerWindow.isDestroyed()) return;
  const state = {
    escala: currentEscala,
    eventTitle: currentEvent?.titulo || '',
  };
  controllerWindow.webContents.send('controller-state-update', state);
}

function startControllerSync() {
  if (!supabaseClient || !currentEvent) return;

  // Fetch initial data immediately
  fetchEscalaForController(currentEvent.id);

  // Clear any previous polling interval
  if (controllerSubscription) {
    clearInterval(controllerSubscription);
    controllerSubscription = null;
  }

  const eventId = currentEvent.id;

  // Poll every 2 seconds for state changes (more reliable than WS in main process)
  controllerSubscription = setInterval(async () => {
    if (!controllerWindow || controllerWindow.isDestroyed()) {
      clearInterval(controllerSubscription);
      controllerSubscription = null;
      return;
    }
    await fetchEscalaForController(eventId);
  }, 2000);

  console.log('Controller polling sync started for event:', currentEvent.id);
}

// IPC: Controller sends navigation commands — handled directly via Supabase
ipcMain.on('controller-command', async (_event, command: 'next' | 'previous') => {
  if (!supabaseClient || !currentEvent || currentEscala.length === 0) return;

  const escala = currentEscala;
  const currentIndex = escala.findIndex(i => i.status === 'atual');

  let targetIndex = -1;

  if (command === 'next') {
    if (currentIndex === -1) {
      // Nothing active yet — start from first non-section item
      targetIndex = escala.findIndex(i => i.tipo !== 'seccao');
    } else {
      for (let i = currentIndex + 1; i < escala.length; i++) {
        if (escala[i].tipo !== 'seccao') { targetIndex = i; break; }
      }
    }
  } else if (command === 'previous') {
    if (currentIndex === -1) return;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (escala[i].tipo !== 'seccao') { targetIndex = i; break; }
    }
  }

  try {
    // Mark current item as concluido
    await supabaseClient
      .from('dbEscalas')
      .update({ status: 'concluido' })
      .eq('evento_id', currentEvent.id)
      .eq('status', 'atual');

    if (targetIndex !== -1) {
      // Set new item as atual
      await supabaseClient
        .from('dbEscalas')
        .update({ status: 'atual' })
        .eq('id', escala[targetIndex].id);
    } else if (command === 'previous' && currentIndex !== -1) {
      // Going back past the first item — reset to no active item
      // (already marked as concluido above, nothing more needed)
    }

    // Refresh our local cache
    if (currentEvent) await fetchEscalaForController(currentEvent.id);
  } catch (e) {
    console.error('Error executing navigation command:', e);
  }
});

// IPC: Controller requests current state on load
ipcMain.on('controller-request-state', () => {
  if (currentEvent) {
    fetchEscalaForController(currentEvent.id);
  } else {
    pushStateToController();
  }
});

// ============================================
// END CONTROLLER WINDOW
// ============================================

/**
 * Fetch event details from Supabase
 */
async function fetchEventDetails(id: string) {
  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('dbEventos')
      .select('id, data, titulo')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (data) {
      currentEvent = {
        id: data.id.toString(),
        data: data.data,
        titulo: data.titulo
      };
      updateMenu();
      // If the controller window is open, restart sync for new event
      if (controllerWindow && !controllerWindow.isDestroyed()) {
        startControllerSync();
      }
    }
  } catch (err) {
    console.error('Error fetching event details:', err);
  }
}

/**
 * Logic to handle PowerPoint opening/creation
 */
async function handlePowerPointAction() {
  if (!currentEvent) return;

  const eventDate = new Date(currentEvent.data);
  const year = eventDate.getFullYear().toString();
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthName = months[eventDate.getMonth()];
  const day = eventDate.getDate().toString();
  
  const dd = day.padStart(2, '0');
  const mm = (eventDate.getMonth() + 1).toString().padStart(2, '0');
  const fileName = `${dd}-${mm}-${year}.pptx`;

  // Detect External Drive
  const drives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(d => `${d}:\\`);
  let targetDrive: string | null = null;

  for (const drive of drives) {
    try {
      if (fs.existsSync(path.join(drive, 'Cultos')) && fs.existsSync(path.join(drive, 'Modelo'))) {
        targetDrive = drive;
        break;
      }
    } catch (e) { /* ignore restricted drives */ }
  }

  if (!targetDrive) {
    dialog.showErrorBox('Erro', 'Disco externo não encontrado. Certifique-se que o disco contém as pastas "Cultos" e "Modelo" na raiz.');
    return;
  }

  const modelPath = path.join(targetDrive, 'Modelo', 'Apresentação para o Culto - Modelo.pptx');
  if (!fs.existsSync(modelPath)) {
    dialog.showErrorBox('Erro', `Ficheiro modelo não encontrado em: ${modelPath}`);
    return;
  }

  const targetDir = path.join(targetDrive, 'Cultos', year, monthName, day);
  const finalFilePath = path.join(targetDir, fileName);

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (!fs.existsSync(finalFilePath)) {
      fs.copyFileSync(modelPath, finalFilePath);
      console.log('Created new pptx from model:', finalFilePath);
    }

    shell.openPath(finalFilePath).then((err) => {
        if (err) {
            dialog.showErrorBox('Erro ao abrir PowerPoint', err);
        }
    });

  } catch (err: any) {
    console.error('Error in handlePowerPointAction:', err);
    dialog.showErrorBox('Erro de Ficheiro', `Ocorreu um erro ao processar o ficheiro: ${err.message}`);
  }
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
    ...(currentEvent ? [{
      label: 'Culto',
      submenu: [
        {
          label: `Abrir PowerPoint (${new Date(currentEvent.data).toLocaleDateString('pt-PT')})`,
          click: () => handlePowerPointAction()
        },
        { type: 'separator' as const },
        {
          label: controllerWindow && !controllerWindow.isDestroyed() ? 'Fechar Janela de Controlo' : 'Abrir Janela de Controlo',
          click: () => {
            if (controllerWindow && !controllerWindow.isDestroyed()) {
              controllerWindow.close();
            } else {
              createControllerWindow();
            }
          }
        }
      ]
    } as MenuItemConstructorOptions] : []),
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
      initSupabase();
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
