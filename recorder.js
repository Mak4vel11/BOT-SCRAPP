const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { TikTokLiveConnection } = require('tiktok-live-connector');

// ANSI color codes for beautiful terminal output
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const cyan = '\x1b[36m';
const magenta = '\x1b[35m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';
const fancyTerminal = !/^(0|false|no|off)$/i.test(String(process.env.FANCY_TERMINAL || '1'));
const tiktokBrowserUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function terminalWidth() {
  return Math.max(72, Math.min(110, process.stdout.columns || 90));
}

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function fitText(value, width) {
  const text = String(value || '');
  const plain = stripAnsi(text);
  if (plain.length <= width) {
    return text + ' '.repeat(width - plain.length);
  }

  return plain.slice(0, Math.max(0, width - 3)) + '...';
}

function cyberLine(char = '-') {
  if (!fancyTerminal) {
    return;
  }

  console.log(dim + cyan + char.repeat(terminalWidth()) + reset);
}

function cyberBanner() {
  if (!fancyTerminal) {
    return;
  }

  const width = terminalWidth();
  const innerWidth = width - 4;
  const title = `${bold}${cyan}TIKTOK LIVE RECORDER${reset}`;
  const subtitle = `${magenta}COOKIE-FIRST STREAM CAPTURE / AUTO-RECOVERY${reset}`;

  console.log('');
  console.log(cyan + '+' + '='.repeat(width - 2) + '+' + reset);
  console.log(cyan + '| ' + reset + fitText(title, innerWidth) + cyan + ' |' + reset);
  console.log(cyan + '| ' + reset + fitText(subtitle, innerWidth) + cyan + ' |' + reset);
  console.log(cyan + '+' + '='.repeat(width - 2) + '+' + reset);
}

function cyberKV(label, value, color = cyan) {
  if (!fancyTerminal) {
    console.log(color + `${label}: ${value}` + reset);
    return;
  }

  const width = terminalWidth();
  const innerWidth = width - 4;
  const left = `${bold}${label}${reset}`;
  const line = `${left}${dim} :: ${reset}${value}`;
  console.log(cyan + '| ' + reset + fitText(line, innerWidth) + cyan + ' |' + reset);
}

function cyberPanel(title, rows) {
  if (!fancyTerminal) {
    console.log(cyan + title + reset);
    for (const [label, value] of rows) {
      cyberKV(label, value);
    }
    return;
  }

  const width = terminalWidth();
  const innerWidth = width - 4;
  console.log(cyan + '+' + '-'.repeat(width - 2) + '+' + reset);
  console.log(cyan + '| ' + reset + fitText(`${bold}${magenta}${title}${reset}`, innerWidth) + cyan + ' |' + reset);
  console.log(cyan + '+' + '-'.repeat(width - 2) + '+' + reset);
  for (const [label, value] of rows) {
    cyberKV(label, value);
  }
  console.log(cyan + '+' + '-'.repeat(width - 2) + '+' + reset);
}

function cyberRecordStart(username, rows) {
  if (!fancyTerminal) {
    cyberPanel(`REC START: ${username}`, rows);
    return;
  }

  const width = terminalWidth();
  const innerWidth = width - 4;
  const pulseFrames = Math.max(1, parseInt(process.env.REC_START_FRAMES || '7', 10) || 7);

  for (let frame = 0; frame < pulseFrames; frame += 1) {
    const pulse = frame % 2 === 0 ? green : cyan;
    const scan = matrixTrail(22);
    process.stdout.write('\r' + pulse + bold + `>>> SIGNAL LOCKED :: ${username} :: ${scan}` + reset + ' '.repeat(12));
    sleepSync(55);
  }
  process.stdout.write('\n');

  console.log(green + '+' + '='.repeat(width - 2) + '+' + reset);
  console.log(green + '| ' + reset + fitText(`${bold}${green}●● RECORDING ENGAGED${reset} ${dim}//${reset} ${bold}${username}${reset}`, innerWidth) + green + ' |' + reset);
  console.log(green + '+' + '='.repeat(width - 2) + '+' + reset);
  console.log(green + '| ' + reset + fitText(`${dim}STREAM ${matrixTrail(12)}  NODE ${matrixTrail(10)}  CAPTURE ${matrixTrail(8)}${reset}`, innerWidth) + green + ' |' + reset);
  console.log(green + '+' + '-'.repeat(width - 2) + '+' + reset);

  for (const [label, value] of rows) {
    const labelCell = `${bold}${label.padEnd(10)}${reset}`;
    const valueCell = label === 'URL' ? `${dim}${value}${reset}` : value;
    console.log(green + '| ' + reset + fitText(`${labelCell} ${cyan}=>${reset} ${valueCell}`, innerWidth) + green + ' |' + reset);
  }

  console.log(green + '+' + '='.repeat(width - 2) + '+' + reset);
}

function timeStamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function matrixTrail(length = 16) {
  const alphabet = '01ABCDEF';
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function cyberBootSequence() {
  if (!fancyTerminal || /^(0|false|no|off)$/i.test(String(process.env.MATRIX_BOOT || '1'))) {
    return;
  }

  const width = terminalWidth();
  const height = Math.min(14, Math.max(8, Math.floor((process.stdout.rows || 24) / 2)));
  const frames = Math.max(1, parseInt(process.env.MATRIX_BOOT_FRAMES || '18', 10) || 18);
  const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-/<>[]{}';

  process.stdout.write('\x1b[?25l');
  for (let frame = 0; frame < frames; frame += 1) {
    const progress = Math.floor(((frame + 1) / frames) * 28);
    const progressBar = '[' + '#'.repeat(progress) + dim + '-'.repeat(28 - progress) + reset + green + ']';

    process.stdout.write('\x1b[2J\x1b[H');
    console.log(dim + green + matrixTrail(width).slice(0, width) + reset);
    console.log(green + bold + fitText('INITIALIZING COOKIE-FIRST LIVE CAPTURE GRID', width) + reset);
    console.log(cyan + fitText(`BOOT ${progressBar} ${Math.floor(((frame + 1) / frames) * 100)}%`, width) + reset);

    for (let row = 0; row < height; row += 1) {
      let line = '';
      for (let col = 0; col < width; col += 1) {
        const shouldGlow = (col + row + frame) % 11 === 0;
        const shouldDim = (col * 3 + row + frame) % 5 === 0;
        const char = chars[Math.floor(Math.random() * chars.length)];
        if (shouldGlow) {
          line += green + bold + char + reset;
        } else if (shouldDim) {
          line += dim + cyan + char + reset;
        } else {
          line += dim + green + char + reset;
        }
      }
      console.log(line);
    }

    console.log(cyan + fitText(`NODES ${matrixTrail(8)}  STREAMS ${matrixTrail(8)}  WATCHDOG ${matrixTrail(8)}`, width) + reset);
    sleepSync(45);
  }

  process.stdout.write('\x1b[2J\x1b[H\x1b[?25h');
}

function cyberEvent(level, username, message, meta = '') {
  const styles = {
    scan: { color: cyan, tag: 'SCAN', mark: '>>' },
    live: { color: green, tag: 'LIVE', mark: '##' },
    rec: { color: green, tag: 'REC', mark: '●●' },
    idle: { color: blue, tag: 'IDLE', mark: '--' },
    wait: { color: yellow, tag: 'WAIT', mark: '..' },
    warn: { color: yellow, tag: 'WARN', mark: '!!' },
    stop: { color: red, tag: 'STOP', mark: 'XX' }
  };
  const style = styles[level] || styles.scan;

  if (!fancyTerminal) {
    console.log(style.color + `[${style.tag}] ${username}: ${message}${meta ? ` (${meta})` : ''}` + reset);
    return;
  }

  const userCell = fitText(username || '-', 22);
  const msgCell = fitText(message || '', 44);
  const metaCell = fitText(meta || matrixTrail(14), 22);
  console.log(
    `${dim}${timeStamp()}${reset} ` +
    `${style.color}${style.mark} [${style.tag}]${reset} ` +
    `${bold}${userCell}${reset} ` +
    `${style.color}${msgCell}${reset} ` +
    `${dim}${metaCell}${reset}`
  );
}

function cyberScan(username, source = '') {
  cyberEvent('scan', username, source ? `probing ${source}` : 'probing live matrix', matrixTrail(18));
}

cyberBootSequence();
cyberBanner();

const accountsList = [
  'haverri_sp', 'kozak696990', 'itskingmafia', 'cashmoneyotr', 'medii_iiseni',
  'diamanti_bluofficial', '', 'greca99', 'fire.fire9', 'ols_nazari',
  'kozak.megalluks69', 'edlirhalilaj', 'klajdi_tt3', 'babaimnp0', '',
  '', '', '', '', '',
  '', '', '', '', ''
];

// Optional direct stream URLs for accounts TikTok marks live but hides the stream URL.
// Prefer TIKTOK_MANUAL_STREAM_URLS in the environment for temporary values.
const manualStreamUrls = {};

const rawUsernames = process.env.TIKTOK_USERNAME || process.env.TIKTOK_USERNAMES || accountsList.join(',');
const usernames = rawUsernames.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
const checkIntervalMs = parseInt(process.env.CHECK_INTERVAL_MS, 10) || 40 * 1000;
const offlineConfirmationChecks = Math.max(1, parseInt(process.env.OFFLINE_CONFIRMATION_CHECKS || '3', 10) || 3);
const rawRecordDuration = process.env.RECORD_DURATION;
const recordDurationSeconds = rawRecordDuration != null && rawRecordDuration !== '' ? parseDuration(rawRecordDuration, 10) : null;
const recordDurationLabel = recordDurationSeconds == null ? 'unlimited' : formatDuration(recordDurationSeconds);
const restartOnStreamChange = !/^(0|false|no|off)$/i.test(String(process.env.RESTART_ON_STREAM_CHANGE || '1'));
const streamChangeRestartCooldownMs = parseDurationMs(process.env.STREAM_CHANGE_RESTART_COOLDOWN || '45s', 45 * 1000);
const corruptRestartThreshold = Math.max(1, parseInt(process.env.CORRUPT_RESTART_THRESHOLD || '12', 10) || 12);
const corruptRestartWindowMs = parseDurationMs(process.env.CORRUPT_RESTART_WINDOW || '30s', 30 * 1000);
const timestampRestartThreshold = Math.max(0, parseInt(process.env.TIMESTAMP_RESTART_THRESHOLD || '0', 10) || 0);
const timestampRestartWindowMs = parseDurationMs(process.env.TIMESTAMP_RESTART_WINDOW || '20s', 20 * 1000);
const restartOnBetterQuality = !/^(0|false|no|off)$/i.test(String(process.env.RESTART_ON_BETTER_QUALITY || '1'));
const betterQualityRestartCooldownMs = parseDurationMs(process.env.BETTER_QUALITY_RESTART_COOLDOWN || '60s', 60 * 1000);
const streamFormatPreference = String(process.env.TIKTOK_STREAM_FORMAT || 'flv').trim().toLowerCase();
const defaultTikTokCookieFile = path.resolve('tiktok_cookies.txt');
const tiktokCookieFile = (process.env.TIKTOK_COOKIE_FILE || (fs.existsSync(defaultTikTokCookieFile) ? defaultTikTokCookieFile : '')).trim();
const tiktokCookieReloadIntervalMs = parseDurationMs(process.env.TIKTOK_COOKIE_RELOAD_INTERVAL || '30s', 30 * 1000);
const tiktokCookieMaxAgeMs = parseDurationMs(process.env.TIKTOK_COOKIE_MAX_AGE || '2d', 2 * 24 * 60 * 60 * 1000);
cyberPanel('RUNTIME CONFIG', [
  ['Accounts', `${usernames.length}/25 - ${usernames.join(', ') || '(none configured yet)'}`],
  ['Check interval', formatDuration(checkIntervalMs / 1000)],
  ['Record duration', recordDurationLabel],
  ['Offline checks', offlineConfirmationChecks],
  ['Stream format', streamFormatPreference],
  ['Lookup order', 'cookies first, public fallback'],
  ['Restart on stream change', restartOnStreamChange ? 'enabled' : 'disabled'],
  ['Restart on better quality', restartOnBetterQuality ? 'enabled' : 'disabled'],
  ['Cookie source', process.env.TIKTOK_COOKIE ? 'TIKTOK_COOKIE env' : tiktokCookieFile || 'not configured']
]);
const uploadEnabled = /^(1|true|yes|on)$/i.test(String(process.env.UPLOAD_ENABLED || ''));
const uploadHost = (process.env.UPLOAD_HOST || '').trim();
const uploadPort = parseInt(process.env.UPLOAD_PORT || '22', 10) || 22;
const uploadUser = (process.env.UPLOAD_USER || '').trim();
const uploadRemotePath = (process.env.UPLOAD_REMOTE_PATH || '').trim();
const uploadPrivateKeyPath = (process.env.UPLOAD_PRIVATE_KEY_PATH || '').trim();
const uploadDeleteAfterSuccess = /^(1|true|yes|on)$/i.test(String(process.env.UPLOAD_DELETE_AFTER_SUCCESS || ''));

function canRunFfmpeg(candidatePath) {
  if (!candidatePath) {
    return false;
  }

  try {
    const result = spawnSync(candidatePath, ['-version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    });

    return !result.error && result.status === 0;
  } catch (err) {
    return false;
  }
}

function resolveFfmpegPath() {
  const explicitPath = process.env.FFMPEG_PATH;
  if (explicitPath) {
    return explicitPath;
  }

  if (canRunFfmpeg('ffmpeg')) {
    return 'ffmpeg';
  }

  if (ffmpegInstaller.path) {
    return ffmpegInstaller.path;
  }

  if (canRunFfmpeg('ffmpeg')) {
    return 'ffmpeg';
  }

  return null;
}

const ffmpegPath = resolveFfmpegPath();
if (!ffmpegPath) {
  console.error('FFmpeg binary not found. Install FFmpeg, set FFMPEG_PATH, or install @ffmpeg-installer/ffmpeg.');
  process.exit(1);
}

if (!fs.existsSync('recordings')) {
  fs.mkdirSync('recordings', { recursive: true });
  console.log(cyan + '✅ Created recordings directory' + reset);
}

cyberPanel('SYSTEM PATHS', [
  ['Working directory', process.cwd()],
  ['Recordings folder', path.resolve('recordings')],
  ['FFmpeg binary', ffmpegPath]
]);

const ffmpegProbe = spawnSync(ffmpegPath, ['-version'], {
  encoding: 'utf8',
  timeout: 5000,
  windowsHide: true
});

if (ffmpegProbe.error || ffmpegProbe.status !== 0) {
  console.error(red + '❌ FFmpeg startup probe failed.' + reset);
  if (ffmpegProbe.error) {
    console.error(red + '❌ Probe error: ' + ffmpegProbe.error.message + reset);
  }
  if (ffmpegProbe.stderr) {
    console.error(red + '❌ Probe stderr: ' + ffmpegProbe.stderr.trim() + reset);
  }
  process.exit(1);
}

const ffmpegVersionLine = (ffmpegProbe.stdout || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find(Boolean);
const ffmpegLooksOld = /N-92722|Copyright \(c\) 2000-2018/i.test(ffmpegVersionLine || '');
if (ffmpegVersionLine) {
  cyberKV('FFmpeg probe', ffmpegVersionLine);
  if (ffmpegLooksOld) {
    console.log(yellow + '⚠️ Bundled FFmpeg is old. TikTok hd5/H.265 FLV streams may require a newer FFmpeg build.' + reset);
  }
}

const activeRecordings = new Map();
const activeTransfers = new Map();
const restartTimers = new Map();
const liveCheckState = new Map();
const temporarilyBlockedStreamFormats = new Map();
const failedStartState = new Map();
const streamUrlSources = new Map();
const publicStreamUrlBlockedUntil = new Map();
const liveNoStreamUrl = Symbol('liveNoStreamUrl');
const cookieCache = {
  value: '',
  loadedAt: 0,
  fileMtimeMs: 0,
  fingerprint: '',
  warnedMissing: false,
  warnedStale: false,
  warnedEmpty: false
};
let shutdownRequested = false;
let shutdownExitCode = 0;

function canRunCommand(command, args = ['--help']) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    });

    return !result.error;
  } catch (err) {
    return false;
  }
}

