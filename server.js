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

// Memory store for conversation session
const memoryStore = new Map();
const SYSTEM_PROMPT = "You are Johnny Tec AI — a sharp, intelligent, witty cyber-neon AI assistant.";

// -------------------------------------------------------------
// 1. KEEP-ALIVE SELF-PING ROUTINE
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
// 3. API ROUTER ENDPOINTS
// -------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default-session', message, provider = 'groq' } = req.body;
    
    if (!memoryStore.has(sessionId)) {
      memoryStore.set(sessionId, [{ role: 'system', content: SYSTEM_PROMPT }]);
    }
    const history = memoryStore.get(sessionId);
    history.push({ role: 'user', content: message || 'Hello' });

    let reply = '';
    if (provider === 'claude') reply = await callClaude(history);
    else if (provider === 'gpt') reply = await callOpenAI(history);
    else reply = await callGroq(history);

    history.push({ role: 'assistant', content: reply });
    res.json({ success: true, provider, reply });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!process.env.REPLICATE_API_KEY) {
      return res.json({ success: false, error: 'REPLICATE_API_KEY environment variable is not set.' });
    }
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
// 4. API CALL HELPERS
// -------------------------------------------------------------
async function callGroq(messages) {
  if (!process.env.GROQ_API_KEY) return "GROQ_API_KEY is not configured in Render Environment Variables.";
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages })
  });
  const data = await res.json();
  if (data.error) return `Groq Error: ${data.error.message}`;
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) return "OPENAI_API_KEY is not configured in Render Environment Variables.";
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
  if (!process.env.ANTHROPIC_API_KEY) return "ANTHROPIC_API_KEY is not configured in Render Environment Variables.";
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
// 5. WEBSOCKET VOICE CONNECTION
// -------------------------------------------------------------
wss.on('connection', (ws) => {
  console.log('🎙️ Real-Time Voice Socket Connected');
  ws.on('message', (msg) => {
    ws.send(JSON.stringify({ status: 'received', message: 'Voice stream chunk processed' }));
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Johnny Tec AI Server live on port ${PORT}`);
});
      
