/**
 * PORTAL DISPLAY LAYANAN • SMART MEDIA SIGNAGE & DISPLAY SYSTEM
 * Modern Vanilla JavaScript Architecture
 */

// ===================================================================
// DEFAULT MEDIA ITEMS
// ===================================================================
const DEFAULT_MEDIA = [
  {
    id: 'def-1',
    type: 'image',
    src: 'media/847287402_18109332539213351_4384306797872519912_n.jpg',
    title: 'Apa Yang Berbeda Dalam Perlinsos?',
    desc: 'Dua formulir sanggahan: Form Sanggah Singkat & Form DTSEN'
  },
  {
    id: 'def-2',
    type: 'image',
    src: 'media/847939110_18109332530213351_4722421588133763099_n.jpg',
    title: 'Data Kamu Tidak Sesuai?',
    desc: 'Panduan pengajuan sanggahan resmi melalui Portal Perlinsos'
  },
  {
    id: 'def-3',
    type: 'image',
    src: 'media/848026564_18109332548213351_8016544548393381962_n.jpg',
    title: 'Bagaimana Mengetahui Apa Yang Perlu Disanggah?',
    desc: 'Cek alasan tidak layak dan periksa kesesuaian data kondisi sebenarnya'
  },
  {
    id: 'def-4',
    type: 'image',
    src: 'media/848439103_18109332575213351_3066274871475878244_n.jpg',
    title: 'Hasil Perlinsos Belum Sesuai Kondisi Kamu?',
    desc: 'Informasi hak sanggah dan peninjauan kesejahteraan masyarakat'
  },
  {
    id: 'def-video-1',
    type: 'video',
    src: 'media/snapgram.io_oe949efymsiu.mp4',
    title: 'Video Display Informasi Layanan Publik 1',
    desc: 'Tayangan video profil edukasi dan panduan informasi digital'
  },
  {
    id: 'def-video-2',
    type: 'video',
    src: 'media/snapgram.io_svfnjhtqwfju.mp4',
    title: 'Video Display Informasi Layanan Publik 2',
    desc: 'Tayangan video profil edukasi dan panduan informasi digital'
  },
  {
    id: 'def-web-cuaca',
    type: 'web',
    src: 'https://siaga112.bogorkab.go.id/cuaca-kecamatan',
    title: 'Prakiraan Cuaca 40 Kecamatan',
    desc: 'Live Cuaca BMKG Kabupaten Bogor • Portal Siaga 112',
    duration: 20000
  }
];

// ===================================================================
// MEDIA PATH RESOLVER & AUTO-HEAL
// ===================================================================
function resolveMediaPath(src) {
  if (!src) return '';
  if (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  ) {
    return src;
  }
  let clean = src.replace(/^(\.\/)?/, '');
  if (!clean.startsWith('media/')) {
    clean = 'media/' + clean;
  }
  return clean;
}

// ===================================================================
// INDEXED-DB MEDIA REPOSITORY (FOR USER UPLOAD PERSISTENCE)
// ===================================================================
const DB_NAME = 'PortalDisplayDB';
const DB_VERSION = 3;
const STORE_NAME = 'mediaItems';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getInitialMediaItems() {
  const list = [];
  const addedSrcs = new Set();

  // If manifest exists (from manifest.js or server), populate from manifest
  if (Array.isArray(window.__MEDIA_MANIFEST__) && window.__MEDIA_MANIFEST__.length > 0) {
    window.__MEDIA_MANIFEST__.forEach(item => {
      const src = resolveMediaPath(item.src || ('media/' + item.filename));
      if (src && !addedSrcs.has(src)) {
        addedSrcs.add(src);
        list.push({
          id: item.id || ('media-' + (item.filename || Math.random().toString(36).substr(2, 6))),
          type: item.type || (src.endsWith('.mp4') || src.endsWith('.webm') ? 'video' : 'image'),
          src: src,
          title: item.title || 'Informasi Layanan',
          desc: item.desc || (item.type === 'video' ? 'Video informasi display' : 'Foto poster display informasi')
        });
      }
    });
  }

  // Ensure any DEFAULT_MEDIA not yet in list is included
  DEFAULT_MEDIA.forEach(def => {
    const src = resolveMediaPath(def.src);
    if (!addedSrcs.has(src)) {
      addedSrcs.add(src);
      list.push({ ...def, src });
    }
  });

  return list;
}

async function loadSavedMedia() {
  const baseDefaults = getInitialMediaItems();
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        let items = req.result;
        if (items && items.length > 0) {
          let hasModifications = false;
          // Heal paths
          items = items.map(item => {
            const defItem = baseDefaults.find(d => d.id === item.id || d.src === item.src);
            if (defItem) {
              if (item.src !== defItem.src) {
                hasModifications = true;
                return { ...item, src: defItem.src };
              }
              return item;
            }
            const resolved = resolveMediaPath(item.src);
            if (resolved !== item.src) {
              hasModifications = true;
              return { ...item, src: resolved };
            }
            return item;
          });

          // Filter out any stale local media files that no longer exist in the media manifest
          const validSrcs = new Set(baseDefaults.map(d => resolveMediaPath(d.src)));
          const preFilterCount = items.length;
          items = items.filter(item => {
            const src = resolveMediaPath(item.src);
            if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
              return true;
            }
            return validSrcs.has(src);
          });
          if (items.length !== preFilterCount) {
            hasModifications = true;
          }

          // Merge any new files from manifest that aren't in IndexedDB yet
          const existingSrcs = new Set(items.map(i => resolveMediaPath(i.src)));
          baseDefaults.forEach(def => {
            if (!existingSrcs.has(def.src)) {
              items.push(def);
              existingSrcs.add(def.src);
              hasModifications = true;
            }
          });

          if (hasModifications) {
            saveMediaToDB(items);
          }
          resolve(items);
        } else {
          saveMediaToDB(baseDefaults);
          resolve(baseDefaults);
        }
      };
      req.onerror = () => resolve(baseDefaults);
    });
  } catch (err) {
    console.warn('IndexedDB not available, fallback to defaults:', err);
    return baseDefaults;
  }
}

async function saveMediaToDB(mediaList) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      mediaList.forEach(item => store.put(item));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save to IndexedDB:', err);
  }
}

// ===================================================================
// APPLICATION STATE
// ===================================================================
const state = {
  media: [],
  currentIndex: 0,
  isPlaying: true,
  isMuted: true,
  fitMode: 'contain', // Default Fit Penuh (contain) agar seluruh gambar dan teks poster terlihat utuh
  aspectRatio: 'full', // Default true edge-to-edge fullscreen
  slideDuration: 7000, // milliseconds for image
  webSlideDuration: 20000, // milliseconds for web page / iframe
  transitionEffect: 'fade', // 'fade', 'zoom', 'slide'
  activeView: 'slideshow', // 'slideshow' or 'grid'
  galleryFilter: 'all',
  
  // Timers & RAF
  slideTimer: null,
  slideStartTime: null,
  rafId: null,
  
  // Idle Auto-HUD
  idleTimer: null,
  idleDelay: 3500,
  isHudHidden: false,

  // Settings
  showClock: true,
  showTicker: true,
  tickerText: '✦ Selamat Datang di Layanan Display Informasi Publik ✦ Cek status kelayakan Perlinsos dan gunakan form sanggahan sesuai kebutuhan data Anda ✦ Layanan dibuka setiap hari kerja ✦ Tetap jaga ketertiban dan kenyamanan bersama ✦'
};

