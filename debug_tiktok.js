const axios = require('axios');

async function debugUsername(user) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `https://www.tiktok.com/@${user}`,
  };

  const url = `https://www.tiktok.com/@${user}/live`;
  const res = await axios.get(url, { headers, responseType: 'text', validateStatus: () => true });
  console.log('STATUS', res.status);
  const html = res.data;

  // Look for stream URLs in the raw HTML
  const streamPatterns = [
    /https?:\/\/[^"'\s]*?\.m3u8[^"'\s]*/gi,
    /https?:\/\/[^"'\s]*?\.flv[^"'\s]*/gi,
    /"playAddr"\s*:\s*"([^"]*?)"/gi,
    /"playUrl"\s*:\s*"([^"]*?)"/gi,
    /"hls_url"\s*:\s*"([^"]*?)"/gi,
    /"streamUrl"\s*:\s*"([^"]*?)"/gi,
    /pull[^"'\s]*?\.tiktokcdn[^"'\s]*/gi
  ];

  console.log('=== STREAM URL SEARCH ===');
  streamPatterns.forEach((pattern, i) => {
    const matches = html.match(pattern);
    if (matches) {
      console.log(`Pattern ${i}:`, matches.slice(0, 5));
    }
  });

  // Look for WebSocket or API endpoints
  const wsPatterns = [
    /wss?:\/\/[^"'\s]*?/gi,
    /webcast[^"'\s]*?\.tiktok[^"'\s]*/gi,
    /api[^"'\s]*?\.tiktok[^"'\s]*/gi
  ];

  console.log('=== WEBSOCKET/API SEARCH ===');
  wsPatterns.forEach((pattern, i) => {
    const matches = html.match(pattern);
    if (matches) {
      console.log(`WS Pattern ${i}:`, matches.slice(0, 3));
    }
  });
  const sigiIndex = html.indexOf('SIGI_STATE');
  console.log('SIGI index', sigiIndex);
  if (sigiIndex >= 0) {
    console.log('SIGI snippet', html.slice(Math.max(0, sigiIndex - 200), sigiIndex + 200));
  }
  const marker = '<script id="SIGI_STATE" type="application/json">';
  const start = html.indexOf(marker);
  console.log('hasSIGI', start >= 0);
  if (start >= 0) {
    const end = html.indexOf('</script>', start);
    const json = html.substring(start + marker.length, end);
    console.log('jsonLen', json.length);
    const obj = JSON.parse(json);
    console.log('rootKeys', Object.keys(obj).join(','));

    const matches = [];
    function traverse(o, path) {
      if (typeof o === 'string') {
        if (o.includes('.m3u8') || o.includes('.flv') || o.toLowerCase().includes('playurl') || o.toLowerCase().includes('stream') || o.toLowerCase().includes('pull') || o.toLowerCase().includes('cdn')) {
          matches.push({ path, value: o });
          if (matches.length >= 50) return;
        }
      } else if (Array.isArray(o)) {
        for (let i = 0; i < o.length && matches.length < 50; i++) {
          traverse(o[i], `${path}[${i}]`);
        }
      } else if (o && typeof o === 'object') {
        for (const k of Object.keys(o)) {
          if (matches.length >= 50) break;
          traverse(o[k], `${path}.${k}`);
        }
      }
    }

    traverse(obj, 'root');
    console.log('matches', matches.slice(0, 50));

    // Check if user is live
    const isLive = obj.LiveRoom && obj.LiveRoom.liveRoomUserInfo && obj.LiveRoom.liveRoomUserInfo.liveRoom;
    console.log('isLive', !!isLive);
    if (isLive) {
      const liveData = obj.LiveRoom.liveRoomUserInfo.liveRoom;
      console.log('liveRoom data:', JSON.stringify(liveData, null, 2));

      // Extract room ID and user ID
      const roomId = obj.CurrentRoom && obj.CurrentRoom.roomId;
      const userId = obj.LiveRoom.liveRoomUserInfo.user && obj.LiveRoom.liveRoomUserInfo.user.id;
      console.log('roomId:', roomId);
      console.log('userId:', userId);

      // Try to get stream URL via TikTok API
      if (roomId) {
        try {
          const apiUrl = `https://webcast.tiktok.com/webcast/room/info/?room_id=${roomId}&app_name=tiktok_web`;
          console.log('Trying API URL:', apiUrl);
          const apiRes = await axios.get(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              'Referer': `https://www.tiktok.com/@${user}/live`
            },
            timeout: 5000
          });
          console.log('API Response status:', apiRes.status);
          if (apiRes.data && apiRes.data.data) {
            console.log('API Stream data:', JSON.stringify(apiRes.data.data, null, 2));
          }
        } catch (apiErr) {
          console.log('API call failed:', apiErr.message);
        }
      }
    }
  }
}

debugUsername(process.argv[2] || 'margarita.liliia').catch((err) => {
  console.error(err);
  process.exit(1);
});