function getUploadConfig() {
  const missingFields = [];

  if (!uploadHost) missingFields.push('UPLOAD_HOST');
  if (!uploadUser) missingFields.push('UPLOAD_USER');
  if (!uploadRemotePath) missingFields.push('UPLOAD_REMOTE_PATH');

  if (missingFields.length > 0) {
    return {
      enabled: false,
      reason: `missing required env vars: ${missingFields.join(', ')}`
    };
  }

  if (!canRunCommand('scp')) {
    return {
      enabled: false,
      reason: 'scp is not installed or not available in PATH'
    };
  }

  return {
    enabled: true,
    host: uploadHost,
    port: uploadPort,
    user: uploadUser,
    remotePath: uploadRemotePath,
    privateKeyPath: uploadPrivateKeyPath || null,
    deleteAfterSuccess: uploadDeleteAfterSuccess
  };
}

const uploadConfig = getUploadConfig();
if (uploadEnabled) {
  if (uploadConfig.enabled) {
    cyberKV('Upload target', `${uploadConfig.user}@${uploadConfig.host}:${uploadConfig.remotePath}`);
  } else {
    console.log(yellow + `⚠️ Upload requested but disabled: ${uploadConfig.reason}` + reset);
  }
} else {
  cyberKV('Upload target', 'disabled');
}
cyberLine('=');

function getRecordingState(username) {
  return activeRecordings.get(username) || null;
}

function isRecording(username) {
  return activeRecordings.has(username);
}

function getLiveCheckState(username) {
  if (!liveCheckState.has(username)) {
    liveCheckState.set(username, { consecutiveOfflineChecks: 0 });
  }

  return liveCheckState.get(username);
}

function resetOfflineChecks(username) {
  getLiveCheckState(username).consecutiveOfflineChecks = 0;
}

function resetFailedStartState(username) {
  failedStartState.delete(username);
}

function noteFailedStart(username) {
  const state = failedStartState.get(username) || { failures: 0 };
  state.failures += 1;
  failedStartState.set(username, state);
  return state.failures;
}

function getRetryDelayMs(username) {
  const failures = failedStartState.get(username)?.failures || 0;
  if (failures <= 1) return 5000;
  if (failures === 2) return 15000;
  if (failures === 3) return 30000;
  return 60000;
}

function noteOfflineCheck(username) {
  const state = getLiveCheckState(username);
  state.consecutiveOfflineChecks += 1;
  return state.consecutiveOfflineChecks;
}

function hasActiveTransfers() {
  return activeTransfers.size > 0;
}

function maybeExitAfterShutdown() {
  if (shutdownRequested && activeRecordings.size === 0 && !hasActiveTransfers()) {
    console.log(cyan + '👋 Recorder shutdown complete.' + reset);
    process.exit(shutdownExitCode);
  }
}

function queueUpload(username, outputFile) {
  if (!uploadEnabled) {
    return;
  }

  if (!uploadConfig.enabled) {
    console.log(yellow + `⚠️ Skipping upload for ${username}: ${uploadConfig.reason}` + reset);
    return;
  }

  const resolvedOutputFile = path.resolve(outputFile);
  if (!fs.existsSync(resolvedOutputFile)) {
    console.log(yellow + `⚠️ Skipping upload for ${username}: file not found at ${resolvedOutputFile}` + reset);
    return;
  }

  const transferId = `${username}:${Date.now()}:${path.basename(resolvedOutputFile)}`;
  const remoteTarget = `${uploadConfig.user}@${uploadConfig.host}:${uploadConfig.remotePath.replace(/\\/g, '/')}/`;
  const scpArgs = ['-P', String(uploadConfig.port)];

  if (uploadConfig.privateKeyPath) {
    scpArgs.push('-i', uploadConfig.privateKeyPath);
  }

  scpArgs.push(resolvedOutputFile, remoteTarget);

  console.log(cyan + `📤 Uploading ${path.basename(resolvedOutputFile)} for ${username} to ${remoteTarget}` + reset);
  const uploadProcess = spawn('scp', scpArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  activeTransfers.set(transferId, {
    username,
    file: resolvedOutputFile,
    process: uploadProcess
  });

  uploadProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.log(blue + `[upload] ${text}` + reset);
    }
  });

  uploadProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.log(yellow + `[upload] ${text}` + reset);
    }
  });

  uploadProcess.on('error', (err) => {
    activeTransfers.delete(transferId);
    console.log(red + `❌ Upload process error for ${username}: ${err.message}` + reset);
    maybeExitAfterShutdown();
  });

  uploadProcess.on('exit', (code) => {
    activeTransfers.delete(transferId);

    if (code === 0) {
      console.log(green + `✅ Upload completed for ${username}: ${resolvedOutputFile}` + reset);

      if (uploadConfig.deleteAfterSuccess) {
        try {
          fs.unlinkSync(resolvedOutputFile);
          console.log(cyan + `🧹 Deleted local file after upload: ${resolvedOutputFile}` + reset);
        } catch (err) {
          console.log(yellow + `⚠️ Uploaded but failed to delete local file ${resolvedOutputFile}: ${err.message}` + reset);
        }
      }
    } else {
      console.log(red + `❌ Upload failed for ${username} with exit code ${code}: ${resolvedOutputFile}` + reset);
    }

    maybeExitAfterShutdown();
  });
}

function getOutputConfig(streamUrl, username) {
  const safeUsername = username.replace(/[^\w.-]+/g, '_');
  const timestamp = Date.now();
  const isHlsStream = getStreamFormat(streamUrl) === 'hls';

  return {
    outputFile: path.join('recordings', `live_${safeUsername}_${timestamp}.${isHlsStream ? 'ts' : 'mkv'}`),
    outputFormat: isHlsStream ? 'mpegts' : 'matroska',
    useBitstreamFilter: false
  };
}

function getStreamIdentity(streamUrl) {
  try {
    const parsedUrl = new URL(streamUrl);
    const normalizedPathname = parsedUrl.pathname.replace(/_(?:ld|sd|hd|or\d+)(?=(?:\.(?:flv|m3u8)|\/))/gi, '');
    return normalizedPathname;
  } catch (err) {
    return String(streamUrl || '')
      .split('?')[0]
      .replace(/_(?:ld|sd|hd|or\d+)(?=(?:\.(?:flv|m3u8)|\/))/gi, '');
  }
}

function getStreamFormat(streamUrl) {
  if (/\.m3u8(?:\?|$)/i.test(streamUrl)) {
    return 'hls';
  }

  if (/\.flv(?:\?|$)/i.test(streamUrl)) {
    return 'flv';
  }

  return 'unknown';
}

function getTemporarilyBlockedFormats(username) {
  const now = Date.now();
  const blockedFormats = temporarilyBlockedStreamFormats.get(username);
  if (!blockedFormats) {
    return new Set();
  }

  for (const [format, expiresAt] of blockedFormats.entries()) {
    if (expiresAt <= now) {
      blockedFormats.delete(format);
    }
  }

  if (blockedFormats.size === 0) {
    temporarilyBlockedStreamFormats.delete(username);
    return new Set();
  }

  return new Set(blockedFormats.keys());
}