// ===================================================================
// DOM ELEMENTS
// ===================================================================
const elements = {
  app: document.getElementById('app'),
  topHeader: document.getElementById('topHeader'),
  slideshowStage: document.getElementById('slideshowStage'),
  reelsFrame: document.getElementById('reelsFrame'),
  mediaContainer: document.getElementById('mediaContainer'),
  ambientBackdrop: document.getElementById('ambientBackdrop'),
  ambientMedia: document.getElementById('ambientMedia'),
  reelsStoryBars: document.getElementById('reelsStoryBars'),
  gridGalleryView: document.getElementById('gridGalleryView'),
  galleryGrid: document.getElementById('galleryGrid'),
  runningTicker: document.getElementById('runningTicker'),
  tickerContent: document.getElementById('tickerContent'),
  
  // Clock
  dateTimeWidget: document.getElementById('dateTimeWidget'),
  clockTime: document.getElementById('clockTime'),
  clockDate: document.getElementById('clockDate'),

  // Controls & Metadata
  currentTypePill: document.getElementById('currentTypePill'),
  currentTypeIcon: document.getElementById('currentTypeIcon'),
  currentTypeName: document.getElementById('currentTypeName'),
  currentMediaTitle: document.getElementById('currentMediaTitle'),
  currentMediaDesc: document.getElementById('currentMediaDesc'),
  counterCurrent: document.getElementById('counterCurrent'),
  counterTotal: document.getElementById('counterTotal'),
  slideTimerFill: document.getElementById('slideTimerFill'),
  fitModeLabel: document.getElementById('fitModeLabel'),

  // Playback Buttons (Bottom Dock)
  btnPlayPause: document.getElementById('btnPlayPause'),
  iconPlay: document.getElementById('iconPlay'),
  iconPause: document.getElementById('iconPause'),
  btnToggleMute: document.getElementById('btnToggleMute'),
  iconSoundOn: document.getElementById('iconSoundOn'),
  iconSoundMute: document.getElementById('iconSoundMute'),
  btnToggleFit: document.getElementById('btnToggleFit'),
  btnPrevSlide: document.getElementById('btnPrevSlide'),
  btnNextSlide: document.getElementById('btnNextSlide'),
  btnToggleFullscreen: document.getElementById('btnToggleFullscreen'),
  fsIconExpand: document.getElementById('fsIconExpand'),
  fsIconCompress: document.getElementById('fsIconCompress'),

  // Reels Side Action Buttons
  btnSideMute: document.getElementById('btnSideMute'),
  iconSideSoundOn: document.getElementById('iconSideSoundOn'),
  iconSideSoundMute: document.getElementById('iconSideSoundMute'),
  btnSidePlayPause: document.getElementById('btnSidePlayPause'),
  iconSidePlay: document.getElementById('iconSidePlay'),
  iconSidePause: document.getElementById('iconSidePause'),
  btnSideFit: document.getElementById('btnSideFit'),
  sideFitCaption: document.getElementById('sideFitCaption'),
  btnSideOpenWeb: document.getElementById('btnSideOpenWeb'),

  // Aspect Ratio Buttons
  btnRatio916: document.getElementById('btnRatio916'),
  btnRatio169: document.getElementById('btnRatio169'),
  btnRatioFull: document.getElementById('btnRatioFull'),

  // View Mode Buttons
  btnViewSlideshow: document.getElementById('btnViewSlideshow'),
  btnViewGrid: document.getElementById('btnViewGrid'),
  btnLaunchSlideshow: document.getElementById('btnLaunchSlideshow'),

  // Modals
  addMediaModal: document.getElementById('addMediaModal'),
  btnAddMedia: document.getElementById('btnAddMedia'),
  btnCloseAddMedia: document.getElementById('btnCloseAddMedia'),
  addMediaBackdrop: document.getElementById('addMediaBackdrop'),
  uploadDropzone: document.getElementById('uploadDropzone'),
  mediaFileInput: document.getElementById('mediaFileInput'),
  btnBrowseFiles: document.getElementById('btnBrowseFiles'),
  uploadFileListPreview: document.getElementById('uploadFileListPreview'),
  urlMediaForm: document.getElementById('urlMediaForm'),
  urlType: document.getElementById('urlType'),
  urlMediaLink: document.getElementById('urlMediaLink'),
  urlMediaTitle: document.getElementById('urlMediaTitle'),
  urlMediaDuration: document.getElementById('urlMediaDuration'),
  groupWebDuration: document.getElementById('groupWebDuration'),
  btnApplyCuacaPreset: document.getElementById('btnApplyCuacaPreset'),

  settingsModal: document.getElementById('settingsModal'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  settingsBackdrop: document.getElementById('settingsBackdrop'),
  settingDuration: document.getElementById('settingDuration'),
  settingWebDuration: document.getElementById('settingWebDuration'),
  settingTransition: document.getElementById('settingTransition'),
  settingFitMode: document.getElementById('settingFitMode'),
  toggleTickerSwitch: document.getElementById('toggleTickerSwitch'),
  customTickerInput: document.getElementById('customTickerInput'),
  toggleClockSwitch: document.getElementById('toggleClockSwitch'),
  settingsMediaList: document.getElementById('settingsMediaList'),
  settingsMediaCount: document.getElementById('settingsMediaCount'),
  btnResetMedia: document.getElementById('btnResetMedia'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),

  // Lightbox
  lightboxModal: document.getElementById('lightboxModal'),
  lightboxBackdrop: document.getElementById('lightboxBackdrop'),
  btnCloseLightbox: document.getElementById('btnCloseLightbox'),
  btnLightboxPrev: document.getElementById('btnLightboxPrev'),
  btnLightboxNext: document.getElementById('btnLightboxNext'),
  lightboxContentBox: document.getElementById('lightboxContentBox'),
  lightboxTitle: document.getElementById('lightboxTitle'),
  lightboxDesc: document.getElementById('lightboxDesc'),
  btnLightboxPlayFromHere: document.getElementById('btnLightboxPlayFromHere'),

  // Counters in Grid
  countAll: document.getElementById('countAll'),
  countPhotos: document.getElementById('countPhotos'),
  countVideos: document.getElementById('countVideos'),
  countWeb: document.getElementById('countWeb'),

  // Toast
  toastNotification: document.getElementById('toastNotification'),
  toastMessage: document.getElementById('toastMessage')
};

// ===================================================================
// INITIALIZATION
// ===================================================================
async function initApp() {
  loadStoredPreferences();
  state.media = await loadSavedMedia();
  
  // Guarantee all items have proper resolved media/ paths
  if (state.media && state.media.length > 0) {
    state.media = state.media.map(item => {
      const def = DEFAULT_MEDIA.find(d => d.id === item.id);
      if (def) return { ...item, src: def.src };
      return { ...item, src: resolveMediaPath(item.src) };
    });
    saveMediaToDB(state.media);
  }
  
  initClock();
  renderStoryBars();
  applyAspectRatio();
  initSlideshow();
  initGalleryGrid();
  initAutoHud();
  initEventListeners();
  initKeyboardShortcuts();
  initReelsGestures();

  applyTransitionClass();
  applyFitMode();
  updateMediaCounters();

  // Start continuous folder synchronization
  startLiveFolderSync();
}

// ===================================================================
// LIVE MEDIA FOLDER WATCHER & DYNAMIC DIRECTORY SCANNER
// ===================================================================
function formatMediaTitle(filename) {
  if (!filename) return 'Informasi Layanan';
  const parts = filename.split('.');
  if (parts.length > 1) parts.pop();
  let base = parts.join('.');
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

function syncMediaWithManifest(manifestItems, allowPartialMerge = false) {
  if (!Array.isArray(manifestItems) || manifestItems.length === 0) return;

  const validSrcs = new Set(manifestItems.map(item => resolveMediaPath(item.src || ('media/' + (item.filename || '')))));
  const originalCount = state.media.length;

  // 1. Remove deleted files (only if this is a complete manifest sync, not a partial discovery)
  if (!allowPartialMerge) {
    state.media = state.media.filter(item => {
      const src = resolveMediaPath(item.src);
      if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
        return true;
      }
      return validSrcs.has(src);
    });
  }
  const removedCount = originalCount - state.media.length;

  // 2. Add new files
  let addedCount = 0;
  const currentSrcs = new Set(state.media.map(m => resolveMediaPath(m.src)));

  manifestItems.forEach(item => {
    const filename = item.filename || (item.src ? item.src.split('/').pop() : '');
    const resolved = resolveMediaPath(item.src || ('media/' + filename));
    if (resolved && !currentSrcs.has(resolved)) {
      const isVideo = item.type === 'video' || /\.(mp4|webm|ogg|mov)$/i.test(resolved);
      state.media.push({
        id: item.id || ('auto-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)),
        type: isVideo ? 'video' : 'image',
        src: resolved,
        title: item.title || formatMediaTitle(filename),
        desc: item.desc || (isVideo ? 'Video informasi display' : 'Foto poster display informasi')
      });
      currentSrcs.add(resolved);
      addedCount++;
    }
  });

  if (addedCount > 0 || removedCount > 0) {
    if (state.currentIndex >= state.media.length) {
      state.currentIndex = 0;
    }
    saveMediaToDB(state.media);
    renderStoryBars();
    renderGalleryGrid();
    renderSettingsMediaList();
    updateMediaCounters();
    if (addedCount > 0) {
      showToast(`📢 ${addedCount} file media baru otomatis ditambahkan ke display!`);
    }
  }
}

let hasCheckedGitHubApi = false;

async function checkMediaFolderUpdates(isManualSync = false) {
  if (window.location.protocol.startsWith('http')) {
    // 1. Direct Live Server / Apache / Local HTTP Directory Listing Detection
    try {
      const dirRes = await fetch(`media/?_t=${Date.now()}`, { cache: 'no-store' });
      if (dirRes.ok) {
        const text = await dirRes.text();
        if (text.includes('<html') || text.includes('href=')) {
          const regex = /href=["']([^"']+\.(jpg|jpeg|png|webp|gif|svg|bmp|mp4|webm|ogg|mov))["']/gi;
          let match;
          const discovered = [];
          const seen = new Set();
          while ((match = regex.exec(text)) !== null) {
            const raw = match[1].split('?')[0].split('#')[0];
            const filename = decodeURIComponent(raw.split('/').pop().split('\\').pop());
            if (filename && !seen.has(filename) && filename !== '..' && filename !== '.') {
              seen.add(filename);
              const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(filename);
              discovered.push({
                id: 'media-' + filename.replace(/[^a-zA-Z0-9_-]/g, '_'),
                filename: filename,
                src: 'media/' + filename,
                type: isVideo ? 'video' : 'image',
                title: formatMediaTitle(filename),
                desc: isVideo ? 'Video informasi display' : 'Foto poster display informasi'
              });
            }
          }
          if (discovered.length > 0) {
            syncMediaWithManifest(discovered);
            return;
          }
        }
      }
    } catch (_) {}

    // 2. Try manifest.json
    try {
      const res = await fetch(`media/manifest.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const items = await res.json();
        syncMediaWithManifest(items);
        if (!window.location.hostname.endsWith('github.io')) {
          return;
        }
      }
    } catch (_) {}

    // 3. GitHub API (when running on GitHub Pages: run once on initial load or on manual sync)
    if (window.location.hostname.endsWith('github.io') && (!hasCheckedGitHubApi || isManualSync)) {
      hasCheckedGitHubApi = true;
      try {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const repo = pathParts[0];
        const user = window.location.hostname.split('.')[0];
        if (user && repo) {
          const ghRes = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/media?_t=${Date.now()}`, { cache: 'no-store' });
          if (ghRes.ok) {
            const ghFiles = await ghRes.json();
            if (Array.isArray(ghFiles)) {
              const items = ghFiles
                .filter(f => f.type === 'file' && /\.(jpg|jpeg|png|webp|gif|svg|bmp|mp4|webm|ogg|mov)$/i.test(f.name))
                .map(f => {
                  const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(f.name);
                  return {
                    id: 'media-' + f.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
                    filename: f.name,
                    src: 'media/' + f.name,
                    type: isVideo ? 'video' : 'image',
                    title: formatMediaTitle(f.name),
                    desc: isVideo ? 'Video informasi display' : 'Foto poster display informasi'
                  };
                });
              if (items.length > 0) {
                syncMediaWithManifest(items, true);
                return;
              }
            }
          }
        }
      } catch (_) {}
    }

    // 4. Vercel serverless /api/media
    try {
      if (!window.location.hostname.includes('github.io')) {
        const apiRes = await fetch(`api/media?_t=${Date.now()}`, { cache: 'no-store' });
        if (apiRes.ok) {
          const items = await apiRes.json();
          syncMediaWithManifest(items);
          return;
        }
      }
    } catch (_) {}
  }

  // Fallback for file:// protocol or static server: dynamically reload manifest.js
  reloadManifestScriptTag();
}

