import axios from 'axios';
import crypto from 'crypto';

const ogmp3 = {
  api: {
    base: "https://api3.apiapi.lat",
    endpoints: {
      a: "https://api5.apiapi.lat",
      b: "https://api.apiapi.lat",
      c: "https://api3.apiapi.lat"
    }
  },

  headers: {
    'authority': 'api.apiapi.lat',
    'content-type': 'application/json',
    'origin': 'https://ogmp3.lat',
    'referer': 'https://ogmp3.lat/',
    'user-agent': 'Alastor-Radio-Service/1.0.0'
  },
 
  formats: {
    video: ['240', '360', '480', '720', '1080'],
    audio: ['64', '96', '128', '192', '256', '320']
  },

  default_fmt: { video: '720', audio: '320' },

  restrictedTimezones: new Set(["-330", "-420", "-480", "-540"]),

  utils: {
    hash: () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join(""),
    encoded: (str) => Array.from(str, c => String.fromCharCode(c.charCodeAt(0) ^ 1)).join(""),
    enc_url: (url) => url.split("").map(c => c.charCodeAt(0)).reverse().join(",")
  },

  isUrl: str => {
    try {
      const { hostname, searchParams } = new URL(str);
      return [/youtube\.com$/, /youtube-nocookie\.com$/, /youtu\.be$/].some(r => r.test(hostname)) && !searchParams.has("playlist");
    } catch { return false; }
  },

  youtube: url => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  },

  request: async (endpoint, data = {}, method = 'post') => {
    try {
      const endpoints = Object.values(ogmp3.api.endpoints);
      const url = endpoint.startsWith('http') ? endpoint : `${endpoints[Math.floor(Math.random() * endpoints.length)]}${endpoint}`;
      const { data: response } = await axios({ method, url, data: method === 'post' ? data : undefined, headers: ogmp3.headers });
      return { status: true, data: response };
    } catch (e) {
      return { status: false, error: e.message };
    }
  },

  async checkStatus(id) {
    const res = await this.request(`/${this.utils.hash()}/status/${this.utils.encoded(id)}/${this.utils.hash()}/`, { data: id });
    return res;
  },

  async checkProgress(data) {
    for (let i = 0; i < 300; i++) {
      const res = await this.checkStatus(data.i);
      if (res.status && (res.data.s === "C" || res.data.s === "P")) {
        if (res.data.s === "C") return res.data;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return null;
  },

  download: async (link, format, type = 'audio') => {
    if (!link) return { status: false, error: " ¡Un micrófono vacío no transmite nada, querido!" };
    if (!ogmp3.isUrl(link)) return { status: false, error: "📻 Esa sintonía no pertenece a nuestra estación. ¡Busca un link de YouTube válido!" };
    
    const id = ogmp3.youtube(link);
    if (!id) return { status: false, error: "⚠️ La ID de esa transmisión se ha perdido en el abismo." };

    try {
      for (let retries = 0; retries < 20; retries++) {
        const req = {
          data: ogmp3.utils.encoded(link),
          format: type === 'audio' ? "0" : "1",
          mp3Quality: type === 'audio' ? format : null,
          mp4Quality: type === 'video' ? format : null
        };

        const resx = await ogmp3.request(`/${ogmp3.utils.hash()}/init/${ogmp3.utils.enc_url(link)}/${ogmp3.utils.hash()}/`, req);
        if (!resx.status) continue;

        const data = resx.data;
        if (data.e || data.i === "invalid") return { status: false, error: "💀 Esa transmisión ha sido censurada o eliminada. ¡Qué tragedia!" };
        
        if (data.s === "C" || (await ogmp3.checkProgress(data))?.s === "C") {
          const finalData = data.s === "C" ? data : await ogmp3.checkProgress(data);
          return {
            status: true,
            result: {
              title: finalData.t || "Transmisión sin nombre",
              download: `${ogmp3.api.base}/${ogmp3.utils.hash()}/download/${ogmp3.utils.encoded(finalData.i)}/${ogmp3.utils.hash()}/`
            }
          };
        }
      }
      return { status: false, error: "📻 La interferencia es demasiado fuerte. ¡Inténtalo de nuevo en un momento!" };
    } catch (e) {
      return { status: false, error: "🔥 Algo ha salido horriblemente mal en los circuitos." };
    }
  }
};

export { ogmp3 };
