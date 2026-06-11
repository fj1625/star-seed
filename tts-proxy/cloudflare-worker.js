/* Google Translate TTS Proxy for Cloudflare Workers */
/* Free, no API key, HTTP-based */

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

      var encodedText = encodeURIComponent(text);
      var url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodedText + '&tl=en&total=1&idx=0&textlen=' + text.length + '&client=tw-ob&ttsspeed=' + (Math.round(100 / rate) / 100);

      return fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Referer': 'https://translate.google.com/'
        }
      }).then(function(response) {
        if (!response.ok) {
          throw new Error('TTS request failed: ' + response.status);
        }
        return response.arrayBuffer();
      }).then(function(arrayBuffer) {
        var bytes = new Uint8Array(arrayBuffer);
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