function reloadManifestScriptTag() {
  const oldScript = document.getElementById('manifestScript');
  const newScript = document.createElement('script');
  newScript.id = 'manifestScript';
  newScript.src = `media/manifest.js?_t=${Date.now()}`;
  newScript.onload = () => {
    if (Array.isArray(window.__MEDIA_MANIFEST__)) {
      syncMediaWithManifest(window.__MEDIA_MANIFEST__);
    }
  };
  if (oldScript && oldScript.parentNode) {
    oldScript.parentNode.replaceChild(newScript, oldScript);
  } else {
    document.head.appendChild(newScript);
  }
}

function startLiveFolderSync() {
  // Global callback triggered when manifest.js loads/reloads
  window.__onMediaManifestUpdated = (items) => {
    syncMediaWithManifest(items);
  };

  // Immediate check with currently loaded manifest
  if (Array.isArray(window.__MEDIA_MANIFEST__)) {
    syncMediaWithManifest(window.__MEDIA_MANIFEST__);
  }

  // Immediately trigger live folder scan
  checkMediaFolderUpdates();

  // Poll every 3 seconds for folder changes
  setInterval(checkMediaFolderUpdates, 3000);

  // Hook up sync button in modal
  const btnSync = document.getElementById('btnSyncFolderNow');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      btnSync.innerHTML = '🔄 Memindai Folder...';
      await checkMediaFolderUpdates(true);
      setTimeout(() => {
        btnSync.disabled = false;
        btnSync.innerHTML = '🔄 Sinkronkan Sekarang';
        showToast('Pemeriksaan folder media selesai.');
      }, 600);
    });
  }
}

