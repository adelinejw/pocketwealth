# PocketWealth Backend (simple)

This is a tiny Express + Lowdb backend used for teaching/demo purposes.

Location: `server/`

Quick overview
- Node + Express
- Lowdb JSON file at `server/data/db.json`
- Passwords hashed with `bcrypt` (10 rounds)
- IDs via `nanoid`
- Listens on port `5173`

Install & run

```bash
cd "/Users/jingwen/Downloads/last testing gogo/server"
npm install
npm start
```

The server prints:

```
PocketWealth backend → http://localhost:5173
```

API endpoints

1) Register

POST /api/register

Body JSON: { "email", "username", "password" }

Response: { ok:true, user:{ id, email, username } }

Example curl:

```bash
curl -s -X POST http://localhost:5173/api/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","username":"alice","password":"secret"}' | jq
```

2) Login

POST /api/login

Body JSON: { "email", "password" }

Response: { ok:true, sid, user:{ id, email, username, premium, cashMYR } }

Example curl:

```bash
curl -s -X POST http://localhost:5173/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret"}' | jq
```

3) Topup

POST /api/topup

Body JSON: { "sid", "amount" }

Response: { ok:true, cashMYR }

Example curl:

```bash
curl -s -X POST http://localhost:5173/api/topup \
  -H 'Content-Type: application/json' \
  -d '{"sid":"<SID_FROM_LOGIN>","amount":50}' | jq
```

4) Subscribe

POST /api/subscribe

Body JSON: { "sid", "plan": "starter" | "pro" }

Response: { ok:true, premium, cashMYR }

Example curl:

```bash
curl -s -X POST http://localhost:5173/api/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"sid":"<SID_FROM_LOGIN>","plan":"starter"}' | jq
```

5) Statement

GET /api/statement

Response: { ok:true, ledger: [ ... ] } (latest first)

Example curl:

```bash
curl -s http://localhost:5173/api/statement | jq
```

Test script

Run `npm test` from the `server/` folder to execute `test-client.js` which performs a full flow.

Notes
- If `bcrypt` fails to install due to native build issues on your machine, try installing `bcryptjs` and change the imports accordingly.