function temporarilyBlockStreamFormat(username, format, reason) {
  if (!format || format === 'unknown') {
    return;
  }

  const blockMs = parseDurationMs(process.env.STREAM_FORMAT_BLOCK_DURATION || '10m', 10 * 60 * 1000);
  const blockedFormats = temporarilyBlockedStreamFormats.get(username) || new Map();
  blockedFormats.set(format, Date.now() + blockMs);
  temporarilyBlockedStreamFormats.set(username, blockedFormats);
  console.log(yellow + `⚠️ Temporarily avoiding ${format.toUpperCase()} for ${username} for ${formatDuration(blockMs / 1000)} after ${reason}.` + reset);
}

function blockPublicStreamUrlSource(username, reason) {
  const cookieHeader = getTikTokCookieHeader();
  if (!cookieHeader) {
    return;
  }

  const blockMs = parseDurationMs(process.env.PUBLIC_STREAM_SOURCE_BLOCK_DURATION || '10m', 10 * 60 * 1000);
  publicStreamUrlBlockedUntil.set(normalizeUsername(username), Date.now() + blockMs);
  console.log(yellow + `⚠️ Public stream URL failed for ${username}. Trying cookie-only stream URLs for ${formatDuration(blockMs / 1000)} after ${reason}.` + reset);
}

function isPublicStreamUrlSourceBlocked(username) {
  const uniqueId = normalizeUsername(username);
  const blockedUntil = publicStreamUrlBlockedUntil.get(uniqueId) || 0;
  if (blockedUntil <= Date.now()) {
    publicStreamUrlBlockedUntil.delete(uniqueId);
    return false;
  }

  return true;
}

function parseNetscapeCookieFile(rawValue) {
  const cookies = [];
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const rawLine of String(rawValue || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') && !line.startsWith('#HttpOnly_')) {
      continue;
    }

    const normalizedLine = line.replace(/^#HttpOnly_/, '');
    const parts = normalizedLine.split(/\t+/);
    if (parts.length < 7) {
      continue;
    }

    const expiresAt = Number(parts[4]);
    if (expiresAt && expiresAt < nowSeconds) {
      continue;
    }

    const name = parts[5];
    const value = parts.slice(6).join('\t');
    if (name && value) {
      cookies.push(`${name}=${value}`);
    }
  }

  return cookies.join('; ');
}

function normalizeCookieHeader(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return '';
  }

  const netscapeCookieHeader = parseNetscapeCookieFile(value);
  if (netscapeCookieHeader) {
    return netscapeCookieHeader;
  }

  return value
    .replace(/^cookie:\s*/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('; ');
}

function getCookieSummary(cookieHeader) {
  const cookieNames = String(cookieHeader || '')
    .split(';')
    .map((item) => item.trim().split('=')[0])
    .filter(Boolean);

  const uniqueNames = Array.from(new Set(cookieNames));
  const importantNames = ['sessionid', 'sessionid_ss', 'sid_tt', 'ttwid', 'msToken']
    .filter((name) => uniqueNames.includes(name));

  return `${uniqueNames.length} cookies${importantNames.length ? ` (${importantNames.join(', ')})` : ''}`;
}

function getCookieFingerprint(cookieHeader) {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(String(cookieHeader || ''))
    .digest('hex')
    .slice(0, 12);
}

function getTikTokCookieHeader(options = {}) {
  const forceReload = Boolean(options.forceReload);
  const envCookie = normalizeCookieHeader(process.env.TIKTOK_COOKIE);
  if (envCookie) {
    return envCookie;
  }

  if (!tiktokCookieFile) {
    return '';
  }

  const now = Date.now();
  if (!forceReload && cookieCache.loadedAt && now - cookieCache.loadedAt < tiktokCookieReloadIntervalMs) {
    return cookieCache.value;
  }

  try {
    const resolvedCookieFile = path.resolve(tiktokCookieFile);
    const stats = fs.statSync(resolvedCookieFile);
    const fileAgeMs = now - stats.mtimeMs;
    if (fileAgeMs > tiktokCookieMaxAgeMs && !cookieCache.warnedStale) {
      console.log(yellow + `⚠️ TikTok cookie file is older than ${formatDuration(tiktokCookieMaxAgeMs / 1000)}. Refresh it if TikTok keeps hiding stream URLs.` + reset);
      cookieCache.warnedStale = true;
    }

    if (!forceReload && cookieCache.loadedAt && stats.mtimeMs === cookieCache.fileMtimeMs) {
      cookieCache.loadedAt = now;
      return cookieCache.value;
    }

    cookieCache.value = normalizeCookieHeader(fs.readFileSync(resolvedCookieFile, 'utf8'));
    cookieCache.loadedAt = now;
    cookieCache.fileMtimeMs = stats.mtimeMs;
    cookieCache.fingerprint = cookieCache.value ? getCookieFingerprint(cookieCache.value) : '';
    cookieCache.warnedMissing = false;
    cookieCache.warnedStale = fileAgeMs > tiktokCookieMaxAgeMs;
    if (!cookieCache.value) {
      if (!cookieCache.warnedEmpty) {
        console.log(yellow + `⚠️ TikTok cookie file is empty or not in a usable cookie format: ${resolvedCookieFile}` + reset);
        cookieCache.warnedEmpty = true;
      }
      cookieCache.loadedAt = 0;
      return '';
    }

    cookieCache.warnedEmpty = false;
    console.log(cyan + `🍪 Loaded TikTok cookies from ${resolvedCookieFile} (${getCookieSummary(cookieCache.value)}, id ${cookieCache.fingerprint})` + reset);
    return cookieCache.value;
  } catch (err) {
    if (!cookieCache.warnedMissing) {
      console.log(yellow + `⚠️ Could not load TikTok cookie file "${tiktokCookieFile}": ${err.message}` + reset);
      cookieCache.warnedMissing = true;
    }
    cookieCache.loadedAt = now;
    return cookieCache.value;
  }
}

function getFfmpegInputOptions(username) {
  const uniqueId = username.startsWith('@') ? username.slice(1) : username;
  const referer = `https://www.tiktok.com/@${uniqueId}/live`;
  const headers = [
    'Accept: */*',
    'Accept-Language: en-US,en;q=0.9',
    'Origin: https://www.tiktok.com',
    `Referer: ${referer}`
  ];
  const cookieHeader = getTikTokCookieHeader();
  if (cookieHeader) {
    headers.push(`Cookie: ${cookieHeader}`);
  }

  return [
    '-user_agent', tiktokBrowserUserAgent,
    '-headers', headers.join('\r\n') + '\r\n'
  ];
}

function formatFfmpegArgsForLog(args) {
  return args.map((arg, index) => {
    if (args[index - 1] !== '-headers') {
      return `"${arg}"`;
    }

    const redactedHeaders = String(arg)
      .split('\r\n')
      .map((line) => line.replace(/^Cookie:\s*.+$/i, 'Cookie: [redacted]'))
      .join('\r\n');
    return `"${redactedHeaders}"`;
  }).join(' ');
}