// Load settings from localStorage
function loadStoredPreferences() {
  try {
    // Force default to 'full' and 'cover' for true edge-to-edge fullscreen
    let ratio = localStorage.getItem('display_ratio');
    if (!ratio || ratio === '9:16') {
      ratio = 'full';
      localStorage.setItem('display_ratio', 'full');
    }
    state.aspectRatio = ratio;

    const dur = localStorage.getItem('display_duration');
    if (dur) state.slideDuration = parseInt(dur, 10);

    const webDur = localStorage.getItem('display_web_duration');
    if (webDur) state.webSlideDuration = parseInt(webDur, 10);

    const trans = localStorage.getItem('display_transition');
    if (trans) state.transitionEffect = trans;

    let fit = localStorage.getItem('display_fit');
    if (!fit || localStorage.getItem('display_fit_v2') !== 'true') {
      fit = 'contain';
      localStorage.setItem('display_fit', 'contain');
      localStorage.setItem('display_fit_v2', 'true');
    }
    state.fitMode = fit;

    const tick = localStorage.getItem('display_ticker');
    if (tick !== null) state.showTicker = (tick === 'true');

    const tickText = localStorage.getItem('display_ticker_text');
    if (tickText) state.tickerText = tickText;

    const clk = localStorage.getItem('display_clock');
    if (clk !== null) state.showClock = (clk === 'true');

    // Sync input controls
    if (elements.settingDuration) elements.settingDuration.value = state.slideDuration;
    if (elements.settingWebDuration) elements.settingWebDuration.value = state.webSlideDuration;
    if (elements.settingTransition) elements.settingTransition.value = state.transitionEffect;
    if (elements.settingFitMode) elements.settingFitMode.value = state.fitMode;
    if (elements.toggleTickerSwitch) elements.toggleTickerSwitch.checked = state.showTicker;
    if (elements.customTickerInput) elements.customTickerInput.value = state.tickerText;
    if (elements.toggleClockSwitch) elements.toggleClockSwitch.checked = state.showClock;
    if (elements.tickerContent) elements.tickerContent.textContent = state.tickerText;

    if (!state.showTicker && elements.runningTicker) elements.runningTicker.classList.add('hidden');
    if (!state.showClock && elements.dateTimeWidget) elements.dateTimeWidget.classList.add('hidden');
  } catch (e) {
    console.warn('Preferences load error:', e);
  }
}

// ===================================================================
// ASPECT RATIO & REELS FRAME MANAGEMENT
// ===================================================================
function setAspectRatio(ratio) {
  state.aspectRatio = ratio;
  localStorage.setItem('display_ratio', ratio);
  applyAspectRatio();
  showToast(`Format: ${ratio === '9:16' ? '9:16 Reels Vertikal' : (ratio === '16:9' ? '16:9 Lanskap TV' : 'Layar Penuh')}`);
}

function applyAspectRatio() {
  const ratioClass = 'ratio-' + state.aspectRatio.replace(':', '-');
  if (elements.reelsFrame) {
    elements.reelsFrame.className = `reels-frame ${ratioClass}`;
  }

  // Update ratio buttons active state
  if (elements.btnRatio916) elements.btnRatio916.classList.toggle('active', state.aspectRatio === '9:16');
  if (elements.btnRatio169) elements.btnRatio169.classList.toggle('active', state.aspectRatio === '16:9');
  if (elements.btnRatioFull) elements.btnRatioFull.classList.toggle('active', state.aspectRatio === 'full');
}

// ===================================================================
// REELS / STORIES SEGMENTED PROGRESS BARS
// ===================================================================
function renderStoryBars() {
  if (!elements.reelsStoryBars) return;
  elements.reelsStoryBars.innerHTML = '';
  state.media.forEach((_, idx) => {
    const segment = document.createElement('div');
    segment.className = 'story-bar-segment';
    segment.dataset.index = idx;
    const prog = document.createElement('div');
    prog.className = 'story-bar-progress';
    segment.appendChild(prog);
    elements.reelsStoryBars.appendChild(segment);
  });
}

function updateStoryBars(currentProgressPct) {
  if (!elements.reelsStoryBars) return;
  const segments = elements.reelsStoryBars.querySelectorAll('.story-bar-segment');
  segments.forEach((seg, idx) => {
    const prog = seg.querySelector('.story-bar-progress');
    if (idx < state.currentIndex) {
      seg.classList.add('completed');
      if (prog) prog.style.width = '100%';
    } else if (idx === state.currentIndex) {
      seg.classList.remove('completed');
      if (prog) prog.style.width = `${currentProgressPct}%`;
    } else {
      seg.classList.remove('completed');
      if (prog) prog.style.width = '0%';
    }
  });
}

// ===================================================================
// SLIDESHOW ENGINE
// ===================================================================
function initSlideshow() {
  if (state.media.length === 0) return;
  renderSlide(state.currentIndex);
  if (state.isPlaying) {
    startSlideTimer();
  }
}

function renderSlide(index) {
  if (!state.media || state.media.length === 0) return;
  
  // Wrap around index
  if (index >= state.media.length) index = 0;
  if (index < 0) index = state.media.length - 1;
  state.currentIndex = index;

  const item = state.media[index];
  const resolvedSrc = resolveMediaPath(item.src);
  
  // Update Ambient Blurred Glow Backdrop
  if (elements.ambientMedia) {
    if (item.type === 'video') {
      elements.ambientMedia.style.backgroundImage = `url('media/847287402_18109332539213351_4384306797872519912_n.jpg')`;
    } else if (item.type === 'web') {
      elements.ambientMedia.style.backgroundImage = `linear-gradient(135deg, #0284c7 0%, #0f172a 50%, #047857 100%)`;
    } else {
      elements.ambientMedia.style.backgroundImage = `url('${resolvedSrc}')`;
    }
  }

  // Update Story Segments
  updateStoryBars(0);

  // Clear previous slides or fade them
  const prevSlide = elements.mediaContainer.querySelector('.slide-element.active');
  if (prevSlide) {
    prevSlide.classList.remove('active');
    prevSlide.classList.add('previous');
    setTimeout(() => {
      if (prevSlide && prevSlide.parentElement) {
        prevSlide.remove();
      }
    }, 900);
  }

  // Create new slide element
  const slideEl = document.createElement('div');
  slideEl.className = 'slide-element';
  slideEl.dataset.index = index;

  if (item.type === 'video') {
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-media-wrapper';

    const video = document.createElement('video');
    video.src = resolvedSrc;
    video.autoplay = true;
    video.muted = state.isMuted;
    video.playsInline = true;
    video.loop = false; // Advance to next slide when finished!
    video.className = 'slide-media';

    video.onerror = () => {
      const fn = (item.src || '').split('/').pop().split('\\').pop();
      if (!video.src.includes('media/' + fn)) {
        video.src = 'media/' + fn;
        return;
      }
      console.warn(`[Display] Video tidak ditemukan di disk: ${item.src}. Menghapus item.`);
      state.media = state.media.filter(m => m.id !== item.id && m.src !== item.src);
      saveMediaToDB(state.media);
      updateMediaCounters();
      renderStoryBars();
      renderGalleryGrid();
      renderSettingsMediaList();
      if (state.isPlaying && state.media.length > 0) {
        nextSlide();
      }
    };

    // When video ends, automatically go to next slide
    video.onended = () => {
      if (state.isPlaying) {
        nextSlide();
      }
    };

    // Update progress bar with video duration
    video.ontimeupdate = () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        elements.slideTimerFill.style.width = `${pct}%`;
        updateStoryBars(pct);
      }
    };

    videoWrapper.appendChild(video);
    slideEl.appendChild(videoWrapper);
  } else if (item.type === 'web') {
    // Web Page / Dashboard Iframe element
    const webWrapper = document.createElement('div');
    webWrapper.className = 'web-media-wrapper';

    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'web-loading-indicator';
    loadingSpinner.innerHTML = `
      <div class="web-spinner"></div>
      <div class="web-loading-text">Memuat Tampilan Web...</div>
      <div class="web-loading-sub">${item.title || resolvedSrc}</div>
    `;
    webWrapper.appendChild(loadingSpinner);

    const iframe = document.createElement('iframe');
    iframe.src = resolvedSrc;
    iframe.title = item.title || 'Web Display';
    iframe.className = 'slide-media web-media-iframe';
    iframe.setAttribute('allow', 'fullscreen; autoplay');
    iframe.setAttribute('loading', 'eager');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');

    iframe.onload = () => {
      loadingSpinner.style.opacity = '0';
      setTimeout(() => {
        if (loadingSpinner.parentNode) loadingSpinner.remove();
      }, 350);
    };

    iframe.onerror = () => {
      loadingSpinner.innerHTML = `
        <div class="web-loading-text" style="color: var(--accent-rose);">Halaman Web Tidak Dapat Dimuat Langsung</div>
        <div class="web-loading-sub">${resolvedSrc}</div>
        <a href="${resolvedSrc}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="margin-top: 10px; display: inline-block;">Buka di Tab Baru</a>
      `;
    };

    webWrapper.appendChild(iframe);
    slideEl.appendChild(webWrapper);
  } else {
    // Image element
    const img = document.createElement('img');
    img.src = resolvedSrc;
    img.alt = item.title || 'Display Media';
    img.className = 'slide-media';
    img.loading = 'eager';
    img.onerror = () => {
      const fn = (item.src || '').split('/').pop().split('\\').pop();
      if (!img.src.includes('media/' + fn)) {
        img.src = 'media/' + fn;
        return;
      }
      console.warn(`[Display] File gambar tidak ditemukan di disk: ${item.src}. Menghapus item.`);
      state.media = state.media.filter(m => m.id !== item.id && m.src !== item.src);
      saveMediaToDB(state.media);
      updateMediaCounters();
      renderStoryBars();
      renderGalleryGrid();
      renderSettingsMediaList();
      if (state.isPlaying && state.media.length > 0) {
        nextSlide();
      }
    };
    slideEl.appendChild(img);
  }

  elements.mediaContainer.appendChild(slideEl);

  // Force reflow for smooth transition
  void slideEl.offsetWidth;
  slideEl.classList.add('active');

  // Update UI Metadata
  updateSlideMetadata(item, index);
}

