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
const reset = '\x1b[0m';

const accountsList = [
  '', '', '', '', '',
  '', '', '', '', '',
  '', '', '', '', '',
  '', '', '', '', '',
  '', '', '', '', ''
];

const rawUsernames = process.env.TIKTOK_USERNAME || process.env.TIKTOK_USERNAMES || accountsList.join(',');
const usernames = rawUsernames.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
console.log(cyan + 'ℹ️ Configured usernames (' + usernames.length + '/25):', usernames.join(', ') || '(none configured yet)' + reset);
const checkIntervalMs = parseInt(process.env.CHECK_INTERVAL_MS, 10) || 40 * 1000;
const offlineConfirmationChecks = Math.max(1, parseInt(process.env.OFFLINE_CONFIRMATION_CHECKS || '3', 10) || 3);
const rawRecordDuration = process.env.RECORD_DURATION;
console.log(cyan + '🧮 Raw record duration value:', rawRecordDuration == null ? '(none)' : rawRecordDuration + reset);
const recordDurationSeconds = rawRecordDuration != null && rawRecordDuration !== '' ? parseDuration(rawRecordDuration, 10) : null;
const recordDurationLabel = recordDurationSeconds == null ? 'unlimited' : formatDuration(recordDurationSeconds);
console.log(cyan + 'ℹ️ Record duration:', recordDurationLabel + reset);
console.log(cyan + 'ℹ️ Offline confirmation checks: ' + offlineConfirmationChecks + reset);
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

  if (process.platform === 'linux' && canRunFfmpeg('ffmpeg')) {
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

console.log(cyan + '📄 Working directory: ' + process.cwd() + reset);
console.log(cyan + '📁 Recordings folder: ' + path.resolve('recordings') + reset);
console.log(cyan + '🎞️ Using FFmpeg binary: ' + ffmpegPath + reset);

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
if (ffmpegVersionLine) {
  console.log(cyan + '🎞️ FFmpeg probe: ' + ffmpegVersionLine + reset);
}

const activeRecordings = new Map();
const activeTransfers = new Map();
const restartTimers = new Map();
const liveCheckState = new Map();
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
    console.log(cyan + `📤 Upload target enabled: ${uploadConfig.user}@${uploadConfig.host}:${uploadConfig.remotePath}` + reset);
  } else {
    console.log(yellow + `⚠️ Upload requested but disabled: ${uploadConfig.reason}` + reset);
  }
} else {
  console.log(cyan + '📤 Upload target: disabled' + reset);
}

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
  const isFlvStream = /\.flv(?:\?|$)/i.test(streamUrl);

  return {
    outputFile: path.join('recordings', `live_${safeUsername}_${timestamp}.mkv`),
    outputFormat: 'matroska',
    useBitstreamFilter: isFlvStream
  };
}

