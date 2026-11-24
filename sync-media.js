const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PORT = 3000;
const MEDIA_DIR = path.join(__dirname, 'media');
const MANIFEST_JSON_PATH = path.join(MEDIA_DIR, 'manifest.json');
const MANIFEST_JS_PATH = path.join(MEDIA_DIR, 'manifest.js');

// Known default descriptions and titles for known media files
const KNOWN_METADATA = {
  'kkcatin.jpg': {
    title: 'Informasi Layanan KK Catin',
    desc: 'Informasi layanan administrasi Kartu Keluarga Calon Pengantin'
  },
  'ktp1.jpg': {
    title: 'Informasi Layanan KTP-el (1)',
    desc: 'Panduan layanan administrasi kependudukan KTP Elektronik'
  },
  'ktp2.jpg': {
    title: 'Informasi Layanan KTP-el (2)',
    desc: 'Panduan layanan administrasi kependudukan KTP Elektronik'
  },
  'ktp3.jpg': {
    title: 'Informasi Layanan KTP-el (3)',
    desc: 'Panduan layanan administrasi kependudukan KTP Elektronik'
  },
  'ktp4.jpg': {
    title: 'Informasi Layanan KTP-el (4)',
    desc: 'Panduan layanan administrasi kependudukan KTP Elektronik'
  },
  'sanggah0.jpg': {
    title: 'Apa Yang Berbeda Dalam Perlinsos?',
    desc: 'Dua formulir sanggahan: Form Sanggah Singkat & Form DTSEN'
  },
  'sanggah1.jpg': {
    title: 'Bagaimana Mengetahui Apa Yang Perlu Disanggah?',
    desc: 'Cek alasan tidak layak dan periksa kesesuaian data kondisi sebenarnya'
  },
  'sanggah2.jpg': {
    title: 'Data Kamu Tidak Sesuai?',
    desc: 'Panduan pengajuan sanggahan resmi melalui Portal Perlinsos'
  },
  'sanggah3.jpg': {
    title: 'Hasil Perlinsos Belum Sesuai Kondisi Kamu?',
    desc: 'Informasi hak sanggah dan peninjauan kesejahteraan masyarakat'
  },
  'sanggah4.jpeg': {
    title: 'Panduan Sanggah Perlinsos (4)',
    desc: 'Informasi pengajuan sanggahan data Perlinsos'
  },
  'sanggah5.jpeg': {
    title: 'Panduan Sanggah Perlinsos (5)',
    desc: 'Informasi pengajuan sanggahan data Perlinsos'
  },
  'UHCNEW.mp4': {
    title: 'Video Informasi Layanan UHC',
    desc: 'Tayangan video informasi jaminan kesehatan UHC'
  },
  'snapgram.io_oe949efymsiu.mp4': {
    title: 'Video Display Informasi Layanan Publik 1',
    desc: 'Tayangan video profil edukasi dan panduan informasi digital'
  },
  'snapgram.io_svfnjhtqwfju.mp4': {
    title: 'Video Display Informasi Layanan Publik 2',
    desc: 'Tayangan video profil edukasi dan panduan informasi digital'
  }
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov']);

function formatTitleFromFilename(filename) {
  const ext = path.extname(filename);
  let base = path.basename(filename, ext);
  
  if (/^\d+$/.test(base)) {
    return `Poster Layanan #${base}`;
  }

  if (base.toLowerCase().includes('snapgram')) {
    return 'Video Layanan Publik';
  }

  // If it's a social media / numeric hash filename (like 847287402_181093325...), use default name
  if (/^[0-9_n]+$/.test(base) || base.length > 30) {
    return 'Informasi Layanan Publik';
  }
  
  // Format readable title
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scanMediaFiles() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  const files = fs.readdirSync(MEDIA_DIR);
  const items = [];

  // Ignore order.json when scanning media files
  for (const file of files) {
    if (file === 'manifest.json' || file === 'manifest.js' || file === 'order.json' || file.startsWith('.') || file.startsWith('~$')) continue;

    const ext = path.extname(file).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isVideo = VIDEO_EXTENSIONS.has(ext);

    if (!isImage && !isVideo) continue;

    const fullPath = path.join(MEDIA_DIR, file);
    let stats;
    try {
      stats = fs.statSync(fullPath);
      if (!stats.isFile()) continue;
    } catch (_) {
      continue;
    }

    const meta = KNOWN_METADATA[file] || {};
    const title = meta.title || formatTitleFromFilename(file);
    const desc = meta.desc || (isVideo ? 'Video informasi display' : 'Foto poster display informasi');

    items.push({
      id: 'media-' + crypto.createHash('md5').update(file).digest('hex').slice(0, 12),
      filename: file,
      type: isVideo ? 'video' : 'image',
      src: 'media/' + file,
      title: title,
      desc: desc,
      size: stats.size,
      updatedAt: stats.mtimeMs
    });
  }

  // Deterministic sorting:
  // 1. Custom order from media/order.json (if present)
  // 2. Files with leading sequence numbers (e.g. 01_..., 1.jpg, 02-video.mp4) in numeric order
  // 3. Images first (natural A-Z / numeric sort), then videos (natural A-Z / numeric sort)
  let customOrder = [];
  const orderFilePath = path.join(MEDIA_DIR, 'order.json');
  if (fs.existsSync(orderFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(orderFilePath, 'utf-8'));
      if (Array.isArray(parsed)) customOrder = parsed;
    } catch (_) {}
  }

  const getSeqNum = (filename) => {
    const m = /^(\d{1,3})(?:[\s._-]|$)/.exec(filename);
    return m ? parseInt(m[1], 10) : null;
  };

  items.sort((a, b) => {
    const custA = customOrder.indexOf(a.filename);
    const custB = customOrder.indexOf(b.filename);
    if (custA !== -1 && custB !== -1) return custA - custB;
    if (custA !== -1) return -1;
    if (custB !== -1) return 1;

    const seqA = getSeqNum(a.filename);
    const seqB = getSeqNum(b.filename);
    if (seqA !== null && seqB !== null) {
      if (seqA !== seqB) return seqA - seqB;
      return a.filename.localeCompare(b.filename, 'id', { numeric: true, sensitivity: 'base' });
    }
    if (seqA !== null) return -1;
    if (seqB !== null) return 1;

    if (a.type !== b.type) {
      return a.type === 'image' ? -1 : 1;
    }
    return a.filename.localeCompare(b.filename, 'id', { numeric: true, sensitivity: 'base' });
  });

  items.forEach((item, index) => {
    item.order = index;
  });

  return items;
}