function updateSlideMetadata(item, index) {
  elements.currentMediaTitle.textContent = item.title || 'Informasi Layanan';
  elements.currentMediaDesc.textContent = item.desc || 'Display Visual Digital';
  elements.counterCurrent.textContent = String(index + 1).padStart(2, '0');
  elements.counterTotal.textContent = String(state.media.length).padStart(2, '0');

  if (item.type === 'video') {
    elements.currentTypePill.className = 'reels-type-badge type-video';
    elements.currentTypeName.textContent = 'VIDEO';
    elements.currentTypeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    elements.btnToggleMute.classList.remove('hidden');
    if (elements.btnSideOpenWeb) elements.btnSideOpenWeb.classList.add('hidden');
  } else if (item.type === 'web') {
    elements.currentTypePill.className = 'reels-type-badge type-web';
    elements.currentTypeName.textContent = 'WEB';
    elements.currentTypeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    elements.btnToggleMute.classList.add('hidden');
    if (elements.btnSideOpenWeb) {
      elements.btnSideOpenWeb.classList.remove('hidden');
      elements.btnSideOpenWeb.href = resolveMediaPath(item.src);
    }
  } else {
    elements.currentTypePill.className = 'reels-type-badge';
    elements.currentTypeName.textContent = 'FOTO';
    elements.currentTypeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    elements.btnToggleMute.classList.add('hidden');
    if (elements.btnSideOpenWeb) elements.btnSideOpenWeb.classList.add('hidden');
  }
}

// Timer Loop for Slideshow
function startSlideTimer() {
  clearSlideTimer();
  const currentItem = state.media[state.currentIndex];
  
  // If current item is video, the video's 'ended' event controls progression
  if (currentItem && currentItem.type === 'video') {
    elements.slideTimerFill.style.width = '0%';
    const activeVideo = elements.mediaContainer.querySelector('video');
    if (activeVideo && activeVideo.paused) {
      activeVideo.play().catch(e => console.log('Autoplay policy caught:', e));
    }
    return;
  }

  // Duration for current item:
  // Can be item-specific (item.duration), or if web -> state.webSlideDuration, else state.slideDuration
  const itemDuration = (currentItem && currentItem.duration)
    ? currentItem.duration
    : (currentItem && currentItem.type === 'web' ? (state.webSlideDuration || 20000) : state.slideDuration);

  state.slideStartTime = performance.now();

  function progressLoop(now) {
    if (!state.isPlaying) return;
    const elapsed = now - state.slideStartTime;
    const progress = Math.min((elapsed / itemDuration) * 100, 100);
    elements.slideTimerFill.style.width = `${progress}%`;
    updateStoryBars(progress);

    if (elapsed >= itemDuration) {
      nextSlide();
    } else {
      state.rafId = requestAnimationFrame(progressLoop);
    }
  }

  state.rafId = requestAnimationFrame(progressLoop);
}

function clearSlideTimer() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  elements.slideTimerFill.style.width = '0%';
}

function nextSlide() {
  clearSlideTimer();
  let nextIdx = state.currentIndex + 1;
  if (nextIdx >= state.media.length) nextIdx = 0;
  renderSlide(nextIdx);
  if (state.isPlaying) {
    startSlideTimer();
  }
}

function prevSlide() {
  clearSlideTimer();
  let prevIdx = state.currentIndex - 1;
  if (prevIdx < 0) prevIdx = state.media.length - 1;
  renderSlide(prevIdx);
  if (state.isPlaying) {
    startSlideTimer();
  }
}

function togglePlayPause() {
  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) {
    elements.iconPlay.classList.add('hidden');
    elements.iconPause.classList.remove('hidden');
    if (elements.iconSidePlay) elements.iconSidePlay.classList.add('hidden');
    if (elements.iconSidePause) elements.iconSidePause.classList.remove('hidden');
    showToast('Display Otomatis: Berjalan');
    const activeVideo = elements.mediaContainer.querySelector('video');
    if (activeVideo) activeVideo.play().catch(console.warn);
    startSlideTimer();
  } else {
    elements.iconPlay.classList.remove('hidden');
    elements.iconPause.classList.add('hidden');
    if (elements.iconSidePlay) elements.iconSidePlay.classList.remove('hidden');
    if (elements.iconSidePause) elements.iconSidePause.classList.add('hidden');
    showToast('Display Otomatis: Dijeda');
    const activeVideo = elements.mediaContainer.querySelector('video');
    if (activeVideo) activeVideo.pause();
    clearSlideTimer();
  }
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  const activeVideo = elements.mediaContainer.querySelector('video');
  if (activeVideo) {
    activeVideo.muted = state.isMuted;
  }
  if (state.isMuted) {
    elements.iconSoundOn.classList.add('hidden');
    elements.iconSoundMute.classList.remove('hidden');
    if (elements.iconSideSoundOn) elements.iconSideSoundOn.classList.add('hidden');
    if (elements.iconSideSoundMute) elements.iconSideSoundMute.classList.remove('hidden');
    showToast('Suara Video: Dibisukan (Muted)');
  } else {
    elements.iconSoundOn.classList.remove('hidden');
    elements.iconSoundMute.classList.add('hidden');
    if (elements.iconSideSoundOn) elements.iconSideSoundOn.classList.remove('hidden');
    if (elements.iconSideSoundMute) elements.iconSideSoundMute.classList.add('hidden');
    showToast('Suara Video: Aktif');
  }
}

function toggleFitMode() {
  state.fitMode = (state.fitMode === 'cover') ? 'contain' : 'cover';
  applyFitMode();
  if (elements.sideFitCaption) {
    elements.sideFitCaption.textContent = state.fitMode === 'cover' ? 'Penuh' : 'Fit';
  }
  showToast(`Mode Tampilan: ${state.fitMode === 'cover' ? 'Fullscreen Penuh (Tanpa Frame)' : 'Fit Layar'}`);
  localStorage.setItem('display_fit', state.fitMode);
}

function applyFitMode() {
  if (state.fitMode === 'contain') {
    elements.app.classList.add('fit-contain');
    elements.app.classList.remove('fit-cover');
    elements.fitModeLabel.textContent = 'Fit';
    if (elements.sideFitCaption) elements.sideFitCaption.textContent = 'Fit';
  } else {
    elements.app.classList.remove('fit-contain');
    elements.app.classList.add('fit-cover');
    elements.fitModeLabel.textContent = 'Fullscreen';
    if (elements.sideFitCaption) elements.sideFitCaption.textContent = 'Penuh';
  }
}