function startRecording(username, streamUrl) {
  if (isRecording(username)) {
    return;
  }

  const outputConfig = getOutputConfig(streamUrl, username);
  const outputFile = outputConfig.outputFile;
  const streamSource = streamUrlSources.get(streamUrl) || 'unknown';
  cyberRecordStart(username, [
    ['Output', outputFile],
    ['Source', streamSource],
    ['Format', describeStreamUrl(streamUrl)],
    ['Duration', recordDurationLabel],
    ['URL', streamUrl]
  ]);

  const ffmpegArgs = [
    '-y',
    '-hide_banner',
    '-loglevel', 'warning',
    '-fflags', '+genpts+discardcorrupt',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-rw_timeout', '15000000',
    '-rtbufsize', '100M',
    '-analyzeduration', '10000000',
    '-probesize', '10000000',
    ...getFfmpegInputOptions(username),
    '-i', streamUrl,
    '-c', 'copy'
  ];

  if (outputConfig.useBitstreamFilter) {
    ffmpegArgs.push('-bsf:v', 'h264_mp4toannexb');
  }

  ffmpegArgs.push('-f', outputConfig.outputFormat);

  if (recordDurationSeconds != null) {
    ffmpegArgs.push('-t', String(recordDurationSeconds));
  }

  ffmpegArgs.push(outputFile);
  const resolvedOutputFile = path.resolve(outputFile);
  console.log(cyan + '🔧 FFmpeg command: ' + ffmpegPath + ' ' + formatFfmpegArgsForLog(ffmpegArgs) + reset);
  console.log(cyan + '🏃 Spawning FFmpeg process...' + reset);
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  console.log(cyan + `✅ FFmpeg process spawned for ${username} (PID: ${ffmpegProcess.pid})` + reset);

  const state = {
    ffmpegProcess,
    streamUrl,
    streamSource,
    streamIdentity: getStreamIdentity(streamUrl),
    streamQualityRank: getStreamQualityRank(streamUrl),
    lastStreamChangeRestartAt: 0,
    lastBetterQualityRestartAt: 0,
    intentionalStop: false,
    pendingRestart: false,
    errorState: {
      consecutiveHlsFailures: 0,
      firstFailureAt: null,
      consecutiveCorruptPackets: 0,
      firstCorruptPacketAt: null,
      consecutiveTimestampWarnings: 0,
      firstTimestampWarningAt: null,
      unsupportedCodecDetected: false
    }
  };
  activeRecordings.set(username, state);

  ffmpegProcess.on('exit', (code, signal) => {
    console.log(cyan + `🕐 FFmpeg exited for ${username}. Checking output file...\n` + reset);
    
    // Give filesystem a moment to sync
    setTimeout(() => {
      const fileExists = fs.existsSync(outputFile);
      const resolvedExists = fs.existsSync(resolvedOutputFile);
      let fileSize = 0;
      if (fileExists) {
        fileSize = fs.statSync(outputFile).size;
      } else if (resolvedExists) {
        fileSize = fs.statSync(resolvedOutputFile).size;
      }
      
      console.log(cyan + '📊 Output file status:' + reset);
      console.log(cyan + '  Path (relative): ' + outputFile + reset);
      console.log(cyan + '  Path (resolved): ' + resolvedOutputFile + reset);
      console.log(cyan + '  Exists (relative): ' + fileExists + reset);
      console.log(cyan + '  Exists (resolved): ' + resolvedExists + reset);
      console.log(cyan + '  Size: ' + fileSize + ' bytes\n' + reset);
      
      // List all files in recordings folder
      try {
        const files = fs.readdirSync('recordings');
        console.log(cyan + '📁 Files in recordings/: ' + (files.length > 0 ? files.join(', ') : '(empty)') + reset);
      } catch (err) {
        console.log(red + '❌ Error reading recordings folder: ' + err.message + reset);
      }

      const currentState = getRecordingState(username);
      const requestedRestart = currentState ? currentState.pendingRestart : false;
      const wasIntentionalStop = currentState ? currentState.intentionalStop : false;
      activeRecordings.delete(username);

      if (code === 0) {
        if (requestedRestart) {
          console.log(yellow + `🔁 Recording segment closed for ${username}. Fetching a fresh stream URL...` + reset);
        } else {
          console.log(green + `✅ Recording completed successfully for ${username}` + reset);
        }

        if (fileSize > 0) {
          resetFailedStartState(username);
          queueUpload(username, resolvedOutputFile);
        } else {
          console.log(yellow + `⚠️ Skipping upload for ${username}: output file is empty` + reset);
        }

        if (requestedRestart) {
          scheduleRestart(username);
        }
      } else {
        console.log(yellow + `🛑 FFmpeg exited (code=${code}, signal=${signal})` + reset);
        if (fileSize === 0 && !wasIntentionalStop) {
          const failures = noteFailedStart(username);
          console.log(yellow + `⏳ Empty/failed start count for ${username}: ${failures}. Next retry delay: ${formatDuration(getRetryDelayMs(username) / 1000)}.` + reset);
        }
        if (requestedRestart) {
          console.log(yellow + `🔁 Restart requested for ${username}. Fetching a fresh stream URL...` + reset);
          scheduleRestart(username);
        } else if (!wasIntentionalStop) {
          console.log(yellow + '🔁 Recording stopped unexpectedly. Scheduling retry for', username + reset);
          scheduleRestart(username);
        }
      }

      maybeExitAfterShutdown();
    }, 1000);
  });

  ffmpegProcess.on('error', (err) => {
    console.error(red + '❌ FFmpeg process error:', err.message + reset);
    activeRecordings.delete(username);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (!text) {
      return;
    }

    if (isLikelyTransientInputFailure(text)) {
      if (isInput404Message(text)) {
        console.log(yellow + `[ffmpeg] WARN: Input URL expired for ${username}: ${text}` + reset);
        const currentState = getRecordingState(username);
        if (currentState && currentState.streamSource === 'public page') {
          blockPublicStreamUrlSource(username, '404 Not Found');
        }
      } else if (isInput403Message(text)) {
        console.log(yellow + `[ffmpeg] WARN: Input URL was denied for ${username}: ${text}` + reset);
        const currentState = getRecordingState(username);
        if (currentState) {
          temporarilyBlockStreamFormat(username, getStreamFormat(currentState.streamUrl), '403 Forbidden');
          if (currentState.streamSource === 'public page') {
            blockPublicStreamUrlSource(username, '403 Forbidden');
          }
        }
      }
      requestImmediateRestart(username, 'Input stream failed.');
    }

    if (text.includes('frame=') || text.includes('time=') || text.includes('bitrate=')) {
      process.stdout.write('.');
      return;
    }

    if (/Video codec \(c\) is not implemented|unknown codec|Codec 'unknown'/i.test(text)) {
      const currentState = getRecordingState(username);
      if (currentState && !currentState.errorState.unsupportedCodecDetected) {
        currentState.errorState.unsupportedCodecDetected = true;
        console.log(red + `[ffmpeg] ERROR: ${username} stream uses a codec this FFmpeg cannot read. Stopping this recording. Install a newer FFmpeg, or use a non-hd5/non-H.265 stream URL.` + reset);
        stopRecording({ username });
      }
      return;
    }

    const isHlsFailure = /404 Not Found/i.test(text) || /Failed to open segment/i.test(text) || /Media sequence changed unexpectedly/i.test(text);
    if (isHlsFailure) {
      const currentState = getRecordingState(username);
      if (!currentState) {
        return;
      }

      const now = Date.now();
      if (!currentState.errorState.firstFailureAt || now - currentState.errorState.firstFailureAt > 20000) {
        currentState.errorState.firstFailureAt = now;
        currentState.errorState.consecutiveHlsFailures = 0;
      }
      currentState.errorState.consecutiveHlsFailures += 1;

      if (currentState.errorState.consecutiveHlsFailures >= 50) {
        console.log(yellow + `⚠️ Detected repeated HLS segment failures for ${username} (${currentState.errorState.consecutiveHlsFailures}). Restarting recording...` + reset);
        currentState.errorState.consecutiveHlsFailures = 0;
        currentState.errorState.firstFailureAt = null;
        stopRecording({ restart: true, username });
      }
    }

    const isCorruptPacket = /Packet corrupt|corrupt input packet|Invalid NAL|non-existing PPS|missing picture|decode_slice_header error|concealing .* errors/i.test(text);
    if (isCorruptPacket) {
      const currentState = getRecordingState(username);
      if (!currentState) {
        return;
      }

      const now = Date.now();
      if (!currentState.errorState.firstCorruptPacketAt || now - currentState.errorState.firstCorruptPacketAt > corruptRestartWindowMs) {
        currentState.errorState.firstCorruptPacketAt = now;
        currentState.errorState.consecutiveCorruptPackets = 0;
      }
      currentState.errorState.consecutiveCorruptPackets += 1;

      if (currentState.errorState.consecutiveCorruptPackets >= corruptRestartThreshold) {
        console.log(yellow + `⚠️ Detected repeated corrupt video packets for ${username} (${currentState.errorState.consecutiveCorruptPackets}). Restarting with a fresh stream URL...` + reset);
        temporarilyBlockStreamFormat(username, getStreamFormat(currentState.streamUrl), 'repeated corrupt video packets');
        currentState.errorState.consecutiveCorruptPackets = 0;
        currentState.errorState.firstCorruptPacketAt = null;
        stopRecording({ restart: true, username });
        return;
      }
    }

    const timestampWarningCount = (text.match(/Non-monotonous DTS|non monotonically increasing dts|Queue input is backward in time/gi) || []).length;
    if (timestampWarningCount > 0) {
      const currentState = getRecordingState(username);
      if (!currentState) {
        return;
      }

      const now = Date.now();
      if (!currentState.errorState.firstTimestampWarningAt || now - currentState.errorState.firstTimestampWarningAt > timestampRestartWindowMs) {
        currentState.errorState.firstTimestampWarningAt = now;
        currentState.errorState.consecutiveTimestampWarnings = 0;
        console.log(yellow + `⚠️ Timestamp rollback warnings detected for ${username}. Suppressing repeated FFmpeg DTS spam.` + reset);
      }
      currentState.errorState.consecutiveTimestampWarnings += timestampWarningCount;

      if (timestampRestartThreshold > 0 && currentState.errorState.consecutiveTimestampWarnings >= timestampRestartThreshold) {
        console.log(yellow + `⚠️ Detected repeated timestamp rollback warnings for ${username} (${currentState.errorState.consecutiveTimestampWarnings}). Restarting with a fresh stream URL...` + reset);
        currentState.errorState.consecutiveTimestampWarnings = 0;
        currentState.errorState.firstTimestampWarningAt = null;
        stopRecording({ restart: true, username });
      }
      return;
    }

    const isReconnectNotice = /Will reconnect/i.test(text) || /End of file/i.test(text) || /keepalive request failed/i.test(text);
    if (isReconnectNotice) {
      console.log(blue + '[ffmpeg] INFO: ' + text + reset);
      return;
    }

    if (/Invalid data found|not find a matching/i.test(text)) {
      console.log(yellow + '[ffmpeg] WARN: ' + text + reset);
      return;
    }

    if (text.toLowerCase().includes('error')) {
      console.log(red + '[ffmpeg] ERROR: ' + text + reset);
    } else if (text.toLowerCase().includes('warning')) {
      console.log(yellow + '[ffmpeg] WARNING: ' + text + reset);
    } else {
      console.log(blue + '[ffmpeg] ' + text + reset);
    }
  });

  ffmpegProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text && !text.includes('frame=')) {
      console.log(blue + '[ffmpeg-stdout] ' + text + reset);
    }
  });
}

