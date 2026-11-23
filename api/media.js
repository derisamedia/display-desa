const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov']);

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

function formatTitle(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  if (/^\d+$/.test(base)) {
    return `Poster Layanan #${base}`;
  }
  if (base.toLowerCase().includes('snapgram')) {
    return 'Video Layanan Publik';
  }
  if (base.toLowerCase().startsWith('whatsapp image')) {
    return 'Foto Layanan • ' + base.replace(/^whatsapp image /i, '').replace(/ at /i, ' ');
  }
  if (/^[0-9_n]+$/.test(base) || base.length > 30) {
    return 'Informasi Layanan Publik';
  }
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = (req, res) => {
  try {
    const mediaDir = path.join(process.cwd(), 'media');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Check if manifest.json already exists
    const manifestPath = path.join(mediaDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      return res.status(200).send(content);
    }

    if (!fs.existsSync(mediaDir)) {
      return res.status(200).json([]);
    }

    const files = fs.readdirSync(mediaDir);
    const items = [];

    for (const file of files) {
      if (file === 'manifest.json' || file === 'manifest.js' || file === 'order.json' || file.startsWith('.') || file.startsWith('~$')) continue;
      const ext = path.extname(file).toLowerCase();
      const isImage = IMAGE_EXTENSIONS.has(ext);
      const isVideo = VIDEO_EXTENSIONS.has(ext);
      if (!isImage && !isVideo) continue;

      const fullPath = path.join(mediaDir, file);
      let stats;
      try {
        stats = fs.statSync(fullPath);
        if (!stats.isFile()) continue;
      } catch (_) {
        continue;
      }

      const meta = KNOWN_METADATA[file] || {};
      items.push({
        id: 'media-' + crypto.createHash('md5').update(file).digest('hex').slice(0, 12),
        filename: file,
        type: isVideo ? 'video' : 'image',
        src: 'media/' + file,
        title: meta.title || formatTitle(file),
        desc: meta.desc || (isVideo ? 'Video informasi display' : 'Foto poster display informasi'),
        size: stats.size,
        updatedAt: stats.mtimeMs
      });
    }

    let customOrder = [];
    const orderFilePath = path.join(mediaDir, 'order.json');
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

    const defaultKeys = Object.keys(KNOWN_METADATA);
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

      const idxA = defaultKeys.indexOf(a.filename);
      const idxB = defaultKeys.indexOf(b.filename);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      if (a.type !== b.type) {
        return a.type === 'image' ? -1 : 1;
      }
      return a.filename.localeCompare(b.filename, 'id', { numeric: true, sensitivity: 'base' });
    });

    items.forEach((item, index) => {
      item.order = index;
    });

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
