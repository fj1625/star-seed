/**
 * Star Seed — Edge TTS Proxy (Microsoft Edge Read Aloud)
 * Free, no API key, no quota limit.
 * Deploy to Cloudflare Workers.
 */

const EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_TTS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TTS_TOKEN}`;

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { text, rate = 1.0 } = body;

      if (!text || typeof text !== 'string') {
        return new Response(JSON.stringify({ error: 'text is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const audioData = await synthesizeEdgeTTS(text, rate);

      if (!audioData) {
        return new Response(JSON.stringify({ error: 'TTS failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Convert to base64
      const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));

      return new Response(JSON.stringify({ code: 3000, data: base64 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function synthesizeEdgeTTS(text, rate) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(EDGE_TTS_URL);
    const audioChunks = [];
    let done = false;

    // Speed ratio mapping: 0.8-2.0, default 1.0
    // Edge TTS rate is inverse: lower rate = faster speech
    const speedRatio = Math.max(0.8, Math.min(2.0, 1.0 / rate));

    ws.addEventListener('open', () => {
      const timestamp = new Date().toISOString();
      const requestId = crypto.randomUUID();

      // 1. Send config
      const configPayload = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: 'false',
                wordBoundaryEnabled: 'true',
              },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            },
          },
        },
      });
      const configMsg = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${configPayload}`;
      ws.send(configMsg);

      // 2. Send SSML
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)"><prosody rate="${(speedRatio * 100).toFixed(0)}%">${escapeXml(text)}</prosody></voice></speak>`;
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    });

    ws.addEventListener('message', async (event) => {
      if (done) return;

      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Edge TTS binary format: [2-byte header length][header JSON][audio data]
        if (uint8Array.length < 2) return;
        const headerLength = (uint8Array[0] << 8) | uint8Array[1];
        const headerEnd = 2 + headerLength;

        if (uint8Array.length <= headerEnd) return;

        // Extract audio payload
        const audioPayload = uint8Array.slice(headerEnd);
        if (audioPayload.length > 0) {
          audioChunks.push(audioPayload);
        }
      } else if (typeof event.data === 'string') {
        // Text control messages
        if (event.data.includes('Path:turn.end')) {
          done = true;
          ws.close();
        }
      }
    });

    ws.addEventListener('close', () => {
      if (audioChunks.length === 0) {
        resolve(null);
        return;
      }
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(result.buffer);
    });

    ws.addEventListener('error', (err) => {
      reject(new Error('WebSocket error'));
    });

    // Timeout guard
    setTimeout(() => {
      if (!done) {
        ws.close();
      }
      if (audioChunks.length === 0) {
        reject(new Error('Timeout'));
      }
    }, 15000);
  });
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
