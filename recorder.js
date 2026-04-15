const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { spawn } = require('child_process');
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

// 25 account placeholders - Add your TikTok usernames here
const accountsList = [
  'kozak696990', 'cashmoneyotr', '', '', '',
  '', '', '', '', '',
  '', '', '', '', '',
  '', '', '', '', '',
  '', '', '', '', ''
];

const rawUsernames = process.env.TIKTOK_USERNAME || process.env.TIKTOK_USERNAMES || accountsList.join(',');
const usernames = rawUsernames.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
console.log(cyan + 'ℹ️ Configured usernames (' + usernames.length + '/25):', usernames.join(', ') || '(none configured yet)' + reset);
const checkIntervalMs = parseInt(process.env.CHECK_INTERVAL_MS, 10) || 40 * 1000;
const rawRecordDuration = process.env.RECORD_DURATION;
console.log(cyan + '🧮 Raw record duration value:', rawRecordDuration == null ? '(none)' : rawRecordDuration + reset);
const recordDurationSeconds = rawRecordDuration != null && rawRecordDuration !== '' ? parseDuration(rawRecordDuration, 10) : null;
const recordDurationLabel = recordDurationSeconds == null ? 'unlimited' : formatDuration(recordDurationSeconds);
console.log(cyan + 'ℹ️ Record duration:', recordDurationLabel + reset);

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
if (!ffmpegPath) {
  console.error('FFmpeg binary not found. Install FFmpeg, set FFMPEG_PATH, or install @ffmpeg-installer/ffmpeg.');
  process.exit(1);
}

if (!fs.existsSync('recordings')) {
  fs.mkdirSync('recordings', { recursive: true });
}

let ffmpegProcess = null;
let recordingUser = null;

function startRecording(username, streamUrl) {
  if (ffmpegProcess) {
    return;
  }

  const outputFile = path.join('recordings', `live_${username}_${Date.now()}.mp4`);
  console.log(green + '🎥 Starting recording for', username, '->', outputFile + reset);
  console.log(green + '⏱️ Record duration:', recordDurationLabel + reset);
  console.log(blue + '🔗 Stream URL:', streamUrl + reset);

  const ffmpegArgs = [
    '-y',
    '-hide_banner',
    '-loglevel', 'warning',
    // Connection & buffering settings
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-rtbufsize', '100M',
    '-fflags', '+discardcorrupt+genpts+igndts',
    '-flags', '+low_delay',
    '-flags2', '+fast',
    '-start_at_zero',
    '-avoid_negative_ts', 'make_zero',
    '-i', streamUrl,
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-crf', '24',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-af', 'aresample=async=1',
    '-vsync', '1',
    // Output format
    '-f', 'mp4',
    '-movflags', 'faststart+frag_keyframe+empty_moov+delay_moov',
    '-max_muxing_queue_size', '9999'
  ];

  if (recordDurationSeconds != null) {
    ffmpegArgs.push('-t', String(recordDurationSeconds));
  }

  ffmpegArgs.push(outputFile);
  ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

  ffmpegProcess.on('exit', (code, signal) => {
    if (code === 0) {
      console.log(green + `✅ Recording completed successfully for ${username}` + reset);
    } else {
      console.log(yellow + `🛑 FFmpeg exited (code=${code}, signal=${signal})` + reset);
    }
    ffmpegProcess = null;
    recordingUser = null;
  });

  ffmpegProcess.on('error', (err) => {
    console.error(red + '❌ FFmpeg process error:', err.message + reset);
    ffmpegProcess = null;
    recordingUser = null;
  });

  ffmpegProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      // Filter out verbose ffmpeg stats
      if (text.includes('frame=') || text.includes('time=') || text.includes('bitrate=')) {
        // Silently log progress
        process.stdout.write('.');
      } else if (text.toLowerCase().includes('error')) {
        console.log(red + '[ffmpeg] ERROR: ' + text + reset);
      } else if (text.toLowerCase().includes('warning')) {
        console.log(yellow + '[ffmpeg] WARNING: ' + text + reset);
      } else {
        console.log(blue + '[ffmpeg] ' + text + reset);
      }
    }
  });

  recordingUser = username;
}

function stopRecording() {
  if (!ffmpegProcess) {
    return;
  }

  console.log(yellow + '🛑 Stopping recording gracefully...' + reset);
  ffmpegProcess.stdin.write('q\n');
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
          console.log(green + '🎥 Found stream URL in JSON for', uniqueId + reset);
          return streamUrl;
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
              return url;
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

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === 'string') {
      const match = value.match(/https?:\/\/[^"'\s]*?\.(?:m3u8|flv)(?:\?[^"'\s]*)?/gi);
      if (match) {
        for (const url of match) {
          if (url.includes('only_audio=1')) {
            continue;
          }
          if (url.toLowerCase().includes('.m3u8')) {
            return url;
          }
          if (!flvCandidate) {
            flvCandidate = url;
          }
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = findStreamUrlInJson(value, visited);
      if (result) return result;
    }
  }

  return flvCandidate;
}

async function monitorLoop() {
  while (true) {
    if (recordingUser) {
      console.log(cyan + '⏸️ Recording in progress for', recordingUser, ', skipping live check' + reset);
      await wait(checkIntervalMs);
      continue;
    }

    for (const username of usernames) {
      try {
        const streamUrl = await getHlsStreamUrl(username);

        if (streamUrl) {
          if (!ffmpegProcess) {
            startRecording(username, streamUrl);
          } else if (recordingUser === username) {
            console.log(green + '✅ Already recording', username + reset);
          } else {
            console.log(yellow + '🔁 Another user is currently recording:', recordingUser + reset);
          }
        } else {
          if (ffmpegProcess && recordingUser === username) {
            console.log(red + '⚠️ Live ended or stream not found for', username + reset);
            stopRecording();
          } else {
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
  console.log(yellow + '✋ Exiting gracefully...' + reset);
  stopRecording();
  process.exit(0);
});

monitorLoop().catch((err) => {
  console.error(red + 'Fatal error:', err + reset);
  process.exit(1);
});
