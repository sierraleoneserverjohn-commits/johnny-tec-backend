const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Conversation Memory Store
const memoryStore = new Map();

const SYSTEM_PROMPT = `
You are Johnny Tec AI — a sharp, intelligent, fun, and witty cyber-neon AI assistant.
Rules:
1. Silently auto-correct and understand user input even if misspelled.
2. Remember prior conversation history for context.
3. Keep answers concise, energetic, and helpful.
`;

// Health Check Route (Fixes 'Cannot GET /')
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🚀 Johnny Tec AI Backend Engine Running Smoothly!'
  });
});

// Helper: Fetch conversation history
function getHistory(sessionId) {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, [{ role: 'system', content: SYSTEM_PROMPT }]);
  }
  return memoryStore.get(sessionId);
}

// 1. ROUTER ENDPOINT (Handles Groq, GPT, Claude switching)
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId = 'default-session', message, provider = 'groq' } = req.body;
    const history = getHistory(sessionId);
    history.push({ role: 'user', content: message });

    let reply = '';

    switch (provider) {
      case 'groq':
        reply = await callGroqAPI(history);
        break;
      case 'gpt':
        reply = await callOpenAI(history);
        break;
      case 'claude':
        reply = await callClaude(history);
        break;
      default:
        reply = await callGroqAPI(history);
    }

    history.push({ role: 'assistant', content: reply });
    res.json({ success: true, reply, provider });
  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ error: 'AI Router Request Failed' });
  }
});

// 2. IMAGE GENERATION ENDPOINT (Replicate / Flux.1)
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
      body: JSON.stringify({
        input: { prompt: prompt, aspect_ratio: '1:1' }
      })
    });

    const data = await response.json();
    const imageUrl = data.output ? data.output[0] : null;

    res.json({ success: true, imageUrl, raw: data });
  } catch (err) {
    console.error('Image Generation Error:', err);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// API CALL IMPLEMENTATIONS

async function callGroqAPI(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callClaude(messages) {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const formattedMessages = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      system: systemMessage,
      messages: formattedMessages
    })
  });
  const data = await res.json();
  return data.content[0].text;
}

// 3. REAL-TIME LIVE VOICE (WebSocket Connection)
wss.on('connection', (ws) => {
  console.log('🎙️ Real-Time Voice Socket Connected');

  ws.on('message', async (audioChunk) => {
    ws.send(JSON.stringify({ status: 'processing_audio_stream' }));
  });

  ws.on('close', () => console.log('Voice Socket Closed'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Johnny Tec AI Server live on port ${PORT}`);
});