function startRecording(username, streamUrl) {
  if (isRecording(username)) {
    return;
  }

  const outputConfig = getOutputConfig(streamUrl, username);
  const outputFile = outputConfig.outputFile;
  console.log(green + '🎥 Starting recording for', username, '->', outputFile + reset);
  console.log(green + '⏱️ Record duration:', recordDurationLabel + reset);
  console.log(blue + '🔗 Stream URL:', streamUrl + reset);

  const ffmpegArgs = [
    '-y',
    '-hide_banner',
    '-loglevel', 'warning',
    '-fflags', '+discardcorrupt',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-rw_timeout', '15000000',
    '-rtbufsize', '100M',
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
  console.log(cyan + '🔧 FFmpeg command: ' + ffmpegPath + ' ' + ffmpegArgs.map(arg => `"${arg}"`).join(' ') + reset);
  console.log(cyan + '🏃 Spawning FFmpeg process...' + reset);
  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
  console.log(cyan + `✅ FFmpeg process spawned for ${username} (PID: ${ffmpegProcess.pid})` + reset);

  const state = {
    ffmpegProcess,
    streamUrl,
    intentionalStop: false,
    pendingRestart: false,
    errorState: {
      consecutiveHlsFailures: 0,
      firstFailureAt: null
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
        console.log(green + `✅ Recording completed successfully for ${username}` + reset);
        if (fileSize > 0) {
          queueUpload(username, resolvedOutputFile);
        } else {
          console.log(yellow + `⚠️ Skipping upload for ${username}: output file is empty` + reset);
        }
      } else {
        console.log(yellow + `🛑 FFmpeg exited (code=${code}, signal=${signal})` + reset);
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
      }
      requestImmediateRestart(username, 'Input stream failed.');
    }

    if (text.includes('frame=') || text.includes('time=') || text.includes('bitrate=')) {
      process.stdout.write('.');
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

  const restartTimer = setTimeout(async () => {
    restartTimers.delete(username);
    if (!isRecording(username) && !shutdownRequested) {
      console.log(yellow + `🔁 Retrying recording for ${username} after FFmpeg stopped unexpectedly...` + reset);
      const streamUrl = await getHlsStreamUrl(username);
      if (streamUrl) {
        startRecording(username, streamUrl);
      } else {
        console.log(yellow + `⚠️ Stream unavailable for ${username} when retrying. Monitor loop will try again later.` + reset);
      }
    }
  }, 5000);
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

function decodeEscapes(value) {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function getHlsStreamUrl(username) {
  const uniqueId = username.startsWith('@') ? username.slice(1) : username;
  console.log(cyan + '🔎 Checking live status for', uniqueId + reset);

  try {
    const url = `https://www.tiktok.com/@${uniqueId}/live`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `https://www.tiktok.com/@${uniqueId}`
      },
      responseType: 'text',
      validateStatus: () => true,
      timeout: 10000
    });

    if (response.status !== 200) {
      console.log(yellow + '⚠️ TikTok returned', response.status, 'for', uniqueId + reset);
      return null;
    }

    const html = response.data;
    const sigiMatch = html.match(/<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i);

    if (sigiMatch && sigiMatch[1]) {
      try {
        const sigiState = JSON.parse(sigiMatch[1]);

        // Check if user is live
        const isLive = sigiState.LiveRoom && sigiState.LiveRoom.liveRoomUserInfo && sigiState.LiveRoom.liveRoomUserInfo.liveRoom;
        if (!isLive) {
          console.log(blue + '⏳ Not live:', uniqueId + reset);
          return null;
        }

        const liveData = sigiState.LiveRoom.liveRoomUserInfo.liveRoom;
        if (liveData.status !== 2) {
          console.log(blue + '⏳ Not live (status:', liveData.status, '):', uniqueId + reset);
          return null;
        }

        console.log(green + '✅ User is live:', uniqueId + reset);

        // Try to find stream URLs in the JSON
        const streamUrl = findStreamUrlInJson(sigiState);
        if (streamUrl) {
          const decodedUrl = decodeEscapes(streamUrl);
          console.log(green + '🎥 Found stream URL in JSON for', uniqueId + reset);
          return decodedUrl;
        }

        // Fallback: look for stream URLs in HTML
        const streamPatterns = [
          /https?:\/\/[^"'\s]*?\.m3u8[^"'\s]*/gi,
          /https?:\/\/[^"'\s]*?\.flv[^"'\s]*/gi
        ];

        for (const pattern of streamPatterns) {
          const matches = html.match(pattern);
          if (matches && matches.length > 0) {
            const url = matches[0];
            if (!url.includes('only_audio=1')) {
              console.log(green + '🎥 Found stream URL in HTML for', uniqueId + reset);
              return decodeEscapes(url);
            }
          }
        }

        console.log(yellow + '⚠️ User is live but no stream URL found for', uniqueId + reset);
        return null;

      } catch (jsonErr) {
        console.log(yellow + '⚠️ Failed to parse SIGI_STATE for', uniqueId, ':', jsonErr.message + reset);
      }
    }

    console.log(yellow + '⚠️ No SIGI_STATE found for', uniqueId + reset);
    return null;

  } catch (err) {
    console.error(red + '❌ Fetch error for', uniqueId, ':', err.message + reset);
    return null;
  }
}

function findStreamUrlInJson(node, visited = new Set()) {
  if (!node || typeof node !== 'object' || visited.has(node)) {
    return null;
  }

  visited.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findStreamUrlInJson(item, visited);
      if (result) return result;
    }
    return null;
  }

  let flvCandidate = null;
  let m3u8Candidate = null;

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === 'string') {
      const match = value.match(/https?:\/\/[^"'\s]*?\.(?:m3u8|flv)(?:\?[^"'\s]*)?/gi);
      if (match) {
        for (const url of match) {
          if (url.includes('only_audio=1')) {
            continue;
          }
          if (url.toLowerCase().includes('.flv')) {
            if (!flvCandidate) {
              flvCandidate = url;
            }
            continue;
          }
          if (!m3u8Candidate) {
            m3u8Candidate = url;
          }
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = findStreamUrlInJson(value, visited);
      if (result) return result;
    }
  }

  return flvCandidate || m3u8Candidate;
}

function isInput404Message(text) {
  return /404 Not Found/i.test(text) || /Server returned 404 Not Found/i.test(text);
}

function isLikelyTransientInputFailure(text) {
  return isInput404Message(text) || /Error opening input/i.test(text);
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

        if (streamUrl) {
          resetOfflineChecks(username);
          if (!isRecording(username)) {
            startRecording(username, streamUrl);
          } else {
            console.log(green + '✅ Already recording', username + reset);
          }
        } else {
          if (isRecording(username)) {
            const offlineChecks = noteOfflineCheck(username);
            if (offlineChecks >= offlineConfirmationChecks) {
              console.log(red + `⚠️ Live confirmed ended for ${username} after ${offlineChecks} offline checks.` + reset);
              stopRecording({ username });
              resetOfflineChecks(username);
            } else {
              console.log(yellow + `⚠️ Stream check missed for ${username} (${offlineChecks}/${offlineConfirmationChecks}). Keeping current recording running.` + reset);
            }
          } else {
            resetOfflineChecks(username);
            console.log(blue + '⏳ Not live:', username + reset);
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
