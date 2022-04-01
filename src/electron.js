const { app, BrowserWindow } = require('electron');
const p = require('path');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'Energ.io',
        // titleBarStyle: 'hidden'
    });
  
    win.setMenuBarVisibility(false);
    win.loadFile(p.join(__dirname, '../static/index.html'));
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});