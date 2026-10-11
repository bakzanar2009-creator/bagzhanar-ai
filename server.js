import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: '200kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = apiKey ? new OpenAI({ apiKey }) : null;

app.get('/health', (_req, res) => res.json({ ok: true, service: 'BAGZHANAR AI' }));

app.post('/api/chat', async (req, res) => {
  try {
    if (!client) return res.status(503).json({ error: 'AI қызметі серверде бапталмаған.' });
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40) {
      return res.status(400).json({ error: 'Хабарламалар тізімі жарамсыз.' });
    }
    const clean = messages.map(m => {
      if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000) {
        throw new Error('INVALID_MESSAGE');
      }
      return { role: m.role, content: m.content.trim() };
    });
    if (clean[clean.length - 1].role !== 'user') return res.status(400).json({ error: 'Соңғы хабарлама пайдаланушыдан болуы керек.' });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Сен BAGZHANAR AI атты пайдалы жеке көмекшісің. Әдепкіде қазақ тілінде жауап бер. Пайдаланушы басқа тілде сөйлесе, сол тілде жауап бер. Оқушыға есепті тек жауаппен шектемей, қадамдап түсіндір. Қауіпті немесе сенімсіз мәліметті нақтылап, белгісіз нәрсені ойдан шығарма.' },
        ...clean
      ],
      temperature: 0.7
    });
    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'AI бос жауап қайтарды.' });
    return res.json({ reply });
  } catch (err) {
    if (err.message === 'INVALID_MESSAGE') return res.status(400).json({ error: 'Хабарлама пішімі жарамсыз.' });
    console.error('chat request failed:', err.status || err.name || 'unknown');
    return res.status(500).json({ error: 'AI сұрауын орындау мүмкін болмады.' });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`BAGZHANAR AI backend listening on port ${port}`));