function applyTransitionClass() {
  elements.mediaContainer.classList.remove('transition-fade', 'transition-zoom', 'transition-slide');
  elements.mediaContainer.classList.add(`transition-${state.transitionEffect}`);
}

// ===================================================================
// AUTO-HUD: HIDES CONTROLS ON IDLE IN SLIDESHOW MODE (FOR CLEAN TV)
// ===================================================================
function initAutoHud() {
  function resetIdleTimer() {
    if (state.isHudHidden) {
      elements.app.classList.remove('controls-hidden');
      state.isHudHidden = false;
    }

    clearTimeout(state.idleTimer);

    // Only auto-hide if in slideshow view and no modal is active
    if (state.activeView === 'slideshow' && !isAnyModalOpen()) {
      state.idleTimer = setTimeout(() => {
        elements.app.classList.add('controls-hidden');
        state.isHudHidden = true;
      }, state.idleDelay);
    }
  }

  // Activity listeners
  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  resetIdleTimer();
}

function isAnyModalOpen() {
  return !elements.settingsModal.classList.contains('hidden') ||
         !elements.addMediaModal.classList.contains('hidden') ||
         !elements.lightboxModal.classList.contains('hidden');
}

// ===================================================================
// GRID GALLERY VIEW
// ===================================================================
function initGalleryGrid() {
  renderGalleryGrid();
}

function renderGalleryGrid() {
  elements.galleryGrid.innerHTML = '';

  const filter = state.galleryFilter;
  const filtered = state.media.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  filtered.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.index = index;

    const resolvedSrc = resolveMediaPath(item.src);
    let thumbHtml = '';
    if (item.type === 'video') {
      thumbHtml = `
        <div class="card-thumb-wrapper">
          <video class="card-thumb" src="${resolvedSrc}#t=1" preload="metadata" onerror="const f=this.getAttribute('src').split('/').pop();if(!this.src.includes('media/'+f))this.src='media/'+f;"></video>
          <div class="card-type-tag tag-video">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            VIDEO
          </div>
          <div class="card-play-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      `;
    } else if (item.type === 'web') {
      const cleanUrl = resolvedSrc.replace(/^https?:\/\//, '');
      thumbHtml = `
        <div class="card-thumb-wrapper">
          <div class="card-thumb card-thumb-web">
            <div class="web-mockup-bar">
              <span class="web-mockup-dots"><i></i><i></i><i></i></span>
              <span class="web-mockup-url">${cleanUrl}</span>
            </div>
            <div class="web-mockup-content">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--accent-cyan);"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <div class="web-mockup-title">${item.title}</div>
              <div class="web-mockup-badge">LIVE WEB DASHBOARD</div>
            </div>
          </div>
          <div class="card-type-tag tag-web">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            WEB
          </div>
          <div class="card-play-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      `;
    } else {
      thumbHtml = `
        <div class="card-thumb-wrapper">
          <img class="card-thumb" src="${resolvedSrc}" alt="${item.title}" loading="lazy" onerror="const f=this.getAttribute('src').split('/').pop();if(!this.src.includes('media/'+f))this.src='media/'+f;">
          <div class="card-type-tag">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            FOTO
          </div>
          <div class="card-play-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      ${thumbHtml}
      <div class="card-info">
        <h4 class="card-title">${item.title}</h4>
        <p class="card-desc">${item.desc}</p>
      </div>
    `;

    card.addEventListener('click', () => {
      openLightbox(state.media.indexOf(item));
    });

    elements.galleryGrid.appendChild(card);
  });
}

function updateMediaCounters() {
  const allCount = state.media.length;
  const photoCount = state.media.filter(m => m.type === 'image').length;
  const videoCount = state.media.filter(m => m.type === 'video').length;
  const webCount = state.media.filter(m => m.type === 'web').length;

  if (elements.countAll) elements.countAll.textContent = allCount;
  if (elements.countPhotos) elements.countPhotos.textContent = photoCount;
  if (elements.countVideos) elements.countVideos.textContent = videoCount;
  if (elements.countWeb) elements.countWeb.textContent = webCount;
  if (elements.settingsMediaCount) elements.settingsMediaCount.textContent = `${allCount} Item`;
}

// ===================================================================
// LIGHTBOX VIEWER
// ===================================================================
let lightboxIndex = 0;

function openLightbox(index) {
  lightboxIndex = index;
  renderLightboxItem();
  elements.lightboxModal.classList.remove('hidden');
}

function closeLightbox() {
  elements.lightboxModal.classList.add('hidden');
  const lbVideo = elements.lightboxContentBox.querySelector('video');
  if (lbVideo) lbVideo.pause();
}

function renderLightboxItem() {
  const item = state.media[lightboxIndex];
  if (!item) return;

  elements.lightboxContentBox.innerHTML = '';
  elements.lightboxTitle.textContent = item.title;
  elements.lightboxDesc.textContent = item.desc;

  const resolvedSrc = resolveMediaPath(item.src);
  if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = resolvedSrc;
    video.controls = true;
    video.autoplay = true;
    video.className = 'lightbox-media';
    video.onerror = () => {
      const fn = (item.src || '').split('/').pop().split('\\').pop();
      if (!video.src.includes('media/' + fn)) video.src = 'media/' + fn;
    };
    elements.lightboxContentBox.appendChild(video);
  } else if (item.type === 'web') {
    const webContainer = document.createElement('div');
    webContainer.className = 'lightbox-web-container';
    webContainer.innerHTML = `
      <div class="lightbox-web-toolbar">
        <span class="web-url-text">${resolvedSrc}</span>
        <a href="${resolvedSrc}" target="_blank" rel="noopener noreferrer" class="btn-subtle" style="font-size: 0.78rem;">
          Buka Tab Baru ↗
        </a>
      </div>
      <iframe src="${resolvedSrc}" class="lightbox-web-iframe" allow="fullscreen; autoplay"></iframe>
    `;
    elements.lightboxContentBox.appendChild(webContainer);
  } else {
    const img = document.createElement('img');
    img.src = resolvedSrc;
    img.alt = item.title;
    img.className = 'lightbox-media';
    img.onerror = () => {
      const fn = (item.src || '').split('/').pop().split('\\').pop();
      if (!img.src.includes('media/' + fn)) img.src = 'media/' + fn;
    };
    elements.lightboxContentBox.appendChild(img);
  }
}

function nextLightbox() {
  lightboxIndex++;
  if (lightboxIndex >= state.media.length) lightboxIndex = 0;
  renderLightboxItem();
}

function prevLightbox() {
  lightboxIndex--;
  if (lightboxIndex < 0) lightboxIndex = state.media.length - 1;
  renderLightboxItem();
}

// ===================================================================
// ADD MEDIA (UPLOAD & URL)
// ===================================================================
let stagedFiles = [];

function handleFileSelection(files) {
  Array.from(files).forEach(file => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      showToast('Hanya mendukung format foto atau video!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const newItem = {
        id: 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: isVideo ? 'video' : 'image',
        src: e.target.result, // base64 Data URL stored persistently in IndexedDB
        title: file.name.replace(/\.[^/.]+$/, ""),
        desc: `File ${isVideo ? 'Video' : 'Foto'} diunggah pengguna`
      };

      state.media.push(newItem);
      saveMediaToDB(state.media);
      updateMediaCounters();
      renderGalleryGrid();
      renderSettingsMediaList();
      showToast(`Berhasil menambahkan: ${newItem.title}`);
    };
    reader.readAsDataURL(file);
  });

  closeAddMediaModal();
}

