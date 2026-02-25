# PocketWealth — v1.0.0 (Final)

Static marketing site and in-browser demo app built with vanilla HTML/CSS/JS.

Release date: 2025-10-24

Overview
--------
PocketWealth demonstrates a client-side investing prototype: a responsive marketing site, an embedded app with a simulated market, simple trading flows, educational tools (Paper Trading Game and Risk vs Reward Simulator), and an admin panel. It runs entirely in the browser (no backend).

Table of contents
-----------------
- Quick start
- Project structure
- Technologies used
- Features
- Setup & usage guide
- Troubleshooting
- Security & limitations

Quick start
-----------
1) Open `PocketWealth.html` (or `app.html`) directly in a browser for a quick look.
2) For full functionality (fetching local JSON, CSP), serve the folder via a static server:

```bash
# from project root (macOS/Linux)
python3 -m http.server 8000
# then visit
open http://localhost:8000/PocketWealth.html
```

Project structure
-----------------
- `PocketWealth.html` — marketing site + embedded app shell
- `app.html` — standalone app shell (for testing)
- `assets/css/` — styles (`styles.css`, `app.css`, `app-page.css`)
- `assets/js/` — app logic (`app.js`, `app-core.js`, `market.js?`, `paper-trading-game.js`, `charts.js`)
- `assets/img/` — logos and illustrations (+ `favicons/`)
- `data/` — demo JSON (etfs, fees, demo-portfolios, learning, impact, market)

Technologies used
-----------------
- HTML5, CSS3, JavaScript (ES6+)
- Chart.js (CDN) for charts
- React + ReactDOM (UMD via CDN) for the Paper Trading Game and mini-quiz
- Browser APIs: localStorage, DOM events, CustomEvent, Intl/Date

Features
--------
- Marketing site: hero, features, charts, FAQ; responsive layout
- Auth demo: Register/Sign-in (stored in localStorage), app-only mode
- Market: random-walk price engine, watchlist, symbol detail with live chart
- Trading: snapshot confirmation modal, BUY/SELL (RM10 minimum), portfolio KPIs
- Activity & Trust Log: human-readable entries, CSV export
- Premium & Plans: Starter (Robo only) and Pro (all features); client-side subscription simulation with ledger entries
- Admin: seeded admin, gifting, user lookup, exports
- Game tab: Paper Trading Game (12-month sim, achievements, leaderboard)
- Risk vs Reward Simulator: interactive sliders, animated chart, metrics & insights
 - PocketWealth Assistant (chatbot): floating help button with rule-based Q&A and app navigation commands
- Robo-Advisory: risk quiz with stored profile, suggested allocations/tickers, and a summary card; ESG scoring dashboards (Pro only)
- Shariah Market (Pro): curated Shariah-certified instruments under Invest with buy/follow actions
- Statement: month/year/type filtered statement with summary metrics and pagination (50 rows/page)
- Learning Library: anchors to Investing 101 and more; smooth scrolling and subtle animations

Setup & usage guide
-------------------
1) Sign up or sign in from the landing page. A demo account is stored in localStorage.
2) After sign-in, the app shell appears with tabs (Dashboard, Market, Invest, Activity, Admin, Game).
3) Use the Market tab to view live (simulated) prices and place trades via the snapshot modal.
4) Use the Game tab to play the Paper Trading Game or run the Risk vs Reward Simulator.
5) Check Activity to see readable logs and export CSV.
 6) Use Premium to subscribe to Starter (Robo) or Pro (full features). Use Statement to review transactions and monthly realised P&L.

Tabs overview
-------------
- Dashboard
	• Shows balance, portfolio value, and unrealised P&L.
	• Charts: Allocation donut and Portfolio Value line (Chart.js).
	• Quick actions: Top-up (modal) and Withdraw controls; recent activity feed; premium status badge.
- Market
	• Watchlist with live last price and 24h change; volatility column for subscription users.
	• Select a symbol to open the detail panel with a live chart and order ticket (Buy/Sell via modal at snapshot price).
	• Premium Insights show simple momentum/volatility metrics.
- Invest
	• Card grid of instruments with type tags. “View Market” deep-links to symbol details.
	• Recommendations appear if you took the Robo risk quiz.
	• Shariah Market (Pro): dedicated cards for certified symbols with Buy/Follow actions.
- Robo
	• Take the risk quiz (modal) to get a risk score, suggested allocations, and suggested tickers.
	• Summary card with grouped suggestions and a mini donut chart; deep-link to Market per instrument.
	• ESG scoring dashboards (Pro): Gauge, Bars, Radar charts and explanatory text.
- Premium
	• Subscribe to Starter (RM10/mo) or Pro (RM20/mo). Unsubscribe with one click.
	• Subscriptions update your balance and ledger; Pro unlocks Shariah and ESG scoring.
- Statement
	• Filter by Month, Year, and Type; search free text; see summary metrics (Cash-in, Realised P&L, Transactions).
	• Paginated 50 rows per page; user-friendly type labels (e.g., Invest/Sell/Cash-in).
- Learning
	• Buttons and anchors to Investing 101 and the Library; scrolls smoothly; sections fade in on view.
- Activity
	• Human-readable activity feed with colored type tags and a CSV export button.
- Admin
	• Only for the seeded admin account; overview KPIs and charts; searchable users table.
	• Gift funds via a combobox picker; writes activity and ledger entries for users.

Game tab basics
---------------
- Paper Trading Game: Reset to start with RM10,000; Buy from Watchlist; advance with Next Month (or Fast-Forward to month 12); Save Result to record your run. Achievements unlock based on returns, drawdown, diversification, and more.
- Risk vs Reward Simulator: Now in its own box in the Game tab. Adjust Risk Level, Amount, and Horizon; click Simulate to animate the chart and view Return %, Max Drawdown %, and Volatility %, plus plain-English insights.

PocketWealth Assistant (chatbot)
--------------------------------
- How to open: Click the blue chat bubble at the bottom-right (💬). A small window slides up.
- What it can do (examples):
	• “What’s my balance?”
	• “Am I premium?” / “Premium status”
	• “Top performing stock” / “Worst performing stock”
	• “How much did I earn this month?” (realised P&L from ledger)
	• “Open Market” / “Open Game” / “Open Statement” / “Open Premium”
	• “How to top up” / “How to withdraw” / “What is ESG?” / “What is Shariah?”
- Notes:
	• The assistant is rule-based (no network/LLM); it matches common phrases and queries your local data (localStorage).
	• Chat history is stored only for the current page session (sessionStorage) and resets on reload.

Trade rules (demo)
------------------
- Minimum buy amount: RM10
- BUY fractional qty = amount / snapshot price (at confirm)
- SELL up to owned quantity; holdings/portfolio update immediately

Admin demo account
------------------
- Email: admin@pocketwealth.com.my
- Password: Admin_123

Troubleshooting
---------------
- If charts or JSON don’t load, run via a static server (see Quick start) due to browser fetch/CORS restrictions for file:// URLs.
- To reset the demo, clear localStorage for the site (this wipes users/sessions/market/game saves).
- If favicons don’t update, hard-refresh or clear browser cache.
 - If the chat window doesn't appear, ensure `assets/js/app-core.js` is loaded and you’re on the app shell (after sign-in).
 - If Statement shows no rows for the selected month, it will auto-jump to your newest month with transactions.

Security & limitations
----------------------
- Client-side demo only. Do not use real credentials.
- No server-side validation, persistence, or security.
- If converting to production, add a secure backend, real market feeds, and tests.
 - Chatbot is keyword-based and offline; it does not call any external AI services.


