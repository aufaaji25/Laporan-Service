const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const db = require('./db');

const DEFAULT_PORT = process.env.PORT || 3000;

// Otomatis cari folder web/ atau public/ atau root
function getWebDir() {
  if (fs.existsSync(path.join(__dirname, 'web'))) {
    return path.join(__dirname, 'web');
  }
  if (fs.existsSync(path.join(__dirname, 'public'))) {
    return path.join(__dirname, 'public');
  }
  return __dirname;
}

const WEB_DIR = getWebDir();

// Tentukan path penyimpanan data JSON lokal (sebagai file backup)
function getDataFilePath() {
  const localDataDir = path.join(__dirname, 'data');
  const localDataFile = path.join(localDataDir, 'laporan-service.json');

  if (fs.existsSync(localDataFile)) {
    return localDataFile;
  }

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  const electronDataPath = path.join(appData, 'laporan-service-pc', 'laporan-service.json');
  if (fs.existsSync(electronDataPath)) {
    return electronDataPath;
  }

  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true });
  }
  return localDataFile;
}

const DATA_FILE = getDataFilePath();

// Data default jika file/db belum ada
const DEFAULT_ADMIN = {
  id: 1,
  username: 'user',
  password: 'user123',
  nama: 'User',
  role: 'Admin'
};

const INITIAL_DATA = {
  users: [DEFAULT_ADMIN],
  jenisAlat: [],
  kategoriLokasi: [],
  laporan: []
};

// Baca data JSON lokal
function readJsonData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [DEFAULT_ADMIN],
        jenisAlat: Array.isArray(parsed.jenisAlat) ? parsed.jenisAlat : INITIAL_DATA.jenisAlat,
        kategoriLokasi: Array.isArray(parsed.kategoriLokasi) ? parsed.kategoriLokasi : INITIAL_DATA.kategoriLokasi,
        laporan: Array.isArray(parsed.laporan) ? parsed.laporan : []
      };
    }
  } catch (err) {
    console.error('Gagal membaca file data JSON:', err);
  }
  return INITIAL_DATA;
}

// Simpan data JSON lokal
function writeJsonData(newData) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Gagal menyimpan file data JSON:', err);
    return false;
  }
}

// Ambil IP Lokal untuk akses jaringan LAN / Wi-Fi
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

// Content-Type map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // --- API: GET DATA ---
    if (pathname === '/api/data' && req.method === 'GET') {
      let result = null;
      const dbStatus = db.getDatabaseStatus();

      if (dbStatus.connected) {
        result = await db.getDataFromDb();
      }

      if (!result) {
        result = readJsonData();
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Database-Engine': dbStatus.engine
      });
      res.end(JSON.stringify(result));
      return;
    }

    // --- API: SAVE DATA ---
    if (pathname === '/api/save-data' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) { // 50MB limit
          req.destroy();
        }
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          
          // 1. Simpan ke file JSON sebagai cadangan
          writeJsonData(parsed);

          // 2. Simpan ke database MySQL jika terhubung
          const dbStatus = db.getDatabaseStatus();
          let dbSuccess = true;
          if (dbStatus.connected) {
            dbSuccess = await db.saveDataToDb(parsed);
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            engine: dbStatus.engine,
            dbSaved: dbSuccess
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Format data tidak valid: ' + e.message }));
        }
      });
      return;
    }

    // --- API: INFO SERVER ---
    if (pathname === '/api/info' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'online',
        database: db.getDatabaseStatus(),
        backupJsonFile: DATA_FILE,
        localIps: getLocalIPAddresses()
      }));
      return;
    }

    // --- STATIC FILE SERVING ---
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\' || safePath === '') {
      safePath = '/index.html';
    }

    let filePath = path.join(WEB_DIR, safePath);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(WEB_DIR, 'index.html');
    } else {
      try {
        if (fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch (e) {
        filePath = path.join(WEB_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File tidak ditemukan: ' + safePath);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  } catch (err) {
    console.error('Unhandled request error:', err);
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error: ' + err.message);
    } catch (e) {}
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startServer() {
  // Inisialisasi MySQL
  const initialData = readJsonData();
  await db.initDatabase(initialData);

  server.listen(DEFAULT_PORT, '0.0.0.0', () => {
    const ips = getLocalIPAddresses();
    const dbStatus = db.getDatabaseStatus();
    console.log('\n=============================================================');
    console.log('  🌐 Laporan Service Web Server Berhasil Dijalankan!');
    console.log('=============================================================');
    console.log(`  ▶ Akses dari komputer ini : http://localhost:${DEFAULT_PORT}`);
    ips.forEach(item => {
      console.log(`  ▶ Akses dari HP/PC lain (${item.name}): http://${item.ip}:${DEFAULT_PORT}`);
    });
    console.log('-------------------------------------------------------------');
    console.log(`  🗄️ Database Utama         : ${dbStatus.connected ? `MySQL [${dbStatus.database}] di ${dbStatus.host}` : 'File JSON (Offline)'}`);
    console.log(`  📁 File Backup Cadangan   : ${DATA_FILE}`);
    console.log('=============================================================\n');
  });
}

startServer();