function handleUrlMediaSubmission(e) {
  e.preventDefault();
  const type = elements.urlType.value;
  const url = elements.urlMediaLink.value.trim();
  const title = elements.urlMediaTitle.value.trim() || (type === 'web' ? 'Halaman Web Display' : 'Media Tautan Web');
  const duration = (type === 'web' && elements.urlMediaDuration) ? parseInt(elements.urlMediaDuration.value, 10) : undefined;

  if (!url) return;

  const newItem = {
    id: 'url-' + Date.now(),
    type: type,
    src: url,
    title: title,
    desc: type === 'web' ? 'Tautan live web dashboard' : 'Tautan media online'
  };
  if (duration) {
    newItem.duration = duration;
  }

  state.media.push(newItem);
  saveMediaToDB(state.media);
  updateMediaCounters();
  renderGalleryGrid();
  renderSettingsMediaList();

  elements.urlMediaLink.value = '';
  elements.urlMediaTitle.value = '';
  closeAddMediaModal();
  showToast(`${type === 'web' ? 'Halaman Web' : 'Media'} baru berhasil ditambahkan ke display!`);
}

function openAddMediaModal() {
  elements.addMediaModal.classList.remove('hidden');
}

function closeAddMediaModal() {
  elements.addMediaModal.classList.add('hidden');
}

// ===================================================================
// SETTINGS MODAL
// ===================================================================
function openSettingsModal() {
  renderSettingsMediaList();
  elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  elements.settingsModal.classList.add('hidden');
}

function renderSettingsMediaList() {
  elements.settingsMediaList.innerHTML = '';
  state.media.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'settings-media-item';

    const resolvedSrc = resolveMediaPath(item.src);
    const isVideo = item.type === 'video';
    const isWeb = item.type === 'web';
    
    let thumbHtml = '';
    if (isWeb) {
      thumbHtml = `<div class="settings-media-thumb settings-web-thumb">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </div>`;
    } else {
      const thumbSrc = isVideo ? 'media/847287402_18109332539213351_4384306797872519912_n.jpg' : resolvedSrc;
      thumbHtml = `<img class="settings-media-thumb" src="${thumbSrc}" alt="thumb" onerror="const f=this.getAttribute('src').split('/').pop();if(!this.src.includes('media/'+f))this.src='media/'+f;">`;
    }

    const typeColor = isWeb ? 'var(--accent-cyan)' : (isVideo ? 'var(--accent-amber)' : 'var(--accent-emerald)');
    const typeLabel = isWeb ? 'WEB / IFRAME' : item.type.toUpperCase();

    row.innerHTML = `
      <div class="settings-media-left">
        <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.75rem;">${idx + 1}.</span>
        ${thumbHtml}
        <div style="overflow: hidden;">
          <div class="settings-media-title">${item.title}</div>
          <div style="font-size: 0.7rem; color: ${typeColor}; font-weight: 600;">
            ${typeLabel} ${item.duration ? `• ${(item.duration/1000)}s` : ''}
          </div>
        </div>
      </div>
      <button class="settings-media-del-btn" title="Hapus dari display" data-id="${item.id}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    `;

    row.querySelector('.settings-media-del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMediaItem(item.id);
    });

    elements.settingsMediaList.appendChild(row);
  });
}

function deleteMediaItem(id) {
  if (state.media.length <= 1) {
    showToast('Minimal harus ada 1 media dalam display!');
    return;
  }
  state.media = state.media.filter(m => m.id !== id);
  if (state.currentIndex >= state.media.length) {
    state.currentIndex = 0;
  }
  saveMediaToDB(state.media);
  updateMediaCounters();
  renderSettingsMediaList();
  renderGalleryGrid();
  renderSlide(state.currentIndex);
  showToast('Media dihapus dari antrean display.');
}

function resetMediaToDefault() {
  if (confirm('Kembalikan daftar media ke poster & video bawaan?')) {
    state.media = [...DEFAULT_MEDIA];
    state.currentIndex = 0;
    saveMediaToDB(state.media);
    updateMediaCounters();
    renderSettingsMediaList();
    renderGalleryGrid();
    renderSlide(0);
    showToast('Media display berhasil di-reset ke bawaan.');
  }
}

function saveSettings() {
  // Save slide duration
  state.slideDuration = parseInt(elements.settingDuration.value, 10);
  localStorage.setItem('display_duration', state.slideDuration);

  // Save web slide duration
  if (elements.settingWebDuration) {
    state.webSlideDuration = parseInt(elements.settingWebDuration.value, 10);
    localStorage.setItem('display_web_duration', state.webSlideDuration);
  }

  // Save transition
  state.transitionEffect = elements.settingTransition.value;
  localStorage.setItem('display_transition', state.transitionEffect);
  applyTransitionClass();

  // Save fit mode
  state.fitMode = elements.settingFitMode.value;
  localStorage.setItem('display_fit', state.fitMode);
  applyFitMode();

  // Ticker settings
  state.showTicker = elements.toggleTickerSwitch.checked;
  localStorage.setItem('display_ticker', state.showTicker);
  if (state.showTicker) {
    elements.runningTicker.classList.remove('hidden');
  } else {
    elements.runningTicker.classList.add('hidden');
  }

  // Ticker custom message
  state.tickerText = elements.customTickerInput.value.trim() || '✦ Selamat Datang di Layanan Display Informasi Publik ✦';
  localStorage.setItem('display_ticker_text', state.tickerText);
  elements.tickerContent.textContent = state.tickerText;

  // Clock widget toggle
  state.showClock = elements.toggleClockSwitch.checked;
  localStorage.setItem('display_clock', state.showClock);
  if (state.showClock) {
    elements.dateTimeWidget.classList.remove('hidden');
  } else {
    elements.dateTimeWidget.classList.add('hidden');
  }

  closeSettingsModal();
  showToast('Pengaturan display berhasil disimpan!');
}

