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

// Conversation Memory Store
const memoryStore = new Map();
const SYSTEM_PROMPT = "You are Johnny Tec AI — a sharp, intelligent, witty cyber-neon AI assistant.";

// -------------------------------------------------------------
// 1. KEEP-ALIVE SELF-PING ROUTINE (Prevents Render Sleep)
// -------------------------------------------------------------
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || 'https://johnny-tec-backend-in37.onrender.com';

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'active', timestamp: new Date().toISOString() });
});

// Self-ping every 10 minutes to stay awake
setInterval(async () => {
  try {
    const response = await fetch(`${SERVER_URL}/ping`);
    console.log(`⚡ Keep-Alive Ping Status: ${response.status} at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.log('Keep-Alive Ping Error:', err.message);
  }
}, 10 * 60 * 1000);

// -------------------------------------------------------------
// 2. SERVE INDEX.HTML FRONTEND
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -------------------------------------------------------------
// 3. API ENDPOINTS
// -------------------------------------------------------------

// CHAT ROUTER ENDPOINT (Groq, GPT, Claude)
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default-session', message, provider = 'groq' } = req.body;
    
    if (!memoryStore.has(sessionId)) {
      memoryStore.set(sessionId, [{ role: 'system', content: SYSTEM_PROMPT }]);
    }
    const history = memoryStore.get(sessionId);
    history.push({ role: 'user', content: message });

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

// FLUX IMAGE GENERATION ENDPOINT
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input: { prompt, aspect_ratio: '1:1' } })
    });
    const data = await response.json();
    res.json({ success: true, imageUrl: data.output ? data.output[0] : null, raw: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HELPER API FUNCTIONS
async function callGroq(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3-70b-8192', messages })
  });
  const data = await res.json();
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages })
  });
  const data = await res.json();
  return data.choices ? data.choices[0].message.content : JSON.stringify(data);
}

async function callClaude(messages) {
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
  return data.content ? data.content[0].text : JSON.stringify(data);
}

// REAL-TIME VOICE WEBSOCKET
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
