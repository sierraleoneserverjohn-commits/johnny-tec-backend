const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const memoryStore = new Map();
const SYSTEM_PROMPT = "You are Johnny Tec AI — a sharp, intelligent, witty cyber-neon AI assistant.";

// -------------------------------------------------------------
// 1. KEEP-ALIVE ROUTINE
// -------------------------------------------------------------
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || 'https://johnny-tec-backend-in37.onrender.com';

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'active', timestamp: new Date().toISOString() });
});

setInterval(async () => {
  try {
    const response = await fetch(`${SERVER_URL}/ping`);
    console.log(`⚡ Keep-Alive Ping Status: ${response.status} at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.log('Keep-Alive Ping Error:', err.message);
  }
}, 10 * 60 * 1000);

// -------------------------------------------------------------
// 2. SERVE FRONTEND DASHBOARD
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -------------------------------------------------------------
// 3. API KEY & HEALTH STATUS ROUTE
// -------------------------------------------------------------
app.get('/api/keys-status', (req, res) => {
  const keysStatus = {
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    HF_TOKEN: !!process.env.HF_TOKEN,
    TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
    SERPAPI_KEY: !!process.env.SERPAPI_KEY,
    DEEPGRAM_API_KEY: !!process.env.DEEPGRAM_API_KEY,
    ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
    NEETS_API_KEY: !!process.env.NEETS_API_KEY,
    REPLICATE_API_KEY: !!process.env.REPLICATE_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    VIRUSTOTAL_API_KEY: !!process.env.VIRUSTOTAL_API_KEY,
    SHODAN_API_KEY: !!process.env.SHODAN_API_KEY,
    LUMALABS_API_KEY: !!process.env.LUMALABS_API_KEY
  };
  res.json({ success: true, keys: keysStatus });
});

// -------------------------------------------------------------
// 4. CHAT AI ROUTER ENDPOINT
// -------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default-session', message, provider = 'gemini' } = req.body;
    
    if (!memoryStore.has(sessionId)) {
      memoryStore.set(sessionId, [{ role: 'system', content: SYSTEM_PROMPT }]);
    }
    const history = memoryStore.get(sessionId);
    history.push({ role: 'user', content: message || 'Hello' });

    let reply = '';
    if (provider === 'gemini') reply = await callGemini(history);
    else if (provider === 'openrouter') reply = await callOpenRouter(history);
    else if (provider === 'groq') reply = await callGroq(history);
    else if (provider === 'huggingface') reply = await callHuggingFace(history);
    else if (provider === 'claude') reply = await callClaude(history);
    else if (provider === 'gpt') reply = await callOpenAI(history);
    else reply = await callGemini(history);

    history.push({ role: 'assistant', content: reply });
    res.json({ success: true, provider, reply });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. IMAGE GENERATION ROUTE
// -------------------------------------------------------------
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, engine = 'replicate' } = req.body;

    if (engine === 'huggingface') {
      if (!process.env.HF_TOKEN) return res.json({ success: false, error: 'HF_TOKEN missing.' });
      const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev", {
        headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      });
      const blob = await response.arrayBuffer();
      const base64 = Buffer.from(blob).toString('base64');
      return res.json({ success: true, imageUrl: `data:image/jpeg;base64,${base64}` });
    }

    if (!process.env.REPLICATE_API_KEY) return res.json({ success: false, error: 'REPLICATE_API_KEY missing.' });
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input: { prompt: prompt || 'Cyberpunk city', aspect_ratio: '1:1' } })
    });
    const data = await response.json();
    res.json({ success: true, imageUrl: data.output ? data.output[0] : null, raw: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6. LIVE WEB SEARCH ROUTE (TAVILY / SERPAPI)
// -------------------------------------------------------------
app.post('/api/search', async (req, res) => {
  try {
    const { query, engine = 'tavily' } = req.body;

    if (engine === 'serpapi') {
      if (!process.env.SERPAPI_KEY) return res.json({ success: false, error: 'SERPAPI_KEY missing.' });
      const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}`);
      const data = await response.json();
      return res.json({ success: true, results: data.organic_results });
    }

    if (!process.env.TAVILY_API_KEY) return res.json({ success: false, error: 'TAVILY_API_KEY missing.' });
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic' })
    });
    const data = await response.json();
    res.json({ success: true, results: data.results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. VOICE TO TEXT (SPEECH TRANSCRIBE VIA GROQ WHISPER)
// -------------------------------------------------------------
app.post('/api/voice-to-text', async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    if (!process.env.GROQ_API_KEY) return res.json({ success: false, error: 'GROQ_API_KEY missing.' });
    
    const buffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-large-v3');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData
    });
    const data = await response.json();
    res.json({ success: true, text: data.text });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 8. TEXT TO AUDIO (NEETS AI TTS)
// -------------------------------------------------------------
app.post('/api/text-to-audio', async (req, res) => {
  try {
    const { text, voiceId = 'us-v1' } = req.body;
    if (!process.env.NEETS_API_KEY) return res.json({ success: false, error: 'NEETS_API_KEY missing.' });

    const response = await fetch('https://api.neets.ai/v1/tts', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.NEETS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice_id: voiceId, params: { model: 'ar-diff-50k' } })
    });
    const blob = await response.arrayBuffer();
    const base64 = Buffer.from(blob).toString('base64');
    res.json({ success: true, audioUrl: `data:audio/mp3;base64,${base64}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 9. CYBERSECURITY ANALYSIS ROUTE (VIRUSTOTAL & SHODAN)
// -------------------------------------------------------------
app.post('/api/cyber-scan', async (req, res) => {
  try {
    const { target, type = 'url' } = req.body;

    if (type === 'shodan') {
      if (!process.env.SHODAN_API_KEY) return res.json({ success: false, error: 'SHODAN_API_KEY missing.' });
      const response = await fetch(`https://api.shodan.io/shodan/host/${target}?key=${process.env.SHODAN_API_KEY}`);
      const data = await response.json();
      return res.json({ success: true, data });
    }

    if (!process.env.VIRUSTOTAL_API_KEY) return res.json({ success: false, error: 'VIRUSTOTAL_API_KEY missing.' });
    const urlId = Buffer.from(target).toString('base64').replace(/=/g, '');
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
    });
    const data = await response.json();
    res.json({ success: true, data: data.data ? data.data.attributes : data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 10. AI VIDEO GENERATOR (LUMA AI & HF ANIMATEDIFF)
// -------------------------------------------------------------
app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, engine = 'luma' } = req.body;

    if (engine === 'luma') {
      if (!process.env.LUMALABS_API_KEY) return res.json({ success: false, error: 'LUMALABS_API_KEY missing.' });
      const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LUMALABS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, model: 'ray-2' })
      });
      const data = await response.json();
      return res.json({ success: true, generation: data });
    }

    if (!process.env.HF_TOKEN) return res.json({ success: false, error: 'HF_TOKEN missing.' });
    const response = await fetch("https://api-inference.huggingface.co/models/guoyww/animatediff-motion-adapter-v1-5-2", {
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ inputs: prompt }),
    });
    const blob = await response.arrayBuffer();
    const base64 = Buffer.from(blob).toString('base64');
    res.json({ success: true, videoUrl: `data:video/mp4;base64,${base64}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 11. API PROVIDER IMPLEMENTATIONS
// -------------------------------------------------------------
async function callGemini(messages) {
  if (!process.env.GEMINI_API_KEY) return "GEMINI_API_KEY is missing in Render.";
  const userMsg = messages[messages.length - 1].content;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: userMsg }] }] })
  });
  const data = await res.json();
  if (data.error) return `Gemini Error: ${data.error.message}`;
  return data.candidates ? data.candidates[0].content.parts[0].text : JSON.stringify(data);
}

async function callOpenRouter(messages) {
  if (!process.env.OPENROUTER_API_KEY) return "OPENROUTER_API_KEY is missing in Render.";
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek/deepseek-r1:free', messages })
  });
  const data = await res.json();
  if (data.error) return `OpenRouter Error: ${data.error.message}`;
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callGroq(messages) {
  if (!process.env.GROQ_API_KEY) return "GROQ_API_KEY is missing in Render.";
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages })
  });
  const data = await res.json();
  if (data.error) return `Groq Error: ${data.error.message}`;
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callHuggingFace(messages) {
  if (!process.env.HF_TOKEN) return "HF_TOKEN is missing in Render.";
  const userMsg = messages[messages.length - 1].content;
  const res = await fetch('https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'meta-llama/Llama-3.2-3B-Instruct', messages: [{ role: 'user', content: userMsg }] })
  });
  const data = await res.json();
  if (data.error) return `HuggingFace Error: ${data.error}`;
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) return "OPENAI_API_KEY is missing in Render.";
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages })
  });
  const data = await res.json();
  if (data.error) return `OpenAI Error: ${data.error.message}`;
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callClaude(messages) {
  if (!process.env.ANTHROPIC_API_KEY) return "ANTHROPIC_API_KEY is missing in Render.";
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1024, system: systemMsg, messages: userMsgs })
  });
  const data = await res.json();
  if (data.error) return `Anthropic Error: ${data.error.message}`;
  return data.content ? data.content[0].text : JSON.stringify(data);
}

// -------------------------------------------------------------
// 12. WEBSOCKET VOICE CONNECTION
// -------------------------------------------------------------
wss.on('connection', (ws) => {
  console.log('🎙️ Voice WebSocket Active');
  ws.on('message', (msg) => {
    ws.send(JSON.stringify({ status: 'active', message: 'Audio stream packet processed' }));
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Johnny TEC Server Live on Port ${PORT}`);
});
              
