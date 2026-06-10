/**
 * Star Seed — Volcano Engine TTS Proxy
 * Deploy this to Cloudflare Workers to keep API keys secret.
 *
 * Setup:
 * 1. Go to https://workers.cloudflare.com/ (free account)
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Deploy
 * 5. Copy the Worker URL (e.g. https://star-seed-tts.yourname.workers.dev)
 * 6. Paste it into js/audio.js as VOLCANO_WORKER_URL
 */

// ==== CONFIG: Replace with your Volcano Engine credentials ====
const VOLC_APPID = '7207252668';
const VOLC_TOKEN = 'i8iN5_phIawWujvD-I8dpTZrvEuzC5aG';
const VOLC_CLUSTER = 'volcano_tts';

// English voice — change this in the Volcano console if you prefer another
const VOICE_TYPE = 'en_female_dacey_uranus_bigtts';

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

      const reqid = crypto.randomUUID();

      const payload = {
        app: {
          appid: VOLC_APPID,
          token: VOLC_TOKEN,
          cluster: VOLC_CLUSTER,
        },
        user: {
          uid: 'star-seed-' + reqid.slice(0, 8),
        },
        audio: {
          voice_type: VOICE_TYPE,
          encoding: 'mp3',
          speed_ratio: rate,
          volume_ratio: 1.0,
          pitch_ratio: 1.0,
        },
        request: {
          reqid: reqid,
          text: text,
          text_type: 'plain',
          operation: 'query',
        },
      };

      const volcResponse = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer;${VOLC_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await volcResponse.json();

      // Forward the response as-is (contains base64 audio in result.data)
      return new Response(JSON.stringify(result), {
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