function updateManifest() {
  const items = scanMediaFiles();

  // Write manifest.json
  fs.writeFileSync(MANIFEST_JSON_PATH, JSON.stringify(items, null, 2), 'utf-8');

  // Write manifest.js (allows seamless local loading via <script> tag without CORS/server issues)
  const jsContent = `// Auto-generated media manifest\n// Generated at: ${new Date().toISOString()}\nwindow.__MEDIA_MANIFEST__ = ${JSON.stringify(items, null, 2)};\nif (typeof window.__onMediaManifestUpdated === 'function') { window.__onMediaManifestUpdated(window.__MEDIA_MANIFEST__); }\n`;
  fs.writeFileSync(MANIFEST_JS_PATH, jsContent, 'utf-8');

  console.log(`[Auto-Sync] Manifest diperbarui: ${items.length} file media terdeteksi di folder media/`);
  return items;
}

// Watch media directory
let debounceTimer = null;
function startWatcher() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  fs.watch(MEDIA_DIR, (eventType, filename) => {
    if (!filename || filename === 'manifest.json' || filename === 'manifest.js') return;
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[Auto-Sync] Perubahan terdeteksi (${eventType}): ${filename}`);
      updateManifest();
    }, 300);
  });

  console.log(`[Auto-Sync] Memantau folder: ${MEDIA_DIR}`);
}

// Optional dev server with video streaming support
function startServer() {
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime'
  };

  const rootDir = path.resolve(__dirname);

  const server = http.createServer((req, res) => {
    let reqPath;
    try {
      reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('400 Bad Request');
      return;
    }
    if (reqPath === '/') reqPath = '/index.html';

    // API endpoint for live media items
    if (reqPath === '/api/media') {
      const items = scanMediaFiles();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(items));
      return;
    }

    // Prevent path traversal outside project root
    const filePath = path.resolve(rootDir, reqPath.replace(/^[/\\]+/, ''));
    if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const range = req.headers.range;
      if (range && contentType.startsWith('video/')) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (!match) {
          res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
          res.end();
          return;
        }
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), stats.size - 1) : stats.size - 1;
        if (isNaN(start) || isNaN(end) || start < 0 || start >= stats.size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
          res.end();
          return;
        }
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        file.on('error', () => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        file.pipe(res);
      } else {
        const file = fs.createReadStream(filePath);
        file.on('error', () => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': contentType,
          'Cache-Control': reqPath.includes('manifest.') ? 'no-cache, no-store, must-revalidate' : 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        file.pipe(res);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Portal Display Aktif di: http://localhost:${PORT}/`);
    console.log(`📂 Folder Media Dipantau: ${MEDIA_DIR}`);
    console.log(`✨ Silakan tambahkan file foto/video ke folder media/`);
    console.log(`   Web akan otomatis menampilkan konten baru!`);
    console.log(`======================================================\n`);
  });
}

// Initial update
updateManifest();

const args = process.argv.slice(2);
if (args.includes('--once')) {
  process.exit(0);
} else {
  startWatcher();
  if (args.includes('--serve') || !args.includes('--no-serve')) {
    startServer();
  }
}