// ===================================================================
// LIVE REAL-TIME CLOCK & DATE WIDGET (INDONESIAN LOCALE)
// ===================================================================
function initClock() {
  function updateTime() {
    const now = new Date();
    
    // Time formatted HH:mm:ss WIB
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    elements.clockTime.textContent = `${hours}:${minutes}:${seconds} WIB`;

    // Indonesian Date formatting
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const dayName = days[now.getDay()];
    const dateNum = now.getDate();
    const monthName = months[now.getMonth()];
    const yearNum = now.getFullYear();

    elements.clockDate.textContent = `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// ===================================================================
// FULLSCREEN TOGGLE
// ===================================================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      elements.fsIconExpand.classList.add('hidden');
      elements.fsIconCompress.classList.remove('hidden');
      showToast('Mode Layar Penuh Aktif');
    }).catch(err => {
      console.warn('Fullscreen error:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        elements.fsIconExpand.classList.remove('hidden');
        elements.fsIconCompress.classList.add('hidden');
      });
    }
  }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    elements.fsIconExpand.classList.remove('hidden');
    elements.fsIconCompress.classList.add('hidden');
  } else {
    elements.fsIconExpand.classList.add('hidden');
    elements.fsIconCompress.classList.remove('hidden');
  }
});

// ===================================================================
// VIEW SWITCHER (SLIDESHOW VS GRID)
// ===================================================================
function switchView(view) {
  state.activeView = view;
  if (view === 'slideshow') {
    elements.app.className = 'app-container mode-slideshow';
    elements.slideshowStage.classList.remove('hidden');
    elements.gridGalleryView.classList.add('hidden');
    elements.btnViewSlideshow.classList.add('active');
    elements.btnViewGrid.classList.remove('active');
    applyFitMode();
    if (state.isPlaying) startSlideTimer();
  } else {
    elements.app.className = 'app-container mode-grid';
    elements.app.classList.remove('controls-hidden');
    elements.slideshowStage.classList.add('hidden');
    elements.gridGalleryView.classList.remove('hidden');
    elements.btnViewSlideshow.classList.remove('active');
    elements.btnViewGrid.classList.add('active');
    clearSlideTimer();
    renderGalleryGrid();
  }
}

// ===================================================================
// NOTIFICATION TOAST
// ===================================================================
let toastTimer = null;
function showToast(msg) {
  clearTimeout(toastTimer);
  elements.toastMessage.textContent = msg;
  elements.toastNotification.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    elements.toastNotification.classList.add('hidden');
  }, 2600);
}

// ===================================================================
// KEYBOARD SHORTCUTS
// ===================================================================
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // If typing in input or textarea, don't trigger shortcuts
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowRight':
        if (!elements.lightboxModal.classList.contains('hidden')) {
          nextLightbox();
        } else {
          nextSlide();
        }
        break;
      case 'ArrowLeft':
        if (!elements.lightboxModal.classList.contains('hidden')) {
          prevLightbox();
        } else {
          prevSlide();
        }
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'g':
      case 'G':
        switchView(state.activeView === 'grid' ? 'slideshow' : 'grid');
        break;
      case 's':
      case 'S':
        switchView('slideshow');
        break;
      case 'Escape':
        if (!elements.lightboxModal.classList.contains('hidden')) closeLightbox();
        if (!elements.addMediaModal.classList.contains('hidden')) closeAddMediaModal();
        if (!elements.settingsModal.classList.contains('hidden')) closeSettingsModal();
        break;
    }
  });
}

// ===================================================================
// EVENT LISTENERS
// ===================================================================
function initEventListeners() {
  // Playback & Nav
  elements.btnPlayPause.addEventListener('click', togglePlayPause);
  elements.btnToggleMute.addEventListener('click', toggleMute);
  elements.btnToggleFit.addEventListener('click', toggleFitMode);
  elements.btnPrevSlide.addEventListener('click', prevSlide);
  elements.btnNextSlide.addEventListener('click', nextSlide);
  elements.btnToggleFullscreen.addEventListener('click', toggleFullscreen);

  // View Switchers
  elements.btnViewSlideshow.addEventListener('click', () => switchView('slideshow'));
  elements.btnViewGrid.addEventListener('click', () => switchView('grid'));
  elements.btnLaunchSlideshow.addEventListener('click', () => switchView('slideshow'));

  // Modals: Add Media
  elements.btnAddMedia.addEventListener('click', openAddMediaModal);
  elements.btnCloseAddMedia.addEventListener('click', closeAddMediaModal);
  elements.addMediaBackdrop.addEventListener('click', closeAddMediaModal);

  // Modal Tabs inside Add Media
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.remove('hidden');
    });
  });

  // Dropzone
  elements.btnBrowseFiles.addEventListener('click', () => elements.mediaFileInput.click());
  elements.uploadDropzone.addEventListener('click', (e) => {
    if (e.target !== elements.btnBrowseFiles) {
      elements.mediaFileInput.click();
    }
  });

  elements.mediaFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    elements.uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.uploadDropzone.classList.add('drag-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.uploadDropzone.classList.remove('drag-active');
    }, false);
  });

  elements.uploadDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileSelection(dt.files);
    }
  });

  elements.urlMediaForm.addEventListener('submit', handleUrlMediaSubmission);

  // URL Type Switcher: toggle Web duration group
  if (elements.urlType && elements.groupWebDuration) {
    elements.urlType.addEventListener('change', () => {
      if (elements.urlType.value === 'web') {
        elements.groupWebDuration.classList.remove('hidden');
        elements.urlMediaLink.placeholder = 'https://siaga112.bogorkab.go.id/cuaca-kecamatan';
      } else {
        elements.groupWebDuration.classList.add('hidden');
        elements.urlMediaLink.placeholder = elements.urlType.value === 'video' ? 'https://example.com/video.mp4' : 'https://example.com/banner.jpg';
      }
    });
  }

  // Quick Preset: Pasang Cuaca 112 Bogor
  if (elements.btnApplyCuacaPreset) {
    elements.btnApplyCuacaPreset.addEventListener('click', () => {
      elements.urlType.value = 'web';
      elements.urlMediaLink.value = 'https://siaga112.bogorkab.go.id/cuaca-kecamatan';
      elements.urlMediaTitle.value = 'Prakiraan Cuaca 40 Kecamatan (Siaga 112 Kab. Bogor)';
      if (elements.urlMediaDuration) elements.urlMediaDuration.value = '20000';
      if (elements.groupWebDuration) elements.groupWebDuration.classList.remove('hidden');
      showToast('⚡ Preset Cuaca 112 terisi! Klik tombol "Tambahkan".');
    });
  }

  // Settings
  elements.btnOpenSettings.addEventListener('click', openSettingsModal);
  elements.btnCloseSettings.addEventListener('click', closeSettingsModal);
  elements.settingsBackdrop.addEventListener('click', closeSettingsModal);
  elements.btnResetMedia.addEventListener('click', resetMediaToDefault);
  elements.btnSaveSettings.addEventListener('click', saveSettings);

  // Lightbox
  elements.btnCloseLightbox.addEventListener('click', closeLightbox);
  elements.lightboxBackdrop.addEventListener('click', closeLightbox);
  elements.btnLightboxPrev.addEventListener('click', prevLightbox);
  elements.btnLightboxNext.addEventListener('click', nextLightbox);
  elements.btnLightboxPlayFromHere.addEventListener('click', () => {
    closeLightbox();
    switchView('slideshow');
    renderSlide(lightboxIndex);
  });

  // Aspect Ratio Switchers (9:16 Reels vs 16:9 TV vs Penuh)
  if (elements.btnRatio916) elements.btnRatio916.addEventListener('click', () => setAspectRatio('9:16'));
  if (elements.btnRatio169) elements.btnRatio169.addEventListener('click', () => setAspectRatio('16:9'));
  if (elements.btnRatioFull) elements.btnRatioFull.addEventListener('click', () => setAspectRatio('full'));

  // Reels Side Action Buttons
  if (elements.btnSidePlayPause) elements.btnSidePlayPause.addEventListener('click', togglePlayPause);
  if (elements.btnSideMute) elements.btnSideMute.addEventListener('click', toggleMute);
  if (elements.btnSideFit) elements.btnSideFit.addEventListener('click', toggleFitMode);

  // Filter Chips in Gallery
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.galleryFilter = chip.dataset.filter;
      renderGalleryGrid();
    });
  });
}

// ===================================================================
// REELS GESTURES & INTERACTIONS (SWIPE & WHEEL NAVIGATION)
// ===================================================================
function initReelsGestures() {
  if (!elements.reelsFrame) return;

  // Touch Swipe gestures (swipe up/down like Instagram Reels / TikTok)
  let touchStartY = 0;
  let touchStartX = 0;
  
  elements.reelsFrame.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  elements.reelsFrame.addEventListener('touchend', (e) => {
    const diffY = touchStartY - e.changedTouches[0].clientY;
    const diffX = touchStartX - e.changedTouches[0].clientX;
    
    // Vertical swipe priority (Reels standard)
    if (Math.abs(diffY) > 40 && Math.abs(diffY) > Math.abs(diffX)) {
      if (diffY > 0) {
        nextSlide(); // swipe up -> next reels
      } else {
        prevSlide(); // swipe down -> previous reels
      }
    } else if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }, { passive: true });

  // Mouse wheel scroll to advance reels
  let wheelThrottle = false;
  elements.reelsFrame.addEventListener('wheel', (e) => {
    if (wheelThrottle) return;
    if (Math.abs(e.deltaY) > 30) {
      wheelThrottle = true;
      setTimeout(() => { wheelThrottle = false; }, 600);
      if (e.deltaY > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }, { passive: true });
}

// Start app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);

