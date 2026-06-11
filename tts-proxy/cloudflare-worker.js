/* Edge TTS Proxy for Cloudflare Workers */
/* Uses Microsoft Edge browser's free TTS service via WebSocket */

var EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
var EDGE_TTS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + EDGE_TTS_TOKEN;

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function synthesizeEdgeTTS(text, rate) {
  return new Promise(function(resolve, reject) {
    var ws = new WebSocket(EDGE_TTS_URL);
    var audioChunks = [];
    var done = false;
    var speedRatio = Math.max(0.8, Math.min(2.0, 1.0 / rate));

    ws.addEventListener('open', function() {
      var timestamp = new Date().toISOString();
      var requestId = '';
      var chars = '0123456789abcdef';
      for (var i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
          requestId += '-';
        } else if (i === 14) {
          requestId += '4';
        } else if (i === 19) {
          requestId += chars[8 + Math.floor(Math.random() * 4)];
        } else {
          requestId += chars[Math.floor(Math.random() * 16)];
        }
      }

      var configPayload = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: 'false',
                wordBoundaryEnabled: 'true'
              },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
            }
          }
        }
      });

      var configMsg = 'X-Timestamp:' + timestamp + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' + configPayload;
      ws.send(configMsg);

      var ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)"><prosody rate="' + (speedRatio * 100).toFixed(0) + '%">' + escapeXml(text) + '</prosody></voice></speak>';
      var ssmlMsg = 'X-RequestId:' + requestId + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + new Date().toISOString() + '\r\nPath:ssml\r\n\r\n' + ssml;
      ws.send(ssmlMsg);
    });

    ws.addEventListener('message', function(event) {
      if (done) return;

      // Workers WebSocket: binary messages are ArrayBuffer, not Blob
      if (event.data instanceof ArrayBuffer) {
        var uint8Array = new Uint8Array(event.data);
        if (uint8Array.length < 2) return;
        var headerLength = (uint8Array[0] << 8) | uint8Array[1];
        var headerEnd = 2 + headerLength;
        if (uint8Array.length <= headerEnd) return;
        var audioPayload = uint8Array.slice(headerEnd);
        if (audioPayload.length > 0) {
          audioChunks.push(audioPayload);
        }
      } else if (typeof event.data === 'string') {
        if (event.data.indexOf('Path:turn.end') !== -1) {
          done = true;
          ws.close();
        }
      }
    });

    ws.addEventListener('close', function() {
      if (audioChunks.length === 0) {
        resolve(null);
        return;
      }
      var totalLength = 0;
      for (var i = 0; i < audioChunks.length; i++) {
        totalLength += audioChunks[i].length;
      }
      var result = new Uint8Array(totalLength);
      var offset = 0;
      for (var i = 0; i < audioChunks.length; i++) {
        result.set(audioChunks[i], offset);
        offset += audioChunks[i].length;
      }
      resolve(result.buffer);
    });

    ws.addEventListener('error', function(err) {
      reject(new Error('WebSocket error'));
    });

    setTimeout(function() {
      if (!done) ws.close();
      if (audioChunks.length === 0) reject(new Error('Timeout'));
    }, 15000);
  });
}

export default {
  fetch: function(request, env, ctx) {
    var corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    return request.json().then(function(body) {
      var text = body.text;
      var rate = body.rate || 1.0;

      if (!text || typeof text !== 'string') {
        return new Response(JSON.stringify({ error: 'text is required' }), {
          status: 400,
          headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
        });
      }

      return synthesizeEdgeTTS(text, rate).then(function(audioData) {
        if (!audioData) {
          return new Response(JSON.stringify({ error: 'TTS failed' }), {
            status: 500,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
          });
        }

        var bytes = new Uint8Array(audioData);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        var base64 = btoa(binary);

        return new Response(JSON.stringify({ code: 3000, data: base64 }), {
          headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
        });
      });
    }).catch(function(err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    });
  }
};