function stopRecording(options = {}) {
  const targetUser = options.username;
  const usernamesToStop = targetUser ? [targetUser] : Array.from(activeRecordings.keys());

  if (usernamesToStop.length === 0) {
    maybeExitAfterShutdown();
    return;
  }

  for (const username of usernamesToStop) {
    const state = getRecordingState(username);
    if (!state) {
      continue;
    }

    state.intentionalStop = !options.restart;
    state.pendingRestart = Boolean(options.restart);
    console.log(yellow + `🛑 Stopping recording gracefully for ${username}...` + reset);
    if (state.ffmpegProcess.stdin && !state.ffmpegProcess.stdin.destroyed) {
      state.ffmpegProcess.stdin.write('q\n');
    } else if (!state.ffmpegProcess.killed) {
      state.ffmpegProcess.kill('SIGTERM');
    }
    state.errorState.consecutiveHlsFailures = 0;
    state.errorState.firstFailureAt = null;
    state.errorState.consecutiveCorruptPackets = 0;
    state.errorState.firstCorruptPacketAt = null;
    state.errorState.consecutiveTimestampWarnings = 0;
    state.errorState.firstTimestampWarningAt = null;
  }
}

function requestShutdown(exitCode = 0, reason = 'Exiting gracefully...') {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  shutdownExitCode = exitCode;
  console.log(yellow + `✋ ${reason}` + reset);

  if (activeRecordings.size === 0) {
    maybeExitAfterShutdown();
    return;
  }

  stopRecording();
  setTimeout(() => {
    if (activeRecordings.size > 0) {
      console.log(yellow + '⌛ FFmpeg did not exit in time. Forcing shutdown.' + reset);
      process.exit(exitCode);
    }
  }, 10000);
}

function scheduleRestart(username) {
  if (restartTimers.has(username) || isRecording(username) || shutdownRequested) {
    return;
  }

  const retryDelayMs = getRetryDelayMs(username);
  const restartTimer = setTimeout(async () => {
    restartTimers.delete(username);
    if (!isRecording(username) && !shutdownRequested) {
      console.log(yellow + `🔁 Retrying recording for ${username} after FFmpeg stopped unexpectedly...` + reset);
      const streamUrl = await getHlsStreamUrl(username);
      if (streamUrl && streamUrl !== liveNoStreamUrl) {
        startRecording(username, streamUrl);
      } else {
        console.log(yellow + `⚠️ Stream unavailable for ${username} when retrying. Monitor loop will try again later.` + reset);
      }
    }
  }, retryDelayMs);
  restartTimers.set(username, restartTimer);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDuration(rawValue, fallbackSeconds = 10) {
  console.log(cyan + '🧮 Raw duration value:', rawValue + reset);

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallbackSeconds;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  const unitMatch = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
  if (!unitMatch) {
    return fallbackSeconds;
  }

  const value = Number(unitMatch[1]);
  if (Number.isNaN(value)) {
    return fallbackSeconds;
  }

  let seconds = value;
  const unit = unitMatch[2];
  if (unit === 'ms') {
    seconds = value / 1000;
  } else if (unit === 'm') {
    seconds = value * 60;
  } else if (unit === 'h') {
    seconds = value * 60 * 60;
  }

  if (seconds <= 0) {
    return fallbackSeconds;
  }

  const maxSeconds = 24 * 60 * 60;
  if (seconds > maxSeconds) {
    console.log(yellow + `⚠️ Duration capped at 24 hours (was ${seconds} seconds)` + reset);
    seconds = maxSeconds;
  }

  return seconds;
}

function parseDurationMs(rawValue, fallbackMs) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallbackMs;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  const unitMatch = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
  if (!unitMatch) {
    return fallbackMs;
  }

  const value = Number(unitMatch[1]);
  if (Number.isNaN(value) || value <= 0) {
    return fallbackMs;
  }

  const unit = unitMatch[2] || 's';
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 's') return value * 1000;
  return value;
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
    return '0s';
  }

  const rounded = Math.round(seconds);
  if (rounded < 60) {
    return `${rounded}s`;
  }

  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function normalizeUsername(username) {
  return String(username || '').trim().replace(/^@+/, '').toLowerCase();
}

