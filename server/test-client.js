// Simple test client for PocketWealth backend
// Usage: node test-client.js

const BASE = 'http://localhost:5173';

async function call(path, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

async function run() {
  console.log('Starting test flow...');

  // 1) Register
  const email = `test${Date.now()}@example.com`;
  const reg = await call('/api/register', 'POST', { email, username: 'tester', password: 'pass123' });
  console.log('register ->', reg);

  // 2) Login
  const login = await call('/api/login', 'POST', { email, password: 'pass123' });
  console.log('login ->', login);
  if (!login || !login.ok) return console.error('Login failed, aborting');
  const sid = login.sid;

  // 3) Topup
  const top = await call('/api/topup', 'POST', { sid, amount: 50 });
  console.log('topup ->', top);

  // 4) Subscribe
  const sub = await call('/api/subscribe', 'POST', { sid, plan: 'starter' });
  console.log('subscribe ->', sub);

  // 5) Statement
  const stmt = await call('/api/statement');
  console.log('statement ->', Array.isArray(stmt.ledger) ? `ledger entries: ${stmt.ledger.length}` : stmt);

  console.log('Test flow complete.');
}

// Node's fetch is available in Node 18+. If not available, inform the user.
if (typeof fetch === 'undefined') {
  console.error('fetch is not available in this Node runtime. Use Node 18+ or install a fetch polyfill.');
  process.exit(1);
}

run().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
