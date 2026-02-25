import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

async function ensureDbFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    // If file missing, write default structure
    try {
      await fs.access(dbFile);
    } catch (err) {
      const initial = { users: [], sessions: [], ledger: [] };
      await fs.writeFile(dbFile, JSON.stringify(initial, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to ensure db file:', err);
    process.exit(1);
  }
}

await ensureDbFile();

const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

await db.read();
db.data = db.data || { users: [], sessions: [], ledger: [] };
await db.write();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5173;

// Helpers
async function getDb() {
  await db.read();
  db.data = db.data || { users: [], sessions: [], ledger: [] };
  return db;
}

function safeUserOutput(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username
  };
}

// Register
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) {
    return res.json({ ok: false, error: 'email, username and password are required' });
  }

  await getDb();

  const exists = db.data.users.find(u => u.email === email);
  if (exists) return res.json({ ok: false, error: 'Email already registered' });

  const hashed = await bcrypt.hash(String(password), 10);
  const user = {
    id: nanoid(),
    email,
    username,
    password: hashed,
    premium: false,
    cashMYR: 0
  };

  db.data.users.push(user);
  await db.write();

  return res.json({ ok: true, user: safeUserOutput(user) });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.json({ ok: false, error: 'email and password are required' });

  await getDb();

  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.json({ ok: false, error: 'Invalid credentials' });

  const ok = await bcrypt.compare(String(password), String(user.password));
  if (!ok) return res.json({ ok: false, error: 'Invalid credentials' });

  const sid = nanoid();
  db.data.sessions.push({ sid, userId: user.id, createdAt: new Date().toISOString() });
  await db.write();

  return res.json({
    ok: true,
    sid,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      premium: !!user.premium,
      cashMYR: Number(user.cashMYR || 0)
    }
  });
});

// Topup
app.post('/api/topup', async (req, res) => {
  const { sid, amount } = req.body || {};
  const num = Number(amount);
  if (!sid || isNaN(num) || num <= 0) return res.json({ ok: false, error: 'sid and positive amount are required' });

  await getDb();

  const session = db.data.sessions.find(s => s.sid === sid);
  if (!session) return res.json({ ok: false, error: 'Invalid session' });

  const user = db.data.users.find(u => u.id === session.userId);
  if (!user) return res.json({ ok: false, error: 'User not found' });

  user.cashMYR = Number(user.cashMYR || 0) + num;

  const entry = {
    id: nanoid(),
    type: 'topup',
    userId: user.id,
    amount: Number(num),
    cashAfter: Number(user.cashMYR),
    time: new Date().toISOString()
  };
  db.data.ledger.push(entry);

  await db.write();

  return res.json({ ok: true, cashMYR: Number(user.cashMYR) });
});

// Subscribe
app.post('/api/subscribe', async (req, res) => {
  const { sid, plan } = req.body || {};
  if (!sid || !plan) return res.json({ ok: false, error: 'sid and plan are required' });
  const costs = { starter: 10, pro: 20 };
  if (!Object.keys(costs).includes(plan)) return res.json({ ok: false, error: 'Invalid plan' });

  await getDb();

  const session = db.data.sessions.find(s => s.sid === sid);
  if (!session) return res.json({ ok: false, error: 'Invalid session' });

  const user = db.data.users.find(u => u.id === session.userId);
  if (!user) return res.json({ ok: false, error: 'User not found' });

  const cost = costs[plan];
  if (Number(user.cashMYR || 0) < cost) return res.json({ ok: false, error: 'Insufficient funds' });

  user.cashMYR = Number(user.cashMYR) - cost;
  user.premium = true;

  const entry = {
    id: nanoid(),
    type: 'subscribe',
    plan,
    userId: user.id,
    amount: -Math.abs(cost),
    cashAfter: Number(user.cashMYR),
    time: new Date().toISOString()
  };
  db.data.ledger.push(entry);

  await db.write();

  return res.json({ ok: true, premium: !!user.premium, cashMYR: Number(user.cashMYR) });
});

// Statement
app.get('/api/statement', async (req, res) => {
  await getDb();
  const list = Array.isArray(db.data.ledger) ? [...db.data.ledger].reverse() : [];
  return res.json({ ok: true, ledger: list });
});

app.listen(PORT, () => {
  console.log(`PocketWealth backend → http://localhost:${PORT}`);
});