function parseManualStreamUrls(rawValue) {
  const parsedUrls = {};
  if (!rawValue) {
    return parsedUrls;
  }

  const normalized = String(rawValue).trim();
  if (!normalized) {
    return parsedUrls;
  }

  if (normalized.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(normalized);
      for (const [username, streamUrl] of Object.entries(parsedJson)) {
        if (streamUrl) {
          parsedUrls[normalizeUsername(username)] = String(streamUrl).trim();
        }
      }
      return parsedUrls;
    } catch (err) {
      console.log(yellow + `⚠️ Failed to parse TIKTOK_MANUAL_STREAM_URLS JSON: ${err.message}` + reset);
      return parsedUrls;
    }
  }

  for (const item of normalized.split(/[\r\n,]+/)) {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const username = normalizeUsername(item.slice(0, separatorIndex));
    const streamUrl = item.slice(separatorIndex + 1).trim();
    if (username && streamUrl) {
      parsedUrls[username] = streamUrl;
    }
  }

  return parsedUrls;
}

function getManualStreamUrl(username) {
  const uniqueId = normalizeUsername(username);
  const configuredUrls = {
    ...Object.fromEntries(
      Object.entries(manualStreamUrls)
        .map(([key, value]) => [normalizeUsername(key), String(value || '').trim()])
        .filter(([, value]) => Boolean(value))
    ),
    ...parseManualStreamUrls(process.env.TIKTOK_MANUAL_STREAM_URLS)
  };
  const streamUrl = configuredUrls[uniqueId];

  if (!streamUrl) {
    return null;
  }

  if (!/\.(?:flv|m3u8)(?:\?|$)/i.test(streamUrl)) {
    console.log(yellow + `⚠️ Manual URL for ${uniqueId} is not a direct .flv/.m3u8 stream URL. Ignoring it.` + reset);
    return null;
  }

  if (ffmpegLooksOld && /_hd5\.flv(?:\?|$)/i.test(streamUrl)) {
    console.log(yellow + `⚠️ Manual URL for ${uniqueId} is _hd5.flv (H.265/HEVC). The bundled FFmpeg is too old for this stream. Find an _or4.flv/.m3u8 URL or set FFMPEG_PATH to a newer FFmpeg.` + reset);
    return null;
  }

  return streamUrl;
}

