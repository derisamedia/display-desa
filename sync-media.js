const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PORT = 3000;
const MEDIA_DIR = path.join(__dirname, 'media');
const MANIFEST_JSON_PATH = path.join(MEDIA_DIR, 'manifest.json');
const MANIFEST_JS_PATH = path.join(MEDIA_DIR, 'manifest.js');

// Known default descriptions and titles for default files
const KNOWN_METADATA = {
  '847287402_18109332539213351_4384306797872519912_n.jpg': {
    title: 'Apa Yang Berbeda Dalam Perlinsos?',
    desc: 'Dua formulir sanggahan: Form Sanggah Singkat & Form DTSEN'
  },
  '847939110_18109332530213351_4722421588133763099_n.jpg': {
    title: 'Data Kamu Tidak Sesuai?',
    desc: 'Panduan pengajuan sanggahan resmi melalui Portal Perlinsos'
  },
  '848026564_18109332548213351_8016544548393381962_n.jpg': {
    title: 'Bagaimana Mengetahui Apa Yang Perlu Disanggah?',
    desc: 'Cek alasan tidak layak dan periksa kesesuaian data kondisi sebenarnya'
  },
  '848439103_18109332575213351_3066274871475878244_n.jpg': {
    title: 'Hasil Perlinsos Belum Sesuai Kondisi Kamu?',
    desc: 'Informasi hak sanggah dan peninjauan kesejahteraan masyarakat'
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

  for (const file of files) {
    if (file === 'manifest.json' || file === 'manifest.js') continue;

    const ext = path.extname(file).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isVideo = VIDEO_EXTENSIONS.has(ext);

    if (!isImage && !isVideo) continue;

    const fullPath = path.join(MEDIA_DIR, file);
    const stats = fs.statSync(fullPath);

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

  // Sort: Known defaults first (in original order), then other files by modification time
  const defaultKeys = Object.keys(KNOWN_METADATA);
  items.sort((a, b) => {
    const idxA = defaultKeys.indexOf(a.filename);
    const idxB = defaultKeys.indexOf(b.filename);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return b.updatedAt - a.updatedAt;
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
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';

    // API endpoint for live media items
    if (reqPath === '/api/media') {
      const items = scanMediaFiles();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(items));
      return;
    }

    const filePath = path.join(__dirname, reqPath);
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
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
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