function decodeEscapes(value) {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function getTikTokPageHeaders(uniqueId, cookieHeader = '') {
  const headers = {
    'User-Agent': tiktokBrowserUserAgent,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `https://www.tiktok.com/@${uniqueId}`
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  return headers;
}

async function fetchTikTokLiveHtml(uniqueId, cookieHeader = '') {
  const url = `https://www.tiktok.com/@${uniqueId}/live`;
  const response = await axios.get(url, {
    headers: getTikTokPageHeaders(uniqueId, cookieHeader),
    responseType: 'text',
    validateStatus: () => true,
    timeout: 10000
  });

  if (response.status !== 200) {
    cyberEvent('warn', uniqueId, `TikTok returned HTTP ${response.status}`, cookieHeader ? 'cookies' : 'public');
    return null;
  }

  return response.data;
}

function extractStreamUrlFromLiveHtml(uniqueId, html, sourceLabel) {
  const sigiMatch = html.match(/<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i);

  if (sigiMatch && sigiMatch[1]) {
    try {
      const sigiState = JSON.parse(sigiMatch[1]);
      const isLive = sigiState.LiveRoom && sigiState.LiveRoom.liveRoomUserInfo && sigiState.LiveRoom.liveRoomUserInfo.liveRoom;
      if (!isLive) {
        cyberEvent('idle', uniqueId, 'offline', sourceLabel);
        return null;
      }

      const liveData = sigiState.LiveRoom.liveRoomUserInfo.liveRoom;
      if (liveData.status !== 2) {
        cyberEvent('idle', uniqueId, `offline status ${liveData.status}`, sourceLabel);
        return null;
      }

      cyberEvent('live', uniqueId, 'signal locked', sourceLabel);

      const blockedFormats = getTemporarilyBlockedFormats(uniqueId);
      const streamUrl = findBestStreamUrlInJson(sigiState, blockedFormats);
      if (streamUrl) {
        const decodedUrl = decodeEscapes(streamUrl);
        streamUrlSources.set(decodedUrl, sourceLabel);
        cyberEvent('rec', uniqueId, 'stream URL found in JSON', `${describeStreamUrl(decodedUrl)} / ${sourceLabel}`);
        return decodedUrl;
      }

      const htmlMatches = html.match(/https?:\/\/[^"'\s]*?\.(?:m3u8|flv)(?:\?[^"'\s]*)?/gi) || [];
      const htmlStreamUrl = pickBestStreamUrl(htmlMatches, blockedFormats);
      if (htmlStreamUrl) {
        const decodedUrl = decodeEscapes(htmlStreamUrl);
        streamUrlSources.set(decodedUrl, sourceLabel);
        cyberEvent('rec', uniqueId, 'stream URL found in HTML', `${describeStreamUrl(decodedUrl)} / ${sourceLabel}`);
        return decodedUrl;
      }

      return liveNoStreamUrl;
    } catch (jsonErr) {
      console.log(yellow + '⚠️ Failed to parse SIGI_STATE for', uniqueId, ':', jsonErr.message + reset);
    }
  }

  cyberEvent('warn', uniqueId, 'no SIGI_STATE found', sourceLabel);
  return null;
}

async function getHlsStreamUrl(username) {
  const uniqueId = username.startsWith('@') ? username.slice(1) : username;
  cyberScan(uniqueId, 'cookies-first');

  try {
    let cookieResult = null;
    const cookieHeader = getTikTokCookieHeader({ forceReload: true });
    if (cookieHeader) {
      const cookieHtml = await fetchTikTokLiveHtml(uniqueId, cookieHeader);
      if (cookieHtml) {
        cookieResult = extractStreamUrlFromLiveHtml(uniqueId, cookieHtml, 'cookies');
        if (cookieResult && cookieResult !== liveNoStreamUrl) {
          return cookieResult;
        }

        if (cookieResult === liveNoStreamUrl) {
          cyberEvent('wait', uniqueId, 'cookie page hides stream URL', 'trying public fallback');
        }
      }
    }

    if (cookieHeader) {
      cyberScan(uniqueId, 'public fallback');
    }
    const publicHtml = await fetchTikTokLiveHtml(uniqueId);
    if (!publicHtml) {
      return cookieResult;
    }

    const publicResult = extractStreamUrlFromLiveHtml(uniqueId, publicHtml, 'public page');
    if (publicResult && publicResult !== liveNoStreamUrl) {
      if (!isPublicStreamUrlSourceBlocked(uniqueId)) {
        return publicResult;
      }

      cyberEvent('warn', uniqueId, 'skipping public stream URL', 'recent public URLs failed');
    }

    const manualStreamUrl = getManualStreamUrl(uniqueId);
    if (manualStreamUrl) {
      streamUrlSources.set(manualStreamUrl, 'manual URL');
      cyberEvent('warn', uniqueId, 'using manual stream URL', describeStreamUrl(manualStreamUrl));
      return manualStreamUrl;
    }

    if (cookieResult === liveNoStreamUrl || publicResult === liveNoStreamUrl) {
      cyberEvent('wait', uniqueId, 'live but no stream URL exposed', 'waiting');
      return liveNoStreamUrl;
    }

    return null;
  } catch (err) {
    console.error(red + '❌ Fetch error for', uniqueId, ':', err.message + reset);
    return null;
  }
}

function collectStreamUrls(node, urls = [], visited = new Set()) {
  if (!node || typeof node !== 'object' || visited.has(node)) {
    return urls;
  }

  visited.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      collectStreamUrls(item, urls, visited);
    }
    return urls;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === 'string') {
      const match = value.match(/https?:\/\/[^"'\s]*?\.(?:m3u8|flv)(?:\?[^"'\s]*)?/gi);
      if (match) {
        for (const url of match) {
          if (url.includes('only_audio=1')) {
            continue;
          }
          urls.push(url);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      collectStreamUrls(value, urls, visited);
    }
  }

  return urls;
}

function findBestStreamUrlInJson(node, blockedFormats = new Set()) {
  return pickBestStreamUrl(collectStreamUrls(node), blockedFormats);
}

function getStreamQualityRank(streamUrl) {
  const pathname = getStreamPathname(streamUrl).toLowerCase();
  if (/(?:_|-)or\d+(?=(?:\.(?:flv|m3u8)|\/))/.test(pathname)) return 50;
  if (/(?:_|-)hd(?=(?:\.(?:flv|m3u8)|\/))/.test(pathname)) return 40;
  if (/(?:_|-)sd(?=(?:\.(?:flv|m3u8)|\/))/.test(pathname)) return 30;
  if (/(?:_|-)ld(?=(?:\.(?:flv|m3u8)|\/))/.test(pathname)) return 10;
  return 20;
}

function getStreamFormatRank(streamUrl) {
  const lowerUrl = String(streamUrl || '').toLowerCase();
  const isFlv = /\.flv(?:\?|$)/i.test(lowerUrl);
  const isHls = /\.m3u8(?:\?|$)/i.test(lowerUrl);

  if (streamFormatPreference === 'hls' || streamFormatPreference === 'm3u8') {
    if (isHls) return 100;
    if (isFlv) return 50;
  }

  if (streamFormatPreference === 'flv') {
    if (isFlv) return 100;
    if (isHls) return 50;
  }

  if (isFlv) return 90;
  if (isHls) return 80;
  return 0;
}

function getStreamPathname(streamUrl) {
  try {
    return new URL(streamUrl).pathname;
  } catch (err) {
    return String(streamUrl || '').split('?')[0];
  }
}

function pickBestStreamUrl(urls, blockedFormats = new Set()) {
  const uniqueUrls = Array.from(new Set((urls || []).map(decodeEscapes)))
    .filter((url) => url && !url.includes('only_audio=1'));

  if (uniqueUrls.length === 0) {
    return null;
  }

  const allowedUrls = uniqueUrls.filter((url) => !blockedFormats.has(getStreamFormat(url)));
  if (blockedFormats.size > 0 && allowedUrls.length === 0) {
    return null;
  }

  const candidateUrls = allowedUrls.length > 0 ? allowedUrls : uniqueUrls;

  candidateUrls.sort((left, right) => {
    const leftScore = getStreamFormatRank(left) + getStreamQualityRank(left);
    const rightScore = getStreamFormatRank(right) + getStreamQualityRank(right);
    return rightScore - leftScore || right.length - left.length;
  });

  return candidateUrls[0];
}

function describeStreamUrl(streamUrl) {
  const lowerPathname = getStreamPathname(streamUrl).toLowerCase();
  const format = getStreamFormat(streamUrl);
  const qualityMatch = lowerPathname.match(/_(or\d+|hd|sd|ld)(?=(?:\.(?:flv|m3u8)|\/))/i);
  return `${format}${qualityMatch ? '/' + qualityMatch[1].toLowerCase() : ''}`;
}

function isInput404Message(text) {
  return /404 Not Found/i.test(text) || /Server returned 404 Not Found/i.test(text);
}

function isInput403Message(text) {
  return /403 Forbidden/i.test(text) || /Server returned 403 Forbidden/i.test(text);
}

function isLikelyTransientInputFailure(text) {
  return isInput404Message(text) || isInput403Message(text) || /Error opening input/i.test(text);
}

function requestImmediateRestart(username, reason) {
  const state = getRecordingState(username);
  if (!state || state.pendingRestart) {
    return;
  }

  console.log(yellow + `🔁 ${reason} Restarting ${username} with a fresh stream URL...` + reset);
  stopRecording({ restart: true, username });
}

async function monitorLoop() {
  while (true) {
    for (const username of usernames) {
      try {
        const streamUrl = await getHlsStreamUrl(username);

        if (streamUrl && streamUrl !== liveNoStreamUrl) {
          resetOfflineChecks(username);
          if (!isRecording(username)) {
            startRecording(username, streamUrl);
          } else {
            const currentState = getRecordingState(username);
            const latestStreamIdentity = getStreamIdentity(streamUrl);
            const latestStreamQualityRank = getStreamQualityRank(streamUrl);
            if (
              restartOnStreamChange &&
              currentState &&
              currentState.streamIdentity &&
              latestStreamIdentity &&
              latestStreamIdentity !== currentState.streamIdentity
            ) {
              const now = Date.now();
              if (now - currentState.lastStreamChangeRestartAt >= streamChangeRestartCooldownMs) {
                currentState.lastStreamChangeRestartAt = now;
                cyberEvent('warn', username, 'stream URL changed', 'restarting recorder');
                stopRecording({ restart: true, username });
              } else {
                cyberEvent('wait', username, 'stream changed', 'restart cooldown active');
              }
            } else if (
              restartOnBetterQuality &&
              currentState &&
              latestStreamQualityRank > currentState.streamQualityRank
            ) {
              const now = Date.now();
              if (now - currentState.lastBetterQualityRestartAt >= betterQualityRestartCooldownMs) {
                currentState.lastBetterQualityRestartAt = now;
                cyberEvent('warn', username, 'better quality found', `${describeStreamUrl(currentState.streamUrl)} -> ${describeStreamUrl(streamUrl)}`);
                stopRecording({ restart: true, username });
              } else {
                cyberEvent('wait', username, 'better quality found', 'restart cooldown active');
              }
            } else {
              cyberEvent('rec', username, 'already recording', currentState ? describeStreamUrl(currentState.streamUrl) : '');
            }
          }
        } else if (streamUrl === liveNoStreamUrl) {
          if (isRecording(username)) {
            resetOfflineChecks(username);
            cyberEvent('wait', username, 'live but no URL', 'keeping recording');
          } else {
            resetOfflineChecks(username);
            cyberEvent('wait', username, 'live but no URL', 'waiting for usable feed');
          }
        } else {
          if (isRecording(username)) {
            const offlineChecks = noteOfflineCheck(username);
            if (offlineChecks >= offlineConfirmationChecks) {
              cyberEvent('stop', username, 'live confirmed ended', `${offlineChecks} offline checks`);
              stopRecording({ username });
              resetOfflineChecks(username);
            } else {
              cyberEvent('wait', username, 'stream check missed', `${offlineChecks}/${offlineConfirmationChecks}`);
            }
          } else {
            resetOfflineChecks(username);
            cyberEvent('idle', username, 'offline', 'standby');
          }
        }
      } catch (err) {
        console.error(red + '❌ Monitor error for', username, err.message || err + reset);
      }
    }

    await wait(checkIntervalMs);
  }
}

process.on('SIGINT', () => {
  requestShutdown(0, 'Exiting gracefully...');
});

process.on('SIGTERM', () => {
  requestShutdown(0, 'Received SIGTERM, exiting gracefully...');
});

process.on('uncaughtException', (err) => {
  console.error(red + '❌ Uncaught exception:', err.stack || err + reset);
  if (activeRecordings.size > 0) {
    stopRecording();
  }
  console.log(yellow + '🔁 Restarting monitor loop after uncaught exception...' + reset);
  runMonitorLoop();
});

process.on('unhandledRejection', (reason) => {
  console.error(red + '❌ Unhandled rejection:', reason, reset);
  if (activeRecordings.size > 0) {
    stopRecording();
  }
  console.log(yellow + '🔁 Restarting monitor loop after unhandled rejection...' + reset);
  runMonitorLoop();
});

function runMonitorLoop() {
  monitorLoop().catch(async (err) => {
    console.error(red + 'Fatal monitor loop error:', err.stack || err + reset);
    await wait(5000);
    console.log(yellow + '🔁 Restarting monitor loop...' + reset);
    runMonitorLoop();
  });
}

runMonitorLoop();
