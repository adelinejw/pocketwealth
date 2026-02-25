/* PocketWealth - app core (vanilla JS, localStorage mock backend)
   - Users: pw_users
   - Session: pw_session
   - Market: pw_market (loaded from data/market.json)
   - Accounts seeded with admin on first run
*/
(function(){
  const USERS_KEY = 'pw_users';
  const SESSION_KEY = 'pw_session';
  const MARKET_KEY = 'pw_market';
  const ADMIN_EMAIL = 'admin@pocketwealth.com.my';

  // Helpers
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));
  function fmtMYR(v){ return 'RM ' + Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function nowISO(){ return new Date().toISOString(); }
  function pseudoHash(){ return Math.random().toString(36).slice(2,10); }

  // Toasts (clean, blue-accented)
  function createToastContainer(){ let c = document.getElementById('toastContainer'); if(!c){ c = document.createElement('div'); c.id = 'toastContainer'; c.style.position = 'fixed'; c.style.right = '18px'; c.style.bottom = '18px'; c.style.zIndex = 1200; document.body.appendChild(c); } return c; }
  function toast(msg, type='info'){ const container = createToastContainer(); const el = document.createElement('div'); el.className = `pw-toast pw-toast-${type}`; el.textContent = msg; el.style.marginTop = '8px'; el.style.padding = '10px 14px'; el.style.borderRadius = '10px'; el.style.background = (type==='success')? '#0b66ff' : (type==='warn')? '#ffb020' : '#e6f0ff'; el.style.color = (type==='success')? '#fff' : '#073044'; el.style.boxShadow = '0 8px 20px rgba(11,22,34,0.08)'; el.style.opacity = '0'; el.style.transition = 'opacity 220ms ease, transform 220ms ease'; container.appendChild(el); requestAnimationFrame(()=>{ el.style.opacity = '1'; el.style.transform = 'translateY(-4px)'; }); setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateY(0)'; setTimeout(()=>el.remove(),240); }, 3000); }

  // Storage helpers
  function loadUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY))||[] }catch(e){ return [] } }
  function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
  function findUser(email){ if(!email) return null; return loadUsers().find(x=>x.email.toLowerCase()===email.toLowerCase()); }
  function upsertUser(user){ const all = loadUsers(); const idx = all.findIndex(x=>x.email.toLowerCase()===user.email.toLowerCase()); if(idx>=0){ all[idx]=user }else{ all.push(user) } saveUsers(all); }
  function setSession(email){ localStorage.setItem(SESSION_KEY, JSON.stringify({ email })); _emitSessionChanged(email); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); _emitSessionChanged(null); }
  function getSession(){ try{return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null } }

  // notify other parts of the app when session changes
  function _emitSessionChanged(email){ try{ document.dispatchEvent(new CustomEvent('session:changed', { detail: { email } })); }catch(e){} }

  // Seed admin if not exists
  (function seedAdmin(){ if(!findUser(ADMIN_EMAIL)){ const admin = { email: ADMIN_EMAIL, username: 'Admin', password: 'Admin_123', role: 'admin', cashBalanceMYR: Infinity, premiumActive: false, premiumActivatedAt: null, holdings: {}, roboPortfolio:{ targetWeights:{} }, activity: [] }; upsertUser(admin); console.info('Seeded admin account'); }})();

  // Load market data and lightly randomize prices
  async function loadMarket(){ try{ const res = await fetch('data/market.json'); const m = await res.json(); // randomize a little
      Object.keys(m).forEach(sym=>{ const p = m[sym].price; const jitter = 1 + ((Math.random()-0.5)*0.02); m[sym].price = Number((p*jitter).toFixed(2)); });
      localStorage.setItem(MARKET_KEY, JSON.stringify(m)); return m; }catch(e){ console.warn('market load failed',e); return JSON.parse(localStorage.getItem(MARKET_KEY) || '{}'); } }

  // --- Simulated live market engine ---
  const MARKET_STORE = 'market.symbols';
  const MARKET_SERIES = 'market.series';
  const MARKET_LAST = 'market.lastPrice';
  const MARKET_RUNNING = 'market.isRunning';
  const MARKET_VOLMODE = 'market.volatilityMode';

  // Universe
  const DEFAULT_SYMBOLS = {
    PWSTK: { name:'PocketWealth Stock', price: 10.00, vol:'med', type:'stock', desc: 'Our simulated stock representing global equity performance.' },
    PWETF: { name:'Pocket ETF', price: 100.00, vol:'low', type:'etf', desc: 'A diversified ETF simulation tracking multiple sectors.' },
    PWGOLD: { name:'Pocket Gold', price: 60.00, vol:'low', type:'stock', desc: 'A stock proxy providing gold-linked exposure.' },
    // Additional instruments (everyone can trade)
    MYSML: { name: 'Malaysia SmallCaps Index', price: 5.20, vol: 'high', type: 'stock', desc: 'Small-cap Malaysian companies — higher growth and volatility.', drift: 0.00028 },
    TECHSEA: { name: 'SEA Technology Basket', price: 18.40, vol: 'high', type: 'etf', desc: 'Southeast Asia technology & digital economy exposure.', drift: 0.00033 },
    HEALTHMY: { name: 'Malaysia Healthcare Leaders', price: 12.75, vol: 'med', type: 'stock', desc: 'Leading healthcare and pharma firms in Malaysia.', drift: 0.00018 },
    COMMEX: { name: 'Commodities Ex-China', price: 21.00, vol: 'med', type: 'etf', desc: 'Selected commodities exposure excluding China-heavy names.', drift: 0.00022 },
    OILFUT: { name: 'Energy & Oil Futures Proxy', price: 34.50, vol: 'high', type: 'etf', desc: 'Energy sector proxy; sensitive to global oil moves.', drift: 0.0004 },
    INFRA: { name: 'Malaysia Infrastructure Fund', price: 27.10, vol: 'low', type: 'etf', desc: 'Infrastructure & tolls; defensive income-oriented exposure.', drift: 0.00012 },
    AGROMY: { name: 'Malaysia Agribusiness', price: 6.80, vol: 'med', type: 'stock', desc: 'Palm oil and agricultural supply-chain companies.', drift: 0.0002 },
    FINBANK: { name: 'Malaysia Banking Blend', price: 14.20, vol: 'med', type: 'etf', desc: 'Major Malaysian banks and financial services.', drift: 0.00016 },
    TELEMY: { name: 'Malaysia Telecoms', price: 8.90, vol: 'low', type: 'stock', desc: 'Telecommunications providers with stable cashflows.', drift: 0.00011 },
    GLOBALESG: { name: 'Global ESG Leaders', price: 47.50, vol: 'med', type: 'etf', desc: 'Global companies screened for strong ESG practices.', drift: 0.0002 }
  };

  // Shariah curated universe (mock dataset)
  // Only these change: unique symbol, display name, and price per unit
  const SHARIAH_SYMBOLS = {
    'SHR-PETDAG': { name: 'PETRONAS Dagangan (Shariah)', price: 24.80, vol: 'med', type: 'stock', shariah: true, desc: 'Certified by the Securities Commission Shariah Advisory Council.' },
    'SHR-INARI' : { name: 'INARI Amerton (Shariah)',    price: 3.70,  vol: 'med', type: 'stock', shariah: true, desc: 'Certified by the Securities Commission Shariah Advisory Council.' },
    'DJIMS'      : { name: 'DJIM Shariah ETF',            price: 46.00, vol: 'low', type: 'etf',   shariah: true, desc: 'Certified by the Securities Commission Shariah Advisory Council.' },
    'SHR-AXIATA': { name: 'AXIATA Group (Shariah)',      price: 1.45,  vol: 'med', type: 'stock', shariah: true, desc: 'Certified by the Securities Commission Shariah Advisory Council.' }
  };

  // Ensure Shariah symbols are present in market meta so they participate in the simulated engine
  function ensureShariahSymbolsExist(){ const meta = loadMarketMeta(); let changed=false; Object.keys(SHARIAH_SYMBOLS).forEach(sym=>{ if(!meta[sym]){ meta[sym]= Object.assign({}, SHARIAH_SYMBOLS[sym]); changed = true; } }); if(changed) saveMarketMeta(meta); }

  // Enhance ensure to seed series and schedule ticks for added shariah symbols
  function ensureShariahSymbolsExistAndSeed(){ const meta = loadMarketMeta(); let changed=false; Object.keys(SHARIAH_SYMBOLS).forEach(sym=>{ if(!meta[sym]){ meta[sym]= Object.assign({}, SHARIAH_SYMBOLS[sym]); changed = true; } }); if(changed){ saveMarketMeta(meta); // seed last prices and series for the new symbols
      Object.keys(SHARIAH_SYMBOLS).forEach(sym=>{ const m = meta[sym]; if(m){ if(!loadLast(sym)) saveLast(sym, m.price); seedSeries(sym, loadLast(sym)||m.price); if(marketRunning){ scheduleSymbolTick(sym); } } }); }
    return changed;
  }

  // Migration: ensure stored Shariah symbols have a market type so Invest tab shows "Volatility • TYPE"
  function ensureShariahTypesExist(){ try{ const meta = loadMarketMeta(); let changed=false; Object.keys(SHARIAH_SYMBOLS).forEach(sym=>{ const def = SHARIAH_SYMBOLS[sym]; if(meta[sym] && !meta[sym].type && def && def.type){ meta[sym].type = def.type; changed=true; } }); if(changed){ saveMarketMeta(meta); } }catch(e){ console.warn('ensureShariahTypesExist failed', e); } }

  // Migration: ensure default/core symbols (like PWETF) have correct type in stored market meta
  function ensureCoreTypesExist(){ try{ const meta = loadMarketMeta(); let changed=false; Object.keys(DEFAULT_SYMBOLS).forEach(sym=>{ const def = DEFAULT_SYMBOLS[sym]; if(meta[sym]){ if(!meta[sym].type && def && def.type){ meta[sym].type = def.type; changed = true; } } }); if(changed){ saveMarketMeta(meta); } }catch(e){ console.warn('ensureCoreTypesExist failed', e); } }

  // Override types for specific symbols if definitions changed over time (e.g., PWGOLD -> stock)
  function ensureTypeOverrides(){ try{ const meta = loadMarketMeta(); let changed=false; const OVERRIDES = { PWGOLD: 'stock' }; Object.keys(OVERRIDES).forEach(sym=>{ if(meta[sym] && meta[sym].type !== OVERRIDES[sym]){ meta[sym].type = OVERRIDES[sym]; changed = true; } }); if(changed){ saveMarketMeta(meta); } }catch(e){ console.warn('ensureTypeOverrides failed', e); } }

  // Migration: ensure core/default symbols have short descriptions in stored market meta
  function ensureCoreDescriptionsExist(){ try{ const meta = loadMarketMeta(); let changed = false; Object.keys(DEFAULT_SYMBOLS).forEach(sym=>{ const def = DEFAULT_SYMBOLS[sym]; if(meta[sym]){ if((!meta[sym].desc || String(meta[sym].desc).trim()=== '') && def && def.desc){ meta[sym].desc = def.desc; changed = true; } } }); if(changed){ saveMarketMeta(meta); } }catch(e){ console.warn('ensureCoreDescriptionsExist failed', e); } }

  function isShariahSymbol(sym){ try{ const meta = loadMarketMeta(); return !!(meta[sym] && meta[sym].shariah); }catch(e){ return false; } }

  // keep market type filter in sync after meta updates
  function saveMarketMeta(m){ try{ localStorage.setItem(MARKET_STORE, JSON.stringify(m)); }catch(e){} try{ populateMarketTypeFilter(); }catch(e){} }

  function loadMarketMeta(){ return JSON.parse(localStorage.getItem(MARKET_STORE) || JSON.stringify(DEFAULT_SYMBOLS)); }
  function saveSeries(sym, series){ const all = JSON.parse(localStorage.getItem(MARKET_SERIES) || '{}'); all[sym] = series; localStorage.setItem(MARKET_SERIES, JSON.stringify(all)); }
  function loadSeries(sym){ const all = JSON.parse(localStorage.getItem(MARKET_SERIES) || '{}'); return all[sym] || []; }
  function saveLast(sym, price){ const all = JSON.parse(localStorage.getItem(MARKET_LAST) || '{}'); all[sym] = price; localStorage.setItem(MARKET_LAST, JSON.stringify(all)); }
  function loadLast(sym){ const all = JSON.parse(localStorage.getItem(MARKET_LAST) || '{}'); return all[sym]; }

  // volatility presets
  const VOL_MAP = { low: 0.002, med: 0.006, high: 0.02 };

  // engine state
  let marketTimers = {}; // symbol -> timer id
  let marketRunning = JSON.parse(localStorage.getItem(MARKET_RUNNING) || 'true');
  // timer to periodically refresh the Portfolio holdings block so values and P&L stay live
  let portfolioRefreshTimer = null;
  let marketMood = localStorage.getItem(MARKET_VOLMODE) || 'normal'; // calm, normal, volatile

  function moodMultiplier(){ if(marketMood==='calm') return 0.5; if(marketMood==='volatile') return 2.0; return 1.0; }

  // series cap
  const SERIES_MAX = 500;

  function seedSeries(sym, price){ const now = Date.now(); const s = loadSeries(sym); if(s.length===0){ // seed with 60 points
    let p = price; for(let i=60;i>0;i--){ p = Number((p*(1 + ((Math.random()-0.5)*0.01))).toFixed(4)); s.push({ t: now - i*60000, p }); }
    saveSeries(sym, s); }
    return s;
  }

  function getVolFor(sym){ const meta = loadMarketMeta()[sym] || DEFAULT_SYMBOLS[sym]; return VOL_MAP[meta?.vol] || VOL_MAP.med; }

  function tickSymbol(sym){ // random-walk + drift
    const meta = loadMarketMeta()[sym]; if(!meta) return;
    if(meta.frozen) return; // skip frozen
    const last = loadLast(sym) || meta.price;
    const vol = getVolFor(sym) * moodMultiplier();
    const drift = (Math.random()-0.5) * vol * 0.2; // small drift
    const shock = (Math.random()-0.5) * vol * 2; // random component
    const changeFactor = 1 + drift + shock;
    let next = Number((last * changeFactor).toFixed(4)); if(next<=0) next = last;
    // micro-events occasionally
    if(Math.random() < 0.01){ const b = 1 + ((Math.random()<0.5? -1 : 1) * (0.01 + Math.random()*0.02)); next = Number((next * b).toFixed(4)); pushMarketEvent(sym, b>1? 'micro-news-up':'micro-news-down', b); }
    // append to series
    const s = loadSeries(sym); s.push({ t: Date.now(), p: next }); if(s.length>SERIES_MAX) s.shift(); saveSeries(sym, s); saveLast(sym, next);
    // schedule next tick
    scheduleSymbolTick(sym);
  }

  function scheduleSymbolTick(sym){ const delay = 3000 + Math.floor(Math.random()*4000); clearTimeout(marketTimers[sym]); marketTimers[sym] = setTimeout(()=>{ if(marketRunning) tickSymbol(sym); else scheduleSymbolTick(sym); }, delay); }

  function startMarketEngine(){ marketRunning = true; localStorage.setItem(MARKET_RUNNING, 'true'); const meta = loadMarketMeta(); Object.keys(meta).forEach(sym=>{ if(!loadLast(sym)) saveLast(sym, meta[sym].price); seedSeries(sym, loadLast(sym)||meta[sym].price); scheduleSymbolTick(sym); }); }

  function pauseMarketEngine(){ marketRunning = false; localStorage.setItem(MARKET_RUNNING, 'false'); Object.keys(marketTimers).forEach(k=>clearTimeout(marketTimers[k])); }

  function resetMarketEngine(){ // reseed series and last prices from defaults
    saveMarketMeta(DEFAULT_SYMBOLS); try{ populateMarketTypeFilter(); }catch(e){} localStorage.removeItem(MARKET_SERIES); localStorage.removeItem(MARKET_LAST); const meta = loadMarketMeta(); Object.keys(meta).forEach(sym=>{ saveLast(sym, meta[sym].price); seedSeries(sym, meta[sym].price); }); }

  function pushMarketEvent(sym, kind, mag){ // record as activity-like micro-event for user visibility
    const s = getSession(); if(!s) return; const u = findUser(s.email); if(!u) return; pushActivity(u.email, { type:'MARKET_EVENT', symbol: sym, event: kind, magnitude: mag }); }

  // admin helpers
  function adminNudge(sym, pct){ const last = loadLast(sym) || loadMarketMeta()[sym].price; const next = Number((last * (1 + pct/100)).toFixed(4)); const s = loadSeries(sym); s.push({ t: Date.now(), p: next }); if(s.length>SERIES_MAX) s.shift(); saveSeries(sym, s); saveLast(sym, next); }
  function adminFreeze(sym, freeze){ const meta = loadMarketMeta(); if(meta[sym]){ meta[sym].frozen = !!freeze; saveMarketMeta(meta); } }

  // exposure: get current price (single source of truth) — robust to missing meta/last
  function currentPrice(sym){
    try{
      const last = loadLast(sym);
      const meta = loadMarketMeta();
      const def = meta && meta[sym] ? meta[sym].price : undefined;
      const base = (typeof last === 'number' && !isNaN(last)) ? last : (typeof def === 'number' ? def : 0);
      return Number(Number(base || 0).toFixed(4));
    }catch(_){
      return 0;
    }
  }

  // load and start by default
  if(localStorage.getItem(MARKET_STORE)===null){ saveMarketMeta(DEFAULT_SYMBOLS); }
  // merge any missing defaults into existing market meta (useful if user cleared some entries)
  (function ensureDefaultSymbolsSeed(){ const meta = loadMarketMeta(); let changed = false; Object.keys(DEFAULT_SYMBOLS).forEach(sym=>{ if(!meta[sym]){ meta[sym] = Object.assign({}, DEFAULT_SYMBOLS[sym]); changed = true; } }); if(changed){ saveMarketMeta(meta); Object.keys(DEFAULT_SYMBOLS).forEach(sym=>{ const m = meta[sym]; if(m){ if(!loadLast(sym)) saveLast(sym, m.price); seedSeries(sym, loadLast(sym)||m.price); if(marketRunning) scheduleSymbolTick(sym); } }); } })();
  marketMood = localStorage.getItem(MARKET_VOLMODE) || 'normal';
  if(marketRunning) startMarketEngine();


  // Activity helpers
  function pushActivity(userEmail, item){ const u = findUser(userEmail); if(!u) return; u.activity = u.activity||[]; const entry = Object.assign({ time: nowISO(), txHash: item.txHash || pseudoHash() }, item); u.activity.unshift(entry); if(u.activity.length>500) u.activity.pop(); upsertUser(u); }

  // In-memory variant: append activity to a provided user object (avoids re-loading from storage)
  function pushActivityForUser(userObj, item){ if(!userObj) return; userObj.activity = userObj.activity||[]; const entry = Object.assign({ time: nowISO(), txHash: item.txHash || pseudoHash() }, item); userObj.activity.unshift(entry); if(userObj.activity.length>500) userObj.activity.pop(); return entry; }

  // Ledger helpers (normalized entries)
  function pushLedger(userEmail, item){ // item should follow normalized schema in user request
    const u = findUser(userEmail); if(!u) return; u.ledger = u.ledger||[]; const entry = Object.assign({ id: ('l_'+pseudoHash()), user: userEmail, ts: item.ts || nowISO() }, item);
    // ensure minimal shape
    // id, user, ts, type, amount (signed: positive inflow, negative outflow)
    u.ledger.unshift(entry);
    // keep a reasonable cap
    if(u.ledger.length > 5000) u.ledger.pop(); upsertUser(u);
    // emit a ledger changed event for UI listeners
    try{ document.dispatchEvent(new CustomEvent('ledger:changed', { detail: { user: userEmail, entry } })); }catch(e){}
    return entry; }

  // In-memory variant: append ledger entry to a provided user object (avoids re-loading from storage)
  function pushLedgerForUser(userObj, item){ if(!userObj) return; userObj.ledger = userObj.ledger||[]; const entry = Object.assign({ id: (item.id || 'l_'+pseudoHash()), user: userObj.email, ts: item.ts || nowISO() }, item); userObj.ledger.unshift(entry); if(userObj.ledger.length > 5000) userObj.ledger.pop(); try{ document.dispatchEvent(new CustomEvent('ledger:changed', { detail: { user: userObj.email, entry } })); }catch(e){} return entry; }

  // Unified transactional helper: mutate in-memory user object, append ledger row, then persist once.
  // This avoids the previous pattern (pushLedger + upsertUser) which reloaded a stale user and then
  // overwrote the freshly added ledger entry when upserting the original object, causing missing trades.
  function recordLedger(userObj, item){
    try{
      if(!userObj) return null;
      const entry = pushLedgerForUser(userObj, item);
      // persist the same mutated object so ledger entry is not lost
      upsertUser(userObj);
      return entry;
    }catch(e){ console.warn('recordLedger failed', e); return null; }
  }

  // Migrate legacy activity -> ledger (run once per user if ledger missing)
  function migrateActivityToLedger(){ const users = loadUsers(); let changed=false; users.forEach(u=>{ if(u.ledger && u.ledger.length>0) return; const acts = u.activity || []; const ledger = []; acts.slice().reverse().forEach(a=>{ // process oldest -> newest to build consistent running state
      try{
        const base = { id: 'l_'+pseudoHash(), user: u.email, ts: a.time || a.t || nowISO(), note: a.detail || a.note || a.txHash || '' };
        if(a.type && (a.type.includes('BUY') || a.type==='MARKET_BUY' || a.type==='FRACTIONAL_BUY' || a.type==='DIY_BUY' || a.type==='ROBO_BUY')){
          const qty = Number(a.qty || 0); const price = Number(a.price || 0); const amount = -(Math.abs(Number(a.amount || (qty*price) || 0)) + (a.fee||0)); ledger.push(Object.assign({}, base, { type: 'BUY', symbol: a.symbol, qty: qty>0? qty: qty, price, amount: Number(amount.toFixed(2)), fee: a.fee||0 }));
        } else if(a.type && (a.type.includes('SELL') || a.type==='MARKET_SELL' || a.type==='FRACTIONAL_SELL' || a.type==='DIY_SELL')){
          const qty = Number(a.qty || 0); const price = Number(a.price || 0); const amount = Math.abs(Number(a.amount || (qty*price) || 0)) - (a.fee||0); ledger.push(Object.assign({}, base, { type: 'SELL', symbol: a.symbol, qty: -(Math.abs(qty)), price, amount: Number(amount.toFixed(2)), fee: a.fee||0 }));
        } else if(a.type && (a.type==='ADMIN_GIFT' || a.type==='ADMIN_GIFT')){
          ledger.push(Object.assign({}, base, { type: 'ADMIN_GIFT', amount: Number(a.amount || 0) }));
        } else if(a.type && (a.type==='PREMIUM_CHARGE' || a.type==='PREMIUM_ACTIVATED')){
          ledger.push(Object.assign({}, base, { type: 'PREMIUM_SUB', amount: Number(-(a.amount||20)) }));
        } else if(a.type && (a.type==='PREMIUM_CANCELLED' || a.type==='PREMIUM_CANCEL')){
          ledger.push(Object.assign({}, base, { type: 'PREMIUM_UNSUB', amount: 0 }));
        } else if(a.type && (a.type==='DEPOSIT' || a.type==='CASH_IN' || a.type==='DEPOSIT')){
          ledger.push(Object.assign({}, base, { type: 'CASH_IN', amount: Number(a.amount || 0) }));
        } else if(a.type && a.type==='WITHDRAW'){
          ledger.push(Object.assign({}, base, { type: 'WITHDRAW', amount: Number(-(a.amount||0)) }));
        } else {
          // map other types as miscellaneous note-only ledger rows
          // skip trivial SCREEN_CHECK etc.
          if(!['SCREEN_CHECK','REBALANCE','TRUST_EVENT'].includes(a.type)){
            ledger.push(Object.assign({}, base, { type: a.type || 'NOTE', amount: Number(a.amount || 0) }));
          }
        }
      }catch(e){ /* ignore malformed */ }
    }); if(ledger.length>0){ u.ledger = ledger.slice().reverse(); upsertUser(u); changed=true; }
  }); if(changed) console.info('Migrated activities to ledger for users'); }

  // Compute portfolio value
  function portfolioValue(user, market){ let val = 0; Object.entries(user.holdings || {}).forEach(([sym,info])=>{ const price = (market[sym] && market[sym].price) || 0; val += (info.qty || 0) * price; }); return val; }

  // Initialize UI elements
  const tabs = $all('.app-tabs .tab');
  const panels = $all('[data-content]');
  const tabContent = $('#tabContent');

  // Dynamic layout: make Game tab block fit the window height
  function _applyGameLayout(){
    try{
      const root = document.getElementById('gameRoot');
      if(!root) return;
      // Compute available height from the element's top to viewport bottom minus footer
      const footer = document.querySelector('.app-footer');
      const top = root.getBoundingClientRect().top + window.scrollY; // absolute top
      const scrollTop = window.scrollY;
      const visibleTop = root.getBoundingClientRect().top; // relative to viewport
      const footerH = (footer && footer.offsetHeight) || 0;
      const vh = window.innerHeight;
      // Height available from root's current top in viewport down to above footer
      const avail = Math.max(320, vh - Math.max(0, visibleTop) - footerH - 12);
      // Use min-height so the block can grow if inner content needs more space
      root.style.removeProperty('height');
      root.style.minHeight = avail + 'px';
    }catch(_){ /* no-op */ }
  }
  function layoutGameTab(active){
    try{
      const root = document.getElementById('gameRoot');
      if(!root) return;
      if(active){
        // apply immediately and on resize
        if(!window.__pwGameLayoutHandler){
          window.__pwGameLayoutHandler = function(){ _applyGameLayout(); };
          window.addEventListener('resize', window.__pwGameLayoutHandler);
        }
        // minor defer to allow panel to unhide and content to mount
        setTimeout(_applyGameLayout, 30);
        setTimeout(_applyGameLayout, 160);
      } else {
        // cleanup height so other tabs are unaffected
        root.style.minHeight = '';
        if(window.__pwGameLayoutHandler){
          window.removeEventListener('resize', window.__pwGameLayoutHandler);
          window.__pwGameLayoutHandler = null;
        }
      }
    }catch(_){ /* ignore */ }
  }

  // Tab persistence
  function selectTab(name){
    tabs.forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
    panels.forEach(p=>p.classList.toggle('hidden', p.dataset.content!==name));
    localStorage.setItem('pw_tab', name);
    // Layout hook: adjust Game tab height to fit viewport
    try{ layoutGameTab(name === 'game'); }catch(_){}
    // When entering the Market tab, ensure the watchlist is rendered and auto-open first symbol
    if(name === 'market'){
      try{
        renderWatchlist();
        // auto-display first symbol if none selected yet
        if(!selectedSymbol){ const meta = loadMarketMeta(); const first = Object.keys(meta)[0]; if(first) { setTimeout(()=>{ openSymbolDetail(first); }, 120); } }
      }catch(e){ console.warn('Market auto-open failed', e); }
    }
    if(name === 'invest'){
      try{ renderInvestList(); renderShariahList(); }catch(e){ console.warn('Invest render failed', e); }
    }
    if(name === 'robo'){
      try{ renderRoboTab(); }catch(e){ console.warn('Robo render failed', e); }
    }
    // When entering Admin tab, ensure user is admin and render admin UI
    if(name === 'admin'){
      try{
        const s = getSession(); const user = s && findUser(s.email);
        const isAdmin = user && ( (user.email && user.email.toLowerCase()===ADMIN_EMAIL) || user.isAdmin === true || user.role==='admin');
        if(!isAdmin){ // redirect non-admins to dashboard
          selectTab('dashboard'); toast('Access denied: admin only','warn'); return; }
        renderAdminView();
      }catch(err){ console.warn('Admin render failed', err); }
    }
      // When entering Dashboard tab, reset chart init flag and render dashboard
      if(name === 'dashboard'){
        try{ dashboardChartsInitialized = false; renderDashboard(); }catch(e){ console.warn('Dashboard render failed', e); }
      }
    // When entering Statement tab, render statement UI
    if(name === 'statement'){
      try{ renderNewStatementTab(); }catch(e){ console.warn('Statement render failed', e); }
    }
    // If learning tab selected, render learning page
    if(name === 'learning'){
      try{ renderLearningPage(); }catch(e){ console.warn('Learning render failed', e); }
    }
  }
  tabs.forEach(t=> t.addEventListener('click', ()=> selectTab(t.dataset.tab)) );
  const lastTab = localStorage.getItem('pw_tab') || 'dashboard'; selectTab(lastTab);
  // After redirect from marketing signup, optionally open Premium tab and hint the selected plan
  try{
    const openAfter = localStorage.getItem('pw_after_signup_open_tab');
    const plan = localStorage.getItem('pw_after_signup_plan');
    if(openAfter){
      // clear flag to avoid future forced navigation
      localStorage.removeItem('pw_after_signup_open_tab');
      selectTab(openAfter);
      setTimeout(()=>{
        try{
          renderPremiumUI();
          if(plan === 'starter'){
            document.getElementById('btnActivatePremiumRobo')?.scrollIntoView({ behavior:'smooth', block:'center' });
            document.getElementById('btnActivatePremiumRobo')?.focus();
          } else if(plan === 'pro'){
            document.getElementById('btnActivatePremiumFull')?.scrollIntoView({ behavior:'smooth', block:'center' });
            document.getElementById('btnActivatePremiumFull')?.focus();
          }
        }catch(_){ }
        // clear plan hint after using it
        try{ localStorage.removeItem('pw_after_signup_plan'); }catch(_){ }
      }, 160);
    }
  }catch(_){ }

  // Re-render dashboard charts on ledger changes (transactional events)
  document.addEventListener('ledger:changed', (e)=>{
    try{ // only refresh if dashboard visible
      const active = localStorage.getItem('pw_tab') || 'dashboard'; if(active==='dashboard'){ dashboardChartsInitialized = false; renderDashboard(); }
    }catch(_){}
  });

  // Re-render Shariah list when session or premium changes
  document.addEventListener('session:changed', ()=>{ try{ renderShariahList(); }catch(e){} });
  document.addEventListener('ledger:changed', ()=>{ try{ renderShariahList(); }catch(e){} });
  window.addEventListener('storage', (e)=>{ if(e.key === USERS_KEY || e.key === null){ try{ renderShariahList(); }catch(e){} } });

  // Session & header
  function refreshHeader(){ const s = getSession(); const user = s && findUser(s.email); if(user){ $('#appUser').textContent = user.username || user.email; $('#welcomeGreeting').textContent = `👉 “Welcome to PocketWealth, ${user.username}!”`; // show admin tab if admin
      if(user.email.toLowerCase()===ADMIN_EMAIL) $('#tabAdmin').style.display='inline-block'; else $('#tabAdmin').style.display='none'; } else { $('#appUser').textContent='(not signed in)'; $('#welcomeGreeting').textContent='Welcome to PocketWealth'; $('#tabAdmin').style.display='none'; } }

  // small helper to escape HTML when inserting user-provided text
  function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"]+/g, function(s){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]) || s; }); }

  // Render the compact user status in the header (#userStatus)
  function renderUserStatus(){ try{ const el = document.getElementById('userStatus'); if(!el) return; const s = getSession(); if(!s || !s.email){ el.style.display='none'; el.innerHTML = ''; return; } const user = findUser(s.email); if(!user){ el.style.display='none'; el.innerHTML = ''; return; } const name = escapeHtml(user.username || user.email || ''); const cash = (user.cashBalanceMYR===Infinity)? 'Unlimited' : fmtMYR(user.cashBalanceMYR || 0); el.innerHTML = `User: <strong style="margin-right:6px">${name}</strong> | Balance (RM): <strong>${cash}</strong>`; el.style.display = 'inline-flex'; }catch(e){ console.warn('renderUserStatus failed', e); } }

  // Listen for session and ledger changes and storage events to update header in real-time
  document.addEventListener('session:changed', (e)=>{ try{ renderUserStatus(); refreshHeader(); }catch(_){} });
  document.addEventListener('ledger:changed', (e)=>{ try{ renderUserStatus(); /* do not auto-refresh full dashboard here to avoid constant chart updates */ }catch(_){} });
  window.addEventListener('storage', (e)=>{ // cross-tab updates: if users or session changed, refresh header
    try{ if(e.key === SESSION_KEY || e.key === USERS_KEY || e.key === null){ renderUserStatus(); refreshHeader(); } }catch(_){} });

  // Update the compact premium status label in the dashboard/header
  function updatePremiumStatusLabel(user){
    try{
      const el = document.getElementById('premiumStatus'); if(!el) return;
      // clear existing modifier classes
      el.classList.remove('premium-status','pro','starter','inactive');
      if(!user){ el.textContent = 'Inactive'; el.classList.add('inactive'); return; }
      if(user.premiumActive){ el.textContent = 'Pro'; el.classList.add('premium-status','pro'); }
      else if(user.premiumRoboActive){ el.textContent = 'Starter'; el.classList.add('premium-status','starter'); }
      else { el.textContent = 'Inactive'; el.classList.add('inactive'); }
    }catch(e){ console.warn('updatePremiumStatusLabel failed', e); }
  }

  // Dashboard render (includes Unrealised P&L)
  let dashboardChartsInitialized = false;
  async function renderDashboard(){ const market = await loadMarket(); const s = getSession(); if(!s) return; const user = findUser(s.email);
    const cash = (user.cashBalanceMYR===Infinity)? 'Unlimited' : user.cashBalanceMYR || 0; $('#cashBalance').textContent = (cash==='Unlimited')? 'Unlimited' : fmtMYR(cash);
  const pv = portfolioValue(user, market); $('#portfolioValue').textContent = fmtMYR(pv);
  // compute unrealised P&L across holdings using last prices
  let totalUnrl = 0; let totalCost = 0; Object.entries(user.holdings||{}).forEach(([sym,h])=>{ const last = (market[sym] && market[sym].price) || loadLast(sym) || 0; const cost = (h.qty||0) * (h.avgPrice||0); const val = (h.qty||0) * last; totalUnrl += (val - cost); totalCost += cost; });
  const unrlPct = totalCost? (totalUnrl/totalCost*100) : 0;
  const unrlText = `${fmtMYR(totalUnrl)} (${unrlPct>=0?'+':''}${unrlPct.toFixed(2)}%)`;
  const upEl = $('#unrealisedPnl'); if(upEl){ upEl.textContent = unrlText; upEl.classList.toggle('price-up', totalUnrl>=0); upEl.classList.toggle('price-down', totalUnrl<0); }
  updatePremiumStatusLabel(user);
    // Initialize charts once per dashboard render cycle. Charts are static (no auto-updates).
    if(!dashboardChartsInitialized){ renderAllocationChart(user, market); renderPerfChart(user); dashboardChartsInitialized = true; }
  }

  // Simple charts
  let allocChart=null;
  function renderAllocationChart(user, market){
    const ctx = document.getElementById('donutAllocation'); if(!ctx) return;
    // compute equity as total market value of all holdings
    const holdings = user.holdings || {};
    let equityVal = 0;
    Object.entries(holdings).forEach(([sym,info])=>{ const price = (market && market[sym] && market[sym].price) || getLastPrice(sym) || 0; equityVal += (info.qty||0) * price; });
    const cashVal = (user.cashBalanceMYR===Infinity)? 0 : (user.cashBalanceMYR||0);
    const total = Number((equityVal + cashVal).toFixed(2)) || 0.0001; // avoid zero-total chart issues
    const equityPct = Number((equityVal / total * 100).toFixed(2));
    const cashPct = Number((cashVal / total * 100).toFixed(2));

    const data = {
      labels: ['Equity (invested)', 'Cash (uninvested)'],
      datasets: [{ data: [Number(equityVal.toFixed(2)), Number(cashVal.toFixed(2))], backgroundColor: ['#0b66ff', '#c7cdd6'] }]
    };

    const options = {
      responsive: true,
      animation: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(ctx){ const val = ctx.raw || 0; const pct = total? (val/total*100) : 0; return `${ctx.label}: ${fmtMYR(val)} (${pct.toFixed(2)}%)`; }
          }
        }
      }
    };

    if(allocChart) allocChart.destroy(); allocChart = new Chart(ctx, { type: 'doughnut', data, options });

    // update legend/summary text near the chart if present
    const allocLegend = document.getElementById('allocationSummary'); if(allocLegend){ allocLegend.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div><strong>Equity</strong><div class="muted">${fmtMYR(equityVal)} • ${equityPct}%</div></div><div><strong>Cash</strong><div class="muted">${fmtMYR(cashVal)} • ${cashPct}%</div></div></div>`; }
  }

  let perfChart=null; function renderPerfChart(user){ const ctx = document.getElementById('perfLine'); if(!ctx) return; const days = 30; const labels = []; const values = []; // prefer stored snapshots if available
    const snaps = (user && Array.isArray(user.snapshots) && user.snapshots.length>0) ? user.snapshots.slice().sort((a,b)=> new Date(a.ts).getTime() - new Date(b.ts).getTime()) : null;
    if(snaps){ // build daily series for the last `days` days using snapshots (carry-forward last known)
      const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
      let si = 0; let lastVal = snaps.length? snaps[0].total : 0; for(let d=0; d<=days; d++){ const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d); const dayKey = day.toISOString().slice(0,10); // find latest snapshot <= day
        while(si < snaps.length && snaps[si].ts.slice(0,10) <= dayKey){ lastVal = snaps[si].total; si++; }
        labels.push(day.toLocaleDateString()); values.push(Number(lastVal.toFixed(2))); }
    } else { // fallback: small deterministic series based on current portfolio value
      const now = Date.now(); for(let i=days;i>=0;i--){ labels.push(new Date(now - i*24*3600*1000).toLocaleDateString()); const pv = portfolioValue(user, JSON.parse(localStorage.getItem(MARKET_KEY)||'{}')) || 0; const base = 1000 + (pv/1000); const drift = Math.sin(i/5) * (pv/5000); values.push(Number((base + drift + i*0.1).toFixed(2))); }
    }
    // static chart: disable animations
    if(perfChart) perfChart.destroy();
    perfChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value (MYR)',
          data: values,
          borderColor: '#0b66ff',
          backgroundColor: 'rgba(11,102,255,0.06)',
          fill: true,
          pointRadius: 0,
          tension: 0.15
        }]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          x: { display: true },
          y: { display: true, ticks: { callback: function(v){ return fmtMYR(v); } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx){ return fmtMYR(ctx.parsed && ctx.parsed.y ? ctx.parsed.y : (ctx.raw || 0)); } } }
        }
      }
    });
  }

  // Market list for fractional
  async function renderMarketList(){ const market = await loadMarket(); const container = $('#marketList'); if(!container) return; container.innerHTML=''; Object.entries(market).forEach(([sym,meta])=>{ const card = document.createElement('div'); card.className='card market'; card.innerHTML = `<strong>${sym}</strong><div>${meta.name}</div><div>Price: RM ${meta.price.toFixed(2)}</div><label>Amount (RM): <input class="buyAmt" data-sym="${sym}" type="number" min="10" step="0.01"></label><button class="btn buyBtn" data-sym="${sym}">Buy</button>`; container.appendChild(card); });
    $all('.buyBtn').forEach(b=> b.addEventListener('click', doFractionalBuy) );
    // add sell buttons dynamically
    $all('.card.market').forEach(card=>{
      const sym = card.querySelector('.buyAmt')?.dataset?.sym;
      if(sym){ const sell = document.createElement('button'); sell.className='btn btn-ghost'; sell.textContent='Sell'; sell.addEventListener('click', ()=>{ const amt = Number(prompt('Amount (MYR) to sell (min RM10):','10')); doFractionalSell(sym, amt); }); card.appendChild(sell); }
    });
 }

  function doFractionalBuy(e){ const sym = e.currentTarget.dataset.sym; const input = document.querySelector(`.buyAmt[data-sym="${sym}"]`); const amt = Number(input.value); if(isNaN(amt) || amt<10){ toast('Minimum investment is RM10','warn'); return; } const s = getSession(); const user = findUser(s.email); const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const price = market[sym].price; if(user.cashBalanceMYR!==Infinity && user.cashBalanceMYR < amt){ toast('Insufficient cash','warn'); return; } const qty = Number((amt/price).toFixed(6)); user.holdings = user.holdings||{}; const prev = user.holdings[sym]||{qty:0,avgPrice:0}; const newQty = prev.qty + qty; const newAvg = ((prev.qty*prev.avgPrice) + (qty*price))/newQty; user.holdings[sym] = { qty:newQty, avgPrice:newAvg }; if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR - amt).toFixed(2)); const tx = { type:'FRACTIONAL_BUY', symbol:sym, amount:amt, qty, txHash:pseudoHash() }; pushActivity(user.email, tx);
  // normalized ledger: BUY (cash out)
  recordLedger(user, { type:'BUY', symbol: sym, qty: Number(qty.toFixed(6)), price: Number(price), amount: Number((-amt).toFixed(2)), note: 'Fractional buy' });
  // snapshot for perf chart
  try{ pushPortfolioSnapshot(user.email); }catch(e){}
  renderMarketList(); renderDashboard(); renderTrustLog(user); (function(){ const container = createToastContainer(); const el = document.createElement('div'); el.className='pw-toast pw-toast-success'; el.style.marginTop='8px'; el.style.padding='10px 14px'; el.style.borderRadius='10px'; el.style.background='#0b66ff'; el.style.color='#fff'; el.style.boxShadow='0 8px 20px rgba(11,22,34,0.08)'; el.innerHTML = `Purchase successful! <a href="#" class="viewStatementLink" style="color:#fff;text-decoration:underline;margin-left:8px">View Statement</a>`; container.appendChild(el); el.querySelector('.viewStatementLink')?.addEventListener('click',(ev)=>{ ev.preventDefault(); selectTab('statement'); setTimeout(()=>{ try{ const now=new Date(); const mSel=document.getElementById('stMonth'); const ySel=document.getElementById('stYear'); if(mSel){ mSel.value = (now.getMonth()+1).toString(); mSel.dispatchEvent(new Event('change')); } if(ySel){ ySel.value = now.getFullYear().toString(); ySel.dispatchEvent(new Event('change')); } }catch(_){ } },140); }); setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),240); },5000); })(); }



  function doFractionalSell(sym, amt){ const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const price = market[sym]?.price; const s = getSession(); const user = findUser(s.email); if(isNaN(amt) || amt<10){ toast('Minimum investment is RM10','warn'); return; } const holding = (user.holdings||{})[sym]; if(!holding || holding.qty<=0){ toast('No holdings to sell','warn'); return; } const qty = Number((amt/price).toFixed(6)); if(qty>holding.qty){ toast('Not enough quantity to sell','warn'); return; } user.holdings[sym].qty = Number((holding.qty - qty).toFixed(6)); if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR + amt).toFixed(2)); const tx = { type:'FRACTIONAL_SELL', symbol:sym, amount:amt, qty, txHash:pseudoHash() }; pushActivity(user.email, tx);
  // normalized ledger: SELL (cash in)
  recordLedger(user, { type:'SELL', symbol: sym, qty: Number((-Math.abs(qty)).toFixed(6)), price: Number(price), amount: Number((amt).toFixed(2)), note: 'Fractional sell' });
  try{ pushPortfolioSnapshot(user.email); }catch(e){}
  renderDashboard(); renderMarketList(); renderTrustLog(user); (function(){ const container = createToastContainer(); const el = document.createElement('div'); el.className='pw-toast pw-toast-success'; el.style.marginTop='8px'; el.style.padding='10px 14px'; el.style.borderRadius='10px'; el.style.background='#0b66ff'; el.style.color='#fff'; el.style.boxShadow='0 8px 20px rgba(11,22,34,0.08)'; el.innerHTML = `Sell successful <a href="#" class="viewStatementLink" style="color:#fff;text-decoration:underline;margin-left:8px">View Statement</a>`; container.appendChild(el); el.querySelector('.viewStatementLink')?.addEventListener('click',(ev)=>{ ev.preventDefault(); selectTab('statement'); setTimeout(()=>{ try{ const now=new Date(); const mSel=document.getElementById('stMonth'); const ySel=document.getElementById('stYear'); if(mSel){ mSel.value = (now.getMonth()+1).toString(); mSel.dispatchEvent(new Event('change')); } if(ySel){ ySel.value = now.getFullYear().toString(); ySel.dispatchEvent(new Event('change')); } }catch(_){ } },140); }); setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),240); },5000); })(); }

  function renderTrustLog(user){ const el = $('#trustLog'); if(!el) return; el.innerHTML = ''; (user.activity||[]).filter(a=>['FRACTIONAL_BUY','FRACTIONAL_SELL','ROBO_BUY','REBALANCE','SCREEN_CHECK','DIY_BUY','DIY_SELL'].includes(a.type)).slice(0,50).forEach(it=>{ const d=document.createElement('div'); d.className='trust-item'; d.innerHTML = `<div><strong>${it.type}</strong> ${it.symbol?(' - '+it.symbol):''} ${it.amount?fmtMYR(it.amount):''}</div><div class="muted small">${it.time} • tx:${it.txHash||''}</div>`; el.appendChild(d); }); }

  // Open trust modal and allow copying individual entries
  function openTrustModal(){ const s = getSession(); if(!s) return; const user = findUser(s.email); const modal = $('#trustModal'); if(!modal) return; modal.querySelector('.modal-body').innerHTML = ''; const list = document.createElement('div'); list.className = 'trust-list'; (user.activity||[]).filter(a=>['FRACTIONAL_BUY','FRACTIONAL_SELL','ROBO_BUY','REBALANCE','DIY_BUY','DIY_SELL','PREMIUM_CHARGE','ADMIN_GIFT'].includes(a.type)).slice(0,200).forEach(it=>{ const d=document.createElement('div'); d.className='trust-item'; d.innerHTML = `<div><strong>${it.type}</strong> ${it.symbol?(' - '+it.symbol):''} ${it.amount?fmtMYR(it.amount):''}</div><div class="muted small">${it.time} • tx:${it.txHash||''}</div>`; d.addEventListener('click', ()=>{ const txt = `${it.time} ${it.type} ${it.symbol||''} ${it.amount||''} tx:${it.txHash||''}`; navigator.clipboard?.writeText(txt).then(()=>toast('Copied entry to clipboard','info')); }); list.appendChild(d); }); modal.querySelector('.modal-body').appendChild(list); modal.style.display='block'; }

  // DIY trading
  $('#diyForm')?.addEventListener('submit', function(e){ e.preventDefault(); const sym = $('#diySymbol').value.trim().toUpperCase(); const side = $('#diySide').value; const amt = Number($('#diyAmount').value); if(isNaN(amt) || amt<1){ toast('Enter a valid amount','warn'); return; } const fee = 5; const s = getSession(); const user = findUser(s.email); const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const price = market[sym]?.price; if(!price){ toast('Unknown symbol','warn'); return; }
    if(side==='BUY'){ const total = amt + fee; if(user.cashBalanceMYR!==Infinity && user.cashBalanceMYR < total){ toast('Insufficient cash for amount + fee','warn'); return; } const qty = Number((amt/price).toFixed(6)); user.holdings[sym] = user.holdings[sym]||{qty:0,avgPrice:0}; const prev = user.holdings[sym]; const newQty = prev.qty + qty; const newAvg = ((prev.qty*prev.avgPrice)+(qty*price))/newQty; user.holdings[sym] = { qty:newQty, avgPrice:newAvg }; if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR - total).toFixed(2)); pushActivity(user.email, { type:'DIY_BUY', symbol:sym, amount:amt, qty, fee, txHash:pseudoHash() }); // ledger: BUY (amount negative), and FEE row
  recordLedger(user, { type:'BUY', symbol: sym, qty: Number(qty.toFixed(6)), price: Number(price), amount: Number((-amt).toFixed(2)), fee: Number(fee) }); if(fee && fee>0) recordLedger(user, { type:'FEE', amount: Number(-fee), note: 'DIY trade fee' }); try{ pushPortfolioSnapshot(user.email); }catch(e){} toast('DIY buy executed','success'); } else { // SELL
  const holding = user.holdings[sym]; if(!holding || holding.qty<=0){ toast('No holdings to sell','warn'); return; } const qty = Number((amt/price).toFixed(6)); if(qty>holding.qty) { toast('Not enough quantity to sell','warn'); return; } const proceeds = amt - fee; user.holdings[sym].qty = Number((holding.qty - qty).toFixed(6)); if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR + proceeds).toFixed(2)); pushActivity(user.email, { type:'DIY_SELL', symbol:sym, amount:amt, qty, fee, txHash:pseudoHash() }); // ledger: SELL (amount positive), FEE row
  recordLedger(user, { type:'SELL', symbol: sym, qty: Number((-Math.abs(qty)).toFixed(6)), price: Number(price), amount: Number((amt).toFixed(2)), fee: Number(fee) }); if(fee && fee>0) recordLedger(user, { type:'FEE', amount: Number(-fee), note: 'DIY trade fee' }); try{ pushPortfolioSnapshot(user.email); }catch(e){} toast('DIY sell executed','success'); }
    renderDashboard(); renderMarketList(); renderFeesSummary(); renderActivityTable(); });

  function renderFeesSummary(){ const el = $('#feesList'); if(!el) return; el.textContent = 'Flat RM5 per DIY trade.'; }

  // Robo basics
  function renderRoboTab() {
    const s = getSession();
    const user = s && findUser(s.email);
    const locked = $('#roboLocked');
    const content = $('#roboContent');
    if(user && (user.premiumActive || user.premiumRoboActive)) {
      locked.classList.add('hidden');
      content.classList.remove('hidden');
      // ensure saved quiz summary is shown (persisted across refresh)
      try{
        const hasProfile = !!(user.robo && user.robo.riskProfile);
        const summaryEl = document.getElementById('roboQuizSummary');
        if(summaryEl){
          if(hasProfile){
            summaryEl.classList.remove('hidden');
            renderRoboSummaryForUser(user);
          } else {
            summaryEl.classList.add('hidden');
          }
        }
        const quizBtn = document.getElementById('btnRoboQuiz');
        if(quizBtn){ quizBtn.textContent = hasProfile ? 'Retake Risk Quiz' : 'Take Risk Quiz'; }
        // render ESG card below risk profile
        renderRoboEsg(user);
      }catch(err){ console.warn('Robo summary render failed', err); }
    } else {
      locked.classList.remove('hidden');
      content.classList.add('hidden');
    }
  }

  // Call on tab switch and after premium changes
  document.addEventListener('session:changed', renderRoboTab);
  document.addEventListener('ledger:changed', renderRoboTab);
  window.addEventListener('storage', renderRoboTab);

  // ---------- ESG scoring (Pro only) ----------
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function round2(n){ return Math.round(Number(n||0)*100)/100; }

  // Compute a simple ESG profile based on holdings mix, symbol types, and risk profile
  function computeEsgForUser(user){
    try{
      const meta = loadMarketMeta();
      const holdings = user && user.holdings ? user.holdings : {};
      const totalVal = Object.entries(holdings).reduce((s,[sym,h])=> s + (h.qty||0) * (currentPrice(sym) || (meta[sym]?.price || 0)), 0) || 0;
      // base components
      let E=50, S=50, G=50;
      // boost for ESG-themed funds and defensive sectors; penalty for energy proxy
      Object.entries(holdings).forEach(([sym,h])=>{
        const w = totalVal? ((h.qty||0) * (currentPrice(sym) || meta[sym]?.price || 0)) / totalVal : 0;
        const name = (meta[sym]?.name||'').toUpperCase();
        const type = (meta[sym]?.type||'').toLowerCase();
        if(/ESG|SUSTAIN|CLEAN|GREEN|HEALTH|INFRA|TELE/i.test(name)){
          E += 15*w; S += 8*w; G += 6*w;
        }
        if(type==='etf'){ G += 4*w; }
        if(/OIL|ENERGY|FUT/i.test(name) || sym==='OILFUT'){ E -= 18*w; }
        if(/BANK|FIN/i.test(name) || sym==='FINBANK'){ G += 2*w; }
        if(/HEALTH/i.test(name) || sym==='HEALTHMY'){ S += 10*w; }
        // Shariah holdings: modest governance/social lift
        if(isShariahSymbol(sym)){ S += 6*w; G += 6*w; }
      });
      // risk profile influences governance tilt
      const riskScore = (user && user.robo && user.robo.riskProfile && user.robo.riskProfile.score) ? user.robo.riskProfile.score : 5;
      G += (riskScore<=3? 6 : riskScore>=8? -4 : 0);
      // market mood: volatile period slightly lowers G and S
      if((localStorage.getItem('market.volatilityMode')||'normal')==='volatile'){ S -= 2; G -= 2; }
      E = clamp(E, 0, 100); S = clamp(S, 0, 100); G = clamp(G, 0, 100);
      const overall = clamp(round2(0.45*E + 0.3*S + 0.25*G), 0, 100);
      return { overall, E: round2(E), S: round2(S), G: round2(G) };
    }catch(e){ return { overall: 0, E:0, S:0, G:0 }; }
  }

  function esgTier(score){ if(score>=80) return 'Excellent'; if(score>=65) return 'Good'; if(score>=50) return 'Fair'; if(score>=35) return 'Needs improvement'; return 'Low'; }

  let esgCharts = { gauge:null, bars:null, radar:null };
  function destroyEsgCharts(){ try{ if(esgCharts.gauge){ esgCharts.gauge.destroy(); esgCharts.gauge=null; } if(esgCharts.bars){ esgCharts.bars.destroy(); esgCharts.bars=null; } if(esgCharts.radar){ esgCharts.radar.destroy(); esgCharts.radar=null; } }catch(_){} }

  function renderRoboEsg(user){
    try{
      const card = document.getElementById('roboEsgCard'); if(!card) return;
      const lockEl = document.getElementById('esgLocked'); const contentEl = document.getElementById('esgContent');
      const isPro = !!(user && user.premiumActive);
      if(!isPro){ if(lockEl) lockEl.classList.remove('hidden'); if(contentEl) contentEl.classList.add('hidden'); destroyEsgCharts(); return; }
      // Pro: show content
      if(lockEl) lockEl.classList.add('hidden'); if(contentEl) contentEl.classList.remove('hidden');
      const esg = computeEsgForUser(user);
      // text
      const overallEl = document.getElementById('esgOverallText'); if(overallEl) overallEl.textContent = `Overall ESG: ${esg.overall} / 100`;
      const tierEl = document.getElementById('esgTierText'); if(tierEl) tierEl.textContent = `Tier: ${esgTier(esg.overall)}`;
      const explain = document.getElementById('esgExplain'); if(explain){
        explain.innerHTML = `
          Your ESG score blends three pillars:
          <ul>
            <li><strong>Environmental (E)</strong>: ${esg.E} — higher with green/healthcare/infrastructure exposure; reduced by energy-heavy holdings.</li>
            <li><strong>Social (S)</strong>: ${esg.S} — reflects people impact; Shariah-compliant holdings add to this pillar.</li>
            <li><strong>Governance (G)</strong>: ${esg.G} — diversified ETFs and balanced risk profiles support stronger governance.</li>
          </ul>
          Scores update automatically after your trades.`;
      }
      // charts
      const gaugeCtx = document.getElementById('esgGauge'); const barCtx = document.getElementById('esgBars'); const radarCtx = document.getElementById('esgRadar');
      destroyEsgCharts();
      if(gaugeCtx){
        esgCharts.gauge = new Chart(gaugeCtx, {
          type:'doughnut',
          data:{
            labels:['Score',''],
            datasets:[{
              data:[esg.overall, 100 - esg.overall],
              backgroundColor:['#00b37a','#e9ecef'],
              borderWidth:0
            }]
          },
          options:{
            cutout:'70%',
            rotation:-90,
            circumference:180,
            plugins:{
              legend:{ display:false },
              tooltip:{ enabled:false }
            }
          }
        });
      }
      if(barCtx){ esgCharts.bars = new Chart(barCtx, { type:'bar', data:{ labels:['E','S','G'], datasets:[{ label:'Score', data:[esg.E, esg.S, esg.G], backgroundColor:['#16a34a','#0ea5e9','#7c3aed'] }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, max:100 } } } }); }
      if(radarCtx){ esgCharts.radar = new Chart(radarCtx, { type:'radar', data:{ labels:['Environmental','Social','Governance'], datasets:[{ label:'ESG', data:[esg.E, esg.S, esg.G], backgroundColor:'rgba(11,102,255,0.1)', borderColor:'#0b66ff', pointRadius:2 }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ r:{ suggestedMin:0, suggestedMax:100 } } } }); }
    }catch(e){ console.warn('renderRoboEsg failed', e); }
  }

  // Populate market type filter dropdown in Market controls
  function populateMarketTypeFilter(){ try{ const sel = document.getElementById('marketTypeFilter'); if(!sel) return; const meta = loadMarketMeta(); const types = new Set(); Object.values(meta).forEach(m=>{ if(m && m.type) types.add(String(m.type).toLowerCase()); }); // clear existing options except 'All'
    const cur = sel.value || '';
    sel.innerHTML = '<option value="">All</option>' + Array.from(types).sort().map(t=> `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
    if(cur) sel.value = cur; // preserve selection if possible
    sel.removeEventListener('change', _marketTypeChangeHandler);
    sel.addEventListener('change', _marketTypeChangeHandler);
  }catch(e){ console.warn('populateMarketTypeFilter failed', e); } }

  function _marketTypeChangeHandler(){ try{ renderWatchlist(); }catch(e){} }

  // Update ESG after trades and when Robo tab is visible
  document.addEventListener('ledger:changed', ()=>{ try{ const s = getSession(); const u = s && findUser(s.email); const active = localStorage.getItem('pw_tab')||''; if(u && active==='robo'){ renderRoboEsg(u); } }catch(_){} });
  document.addEventListener('session:changed', ()=>{ try{ const s = getSession(); const u = s && findUser(s.email); const active = localStorage.getItem('pw_tab')||''; if(u && active==='robo'){ renderRoboEsg(u); } }catch(_){} });

  $('#roboRisk')?.addEventListener('input', ()=>{ $('#roboWeights').textContent = `Target risk: ${$('#roboRisk').value}`; });
  $('#btnSaveRobo')?.addEventListener('click', ()=>{ const s = getSession(); const user = findUser(s.email); user.roboPortfolio = { targetWeights: { equity: Number($('#roboRisk').value) } }; upsertUser(user); pushActivity(user.email, { type:'ROBO_SAVE', detail:'Saved robo target' }); toast('Saved robo portfolio','success'); });
  $('#btnInvestRobo')?.addEventListener('click', ()=>{ const amt = prompt('Amount to invest to target (MYR, min RM10):','100'); const a = Number(amt); if(isNaN(a) || a<10){ toast('Min RM10','warn'); return; } const s = getSession(); const user = findUser(s.email); if(user.cashBalanceMYR!==Infinity && user.cashBalanceMYR < a){ toast('Insufficient cash','warn'); return; } // for demo, split into 2-3 ETFs
    const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const picks = Object.keys(market).slice(0,3); picks.forEach((sym,i)=>{ const share = a * (1/picks.length); const price = market[sym].price; const qty = Number((share/price).toFixed(6)); user.holdings[sym] = user.holdings[sym]||{qty:0,avgPrice:0}; const prev = user.holdings[sym]; const newQty = prev.qty + qty; const newAvg = ((prev.qty*prev.avgPrice)+(qty*price))/newQty; user.holdings[sym] = { qty:newQty, avgPrice:newAvg }; }); if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR - a).toFixed(2)); pushActivity(user.email, { type:'ROBO_BUY', amount:a, txHash:pseudoHash() }); upsertUser(user); renderDashboard(); renderMarketList(); renderActivityTable(); });

  $('#btnRebalance')?.addEventListener('click', ()=>{ const s = getSession(); const user = findUser(s.email); pushActivity(user.email, { type:'REBALANCE', detail:'Rebalanced to target', txHash:pseudoHash() }); upsertUser(user); toast('Rebalance simulated','info'); renderActivityTable(); });

  // Premium
  // Premium processing lock
  let premiumProcessing = false;

  // Single function to set premium state and persist with history and activity
  function setPremiumState(user, active){ // returns promise-like (sync) but we guard errors
    const prev = { premiumActive: user.premiumActive, premiumActivatedAt: user.premiumActivatedAt };
    try{
      user.premiumActive = !!active;
      if(active){ user.premiumActivatedAt = nowISO(); user.premiumHistory = user.premiumHistory||[]; user.premiumHistory.push({ type:'ACTIVATE', time: user.premiumActivatedAt }); pushActivity(user.email, { type:'PREMIUM_ACTIVATED', amount:20 }); }
      else { const t = nowISO(); user.premiumHistory = user.premiumHistory||[]; user.premiumHistory.push({ type:'UNSUBSCRIBE', time: t }); pushActivity(user.email, { type:'PREMIUM_CANCELLED' }); }
  upsertUser(user);
  try{ pushPortfolioSnapshot(user.email); }catch(e){}
      return { ok:true };
    }catch(e){ // rollback
      user.premiumActive = prev.premiumActive; user.premiumActivatedAt = prev.premiumActivatedAt; return { ok:false, error:e };
    }
  }

  function renderPremiumUI(){ const s = getSession(); if(!s) return; const user = findUser(s.email); const activateBtn = $('#btnActivatePremium'); const cancelBtn = $('#btnCancelPremium'); const unlocked = $('#premiumUnlocked'); const upsell = $('#premiumUpsell');
    if(user && user.premiumActive){ // Full Premium active: hide activations, show ONLY Pro cancel
      $all('#btnActivatePremiumFull').forEach(b=>{b.classList.add('hidden');b.setAttribute('aria-hidden','true');});
      $all('#btnActivatePremiumRobo').forEach(b=>{b.classList.add('hidden');b.setAttribute('aria-hidden','true');});
      // show Pro cancel only; hide Starter/legacy cancel buttons
      $all('#btnCancelPro').forEach(b=>{ b.classList.remove('hidden'); b.setAttribute('aria-hidden','false'); });
      $all('#btnCancelStarter, #btnCancelPremium').forEach(b=>{ if(b){ b.classList.add('hidden'); b.setAttribute('aria-hidden','true'); } });
      // show only premium cards that have content; keep empty placeholders hidden
      unlocked.querySelectorAll('.card').forEach(c=>{
        try{
          const content = (c.innerHTML || '').replace(/\s+/g,'').replace(/&nbsp;/g,'');
          if(content && content.length>0){ c.classList.remove('hidden'); c.setAttribute('aria-hidden','false'); }
          else { c.classList.add('hidden'); c.setAttribute('aria-hidden','true'); }
        }catch(e){ c.classList.add('hidden'); c.setAttribute('aria-hidden','true'); }
      });
      upsell.classList.add('hidden');
    } else if(user && user.premiumRoboActive) { // Robo Starter active: show Starter cancel only
      $all('#btnActivatePremiumFull').forEach(b=>{b.classList.remove('hidden');b.setAttribute('aria-hidden','false');});
      $all('#btnActivatePremiumRobo').forEach(b=>{b.classList.add('hidden');b.setAttribute('aria-hidden','true');});
      // show Starter cancel only; hide Pro/legacy cancel buttons
      $all('#btnCancelStarter').forEach(b=>{ b.classList.remove('hidden'); b.setAttribute('aria-hidden','false'); });
      $all('#btnCancelPro, #btnCancelPremium').forEach(b=>{ if(b){ b.classList.add('hidden'); b.setAttribute('aria-hidden','true'); } });
      unlocked.querySelectorAll('.card').forEach(c=>{
        if(c.id==='roboUnlock') c.classList.remove('hidden');
        else c.classList.add('hidden');
      });
      upsell.classList.remove('hidden');
    } else {
      // No subscription: show activation buttons and hide all cancels
      $all('#btnActivatePremiumFull').forEach(b=>{b.classList.remove('hidden');b.setAttribute('aria-hidden','false');});
      $all('#btnActivatePremiumRobo').forEach(b=>{b.classList.remove('hidden');b.setAttribute('aria-hidden','false');});
      $all('#btnCancelPremium, #btnCancelStarter, #btnCancelPro').forEach(b=>{ if(b){ b.classList.add('hidden'); b.setAttribute('aria-hidden','true'); } });
      unlocked.querySelectorAll('.card').forEach(c=>c.classList.add('hidden'));
      upsell.classList.remove('hidden');
    }
  updatePremiumStatusLabel(user);
  // populate content for unlocked cards when user has Pro
  try{ if(user && user.premiumActive){ populatePremiumUnlockedCards(user); } }catch(e){}
  }

  function populatePremiumUnlockedCards(user){
    try{
      const esgEl = document.getElementById('esgScoring');
      const shariahEl = document.getElementById('shariahOptions');
      const supportEl = document.getElementById('premiumSupport');
      if(esgEl){ esgEl.innerHTML = `<h4 style="margin-top:0">ESG Scoring & Dashboards</h4><p class="muted">See your overall ESG score and pillar breakdowns. Interactive charts are available in the Robo tab under ESG scoring.</p>`; esgEl.classList.remove('hidden'); }
      if(shariahEl){ shariahEl.innerHTML = `<h4 style="margin-top:0">Shariah-Certified Options</h4><p class="muted">Access curated Shariah screens and trade certified symbols. Explore the Shariah Market in the Invest tab.</p>`; shariahEl.classList.remove('hidden'); }
      if(supportEl){ supportEl.innerHTML = `<h4 style="margin-top:0">Priority Support & Masterclasses</h4><p class="muted">You now have access to priority support and invitations to member-only masterclasses. Check your inbox for upcoming events.</p>`; supportEl.classList.remove('hidden'); }
    }catch(e){ console.warn('populatePremiumUnlockedCards failed', e); }
  }

  // Handler: Activate Full Premium (RM20)
  $('#btnActivatePremiumFull')?.addEventListener('click', async ()=>{
    const btn = $('#btnActivatePremiumFull'); if(!btn) return; if(premiumProcessing) return; premiumProcessing = true; btn.setAttribute('aria-busy','true'); btn.classList.add('loading'); const s = getSession(); const user = findUser(s.email); try{
      if(!user) throw new Error('No user'); if(user.premiumActive){ toast('Already premium','info'); return; }
      if(user.cashBalanceMYR!==Infinity && user.cashBalanceMYR < 20){ toast('Insufficient balance (RM20 required).','warn'); return; }
      const prevCash = user.cashBalanceMYR;
      const wasRoboActive = !!user.premiumRoboActive;
      try{
        // Always charge RM20 for full premium activation (even if upgrading from Robo)
        if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR - 20).toFixed(2));
        console.debug('[premium] charging RM20', { email: user.email, prevCash: prevCash, newCash: user.cashBalanceMYR });
        // set premium state (this will also push PREMIUM_ACTIVATED activity internally)
        const res = setPremiumState(user, true);
        if(!res.ok) throw res.error || new Error('Failed to set premium');
        // record explicit charge entries on the in-memory user object then persist once
  pushActivityForUser(user, { type:'PREMIUM_CHARGE', amount:20, txHash:pseudoHash() });
  pushLedgerForUser(user, { type:'PREMIUM_SUB', amount: -20, note: 'Premium subscription' });
  upsertUser(user);
  console.debug('[premium] upsertUser called', { email: user.email });
  // ensure header and dashboard reflect new balance immediately
  renderUserStatus(); renderDashboard();
  toast(`Charged RM20 — new balance: ${fmtMYR(user.cashBalanceMYR)}`,'success');
      }catch(err){ user.cashBalanceMYR = prevCash; upsertUser(user); throw err; }
      renderDashboard(); renderPremiumUI(); renderActivityTable(); toast('Premium activated 🎉','success');
    }catch(err){ console.error(err); toast('Something went wrong. Please try again.','warn'); }
    finally{ premiumProcessing = false; btn.removeAttribute('aria-busy'); btn.classList.remove('loading'); btn.focus(); }
  });

  // Handler: Activate Premium Robo (RM10)
  $('#btnActivatePremiumRobo')?.addEventListener('click', async (ev)=>{
    // Prevent accidental event bubbling that could trigger unsubscribe handlers
    try{ ev && ev.preventDefault && ev.preventDefault(); }catch(e){}
    try{ ev && ev.stopPropagation && ev.stopPropagation(); }catch(e){}
    const btn = $('#btnActivatePremiumRobo'); if(!btn) return; if(premiumProcessing) return; premiumProcessing = true; btn.setAttribute('aria-busy','true'); btn.classList.add('loading'); const s = getSession(); const user = findUser(s.email); try{
      if(!user) throw new Error('No user'); if(user.premiumRoboActive){ toast('Already Robo premium','info'); return; }
      if(user.cashBalanceMYR!==Infinity && user.cashBalanceMYR < 10){ toast('Insufficient balance (RM10 required).','warn'); return; }
      const prevCash = user.cashBalanceMYR;
      try{
        if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR - 10).toFixed(2));
        console.debug('[robo] charging RM10', { email: user.email, prevCash: prevCash, newCash: user.cashBalanceMYR });
        user.premiumRoboActive = true;
        user.premiumRoboActivatedAt = nowISO();
        user.premiumHistory = user.premiumHistory||[];
        user.premiumHistory.push({ type:'ACTIVATE_ROBO', time: user.premiumRoboActivatedAt });
        // use in-memory helpers to avoid re-loading stale user
  pushActivityForUser(user, { type:'PREMIUM_ROBO_ACTIVATED', amount:10 });
  pushLedgerForUser(user, { type:'PREMIUM_ROBO_SUB', amount: -10, note: 'Robo-Advisory subscription' });
  upsertUser(user);
  console.debug('[robo] upsertUser called', { email: user.email });
  // refresh header/dashboard immediately
  renderUserStatus(); renderDashboard();
  toast(`Charged RM10 — new balance: ${fmtMYR(user.cashBalanceMYR)}`,'success');
      }catch(err){ user.cashBalanceMYR = prevCash; upsertUser(user); throw err; }
      renderPremiumUI(); renderActivityTable(); toast('Robo-Advisory unlocked!','success');
      try{ renderRoboTab(); }catch(e){}
    }catch(err){ console.error(err); toast('Something went wrong. Please try again.','warn'); }
    finally{ premiumProcessing = false; btn.removeAttribute('aria-busy'); btn.classList.remove('loading'); btn.focus(); }
  });

  // Handler: Unsubscribe (shared for multiple cancel buttons)
  async function handleUnsubscribeClick(ev){
    const triggeringBtn = ev && ev.currentTarget ? ev.currentTarget : $('#btnCancelPremium');
    const btn = triggeringBtn || $('#btnCancelPremium'); if(!btn) return;
    // Ask for confirmation before proceeding
    try{
      const msg = 'Are you sure you want to unsubscribe 😭\n\nWe\'re sorry to see you go. Unsubscribing will remove access to Premium features (Robo, ESG, Shariah screens).\n\nChoose OK to unsubscribe, or Cancel to keep your subscription.';
      const ok = window.confirm(msg);
      if(!ok){ toast('Unsubscribe cancelled','info'); return; }
    }catch(e){ /* if confirm fails, continue to unsubscribe */ }
    if(premiumProcessing) return; premiumProcessing = true; btn.setAttribute('aria-busy','true'); btn.classList.add('loading'); const s = getSession(); const user = findUser(s.email);
    try{
      if(!user) throw new Error('No user');
      let unsubscribed = false;
      if(user.premiumActive) {
        const res = setPremiumState(user, false);
        if(!res.ok) throw res.error || new Error('Failed to unset premium');
  // setPremiumState already pushed PREMIUM_CANCELLED via activity; add ledger row
  pushLedgerForUser(user, { type:'PREMIUM_UNSUB', amount: 0, note: 'Premium unsubscribe' });
  upsertUser(user);
  console.debug('[premium] cancelled full premium', { email: user.email });
        unsubscribed = true;
      }
      if(user.premiumRoboActive) {
        user.premiumRoboActive = false;
        user.premiumRoboActivatedAt = null;
        user.premiumHistory = user.premiumHistory||[];
        user.premiumHistory.push({ type:'UNSUBSCRIBE_ROBO', time: nowISO() });
        pushActivityForUser(user, { type:'PREMIUM_ROBO_CANCELLED' });
        pushLedgerForUser(user, { type:'PREMIUM_ROBO_UNSUB', amount: 0, note: 'Robo-Advisory unsubscribe' });
        upsertUser(user);
        unsubscribed = true;
      }
      if(unsubscribed) {
        renderDashboard(); renderPremiumUI(); renderActivityTable(); try{ renderRoboTab(); }catch(e){}; toast('Subscription cancelled','success');
      } else {
        toast('No active subscription to cancel','info');
      }
    }catch(err){ console.error(err); toast('Something went wrong. Please try again.','warn'); }
    finally{ premiumProcessing = false; btn.removeAttribute('aria-busy'); btn.classList.remove('loading'); try{ btn.focus(); }catch(e){} }
  }

  // Attach unsubscribe handler to any cancel/unsubscribe buttons present in the DOM
  $all('#btnCancelPremium, #btnCancelStarter, #btnCancelPro').forEach(el=>{ if(el) el.addEventListener('click', handleUnsubscribeClick); });

  // Activity table & CSV
  function fmtLocal(dt){ try{ return new Date(dt).toLocaleString(undefined,{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return dt; } }
  function actionLabel(a){ // create a friendly action label based on type and payload
    if(!a) return ''; const t = a.type || ''; if(t==='PREMIUM_ACTIVATED' || t==='PREMIUM_CHARGE') return 'Subscribed to Premium'; if(t==='PREMIUM_CANCELLED' || t==='PREMIUM_CANCEL') return 'Unsubscribed Premium'; if(t==='ROBO_BUY') return `Invested ${fmtMYR(a.amount||0)} in Robo-Advisory`; if(t==='MARKET_BUY') return `Bought ${fmtMYR(a.amount||0)} of ${a.symbol||''} @ ${fmtMYR(a.price||0)}`; if(t==='MARKET_SELL') return `Sold ${fmtMYR(a.amount||0)} of ${a.symbol||''} @ ${fmtMYR(a.price||0)}`; if(t==='DIY_BUY') return `DIY Buy ${fmtMYR(a.amount||0)} ${a.symbol||''}`; if(t==='DIY_SELL') return `DIY Sell ${fmtMYR(a.amount||0)} ${a.symbol||''}`; if(t==='DEPOSIT') return `Deposited ${fmtMYR(a.amount||0)}`; if(t==='WITHDRAW') return `Withdrew ${fmtMYR(a.amount||0)}`; if(t==='ROBO_SAVE') return 'Saved robo target'; if(t==='ADMIN_GIFT') return `Gifted ${fmtMYR(a.amount||0)} to ${a.to||a.email||''}`; return t; }
  function typeTagClass(a){ const t = a.type||''; if(t.includes('BUY')) return 'type-buy'; if(t.includes('SELL')) return 'type-sell'; if(t.includes('PREMIUM')) return 'type-premium'; if(t.includes('ROBO')) return 'type-robo'; return 'type-system'; }

  function renderActivityTable(){ const s = getSession(); const user = findUser(s.email); const container = $('#activityList'); if(!container) return; container.innerHTML = ''; const rows = (user.activity||[]).slice(0,200); rows.forEach(a=>{ const row = document.createElement('div'); row.className='activity-row'; const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:700">${actionLabel(a)}</div><div class="muted small">${fmtLocal(a.time)}</div>`; const right = document.createElement('div'); const tag = document.createElement('span'); tag.className = `activity-type ${typeTagClass(a)}`; tag.textContent = (a.type||''); right.appendChild(tag); row.appendChild(left); row.appendChild(right); container.appendChild(row); }); }

  $('#btnDownloadCSV')?.addEventListener('click', ()=>{ const s = getSession(); const user = findUser(s.email); const rows = (user.activity||[]).map(a=>[ fmtLocal(a.time), actionLabel(a), a.type || '' ]); const csv = ['time,action,type', ...rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='activity.csv'; a.click(); URL.revokeObjectURL(url); });

  // Note: Admin gifting is wired inside renderAdminView to ensure listeners attach to the active Admin panel instance.

  function renderFeesSummary(){ /* placeholder */ }

  function renderAdminSummary(){ const el = $('#adminSummary'); if(!el) return; const users = loadUsers(); const totalUsers = users.length; const totalAUM = users.reduce((s,u)=> s + ((u.cashBalanceMYR===Infinity)?0: (u.cashBalanceMYR||0)) + portfolioValue(u, JSON.parse(localStorage.getItem(MARKET_KEY)||'{}')),0); const premiums = users.filter(u=>u.premiumActive).length; el.innerHTML = `<p>Total users: ${totalUsers}</p><p>Total AUM (cash+portfolios): ${fmtMYR(totalAUM)}</p><p>Premium users: ${premiums}</p>`; }

  // Sign out
  $('#btnSignOutApp')?.addEventListener('click', ()=>{ clearSession(); window.location.href='PocketWealth.html'; });

  // Deposit / Withdraw handlers (normalized ledger entries)
  $('#btnDeposit')?.addEventListener('click', ()=>{
    const amt = Number($('#depositAmount')?.value || 0); if(isNaN(amt) || amt<=0){ toast('Enter a valid amount to deposit','warn'); return; }
    const s = getSession(); if(!s) return; const user = findUser(s.email); if(!user) return; user.cashBalanceMYR = (user.cashBalanceMYR===Infinity)? Infinity : Number(((user.cashBalanceMYR||0) + amt).toFixed(2)); // push activity + ledger
  pushActivity(user.email, { type:'DEPOSIT', amount:amt }); recordLedger(user, { type:'CASH_IN', amount: Number(amt), note: 'Deposit via UI' }); try{ pushPortfolioSnapshot(user.email); }catch(e){} renderDashboard(); renderRecentActivity(); toast('Deposit recorded','success'); });

  $('#btnWithdraw')?.addEventListener('click', ()=>{
    const amt = Number($('#withdrawAmount')?.value || 0); if(isNaN(amt) || amt<=0){ toast('Enter a valid amount to withdraw','warn'); return; }
    const s = getSession(); if(!s) return; const user = findUser(s.email); if(!user) return; if(user.cashBalanceMYR!==Infinity && (user.cashBalanceMYR||0) < amt){ toast('Insufficient cash','warn'); return; }
  user.cashBalanceMYR = (user.cashBalanceMYR===Infinity)? Infinity : Number(((user.cashBalanceMYR||0) - amt).toFixed(2)); pushActivity(user.email, { type:'WITHDRAW', amount:amt }); recordLedger(user, { type:'WITHDRAW', amount: Number(-amt), note: 'Withdraw via UI' }); try{ pushPortfolioSnapshot(user.email); }catch(e){} renderDashboard(); renderRecentActivity(); toast('Withdrawal recorded','success'); });

  // ---------------- Top-up / Reload (self-service) ----------------
  // Configuration: amounts are handled in cents internally
  const TOPUP_MIN_CENTS = 100; // RM1.00
  const TOPUP_MAX_CENTS = 5000000; // RM50,000.00

  function toCents(amount){ return Math.round(Number(amount || 0) * 100); }
  function fromCents(cents){ return Number((cents/100).toFixed(2)); }

  // helper: check if ledger already has an id
  function ledgerHasEntry(user, id){ if(!user || !id) return false; const l = user.ledger || []; return l.some(x=> x.id === id); }

  // Modal state & helpers
  const topupModalEl = $('#topupModal'); let topupState = { processing:false, pendingId:null, lastFocus:null };

  function openTopupModal(){ const s = getSession(); if(!s) return; const user = findUser(s.email); if(!user) return; // populate balances
    $('#topupAmount').value = '';
    $('#topupError').style.display = 'none';
    $('#balanceNow').textContent = fmtMYR(user.cashBalanceMYR===Infinity? 0 : (user.cashBalanceMYR||0)); $('#balanceAfter').textContent = fmtMYR(user.cashBalanceMYR===Infinity? 0 : (user.cashBalanceMYR||0));
    topupState.processing = false; topupState.pendingId = null; topupState.lastFocus = document.activeElement; document.body.style.overflow='hidden'; if(topupModalEl){ topupModalEl.classList.remove('hidden'); topupModalEl.setAttribute('aria-hidden','false'); }
    // trap keys
    topupState._keyHandler = function(e){ if(e.key==='Escape'){ closeTopupModal(); } else if(e.key==='Tab'){ // basic focus trap
        const focusables = Array.from(topupModalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled && el.offsetParent!==null);
        if(focusables.length===0) return; const idx = focusables.indexOf(document.activeElement); if(e.shiftKey){ if(idx===0){ e.preventDefault(); focusables[focusables.length-1].focus(); } } else { if(idx===focusables.length-1){ e.preventDefault(); focusables[0].focus(); } }
      } };
    document.addEventListener('keydown', topupState._keyHandler);
    setTimeout(()=>{ $('#topupAmount')?.focus(); }, 80);
  }

  function closeTopupModal(){ if(topupModalEl){ topupModalEl.classList.add('hidden'); topupModalEl.setAttribute('aria-hidden','true'); } document.body.style.overflow=''; if(topupState && topupState._keyHandler){ document.removeEventListener('keydown', topupState._keyHandler); topupState._keyHandler = null; } try{ if(topupState && topupState.lastFocus) topupState.lastFocus.focus(); }catch(e){} }

  // Wire openers
  $('#btnTopup')?.addEventListener('click', ()=> openTopupModal());
  $('#btnTopupQuick')?.addEventListener('click', ()=> openTopupModal());

  // quick chips
  $all('.topupQuick').forEach(b=> b.addEventListener('click', (e)=>{ const v = Number(e.currentTarget.dataset.amt||0); $('#topupAmount').value = Number(v).toFixed(2); $('#topupAmount').dispatchEvent(new Event('input')); }));

  // input -> validate & preview
  $('#topupAmount')?.addEventListener('input', (e)=>{
    const val = Number($('#topupAmount').value || 0); const s = getSession(); if(!s) return; const user = findUser(s.email); const currentC = toCents(user.cashBalanceMYR||0); const addC = toCents(val); const after = fromCents(currentC + addC);
    $('#balanceNow').textContent = fmtMYR(fromCents(currentC)); $('#balanceAfter').textContent = fmtMYR(after);
    // simple validation
    const errEl = $('#topupError'); errEl.style.display = 'none'; if(isNaN(val) || val <= 0){ errEl.textContent = 'Enter a valid amount'; errEl.style.display = 'block'; $('#topupConfirm').disabled = true; return; }
    const cents = toCents(val); if(cents < TOPUP_MIN_CENTS){ errEl.textContent = 'Minimum top-up is RM1.00'; errEl.style.display = 'block'; $('#topupConfirm').disabled = true; return; }
    if(cents > TOPUP_MAX_CENTS){ errEl.textContent = 'Maximum per top-up is RM50,000'; errEl.style.display = 'block'; $('#topupConfirm').disabled = true; return; }
    $('#topupConfirm').disabled = false;
  });

  // Cancel
  $('#topupCancel')?.addEventListener('click', ()=>{ closeTopupModal(); });

  // Confirm top-up
  $('#topupConfirm')?.addEventListener('click', ()=>{
    if(topupState.processing) return; topupState.processing = true; const btn = $('#topupConfirm'); btn.disabled = true; btn.setAttribute('aria-busy','true'); const s = getSession(); if(!s){ toast('Not signed in','warn'); topupState.processing = false; btn.disabled = false; btn.removeAttribute('aria-busy'); return; } const user = findUser(s.email); if(!user){ toast('User not found','warn'); topupState.processing = false; btn.disabled = false; btn.removeAttribute('aria-busy'); return; }
    const amtVal = Number($('#topupAmount').value || 0); const cents = toCents(amtVal);
    if(isNaN(cents) || cents < TOPUP_MIN_CENTS || cents > TOPUP_MAX_CENTS){ $('#topupError').textContent = 'Invalid amount'; $('#topupError').style.display = 'block'; topupState.processing = false; btn.disabled = false; btn.removeAttribute('aria-busy'); return; }
    // idempotency key
    const idKey = 'topup_' + nowISO().replace(/[:.]/g,'') + '_' + pseudoHash(); if(ledgerHasEntry(user, idKey)){ toast('Top-up already processed','info'); topupState.processing = false; btn.disabled = false; btn.removeAttribute('aria-busy'); closeTopupModal(); return; }
    // apply change in cents, persist, add ledger & activity
    const prevCash = user.cashBalanceMYR===Infinity? Infinity : toCents(user.cashBalanceMYR||0);
    try{
      const newCents = (prevCash===Infinity)? Infinity : (prevCash + cents);
      if(newCents !== Infinity){ user.cashBalanceMYR = fromCents(newCents); } else { user.cashBalanceMYR = Infinity; }
      // activity for user
      pushActivity(user.email, { type:'CASH_IN', amount: fromCents(cents), txHash: pseudoHash(), time: nowISO() });
      // ledger entry (idempotent by id)
      if(!ledgerHasEntry(user, idKey)){
  recordLedger(user, { id: idKey, type:'CASH_IN', amount: fromCents(cents), fee: 0, balanceAfter: user.cashBalanceMYR, note: 'Self top-up', ts: nowISO() });
      }
      upsertUser(user);
      // admin-visible event
      try{ const admin = findUser(ADMIN_EMAIL); if(admin){ pushActivity(ADMIN_EMAIL, { type:'CASH_IN', user: user.email, amount: fromCents(cents), time: nowISO(), txHash: pseudoHash() }); upsertUser(admin); } }catch(e){}
      // refresh UI
      renderUserStatus(); renderDashboard(); renderRecentActivity(); renderActivityTable(); renderAdminSummary();
      // custom toast with link to statement
  const container = createToastContainer(); const el = document.createElement('div'); el.className = 'pw-toast pw-toast-success'; el.style.marginTop = '8px'; el.style.padding = '10px 14px'; el.style.borderRadius = '10px'; el.style.background = '#0b66ff'; el.style.color = '#fff'; el.style.boxShadow = '0 8px 20px rgba(11,22,34,0.08)'; el.innerHTML = `Top-up successful. Balance is now ${fmtMYR(user.cashBalanceMYR)} <a href="#" id="viewStatementLink" style="color:#fff;text-decoration:underline;margin-left:8px">View Statement</a>`; container.appendChild(el);
  document.getElementById('viewStatementLink')?.addEventListener('click', (ev)=>{ ev.preventDefault(); closeTopupModal(); selectTab('statement'); setTimeout(()=>{ try{ const now=new Date(); const mSel=document.getElementById('stMonth'); const ySel=document.getElementById('stYear'); if(mSel){ mSel.value = (now.getMonth()+1).toString(); mSel.dispatchEvent(new Event('change')); } if(ySel){ ySel.value = now.getFullYear().toString(); ySel.dispatchEvent(new Event('change')); } }catch(_){ } },140); });
  // If statement link appears again in future to deep-link
  // we can optionally navigate to statement & set current month.
      setTimeout(()=>{ el.style.opacity = '0'; setTimeout(()=>el.remove(),240); }, 5000);
      closeTopupModal();
    }catch(err){ console.error('Top-up failed', err); // rollback
      try{ if(prevCash!==Infinity) user.cashBalanceMYR = fromCents(prevCash); upsertUser(user); }catch(e){}
      $('#topupError').textContent = 'Top-up failed — no funds were added'; $('#topupError').style.display = 'block'; toast('Top-up failed — no funds were added','warn');
    } finally{ topupState.processing = false; btn.disabled = false; btn.removeAttribute('aria-busy'); }
  });

  // Initial render when session present
  // Initial render when session present
  // Initial render when session present
  (async function init(){ refreshHeader(); await renderDashboard(); renderMarketList(); renderActivityTable(); renderFeesSummary(); renderAdminSummary(); renderPremiumUI();
    // render small user status badge in header
    try{ renderUserStatus(); }catch(e){}
  // init PocketWealth Assistant (chatbot)
  try{ initPocketWealthAssistant(); }catch(e){}
    // Market UI init
    try{ // ensure Shariah symbols exist in market meta
    ensureShariahSymbolsExist(); ensureShariahTypesExist(); ensureCoreTypesExist(); ensureTypeOverrides(); ensureCoreDescriptionsExist(); populateMarketTypeFilter(); renderWatchlist(); const moodSel = $('#marketMood'); if(moodSel) moodSel.value = marketMood || 'normal'; // start/pause button state
      if(marketRunning){ $('#btnMarketStart')?.setAttribute('disabled','true'); } else { $('#btnMarketPause')?.setAttribute('disabled','true'); } }catch(e){} })();
  // Ensure Robo tab reflects saved state on initial load
  try{ renderRoboTab(); }catch(e){}
  // initial render of Shariah list if Invest tab active
  try{ renderShariahList(); }catch(e){}

  // --- Market UI rendering & trading ---
  // PocketWealth Assistant (simple rule-based chatbot)
  function initPocketWealthAssistant(){
    // inject styles with subtle open/close animation and PocketWealth blue theme
    const css = `
      .pw-assist-btn{ position:fixed; right:18px; bottom:18px; width:56px; height:56px; border-radius:28px; background:#0b66ff; color:#fff; display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(11,22,34,0.12); cursor:pointer; z-index:1100; font-size:22px }
      .pw-assist-window{ position:fixed; right:18px; bottom:86px; width:360px; max-width:92vw; height:420px; max-height:76vh; border-radius:12px; background:#fff; box-shadow:0 20px 60px rgba(11,22,34,0.18); z-index:1100; display:flex; flex-direction:column; overflow:hidden; font-family:inherit; opacity:0; transform: translateY(8px); pointer-events:none }
      .pw-assist-window.show{ opacity:1; transform: translateY(0); pointer-events:auto; transition: all 220ms cubic-bezier(.2,.9,.2,1); }
      .pw-assist-header{ background:linear-gradient(90deg,#0b66ff,#0066cc); color:#fff; padding:10px 12px; display:flex;align-items:center; gap:8px }
      .pw-assist-title{ font-weight:700; font-size:14px }
      .pw-assist-close{ margin-left:auto; background:transparent; border:none; color:#fff; font-size:18px; cursor:pointer }
      .pw-assist-body{ padding:12px; overflow:auto; flex:1; background:linear-gradient(180deg,#fbfdff,#fff); display:flex; flex-direction:column; gap:8px; scroll-behavior:smooth }
      .pw-assist-input{ display:flex; gap:8px; padding:10px; border-top:1px solid rgba(11,22,34,0.06) }
      .pw-assist-text{ flex:1; padding:10px 12px; border-radius:20px; border:1px solid rgba(11,22,34,0.06); font-size:14px }
      .pw-assist-send{ background:#0b66ff; color:#fff; border:none; padding:8px 12px; border-radius:12px; cursor:pointer }
      .pw-msg{ max-width:78%; padding:8px 12px; border-radius:12px; display:inline-block; font-size:14px }
      .pw-msg.user{ background:#0b66ff; color:#fff; margin-left:auto; border-bottom-right-radius:4px }
      .pw-msg.bot{ background:#f3f6fb; color:#0b1a2b; margin-right:auto; border-bottom-left-radius:4px }
      .pw-msg-time{ font-size:11px; color:#6b7280; margin-top:4px }
    `;
    const style = document.createElement('style'); style.id = 'pw-assist-styles'; style.textContent = css; document.head.appendChild(style);

    // create button
    if(document.getElementById('pwAssistBtn')) return; // already initialized
    const btn = document.createElement('button'); btn.id = 'pwAssistBtn'; btn.className = 'pw-assist-btn'; btn.title = 'PocketWealth Assistant'; btn.innerHTML = '💬'; document.body.appendChild(btn);

    // create window (hidden)
    const win = document.createElement('div'); win.id = 'pwAssistWin'; win.className = 'pw-assist-window';
    win.innerHTML = `
      <div class="pw-assist-header">
        <div class="pw-assist-title">PocketWealth Assistant</div>
        <button class="pw-assist-close" aria-label="Close">✕</button>
      </div>
      <div class="pw-assist-body" id="pwAssistBody"></div>
      <div class="pw-assist-input">
        <input id="pwAssistInput" class="pw-assist-text" placeholder="Ask me about your balance, premium, investing terms..." />
        <button id="pwAssistSend" class="pw-assist-send">Send</button>
      </div>
    `;
    document.body.appendChild(win);

    // session storage key (per single page load)
    const STORAGE_KEY = 'pw_assistant_hist';
    // initialize history (cleared on reload per requirements) — use sessionStorage so reload resets
    // do not forcibly remove here if previous page loaded in same session; keep until page reload
    try{ if(!sessionStorage.getItem(STORAGE_KEY)) sessionStorage.setItem(STORAGE_KEY, JSON.stringify([])); }catch(e){}

    function loadHistory(){ try{ return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){ return []; } }
    function saveHistory(h){ try{ sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h||[])); }catch(e){} }

    const body = document.getElementById('pwAssistBody'); const input = document.getElementById('pwAssistInput'); const send = document.getElementById('pwAssistSend'); const close = win.querySelector('.pw-assist-close');

    function renderHistory(){ const hist = loadHistory(); body.innerHTML = ''; hist.forEach(item=>{ const wrap = document.createElement('div'); const bubble = document.createElement('div'); bubble.className = 'pw-msg ' + (item.from==='user'?'user':'bot'); bubble.textContent = item.text; wrap.appendChild(bubble); const t = document.createElement('div'); t.className = 'pw-msg-time'; t.textContent = new Date(item.ts).toLocaleTimeString(); if(item.from==='user'){ wrap.style.alignSelf = 'flex-end'; bubble.style.marginLeft='auto'; } else { wrap.style.alignSelf = 'flex-start'; bubble.style.marginRight='auto'; } wrap.appendChild(t); body.appendChild(wrap); }); // smooth scroll to bottom
      try{ body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }); }catch(e){ body.scrollTop = body.scrollHeight; } }

    function pushMessage(from, text){ const h = loadHistory(); const item = { from, text, ts: new Date().toISOString() }; h.push(item); saveHistory(h); renderHistory(); }

    // helper analytics for report-like replies
    function computeRealizedPLForMonth(email, year, month){ try{ const ledger = getUserLedger(email).slice().reverse(); const monthStart = new Date(year, month-1, 1).getTime(); const monthEnd = new Date(year, month, 1).getTime(); // reconstruct holdings up to monthStart
        const holdingsState = reconstructHoldingsUpTo(email, monthStart); let realised = 0; ledger.forEach(r=>{ const t = new Date(r.ts).getTime(); if(t < monthStart || t >= monthEnd) return; if(r.type === 'SELL'){ const symbol = r.symbol; const qty = Math.abs(Number(r.qty||0)); const price = Number(r.price||0); const fee = Number(r.fee||0) || 0; const st = holdingsState[symbol] || { qty:0, avg:0 }; const avg = st.avg || 0; const pnl = Number(((price - avg) * qty - fee).toFixed(2)); realised = Number((realised + pnl).toFixed(2)); // reduce holding
            holdingsState[symbol] = { qty: Math.max(0, (st.qty||0) - qty), avg: st.qty>qty ? st.avg : 0 }; } else if(r.type === 'BUY'){ const symbol = r.symbol; const qty = Number(r.qty||0); const price = Number(r.price||0); const st = holdingsState[symbol] || { qty:0, avg:0 }; const newQty = st.qty + qty; const newAvg = st.qty? ((st.qty*st.avg + qty*price)/newQty) : price; holdingsState[symbol] = { qty: Number(newQty.toFixed(6)), avg: Number(newAvg.toFixed(6)) }; } }); return realised; }catch(e){ return 0; } }

    function countBuysForMonth(email, year, month){ try{ const ledger = getUserLedger(email).slice().reverse(); const monthStart = new Date(year, month-1, 1).getTime(); const monthEnd = new Date(year, month, 1).getTime(); let count = 0; ledger.forEach(r=>{ const t = new Date(r.ts).getTime(); if(t < monthStart || t >= monthEnd) return; if(r.type === 'BUY' || r.type==='MARKET_BUY' || r.type==='DIY_BUY' || r.type==='FRACTIONAL_BUY') count++; }); return count; }catch(e){ return 0; } }

    function topAndWorstPerformers(email){ try{ const s = getSession(); if(!s) return { top:null, worst:null }; const u = findUser(s.email); if(!u) return { top:null, worst:null }; const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const holdings = u.holdings || {}; const metrics = Object.entries(holdings).map(([sym,h])=>{ const price = (market[sym] && market[sym].price) || getLastPrice(sym) || 0; const avg = h.avgPrice || 0; const pct = avg? ((price - avg)/avg*100) : 0; return { sym, pct, price, avg }; }); if(metrics.length===0) return { top:null, worst:null }; metrics.sort((a,b)=> b.pct - a.pct); return { top: metrics[0], worst: metrics[metrics.length-1] }; }catch(e){ return { top:null, worst:null }; } }

    // small talk & extended KB
    const encouragements = [
      "You're doing amazing, {name}! Remember — small steps make big progress 💪.",
      "Don't forget to review your portfolio weekly — consistency pays off!",
      "PocketWealth’s got your back — let’s build your financial future together 💼."
    ];

  const KB = [
      // small talk
    { keys: ['hi','hello','hey there','hey','hi there','hello there','yo','sup','good morning','good afternoon','good evening','morning','afternoon','evening','hola'], reply: ()=> 'Hey there 👋! How’s your investing journey going today?' },
    { keys: ['how are you','how r you','how are u','how r u','how you doing','how\'s it going','hows it going','how do you do'], reply: ()=> 'I\'m doing great, thanks for asking! 😊 Ready to grow your wealth today?' },
    { keys: ['thank you','thanks','thx','thanks!','thank u','terima kasih','tq'], reply: ()=> 'You\'re very welcome! 💙' },
    { keys: ['bye','goodbye','see ya','see you','see ya later','bye bye','later','cya'], reply: ()=> 'Goodbye for now! Don\'t forget to check your portfolio later 🚀.' },
      { keys: ['you\'re smart','you are smart'], reply: ()=> 'Haha, thank you! I\'ve been trained by PocketWealth\'s brilliant team 😉.' },
    { keys: ['tell me a tip','give me a tip','tip','advice','investing tip','any tip','nasihat'], reply: ()=> 'Here\'s one: Consistency beats timing. Even RM10 a week can compound beautifully!' },

      // user data & app questions
  { keys: ['balance','how much','my balance','what is my balance','wallet balance','cash balance','available cash','how much cash','baki','saldo','duit'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see your balance.'; const u = findUser(s.email); if(!u) return 'Sign in to see your balance.'; return `Your current balance is ${fmtMYR(u.cashBalanceMYR===Infinity?0:(u.cashBalanceMYR||0))}.`; } },
  { keys: ['am i a premium user','am i premium','premium status','premium active','am i premium user','is premium active','status premium','premium saya aktif tak','am i pro','is pro active'], reply: ()=>{ const s = getSession(); if(!s) return 'Not signed in.'; const u = findUser(s.email); if(!u) return 'Not signed in.'; if(u.premiumActive && u.premiumActivatedAt){ try{ const act = new Date(u.premiumActivatedAt); const exp = new Date(act.getTime() + 30*24*3600*1000); return `Yes, your Premium is active until ${exp.toLocaleDateString()}. 💎`; }catch(e){} } return `Your Premium is ${u.premiumActive? 'Active 💎':'Inactive'}.`; } },
  { keys: ['portfolio performance','how is my portfolio performing','performance','returns','gain','profit','pnl','p&l','portfolio return','performance today','how is my portfolio doing'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see performance.'; const u = findUser(s.email); if(!u) return 'Sign in to see performance.'; const snaps = (u.snapshots||[]).slice().sort((a,b)=> new Date(a.ts) - new Date(b.ts)); if(snaps.length>=2){ const a = snaps[snaps.length-2].total; const b = snaps[snaps.length-1].total; const pct = a? ((b-a)/a*100) : 0; return `Your recent change is ${pct>=0?'+':''}${pct.toFixed(2)}% (${fmtMYR(a)} → ${fmtMYR(b)}).`; } const pv = portfolioValue(u, JSON.parse(localStorage.getItem(MARKET_KEY)||'{}')) || 0; return `Your portfolio market value is ${fmtMYR(pv)}.`; } },
  { keys: ['total portfolio value','how much is my total portfolio value','what is my portfolio value','aum','total value','portfolio total','net worth','nilai portfolio','total aum'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see your portfolio.'; const u = findUser(s.email); if(!u) return 'Sign in to see your portfolio.'; const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const pv = portfolioValue(u, market) || 0; const cash = (u.cashBalanceMYR===Infinity)? 0 : (u.cashBalanceMYR||0); return `Your total portfolio value (cash + holdings) is ${fmtMYR(Number((pv + cash).toFixed(2)))}.`; } },

      // reports & analytics
  { keys: ['monthly report','show me my monthly report','monthly statement','statement','activity','transactions','history','penyata bulanan','laporan bulanan','my statement','view statement'], reply: ()=> 'Sure! You can find your detailed statement under the Statement tab 📊 — it tracks your buys, sells, and P&L.' },
    { keys: ['how much did i earn this month','earned this month','this month earnings','profit this month','gain this month','pnl this month','p&l this month'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see reports.'; const u = findUser(s.email); if(!u) return 'Sign in to see reports.'; const now = new Date(); const y = now.getFullYear(), m = now.getMonth()+1; const val = computeRealizedPLForMonth(u.email, y, m); return `Let me check... your total realised P&L this month is ${fmtMYR(val)}.`; } },
    { keys: ['how many stocks did i buy this month','stocks did i buy this month','how many stocks did i buy','buys this month','purchases this month','beli bulan ini'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see activity.'; const u = findUser(s.email); if(!u) return 'Sign in to see activity.'; const now = new Date(); const y = now.getFullYear(), m = now.getMonth()+1; const count = countBuysForMonth(u.email, y, m); return `You\'ve made ${count} purchase${count===1? '':'s'} so far this month.`; } },
    { keys: ['top performing stock','top performer','best performer','biggest gainer','top gainer','best stock'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see portfolio.'; const u = findUser(s.email); if(!u) return 'Sign in to see portfolio.'; const t = topAndWorstPerformers(u.email); if(t.top) return `Your best performer right now is ${t.top.sym} with a gain of ${t.top.pct.toFixed(2)}%! 🚀`; return 'You have no holdings yet.'; } },
    { keys: ['worst performing stock','worst performer','bottom performer','biggest loser','top loser','worst stock'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see portfolio.'; const u = findUser(s.email); if(!u) return 'Sign in to see portfolio.'; const t = topAndWorstPerformers(u.email); if(t.worst) return `Hmm, looks like ${t.worst.sym} dropped a bit — current change ${t.worst.pct.toFixed(2)}%. Remember, short-term dips don\'t define your long-term success 📉➡️📈.`; return 'You have no holdings yet.'; } },
    { keys: ['what\'s in my portfolio','what is in my portfolio','what do i hold','what\'s in my portfolio?','what do i own','my holdings','positions','assets','saham saya'], reply: ()=>{ const s = getSession(); if(!s) return 'Sign in to see your portfolio.'; const u = findUser(s.email); if(!u) return 'Sign in to see your portfolio.'; const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const holdings = u.holdings || {}; const list = Object.keys(holdings); if(list.length===0) return 'You currently hold nothing. Explore the Market to add positions.'; const parts = list.map(sym=>{ const val = Number(((holdings[sym].qty||0) * ((market[sym] && market[sym].price) || getLastPrice(sym))).toFixed(2)); return `${sym} (RM ${val})`; }); const total = list.reduce((sSym, sym)=> sSym + ((holdings[sym].qty||0) * ((market[sym] && market[sym].price) || getLastPrice(sym))) , 0); return `You currently hold ${parts.join(', ')} with a total value of ${fmtMYR(Number(total.toFixed(2)))}.`; } },

      // guidance/help
  { keys: ['how do i top up','how to top up','top up','deposit','add funds','topup','reload','isi semula','tambahkan wang'], reply: ()=> 'Click the Top-up button beside your balance to add more funds 💵.' },
  { keys: ['withdraw','how to withdraw','withdrawal','cash out','tarik keluar','keluar wang'], reply: ()=> 'This demo simulates withdrawals in-app. Use the Withdraw input on the Dashboard to reduce your cash balance.' },
  { keys: ['how to upgrade to premium','how to upgrade premium','upgrade to premium','subscribe premium','subscribe pro','get premium','go pro','upgrade plan','subscribe to pro','subscribe to starter','langgan premium'], reply: ()=>{ try{ selectTab('premium'); }catch(e){} return 'Opening Premium tab… Choose Starter (RM10/mo) for Robo or Pro (RM20/mo) for everything.'; } },
  { keys: ['unsubscribe','cancel premium','cancel pro','cancel starter','cancel subscription','stop premium','downgrade','terminate premium','batalkan premium','hentikan premium'], reply: ()=>{ try{ selectTab('premium'); }catch(e){} return 'You can unsubscribe from the Premium tab. It’s one click to cancel.'; } },
  { keys: ['difference between starter and pro','starter vs pro','what is in pro','compare plans','plan comparison','starter pro differences'], reply: ()=> 'Starter (RM10/mo): unlocks Robo-Advisory. Pro (RM20/mo): adds ESG scoring, Shariah markets, and priority support.' },
  { keys: ['open market','go to market','market tab','open invest','show market','buka pasaran','watchlist'], reply: ()=>{ try{ selectTab('market'); }catch(e){} return 'Opening Market — pick a symbol then Buy/Sell from the ticket.'; } },
  { keys: ['open statement','go to statement','view statement','open transactions','open activity','penyata','history'], reply: ()=>{ try{ selectTab('statement'); }catch(e){} return 'Opening Statement — use filters for Month/Year/Type and the pager to move through 50 rows per page.'; } },
  { keys: ['open premium','go to premium','premium tab','pricing','plans','subscriptions'], reply: ()=>{ try{ selectTab('premium'); }catch(e){} return 'Opening Premium — pick Starter or Pro to subscribe.'; } },
  { keys: ['open robo','go to robo','robo tab','risk quiz','risk assessment','advisor','robo advisor'], reply: ()=>{ try{ selectTab('robo'); setTimeout(()=>{ document.getElementById('btnRoboQuiz')?.focus(); }, 200); }catch(e){} return 'Opening Robo — take the quick risk quiz to get recommendations.'; } },
  { keys: ['open game','go to game','play game','paper trading game','paper trade','simulator','game tab'], reply: ()=>{ try{ selectTab('game'); }catch(e){} return 'Opening Paper Trading Game — press Reset to start, Buy from Watchlist, then advance months.'; } },
  { keys: ['open learning','go to learning','see library','education','library','learn'], reply: ()=>{ try{ gotoLearningAnchor('library'); }catch(e){} return 'Opening Learning — scrolling to The Library.'; } },

  // Paper Trading Game help
  { keys: ['how to start game','start the game','begin game','how to play','how do i play','start over','reset game','restart game'], reply: ()=> 'In the Game tab, press Reset to start with RM10,000. Use Watchlist → Buy to add positions, then click Next Month to simulate returns.' },
  { keys: ['how to buy in game','buy in game','place order in game','buy in simulator','place order','execute trade in game'], reply: ()=> 'From Watchlist, click Buy on a symbol. Set quantity in the confirm modal, then Confirm Buy.' },
  { keys: ['what is next month','next month button','fast forward','fast-forward','skip months','skip to month 12','simulate month','save result'], reply: ()=> 'Next Month simulates one month of market movement. Fast-Forward runs to month 12. You can Save Result after finishing 12 months.' },
  { keys: ['how to unlock achievements','game achievements','unlock badges','badges','trophies','awards','unlock trophy'], reply: ()=> 'Achievements unlock based on results — e.g., Return ≥ 10%, Max Drawdown ≤ 5%, diversified holdings, completed 12 months, tried 5+ symbols, etc.' },

  // Shariah & Robo
  { keys: ['how to access shariah','shariah market access','shariah access','halal market','islamic market','syariah','patuh syariah','akses shariah'], reply: ()=> 'Shariah market is a Pro feature. Subscribe to Pro in the Premium tab, then see Shariah Markets under Invest.' },
  { keys: ['unlock robo','how to unlock robo','robo access','enable robo','activate robo','unlock advisor','risk quiz access'], reply: ()=> 'Subscribe to Starter (RM10/mo) or Pro (RM20/mo) in the Premium tab to unlock Robo-Advisory and the Risk Quiz.' },

  // Statement & pagination
  { keys: ['why only 50 rows','change page size','rows per page','page size','50 per page','show 50','per page 50','page length'], reply: ()=> 'Statements show 50 entries per page for readability. Use Prev/Next at the bottom to navigate pages.' },

  // Market guidance
  { keys: ['how to trade','how do i buy','place an order','execute trade','buy shares','sell shares','minimum buy','min invest'], reply: ()=> 'Open Market, select a symbol, then use the Buy/Sell buttons in the order ticket. Minimum Buy is RM10.' },
  { keys: ['what is volatility','volatility meaning','vol','risk level','fluctuation','volatile'], reply: ()=> 'Volatility reflects how much a price moves. Higher volatility = larger, faster swings. Pro users see volatility tags in Watchlist.' },

  // Fees & ESG
  { keys: ['what are the fees','fees','pricing','charges','costs','subscription price','plan price','yuran'], reply: ()=> 'Advisory fee ~0.35% annually (demo). Starter is RM10/mo; Pro is RM20/mo. No hidden ticketing fees in this demo.' },
    { keys: ['what is esg','what is esg investing','esg investing','responsible investing','sustainable investing'], reply: ()=> 'ESG stands for Environmental, Social, and Governance — it\'s about investing responsibly 🌱.' },
    { keys: ['what is shariah','shariah','shariah-compliant','halal investing','islamic finance','patuh syariah'], reply: ()=> 'It\'s investing according to Islamic finance principles — no interest or unethical sectors involved.' },

      // fallback help
  { keys: ['help','how to use','what can you do','commands','what can you answer','bantuan','tolong'], reply: ()=> 'I can answer questions about your balance, portfolio, performance, statements, and basic investing terms. Try: "What\'s my balance?" or "How much did I earn this month?"' }
    ];

    function findKBAnswer(q){ const text = (q||'').toLowerCase(); // search for key matches (longer keys first)
      const items = KB.slice().sort((a,b)=> b.keys.join(' ').length - a.keys.join(' ').length);
      for(const item of items){ for(const k of item.keys){ if(k && text.includes(k)) return item.reply; } }
      return null; }

    function handleQuery(q){ if(!q || !q.trim()) return; pushMessage('user', q.trim()); const kb = findKBAnswer(q); if(kb){ try{ const res = kb(); pushMessage('bot', res); }catch(e){ pushMessage('bot', 'Sorry, I had trouble answering that.'); } } else {
        // fallback generic attempts
        if(/balance|how much|my balance/.test(q.toLowerCase())){ const s = getSession(); if(s){ const u = findUser(s.email); if(u) pushMessage('bot', `Your current balance is ${fmtMYR(u.cashBalanceMYR===Infinity?0:(u.cashBalanceMYR||0))}.`); else pushMessage('bot','Sign in to see your balance.'); } else pushMessage('bot','Sign in to see your balance.');
        } else { pushMessage('bot','Sorry, I do not understand that yet. Try "What is my balance?" or "What is ESG investing?"'); }
      }

      // encouragements: after user has chatted more than 5 times in this session, show a friendly encouragement (once every few messages)
      try{ const hist = loadHistory(); const userMsgs = hist.filter(h=> h.from==='user').length; if(userMsgs > 5 && Math.random() < 0.25){ const s = getSession(); const name = (s && findUser(s.email) && (findUser(s.email).username || (findUser(s.email).email||'').split('@')[0])) || 'friend'; const msg = encouragements[Math.floor(Math.random()*encouragements.length)].replace('{name}', name); pushMessage('bot', msg); } }catch(e){}
    }

    // wire events & UI behavior
  btn.addEventListener('click', ()=>{ const wasHidden = !win.classList.contains('show'); if(wasHidden){ renderHistory(); win.classList.add('show'); setTimeout(()=> input.focus(),80);
    // personalized greeting when opening for first time this session
    try{ const hist = loadHistory(); if(!hist || hist.length===0){ const s = getSession(); const name = (s && findUser(s.email) && (findUser(s.email).username || (findUser(s.email).email||'').split('@')[0])) || 'there'; pushMessage('bot', `Hi, ${name}! 👋 Thanks for using PocketWealth! What can I help you with today?`); // friendly tip after 3s
        setTimeout(()=>{ pushMessage('bot','Try: "Open Market", "Open Game", "How to unlock Robo", "Shariah access", or "Open Statement".'); }, 3000); } }catch(e){}
      } else { win.classList.remove('show'); }
    });
    close.addEventListener('click', ()=>{ win.classList.remove('show'); });
    send.addEventListener('click', ()=>{ const q = input.value || ''; input.value = ''; handleQuery(q); setTimeout(()=> input.focus(),80); });
    input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); send.click(); } });
    // quick sample on double-click
    btn.addEventListener('dblclick', ()=>{ pushMessage('bot','Hi! I am PocketWealth Assistant. Try asking about your balance, portfolio, or premium status.'); });
  }
  let selectedSymbol = null;
  let marketChart = null;
  let chartNeedsRedraw = false;

  function renderWatchlist(){ const meta = loadMarketMeta(); const tbody = document.querySelector('#marketWatch tbody'); if(!tbody) return; tbody.innerHTML=''; const syms = Object.keys(meta); syms.forEach(sym=>{ const last = currentPrice(sym); const series = loadSeries(sym); const dayAgo = Date.now() - 24*3600*1000; const last24 = series.filter(pt=>pt.t>=dayAgo); const change = last24.length? ((last - last24[0].p)/last24[0].p)*100 : 0; const volTag = meta[sym].vol || 'med'; const tr = document.createElement('tr'); // simplified row: symbol only (no secondary subtitle)
    // Show volatility only to Premium users; free users see an empty/locked cell
    const s = getSession(); const user = s && findUser(s.email); const showVol = user && (user.premiumActive || user.premiumRoboActive);
    const volDisplay = showVol ? (meta[sym].vol || '') : '';
    tr.innerHTML = `
      <td class="col-symbol">${sym}</td>
      <td class="col-last">${fmtMYR(last)}</td>
      <td class="col-24h ${change>=0?'price-up':'price-down'}">${change>=0?'+':''}${change.toFixed(2)}%</td>
      <td class="col-vol">${volDisplay}</td>
      <td class="col-action"><button class="btn btn-ghost tradeBtn" data-sym="${sym}">Trade</button></td>
    `;
    tbody.appendChild(tr);
  });
  // apply type filter if present (keeps rendering simple and runs after rows exist)
  try{
    const typeSel = document.getElementById('marketTypeFilter');
    if(typeSel){ const val = (typeSel.value||'').toLowerCase(); if(val){ Array.from(tbody.querySelectorAll('tr')).forEach(r=>{ const s = r.querySelector('.col-symbol')?.textContent?.trim(); const m = loadMarketMeta()[s]; const t = (m && m.type || '').toLowerCase(); r.style.display = (t === val) ? '' : 'none'; }); } else { Array.from(tbody.querySelectorAll('tr')).forEach(r=> r.style.display = ''); } }
  }catch(e){}
    // adjust watchlist container: avoid scrollbars when few symbols
    try{ const wrap = document.getElementById('marketWatchWrap'); if(wrap){ if(syms.length <= 5){ wrap.style.maxHeight = ''; wrap.style.overflowY = 'visible'; } else { wrap.style.maxHeight = ''; wrap.style.overflowY = 'auto'; } } }catch(e){}
    // make the entire row clickable and keyboard-accessible (no absolute positioning)
    Array.from(tbody.querySelectorAll('tr')).forEach(tr=>{
      const btn = tr.querySelector('.tradeBtn'); const sym = btn?.dataset?.sym;
      if(sym){ tr.tabIndex = 0; tr.style.cursor = 'pointer'; tr.setAttribute('role','button'); tr.addEventListener('click', ()=> openSymbolDetail(sym)); tr.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); openSymbolDetail(sym); } }); btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); openSymbolDetail(sym); }); }
    });
  // ensure unrealised P&L updates live as prices move
  try{ /* avoid re-rendering full dashboard here — only update watchlist/position/insights */ }catch(e){}
  }

  function openSymbolDetail(sym){ selectedSymbol = sym; const title = $('#detailTitle'); title.textContent = `${sym} — ${loadMarketMeta()[sym].name}`; const priceEl = $('#detailPrice'); priceEl.textContent = fmtMYR(currentPrice(sym)); $('#priceMoving').textContent = ''; renderPosition(sym); renderOrderTicket(sym); renderInsights(sym); renderAdminControls(sym); // setup chart
  const ctx = document.getElementById('marketChart').getContext('2d'); const series = loadSeries(sym).slice(-500); const labels = series.map(p=> new Date(p.t).toLocaleTimeString()); const data = series.map(p=>p.p); if(marketChart) marketChart.destroy(); marketChart = new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label: sym, data, borderColor:'#0b66ff', backgroundColor:'rgba(11,102,255,0.06)', pointRadius:0, tension:0.15 }] }, options:{ animation:false, responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ display:false } } } }); // throttle redraws
    chartNeedsRedraw = false; }

  // throttled redrawer (runs every 1s)
  setInterval(()=>{ if(!selectedSymbol) return; // append latest point
    const s = selectedSymbol; const chart = marketChart; if(!chart) return; const series = loadSeries(s); const latest = series[series.length-1]; const label = new Date(latest.t).toLocaleTimeString(); // push one point
    chart.data.labels.push(label); chart.data.datasets[0].data.push(latest.p); if(chart.data.labels.length>500){ chart.data.labels.shift(); chart.data.datasets[0].data.shift(); } chart.update(); $('#detailPrice').textContent = fmtMYR(latest.p); $('#priceMoving').textContent = 'price moving…'; setTimeout(()=>{ $('#priceMoving').textContent = '' }, 800);
  }, 1000);

  function renderPosition(sym){ const s = getSession(); if(!s) return; const user = findUser(s.email); const holding = (user.holdings||{})[sym]||{qty:0,avgPrice:0}; const cp = currentPrice(sym); const value = holding.qty * cp; const pnl = value - (holding.qty * (holding.avgPrice||0)); const pct = holding.qty? (pnl / (holding.qty*holding.avgPrice) * 100) : 0; $('#detailPosition').innerHTML = `<h4>Your position</h4><div>Qty: ${holding.qty.toFixed(6)}</div><div>Avg cost: ${holding.avgPrice?fmtMYR(holding.avgPrice):'-'}</div><div>Value: ${fmtMYR(value)}</div><div class="${pnl>=0?'price-up':'price-down'}">Unrealised P&L: ${fmtMYR(pnl)} (${pct?pct.toFixed(2):'0.00'}%)</div>`; }

  function renderOrderTicket(sym){ const container = $('#orderTicket'); if(!container) return; const price = currentPrice(sym); container.innerHTML = `
    <h4>Trade ${sym}</h4>
    <div class="muted small">Use the buttons below to open the execution modal which snapshots the current price.</div>
    <div class="order-actions">
      <button id="btnMarketBuy" class="btn btn-large" aria-label="Buy ${sym}">Buy</button>
      <button id="btnMarketSell" class="btn btn-large btn-ghost" aria-label="Sell ${sym}">Sell</button>
    </div>
    <div class="muted small" style="margin-top:8px">Minimum investment RM10 for Buys. Sells have no minimum and are capped to your owned quantity.</div>
  `;
    $('#btnMarketBuy').addEventListener('click', ()=>{ const snap = currentPrice(sym); openTradeModal(sym,'BUY', snap); });
    $('#btnMarketSell').addEventListener('click', ()=>{ const snap = currentPrice(sym); openTradeModal(sym,'SELL', snap); }); }
  // mark modal as shariah when applicable
  $('#btnMarketBuy')?.addEventListener && $('#btnMarketBuy')?.addEventListener('click', ()=>{ modalState.isShariah = isShariahSymbol(sym); });
  $('#btnMarketSell')?.addEventListener && $('#btnMarketSell')?.addEventListener('click', ()=>{ modalState.isShariah = isShariahSymbol(sym); });

  // Shim: open trade modal with snapshot (keeps compatibility if other code calls doMarketOrder)
  function doMarketOrder(sym, forcedSide){ const snap = currentPrice(sym); openTradeModal(sym, forcedSide||'BUY', snap); }

  // Execute a buy at snapshot price (units qty)
  function placeMarketBuy(user, symbol, qty, snapshotPrice, snapshotTime, opts){
    opts = opts || {};
    const isShariah = !!opts.isShariah;
    const total = Number((qty * snapshotPrice).toFixed(2));
    if(user.cashBalanceMYR!==Infinity && total < 10) throw new Error('Minimum investment is RM10');
    if(user.cashBalanceMYR!==Infinity && user.cashBalanceMYR < total) throw new Error('Insufficient cash');
    user.holdings = user.holdings||{};
    const prev = user.holdings[symbol]||{qty:0,avgPrice:0};
    const newQty = Number((prev.qty + qty).toFixed(6));
    const newAvg = prev.qty? Number(((prev.qty*prev.avgPrice + qty*snapshotPrice)/newQty).toFixed(6)) : snapshotPrice;
    user.holdings[symbol] = { qty:newQty, avgPrice:newAvg };
    if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR - total).toFixed(2));
    // activity + ledger: tag as SHARIAH if applicable
    pushActivity(user.email, { type: isShariah? 'BUY_SHARIAH' : 'MARKET_BUY', symbol, qty, price: snapshotPrice, amount: total, txHash: pseudoHash(), time: snapshotTime });
  recordLedger(user, { type: isShariah? 'BUY_SHARIAH' : 'BUY', symbol: symbol, qty: Number(qty.toFixed(6)), price: Number(snapshotPrice), amount: Number((-total).toFixed(2)), note: isShariah? 'Shariah market buy' : 'Market buy', ts: snapshotTime });
    try{ pushPortfolioSnapshot(user.email, snapshotTime); }catch(e){}
    return { qty:newQty, total };
  }



  // Execute a sell at snapshot price (units qty)
  function placeMarketSell(user, symbol, qty, snapshotPrice, snapshotTime, opts){
    opts = opts || {};
    const isShariah = !!opts.isShariah;
    const holding = (user.holdings||{})[symbol];
    if(!holding || holding.qty<=0) throw new Error('No holdings to sell');
    if(qty<=0) throw new Error('Invalid quantity');
    if(qty>holding.qty) throw new Error('Not enough quantity to sell');
    const total = Number((qty * snapshotPrice).toFixed(2));
    holding.qty = Number((holding.qty - qty).toFixed(6));
    if(user.cashBalanceMYR!==Infinity) user.cashBalanceMYR = Number((user.cashBalanceMYR + total).toFixed(2));
    if(holding.qty===0){ delete user.holdings[symbol]; }
    pushActivity(user.email, { type: isShariah? 'SELL_SHARIAH' : 'MARKET_SELL', symbol, qty, price: snapshotPrice, amount: total, txHash: pseudoHash(), time: snapshotTime });
  recordLedger(user, { type: isShariah? 'SELL_SHARIAH' : 'SELL', symbol: symbol, qty: Number((-Math.abs(qty)).toFixed(6)), price: Number(snapshotPrice), amount: Number((total).toFixed(2)), note: isShariah? 'Shariah market sell' : 'Market sell', ts: snapshotTime });
    try{ pushPortfolioSnapshot(user.email, snapshotTime); }catch(e){}
    return { remaining: holding.qty||0, total };
  }

  function renderInsights(sym){ const box = $('#insightsBox'); if(!box) return; const s = getSession(); if(!s) return; const user = findUser(s.email); if(!user.premiumActive){ box.classList.add('hidden'); return; } box.classList.remove('hidden'); const series = loadSeries(sym); const last20 = series.slice(-20).map(x=>x.p); const last5 = series.slice(-5).map(x=>x.p); const mom = (last5[last5.length-1] - last20[0]) / last20[0] * 100 || 0; const vol = (Math.std? Math.std(last20) : (Math.max(...last20)-Math.min(...last20))/last20[0]) * 100 || 0; box.innerHTML = `<h4>Premium Insights</h4><div>${mom>0? 'Momentum positive': 'Momentum negative'} (${mom.toFixed(2)}%)</div><div>Recent volatility: ${vol.toFixed(2)}%</div>`; }

  // small helper for volatility std (quick implementation)
  Math.std = function(arr){ if(!arr || arr.length===0) return 0; const m = arr.reduce((s,v)=>s+v,0)/arr.length; const v = Math.sqrt(arr.reduce((s,x)=>s + Math.pow(x-m,2),0)/arr.length); return v; }

  function renderAdminControls(sym){ const box = $('#adminControls'); if(!box) return; const s = getSession(); if(!s) return; const user = findUser(s.email); if(user.email.toLowerCase()!==ADMIN_EMAIL) { box.classList.add('hidden'); return; } box.classList.remove('hidden'); box.innerHTML = `<h4>Admin controls</h4><button id="adminNudgeUp" class="btn btn-ghost">Nudge +2%</button><button id="adminNudgeDown" class="btn btn-ghost">Nudge -2%</button><button id="adminFreeze" class="btn btn-ghost">Toggle Freeze</button>`; $('#adminNudgeUp').addEventListener('click', ()=>{ adminNudge(sym, 2); renderMarketList(); renderPosition(sym); }); $('#adminNudgeDown').addEventListener('click', ()=>{ adminNudge(sym, -2); renderMarketList(); renderPosition(sym); }); $('#adminFreeze').addEventListener('click', ()=>{ const meta = loadMarketMeta(); meta[sym].frozen = !meta[sym].frozen; saveMarketMeta(meta); renderAdminControls(sym); }); }

  function renderAdminControls(sym){
    const box = $('#adminControls');
    if(!box) return;
    // Admin controls removed from Market tab.
    // Keep the container hidden and clear any contents so admin users do not see market-level admin buttons here.
    box.classList.add('hidden');
    box.innerHTML = '';
  }

  // wire market start/pause/reset and mood selector
  $('#btnMarketStart')?.addEventListener('click', ()=>{ startMarketEngine(); toast('Market started','info'); });
  $('#btnMarketPause')?.addEventListener('click', ()=>{ pauseMarketEngine(); toast('Market paused','info'); });
  $('#btnMarketReset')?.addEventListener('click', ()=>{ resetMarketEngine(); renderWatchlist(); toast('Market reset','info'); });
  $('#marketMood')?.addEventListener('change', (e)=>{ marketMood = e.target.value; localStorage.setItem(MARKET_VOLMODE, marketMood); toast('Market mood set','info'); });

  // ensure watchlist updates when ticks arrive (subscribe via interval)
  setInterval(()=>{ renderWatchlist(); if(selectedSymbol) { renderPosition(selectedSymbol); renderInsights(selectedSymbol); } }, 2000);

  // Invest tab: render market overview cards
  function typeGlyph(t){
    const k = (t||'').toLowerCase();
    if(k==='stock') return '📈';
    if(k==='etf') return '🧺';
    if(k==='bond') return 'Ⓑ';
    if(k==='reit') return 'Ⓡ';
    if(k==='commodity') return 'Ⓒ';
    if(k==='crypto') return 'Ⓙ';
    return '📈'; // default to stock glyph
  }
  function typeLabel(t){ const k = (t||'').toLowerCase(); if(k==='etf') return 'ETF'; if(k==='bond') return 'Bond'; if(k==='reit') return 'REIT'; if(k==='commodity') return 'Commodity'; if(k==='crypto') return 'Crypto'; return 'Stock'; }
  function renderInvestList(){ const meta = loadMarketMeta(); const container = $('#investList'); if(!container) return; container.innerHTML=''; const s = getSession(); const user = s && findUser(s.email); const isPro = user && user.premiumActive; // free users see only core symbols
    // Build set of recommended symbols based on Robo profile (for Starter or Pro users after quiz)
    const recSet = getRecommendedSet(user);
    const syms = Object.keys(meta);
  syms.forEach(sym=>{ const m = meta[sym]; const price = currentPrice(sym); const volText = m && m.vol ? (m.vol==='low'?'Low volatility': m.vol==='med'?'Moderate volatility':'High volatility') : ''; const desc = m && m.desc ? m.desc : ''; const card = document.createElement('div'); card.className = 'card';
    const isRecommended = recSet.has(sym);
    if(isRecommended){ card.classList.add('recommended'); }
    // Build a consistent label: Volatility • TYPE (or TYPE • subscribe hint if free)
  const typeTag = (m && m.type) ? m.type.toUpperCase() : 'STOCK';
    const volAndType = `${volText}${volText ? ' • ' : ''}${typeTag}`;
    // show volatility only to PocketWealth subscription users
    const volHtml = (user && user.premiumActive)
      ? `<div class="volatility-row"><div class="muted small">${volAndType}</div></div>`
      : `<div class="volatility-row"><div class="muted small">${typeTag} • <a href="#" class="subscribe-hint" data-sym="${sym}">Subscribe to PocketWealth to see volatility</a></div></div>`;
    // Top line: (type symbol + market symbol)
  const glyph = typeGlyph(m && m.type);
  // Header/title: emoji + market symbol (no parentheses)
  const badge = isRecommended ? `<div class="rec-badge">Recommended</div>` : '';
  const topLine = `${badge}<h4 style="margin:0 0 2px 0">${glyph} ${sym}</h4>`;
  // Subtitle: instrument name
  const title = `<h5 style="margin:0 0 6px 0;color:#0b1a2b">${escapeHtml(m.name)}</h5>`;
  card.innerHTML = `${topLine}${title}${volHtml}<div style="margin-top:8px;font-weight:700">${fmtMYR(price)}</div><p class="muted small" style="margin-top:8px">${escapeHtml(desc)}</p><div class="card-actions"><button class="btn viewMarket" data-sym="${sym}">View Market</button></div>`; container.appendChild(card); });
    $all('.viewMarket').forEach(b=>b.addEventListener('click', (e)=>{ const sym = e.currentTarget.dataset.sym; selectTab('market'); renderWatchlist(); setTimeout(()=>{ openSymbolDetail(sym); }, 150); }));
    // subscribe hint links should guide users to the Premium tab — attach after items are rendered
    $all('.subscribe-hint').forEach(a=>{ a.addEventListener('click', (e)=>{ e.preventDefault(); selectTab('premium'); toast('You can subscribe to PocketWealth Premium from the Premium tab','info'); }); });
  }
  // Render Shariah Market cards in Invest tab. Only accessible to Pro users; others see a greyed prompt.
  function renderShariahList(){
    ensureShariahSymbolsExistAndSeed();
    const meta = loadMarketMeta();
    const container = $('#shariahList'); if(!container) return; container.innerHTML = '';
    const s = getSession(); const user = s && findUser(s.email); const isPro = user && user.premiumActive;
    const recSet = getRecommendedSet(user);
    // Only render Shariah list for Pro users — hide for free users
    if(!isPro){ container.innerHTML = ''; return; }
    Object.keys(SHARIAH_SYMBOLS).forEach(sym=>{
      const m = meta[sym] || SHARIAH_SYMBOLS[sym];
      const price = Number((loadLast(sym) || m.price).toFixed(4));
      const card = document.createElement('div'); card.className = 'card shariah-card';
      const isRecommended = recSet.has(sym);
      if(isRecommended){ card.classList.add('recommended'); }
      card.innerHTML = `
          ${isRecommended? '<div class="rec-badge">Recommended</div>' : ''}
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <strong>${m.name} <span class="muted small">(${sym})</span></strong>
              <div class="muted small">${m.desc}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700">${fmtMYR(price)}</div>
              <div class="muted small">${getShariah24Change(sym)}</div>
            </div>
          </div>
          <div class="card-actions shariah-cta" role="group" aria-label="actions">
            <button class="btn btn-buy" data-sym="${sym}">${isPro? 'Buy' : 'Unlock Pro'}</button>
            <button class="btn btn-ghost btn-watch" data-sym="${sym}">${isWatching(sym)? 'Following' : 'Follow'}</button>
            <span class="shariah-badge">Shariah Certified <span class="shariah-tick" aria-hidden="true">✓</span></span>
          </div>
        `;
      if(!isPro){ card.style.opacity = '0.62'; }
      container.appendChild(card);
    });

    // Wire buttons
    $all('.shariah-card .btn-buy').forEach(btn=>{ btn.addEventListener('click', (ev)=>{ const sym = ev.currentTarget.dataset.sym; const s = getSession(); const u = s && findUser(s.email); if(!u || !u.premiumActive){ if(confirm('This market is exclusive to Premium users. Subscribe now to access certified Shariah portfolios and ethical investment opportunities.\n\nSubscribe to Premium?')){ selectTab('premium'); } return; } const snap = currentPrice(sym); modalState.isShariah = true; openTradeModal(sym,'BUY', snap); }); });

    $all('.shariah-card .btn-watch').forEach(btn=>{ btn.addEventListener('click', (ev)=>{ const sym = ev.currentTarget.dataset.sym; toggleWatch(sym); renderShariahList(); }); });
  }

  // Build a Set of recommended symbols from the user's Robo risk profile results
  function getRecommendedSet(user){
    try{
      const set = new Set();
      if(!user) return set;
      // Only after Starter or Pro users take the risk quiz
      const hasAccess = !!(user.premiumActive || user.premiumRoboActive);
      const recs = user && user.robo && user.robo.riskProfile && user.robo.riskProfile.recs;
      if(!hasAccess || !Array.isArray(recs) || recs.length===0) return set;
      const meta = loadMarketMeta();
      const metaKeys = new Set(Object.keys(meta));
      recs.forEach(r=>{
        try{
          if(typeof r === 'string'){
            const key = r.trim().toUpperCase(); if(metaKeys.has(key)) set.add(key);
          } else if(r && typeof r === 'object'){
            if(r.id && metaKeys.has(String(r.id).toUpperCase())){ set.add(String(r.id).toUpperCase()); return; }
            // attempt to extract leading symbol from label e.g., "PWETF (Conservative Bond Index)"
            if(r.label){ const m = String(r.label).toUpperCase().match(/^[A-Z0-9\-]+/); if(m && m[0] && metaKeys.has(m[0])) set.add(m[0]); }
          }
        }catch(_){}
      });
      return set;
    }catch(e){ return new Set(); }
  }

  // Learning page renderer
  function renderLearningPage(){ const container = document.querySelector('[data-content="learning"]'); if(!container) return; // ensure buttons wired
    // start learning anchor
    $('#btnStartLearning')?.addEventListener('click', ()=>{ const el = document.getElementById('learn-investing101'); if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    // see more / anchors
    $all('.see-more').forEach(b=>{ b.addEventListener('click', (ev)=>{ const anchor = ev.currentTarget.dataset.anchor || 'library'; const el = document.getElementById(anchor); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }); });
    $all('.see-library').forEach(b=> b.addEventListener('click', ()=>{ const el = document.getElementById('library'); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }));
    // add fade-in classes and observe
    const observer = new IntersectionObserver((entries)=>{ entries.forEach(ent=>{ if(ent.isIntersecting){ ent.target.classList.add('visible'); } }); }, { threshold: 0.15 });
    $all('.learning-section, .learn-card, .learning-hero-illustration').forEach(el=>{ el.classList.add('fade-in'); observer.observe(el); });
  }

  // --- Robo Risk Quiz: questions, scoring, and results ---
  const ROBO_QUESTIONS = [
    { id: 'horizon', q: 'How long do you plan to invest?', choices: [ ['<1 year',1], ['1-3 years',3], ['3-5 years',5], ['5+ years',8] ] },
    { id: 'reaction', q: 'How do you react to a 20% drop in portfolio?', choices: [ ['Sell everything',1], ['Sell some',3], ['Do nothing',6], ['Buy more',9] ] },
    { id: 'goal', q: 'What is your primary investment goal?', choices: [ ['Preserve capital',1], ['Income',3], ['Growth',6], ['Aggressive growth',9] ] },
    { id: 'pctSavings', q: 'What % of your savings are you investing?', choices: [ ['<10%',2], ['10-30%',4], ['30-60%',6], ['60%+',8] ] },
    { id: 'experience', q: 'How experienced are you with stocks / crypto?', choices: [ ['None',1], ['Beginner',3], ['Experienced',6], ['Expert',9] ] }
  ];

  function openRoboQuiz(){ const modal = $('#roboQuizModal'); if(!modal) return; const body = $('#roboQuizBody'); body.innerHTML = '';
    // pick 4 questions randomly from the pool (or all 5 if you want)
    const shuffled = ROBO_QUESTIONS.slice().sort(()=> Math.random()-0.5); const chosen = shuffled.slice(0,4);
    chosen.forEach((q,qi)=>{
      const wrap = document.createElement('div'); wrap.className='quiz-question'; const h = document.createElement('h4'); h.textContent = `${qi+1}. ${q.q}`; wrap.appendChild(h);
      const choices = document.createElement('div'); choices.className='quiz-choices'; q.choices.forEach((c,ci)=>{ const b = document.createElement('button'); b.type='button'; b.className='quiz-choice small'; b.textContent = c[0]; b.dataset.val = c[1]; b.dataset.qid = q.id; b.addEventListener('click', (ev)=>{ // toggle selection per question
        // deselect others for same qid
        choices.querySelectorAll('.quiz-choice').forEach(x=> x.classList.remove('active'));
        ev.currentTarget.classList.add('active');
      }); choices.appendChild(b); }); wrap.appendChild(choices); body.appendChild(wrap); });
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; setTimeout(()=>{ modal.querySelector('.quiz-choice')?.focus(); },80);
  }

  function closeRoboQuiz(){ const modal = $('#roboQuizModal'); if(!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

  $('#btnRoboQuiz')?.addEventListener('click', ()=>{ openRoboQuiz(); });
  $('#roboQuizCancel')?.addEventListener('click', ()=> closeRoboQuiz());

  $('#roboQuizSubmit')?.addEventListener('click', ()=>{
    // collect answers
    const modal = $('#roboQuizModal'); const questions = modal.querySelectorAll('.quiz-question'); if(questions.length===0) return; let total=0; let maxPossible=0; questions.forEach(qel=>{ const sel = qel.querySelector('.quiz-choice.active'); const vals = Array.from(qel.querySelectorAll('.quiz-choice')).map(x=>Number(x.dataset.val||0)); const m = Math.max(...vals,0); maxPossible += m; if(sel){ total += Number(sel.dataset.val||0); } });
    // normalize score to 1-10
    const raw = total; const normalized = Math.round( (raw / Math.max(maxPossible,1)) * 9 ) + 1; const score = Math.max(1, Math.min(10, normalized));
    // decide risk label
    const label = (score<=3)? 'Conservative' : (score<=6)? 'Balanced' : (score<=8)? 'Growth' : 'Aggressive';
    // assemble recommended allocation (simple mapping)
    const allocation = suggestAllocation(score);
    // suggested tickers (simple mapping)
    const recs = suggestTickers(score);
  // render results (and persist + render in Robo section). Close quiz popup and do not leave the results modal open.
  renderRoboResults({ score, label, allocation, recs });
  closeRoboQuiz();
  // ensure results modal is closed (we render summary into the Robo section instead)
  try{ closeRoboResults(); }catch(e){}
  toast('Recommendation saved to your Robo profile','success');
  });

  function suggestAllocation(score){ // returns array [{label, value}]
    if(score<=3) return [ {label:'Cash', value:40}, {label:'Bonds', value:40}, {label:'Equity', value:20} ];
    if(score<=6) return [ {label:'Cash', value:10}, {label:'Bonds', value:40}, {label:'Equity', value:45}, {label:'Alternatives', value:5} ];
    if(score<=8) return [ {label:'Cash', value:5}, {label:'Bonds', value:20}, {label:'Equity', value:65}, {label:'Alternatives', value:10} ];
    return [ {label:'Cash', value:2}, {label:'Bonds', value:8}, {label:'Equity', value:70}, {label:'Crypto', value:10}, {label:'Alternatives', value:10} ];
  }

  function suggestTickers(score){
    // return structured recommendation objects: { id, label, type, learnAnchor }
    if(score<=3) return [
      { id: 'PWETF', label: 'PWETF (Conservative Bond Index)', type: 'ETF', learnAnchor: 'learn-investing101' },
      { id: 'GOVBND', label: 'GOVBND (MYR Government Bond)', type: 'Bond', learnAnchor: 'learn-investing101' }
    ];
    if(score<=6) return [
      { id: 'PWETF', label: 'PWETF', type: 'ETF', learnAnchor: 'learn-investing101' },
      { id: 'FINBANK', label: 'FINBANK (Financials)', type: 'Equity', learnAnchor: 'learn-investing101' },
      { id: 'INFRA', label: 'INFRA (Infrastructure REIT)', type: 'REIT', learnAnchor: 'learn-investing101' }
    ];
    if(score<=8) return [
      { id: 'TECHSEA', label: 'TECHSEA (SEA Tech Index)', type: 'Equity', learnAnchor: 'learn-options' },
      { id: 'GLOBALESG', label: 'GLOBALESG (Global ESG ETF)', type: 'ETF', learnAnchor: 'learn-investing101' },
      { id: 'PWSTK', label: 'PWSTK (PocketWealth Growth)', type: 'Equity', learnAnchor: 'learn-investing101' }
    ];
    return [
      { id: 'TECHSEA', label: 'TECHSEA', type: 'Equity', learnAnchor: 'learn-options' },
      { id: 'PWSTK', label: 'PWSTK', type: 'Equity', learnAnchor: 'learn-investing101' },
      { id: 'BTC-TEST', label: 'BTC-TEST (Crypto Sim)', type: 'Crypto', learnAnchor: 'library' },
      { id: 'PWGOLD', label: 'PWGOLD (Gold Proxy)', type: 'Commodity', learnAnchor: 'learn-investing101' }
    ];
  }

  // Results modal helpers
  function openRoboResults(){ const m = $('#roboResultsModal'); if(!m) return; m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closeRoboResults(){ const m = $('#roboResultsModal'); if(!m) return; m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  $('#roboResultsClose')?.addEventListener('click', ()=> closeRoboResults());

  function renderRoboResults(data){
    try{
      $('#roboScore').textContent = `Risk score: ${data.score} / 10`;
      $('#roboRiskLevel').textContent = `${data.label} investor — recommended allocation below.`;
      const list = $('#roboRecList'); list.innerHTML = '<h4>Suggested investments</h4>';
      const grouping = { ETF: [], Bond: [], Equity: [], REIT: [], Crypto: [], Commodity: [], Other: [] };
      (data.recs || []).forEach(r=>{
        const t = (r.type||'Other'); if(grouping[t]) grouping[t].push(r); else grouping.Other.push(r);
      });
      const container = document.createElement('div');
      Object.keys(grouping).forEach(k=>{ const items = grouping[k]; if(!items || items.length===0) return; const h = document.createElement('div'); h.style.marginTop='6px'; const title = document.createElement('div'); title.style.fontWeight='600'; title.textContent = k; h.appendChild(title); const ul = document.createElement('ul'); items.forEach(it=>{ const li = document.createElement('li'); li.innerHTML = `<strong>${escapeHtml(it.label||it.id||'')}</strong> — <span class="muted small">${escapeHtml(it.type||'')}</span>`; // add View in Market button
        const btn = document.createElement('button'); btn.className = 'btn btn-ghost small viewMarket'; btn.type = 'button'; btn.dataset.sym = it.id || it.label || ''; btn.textContent = 'View'; btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); const sym = ev.currentTarget.dataset.sym; if(!sym) return; selectTab('market'); renderWatchlist(); setTimeout(()=>{ openSymbolDetail(sym); }, 150); }); li.appendChild(document.createTextNode(' ')); li.appendChild(btn); ul.appendChild(li); }); h.appendChild(ul); container.appendChild(h); });
      // single Learn More link below the grouped list
      const learnMore = document.createElement('div'); learnMore.style.marginTop='8px'; const link = document.createElement('a'); link.href='#'; link.className='btn btn-ghost small'; link.textContent = 'Learn More'; link.addEventListener('click',(ev)=>{ ev.preventDefault(); gotoLearningAnchor('learn-investing101'); }); learnMore.appendChild(link);
      list.appendChild(container); list.appendChild(learnMore);

      // render pie chart
      const ctx = document.getElementById('roboAllocationChart').getContext('2d');
      const labels = data.allocation.map(x=>x.label);
      const values = data.allocation.map(x=>x.value);
      if(window.roboAllocChart) window.roboAllocChart.destroy();
      window.roboAllocChart = new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data: values, backgroundColor: ['#0b66ff','#00b37a','#ffd43b','#ff7aa2','#7c3aed'] }] }, options: { responsive:true } });
    }catch(e){ console.error('renderRoboResults', e); }
  }

  // Persist results to user profile and render summary in Robo section
  function saveRoboQuizToUser(data){ const s = getSession(); if(!s) return; const user = findUser(s.email); if(!user) return; user.robo = user.robo||{}; user.robo.riskProfile = { score: data.score, label: data.label, allocation: data.allocation, recs: data.recs, ts: nowISO() }; upsertUser(user); renderRoboSummaryForUser(user); }

  function renderRoboSummaryForUser(user){ try{ if(!user || !user.robo || !user.robo.riskProfile) return; const p = user.robo.riskProfile; const wrap = $('#roboQuizSummary'); if(!wrap) return; wrap.classList.remove('hidden'); const txt = $('#roboSummaryText'); txt.innerHTML = `<div style="font-weight:700">${p.label} — ${p.score}/10</div><div class="muted small">Updated: ${new Date(p.ts).toLocaleString()}</div>`; const recWrap = $('#roboSummaryRecs'); recWrap.innerHTML = '<strong>Suggested:</strong> ' + (p.recs||[]).slice(0,4).map(r=> escapeHtml(r)).join(', ');
      // draw small pie chart
      try{ const ctx = document.getElementById('roboMiniChart').getContext('2d'); const labels = (p.allocation||[]).map(x=>x.label); const values = (p.allocation||[]).map(x=>x.value); if(window.roboMiniChart) window.roboMiniChart.destroy(); window.roboMiniChart = new Chart(ctx, { type:'doughnut', data:{ labels, datasets:[{ data: values, backgroundColor:['#0b66ff','#00b37a','#ffd43b','#ff7aa2','#7c3aed'] }] }, options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{ display:false } } } }); }catch(e){}
    }catch(e){ console.error('renderRoboSummaryForUser', e); } }
  function renderRoboSummaryForUser(user){
    try{
      if(!user || !user.robo || !user.robo.riskProfile) return;
      const p = user.robo.riskProfile; const wrap = $('#roboQuizSummary'); if(!wrap) return; wrap.classList.remove('hidden'); const txt = $('#roboSummaryText'); txt.innerHTML = `<div style="font-weight:700">${p.label} — ${p.score}/10</div><div class="muted small">Updated: ${new Date(p.ts).toLocaleString()}</div>`;
      const recWrap = $('#roboSummaryRecs'); if(recWrap) recWrap.innerHTML = '';
      // ensure title is present (app.html adds it statically, but keep this defensive)
      try{ const t = document.getElementById('roboSummaryRecsTitle'); if(t) t.textContent = 'Investment recommendations'; }catch(e){}
      const groups = { ETF: [], Bond: [], Equity: [], REIT: [], Crypto: [], Commodity: [], Other: [] };
      (p.recs||[]).slice(0,6).forEach(r=>{ const t = (r.type||'Other'); if(groups[t]) groups[t].push(r); else groups.Other.push(r); });
      const frag = document.createElement('div'); Object.keys(groups).forEach(k=>{ const items = groups[k]; if(!items || items.length===0) return; const line = document.createElement('div'); const bold = document.createElement('strong'); bold.textContent = k + ': '; line.appendChild(bold);
        // append each item with a small View button
        items.forEach((it, idx)=>{ const span = document.createElement('span'); span.style.marginLeft = (idx===0? '6px' : '8px'); span.innerHTML = escapeHtml(it.label||it.id||''); const viewBtn = document.createElement('button'); viewBtn.className = 'btn btn-ghost small viewMarket'; viewBtn.type = 'button'; viewBtn.dataset.sym = it.id || it.label || ''; viewBtn.style.marginLeft = '8px'; viewBtn.textContent = 'View'; viewBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); const sym = ev.currentTarget.dataset.sym; if(!sym) return; selectTab('market'); renderWatchlist(); setTimeout(()=>{ openSymbolDetail(sym); }, 150); }); line.appendChild(span); line.appendChild(viewBtn); });
      frag.appendChild(line); });
      // single Learn More link
      const lm = document.createElement('div'); lm.style.marginTop='6px'; const lnk = document.createElement('a'); lnk.href='#'; lnk.className='muted small'; lnk.textContent = 'Learn More'; lnk.addEventListener('click', (ev)=>{ ev.preventDefault(); gotoLearningAnchor('learn-investing101'); }); lm.appendChild(lnk);
      if(recWrap){ recWrap.appendChild(frag); recWrap.appendChild(lm); }
      // Invest-to-target UI removed from summary
      // draw small pie chart (use fallback allocation if none stored)
      try{
        const canvas = document.getElementById('roboMiniChart'); if(!canvas) return; const ctx = canvas.getContext('2d'); const allocation = (p.allocation && p.allocation.length)? p.allocation : (typeof suggestAllocation === 'function' ? suggestAllocation(p.score) : []);
        const labels = (allocation||[]).map(x=>x.label||''); const values = (allocation||[]).map(x=>Number(x.value||0)); if(window.roboMiniChart) try{ window.roboMiniChart.destroy(); }catch(e){}
        window.roboMiniChart = new Chart(ctx, { type:'doughnut', data:{ labels, datasets:[{ data: values, backgroundColor:['#0b66ff','#00b37a','#ffd43b','#ff7aa2','#7c3aed'] }] }, options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{ display:false } } } });
      }catch(e){ console.error('renderRoboSummaryForUser chart', e); }
    }catch(e){ console.error('renderRoboSummaryForUser', e); }
  }

  // Navigate to Learning tab and scroll to anchor
  function gotoLearningAnchor(anchorId){ try{ selectTab('learning'); setTimeout(()=>{ const el = document.getElementById(anchorId); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 120); }catch(e){} }

  // ensure the Robo summary is rendered when session changes or on init
  document.addEventListener('session:changed', ()=>{ try{ const s = getSession(); if(!s) return; const u = findUser(s.email); if(u) renderRoboSummaryForUser(u); }catch(e){} });

  // After producing results, persist to user
  (function wireSaveRoboResults(){ const originalRender = renderRoboResults; renderRoboResults = function(data){ try{ originalRender(data); saveRoboQuizToUser(data); }catch(e){ console.error(e); originalRender(data); } }; })();
  

  // simple 24h change text for shariah symbols (derived from series)
  function getShariah24Change(sym){ try{ const series = loadSeries(sym); if(!series || series.length<2) return ''; const dayAgo = Date.now() - 24*3600*1000; const old = series.find(pt=> pt.t <= dayAgo) || series[0]; const last = series[series.length-1]; const pct = old && old.p? ((last.p - old.p) / old.p * 100) : 0; return `${pct>=0?'+':''}${pct.toFixed(2)}% (24h)`; }catch(e){ return ''; } }

  // Shariah watchlist (simple persistence per user)
  function getUserShariahWatch(email){ const u = findUser(email); if(!u) return []; return u.shariahWatch || []; }
  function isWatching(sym){ const s = getSession(); if(!s) return false; const u = findUser(s.email); if(!u) return false; return Array.isArray(u.shariahWatch) && u.shariahWatch.includes(sym); }
  function toggleWatch(sym){ const s = getSession(); if(!s) return; const u = findUser(s.email); if(!u) return; u.shariahWatch = u.shariahWatch || []; const idx = u.shariahWatch.indexOf(sym); if(idx>=0) u.shariahWatch.splice(idx,1); else u.shariahWatch.push(sym); upsertUser(u); renderUserStatus(); }


  // Trade modal handling
  let modalState = { symbol:null, side:null, snapshotPrice:0, snapshotTime:null };
  function openTradeModal(sym, side, snapshotPrice){ modalState.symbol = sym; modalState.side = side; modalState.snapshotPrice = snapshotPrice; modalState.snapshotTime = new Date().toISOString(); $('#tradeQty').value = ''; $('#tradeTotal').textContent = ''; $('#tradeWarning').style.display = 'none'; $('#tradeModal').classList.remove('hidden'); $('#tradeModal').setAttribute('aria-hidden','false'); $('#tradeModal').querySelector('#tradeConfirm').textContent = `Confirm ${side}`; $('#tradeModalTitle').textContent = `Trade ${sym}`; $('#snapshotPrice').textContent = `${fmtMYR(snapshotPrice)}`; $('#snapshotTime').textContent = new Date(modalState.snapshotTime).toLocaleString(); // trap focus
    // save last focused element and trap basic keys
    modalState.lastFocus = document.activeElement; document.body.style.overflow='hidden'; setTimeout(()=>{ $('#tradeQty').focus(); },100);
    modalState._keyHandler = function(e){ if(e.key === 'Escape'){ closeTradeModal(); } };
    document.addEventListener('keydown', modalState._keyHandler);
  }
  function closeTradeModal(){ $('#tradeModal').classList.add('hidden'); $('#tradeModal').setAttribute('aria-hidden','true'); document.body.style.overflow=''; if(modalState && modalState._keyHandler) { document.removeEventListener('keydown', modalState._keyHandler); modalState._keyHandler = null; } try{ if(modalState && modalState.lastFocus) modalState.lastFocus.focus(); }catch(e){} modalState.lastFocus = null; }
  $('#tradeCancel')?.addEventListener('click', ()=>{ closeTradeModal(); });
  // qty change -> update total & validation
  $('#tradeQty')?.addEventListener('input', ()=>{ const q = Number($('#tradeQty').value); const total = Number((q * modalState.snapshotPrice).toFixed(2)); $('#tradeTotal').textContent = `Total: ${fmtMYR(total)}`; const s = getSession(); if(!s) return; const user = findUser(s.email); if(modalState.side==='BUY'){ if(total < 10){ $('#tradeWarning').textContent = 'Minimum investment is RM10'; $('#tradeWarning').style.display='block'; } else { $('#tradeWarning').style.display='none'; } } else { // sell
    const own = (user.holdings||{})[modalState.symbol]||{qty:0}; if(q > own.qty){ $('#tradeWarning').textContent = `You only own ${own.qty} units`; $('#tradeWarning').style.display='block'; } else { $('#tradeWarning').style.display='none'; } } });
  // enable/disable confirm button depending on validation
  $('#tradeQty')?.addEventListener('input', ()=>{ const btn = $('#tradeConfirm'); if(!btn) return; const q = Number($('#tradeQty').value); if(!q || q<=0){ btn.disabled = true; return; } if(modalState.side==='BUY'){ const total = Number((q * modalState.snapshotPrice).toFixed(2)); btn.disabled = (total < 10); } else { const s = getSession(); const user = s && findUser(s.email); const own = (user && user.holdings && user.holdings[modalState.symbol])? user.holdings[modalState.symbol].qty : 0; btn.disabled = (q>own); } });

  // Confirm trade
  $('#tradeConfirm')?.addEventListener('click', ()=>{
    const q = Number($('#tradeQty').value); if(!q || q<=0) { $('#tradeWarning').textContent = 'Enter a valid quantity'; $('#tradeWarning').style.display='block'; return; }
    const s = getSession(); if(!s) return; const user = findUser(s.email); const btn = $('#tradeConfirm'); if(btn.disabled) return; btn.disabled=true; btn.setAttribute('aria-busy','true'); try{
      if(modalState.side==='BUY'){
  try{ placeMarketBuy(user, modalState.symbol, q, modalState.snapshotPrice, modalState.snapshotTime, { isShariah: !!modalState.isShariah }); (function(){ const container = createToastContainer(); const el = document.createElement('div'); el.className='pw-toast pw-toast-success'; el.style.marginTop='8px'; el.style.padding='10px 14px'; el.style.borderRadius='10px'; el.style.background='#0b66ff'; el.style.color='#fff'; el.style.boxShadow='0 8px 20px rgba(11,22,34,0.08)'; el.innerHTML = `✅ Bought ${q} ${modalState.symbol} @ ${fmtMYR(modalState.snapshotPrice)} <a href="#" class="viewStatementLink" style="color:#fff;text-decoration:underline;margin-left:8px">View Statement</a>`; container.appendChild(el); el.querySelector('.viewStatementLink')?.addEventListener('click',(ev)=>{ ev.preventDefault(); selectTab('statement'); setTimeout(()=>{ try{ const now=new Date(); const mSel=document.getElementById('stMonth'); const ySel=document.getElementById('stYear'); if(mSel){ mSel.value = (now.getMonth()+1).toString(); mSel.dispatchEvent(new Event('change')); } if(ySel){ ySel.value = now.getFullYear().toString(); ySel.dispatchEvent(new Event('change')); } }catch(_){ } },140); }); setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),240); },5000); })(); }catch(err){ $('#tradeWarning').textContent = err.message || 'Buy failed'; $('#tradeWarning').style.display='block'; btn.disabled=false; btn.removeAttribute('aria-busy'); return; }
      } else {
  try{ placeMarketSell(user, modalState.symbol, q, modalState.snapshotPrice, modalState.snapshotTime, { isShariah: !!modalState.isShariah }); (function(){ const container = createToastContainer(); const el = document.createElement('div'); el.className='pw-toast pw-toast-success'; el.style.marginTop='8px'; el.style.padding='10px 14px'; el.style.borderRadius='10px'; el.style.background='#0b66ff'; el.style.color='#fff'; el.style.boxShadow='0 8px 20px rgba(11,22,34,0.08)'; el.innerHTML = `✅ Sold ${q} ${modalState.symbol} @ ${fmtMYR(modalState.snapshotPrice)} <a href="#" class="viewStatementLink" style="color:#fff;text-decoration:underline;margin-left:8px">View Statement</a>`; container.appendChild(el); el.querySelector('.viewStatementLink')?.addEventListener('click',(ev)=>{ ev.preventDefault(); selectTab('statement'); setTimeout(()=>{ try{ const now=new Date(); const mSel=document.getElementById('stMonth'); const ySel=document.getElementById('stYear'); if(mSel){ mSel.value = (now.getMonth()+1).toString(); mSel.dispatchEvent(new Event('change')); } if(ySel){ ySel.value = now.getFullYear().toString(); ySel.dispatchEvent(new Event('change')); } }catch(_){ } },140); }); setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),240); },5000); })(); }catch(err){ $('#tradeWarning').textContent = err.message || 'Sell failed'; $('#tradeWarning').style.display='block'; btn.disabled=false; btn.removeAttribute('aria-busy'); return; }
      }
      // refresh views (defensive: isolate each renderer so a failure in one doesn't break the rest)
      try{ renderDashboard(); }catch(err){ console.error('renderDashboard failed after trade', err); }
      try{ renderMarketList(); }catch(err){ console.error('renderMarketList failed after trade', err); }
      try{ renderPosition(modalState.symbol); }catch(err){ console.error('renderPosition failed after trade', err); }
      try{ renderActivityTable(); }catch(err){ console.error('renderActivityTable failed after trade', err); }
      try{ renderRecentActivity(); }catch(err){ console.error('renderRecentActivity failed after trade', err); }
      try{ renderPortfolio(); }catch(err){ console.error('renderPortfolio failed after trade', err); }
      // close modal and restore focus
      try{ closeTradeModal(); }catch(err){ console.error('closeTradeModal failed', err); }
      // clear shariah flag to avoid leaking into next trades
      modalState.isShariah = false;
    }catch(e){ console.error(e); toast('Something went wrong','warn'); }
    finally{ btn.disabled=false; btn.removeAttribute('aria-busy'); }
  });

  // call invest list at init
  renderInvestList();

  // Portfolio rendering on Dashboard

  // Improved portfolio renderer with additional columns and defensive guards
  function renderPortfolio(){
    try{
      const s = getSession(); const container = $('#portfolioContent'); if(!container) return; if(!s || !s.email){ container.innerHTML = '<p class="muted">Please sign in to view your holdings.</p>'; return; }
      const user = findUser(s.email); if(!user){ container.innerHTML = '<p class="muted">User not found.</p>'; return; }
      const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const meta = loadMarketMeta(); const holdings = user && user.holdings ? user.holdings : {};
      const syms = Object.keys(holdings || []);
  if(!syms || syms.length===0){ container.innerHTML = `<p class="muted">You have no holdings yet. <button class="btn" onclick="document.querySelector('[data-tab=market]').click();">Explore Market</button></p>`; return; }

  let html = '<table class="portfolio-table"><thead><tr><th style="text-align:left">Name</th><th>Symbol</th><th>Units</th><th>Avg Cost</th><th>Live Price</th><th>Value</th><th>P&L</th><th></th></tr></thead><tbody>';
      let updatedCount = 0;
      syms.forEach(sym=>{
  const h = holdings[sym] || { qty:0, avgPrice:0 };
  const last = Number(currentPrice(sym).toFixed(4));
        const value = Number((h.qty * last).toFixed(2));
        const cost = Number((h.qty * (h.avgPrice||0)).toFixed(2));
        const pnl = Number((value - cost).toFixed(2));
        const pct = cost? Number((pnl / cost * 100).toFixed(2)) : 0;
        const name = (meta[sym] && meta[sym].name) || (market[sym] && market[sym].name) || sym;
        html += `<tr data-sym="${sym}"><td style="text-align:left">${escapeHtml(name)}</td><td>${sym}</td><td>${Number(h.qty||0).toFixed(6)}</td><td>${h.avgPrice?fmtMYR(h.avgPrice):'-'}</td><td>${fmtMYR(last)}</td><td>${fmtMYR(value)}</td><td class="${pnl>=0?'price-up':'price-down'}">${fmtMYR(pnl)} (${pct}%)</td><td><button class="btn btn-ghost quickSell" data-sym="${sym}">Sell</button></td></tr>`;
        updatedCount++;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      // wire quick sell buttons
  $all('.quickSell').forEach(b=>b.addEventListener('click',(e)=>{ const sym = e.currentTarget.dataset.sym; openSymbolDetail(sym); setTimeout(()=>{ openTradeModal(sym,'SELL', currentPrice(sym)); $('#tradeQty').value = (findUser(getSession().email).holdings[sym]?.qty||0); $('#tradeQty').dispatchEvent(new Event('input')); },160); }));

      // ensure a periodic refresh so last prices and P&L stay live
      try{ if(portfolioRefreshTimer) clearInterval(portfolioRefreshTimer); portfolioRefreshTimer = setInterval(()=>{ try{ // fast update: only update numeric cells to avoid reflow where possible
      const rows = container.querySelectorAll('tr[data-sym]'); if(!rows) return; rows.forEach(r=>{ const sym = r.dataset.sym; const h = holdings[sym] || { qty:0, avgPrice:0 }; const last = Number(currentPrice(sym).toFixed(4)); const value = Number((h.qty * last).toFixed(2)); const cost = Number((h.qty * (h.avgPrice||0)).toFixed(2)); const pnl = Number((value - cost).toFixed(2)); const pct = cost? Number((pnl / cost * 100).toFixed(2)) : 0; // update columns: live price (col 5), value (col6), pnl (col7)
                const cells = r.querySelectorAll('td'); if(cells.length>=7){ cells[4].textContent = fmtMYR(last); cells[5].textContent = fmtMYR(value); cells[6].textContent = `${fmtMYR(pnl)} (${pct}%)`; cells[6].classList.toggle('price-up', pnl>=0); cells[6].classList.toggle('price-down', pnl<0); }
            }); }catch(e){} }, 2000); }catch(e){}
    }catch(err){ console.error('[pw] renderPortfolio failed', err); }
  }

  function renderRecentActivity(){ const s = getSession(); if(!s) return; const user = findUser(s.email); const el = $('#recentActivityList'); if(!el) return; const items = (user.activity||[]).slice(0,5); if(items.length===0){ el.textContent = 'No activity yet.'; return; } el.innerHTML = ''; items.forEach(a=>{ const div = document.createElement('div'); div.className='muted small'; div.textContent = `${actionLabel(a)} — ${fmtLocal(a.time)}`; el.appendChild(div); }); }

  // wire view all link
  document.querySelectorAll('[data-action="viewAllActivity"]')?.forEach(a=>a.addEventListener('click',(e)=>{ e.preventDefault(); /* Statement feature removed */ selectTab('dashboard'); }));
  // New statement tab helpers -------------------------------------------------
  const STATEMENT_TYPE_LABELS = {
    'PREMIUM_SUB':'PocketWealth Pro subscription fee',
    'PREMIUM_ROBO_SUB':'PocketWealth Starter subscription fee',
    'PREMIUM_UNSUB':'Premium unsubscribe',
    'PREMIUM_ROBO_UNSUB':'Starter unsubscribe',
    'BUY':'Buy',
    'BUY_SHARIAH':'Buy (Shariah)',
    'SELL':'Sell',
    'SELL_SHARIAH':'Sell (Shariah)',
    'CASH_IN':'Top-up',
    'WITHDRAW':'Withdraw',
    'ADMIN_GIFT_IN':'Gift from admin',
    'FEE':'Fee',
    'DIVIDEND':'Dividend'
  };

  function prettyType(t){ return STATEMENT_TYPE_LABELS[t] || t; }
  // Display label overrides for Statement "Type" column (user-facing)
  function statementDisplayType(t){
    if(!t) return '';
    if(t==='BUY' || t==='BUY_SHARIAH') return 'Invest';
    if(t==='SELL' || t==='SELL_SHARIAH') return 'Sell';
    if(t==='CASH_IN') return 'Cash-in';
    if(t==='WITHDRAW') return 'Withdraw';
    if(t==='ADMIN_GIFT_IN') return 'Gift';
    return prettyType(t);
  }

  function renderNewStatementTab(){
    const s = getSession(); if(!s) return; const user = findUser(s.email); if(!user) return;
    // Ensure legacy activity is migrated/backfilled so statement has data
    try{ backfillLedgerFromActivityFor(user.email); }catch(_){ }
    // Debug: surface ledger length and most recent row in console (non-invasive)
    try{
      const _ledgerDbg = getUserLedger(user.email);
      if(window && !window.__pwStatementLoggedOnce){
        console.info('[Statement] Ledger entries:', _ledgerDbg.length, _ledgerDbg.slice(0,3));
        window.__pwStatementLoggedOnce = true;
      }
    }catch(_){ }
    const monthSel = document.getElementById('stMonth');
    const yearSel = document.getElementById('stYear');
    const typeSel = document.getElementById('stType');
    const searchEl = document.getElementById('stSearch');
    const tbody = document.querySelector('#statementTable tbody');
    const summary = document.getElementById('statementSummaryBlock');
    const tableWrap = document.getElementById('statementTableWrap');
    if(!monthSel || !yearSel || !typeSel || !searchEl || !tbody || !summary) return;
    // Ensure a pagination container exists just after the table
    let pager = document.getElementById('statementPager');
    if(!pager && tableWrap && tableWrap.parentNode){
      pager = document.createElement('div');
      pager.id = 'statementPager';
      pager.className = 'card';
      pager.style.cssText = 'margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;';
      tableWrap.parentNode.insertBefore(pager, tableWrap.nextSibling);
    }
    if(pager && !pager.dataset.page){ pager.dataset.page = '1'; }

    // Populate filters once (idempotent)
    if(!monthSel.dataset.ready){
      const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      names.forEach((n,i)=>{ const o=document.createElement('option'); o.value=(i+1); o.textContent=n; monthSel.appendChild(o); });
      monthSel.dataset.ready='1';
    }
  // Rebuild year list every render (new years may appear) and preserve selection
  const prevYearValue = yearSel.value; yearSel.innerHTML='';
  const years = new Set(); (getUserLedger(user.email)||[]).forEach(r=>{ try{ years.add(new Date(r.ts).getFullYear()); }catch(_){} }); if(years.size===0) years.add(new Date().getFullYear());
  const sortedYears = Array.from(years).sort((a,b)=>b-a);
  sortedYears.forEach(y=>{ const o=document.createElement('option'); o.value=y; o.textContent=y; yearSel.appendChild(o); });
  // attempt to restore previous year, else default to newest
  if(prevYearValue && sortedYears.includes(Number(prevYearValue))){ yearSel.value = prevYearValue; } else { yearSel.value = String(sortedYears[0]); }
    if(!typeSel.dataset.ready){
      const types = ['ALL', ...Object.keys(STATEMENT_TYPE_LABELS)];
      types.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent = (t==='ALL'?'All types': prettyType(t)); typeSel.appendChild(o); });
      typeSel.dataset.ready='1';
    }
    // Force defaults first time entering Statement in a session (fallback to current month)
    const now = new Date(); if(!monthSel.dataset.autoset){ monthSel.value = (now.getMonth()+1).toString(); monthSel.dataset.autoset='1'; }
    if(!yearSel.dataset.autoset){ yearSel.value = now.getFullYear().toString(); yearSel.dataset.autoset='1'; }
    // If the currently selected month/year pair has zero transactions, auto-jump to the newest ledger entry's month
    try{
      const ledgerAll = getUserLedger(user.email) || [];
      if(ledgerAll.length>0){
        const newest = ledgerAll[0]; // stored newest-first
        const selMonth = Number(monthSel.value||0);
        const selYear = Number(yearSel.value||0);
        const newestDate = new Date(newest.ts);
        const newestMonth = newestDate.getMonth()+1;
        const newestYear = newestDate.getFullYear();
        // check if current selection has any rows; if not, adjust to newest
        const monthStartTmp = new Date(selYear, selMonth-1, 1).getTime(); const monthEndTmp = new Date(selYear, selMonth, 1).getTime();
        const anyInSelected = ledgerAll.some(r=>{ const t = new Date(r.ts).getTime(); return t>=monthStartTmp && t<monthEndTmp; });
        if(!anyInSelected){ monthSel.value = String(newestMonth); yearSel.value = String(newestYear); }
      }
    }catch(_){ }

    function apply(){
      // Filter ledger for selected month
      const month = Number(monthSel.value); const year = Number(yearSel.value); const selectedType = typeSel.value; const q = (searchEl.value||'').toLowerCase();
      const monthStart = new Date(year, month-1, 1).getTime(); const monthEnd = new Date(year, month, 1).getTime();
      const rowsNewestFirst = getUserLedger(user.email).slice(); // stored newest-first from pushLedger
      const inMonth = rowsNewestFirst.filter(r=>{ const t = new Date(r.ts).getTime(); return t>=monthStart && t<monthEnd; });
      // Summary metrics
  let cashIn=0; let realised=0; // realised computed only on SELL rows
  // Start with holdings prior to month for accurate cost basis
  const holdingsState = reconstructHoldingsUpTo(user.email, monthStart) || {};
  function applyBuy(symbol, qty, price){ const st = holdingsState[symbol]||{qty:0,avg:0}; const newQty = st.qty + qty; const newAvg = st.qty? ((st.qty*st.avg + qty*price)/newQty):price; holdingsState[symbol] = { qty: Number(newQty.toFixed(6)), avg: Number(newAvg.toFixed(6)) }; }
  function applySell(symbol, qty, price){ const st = holdingsState[symbol]||{qty:0,avg:0}; const sellQty = Math.min(qty, st.qty); const pnl = (price - (st.avg||0)) * sellQty; st.qty = Math.max(0, st.qty - sellQty); holdingsState[symbol]=st; return pnl; }
      // Build chronological for month to compute realised
      const chrono = inMonth.slice().sort((a,b)=> new Date(a.ts)-new Date(b.ts));
      chrono.forEach(r=>{
        if(r.type==='CASH_IN' || r.type==='ADMIN_GIFT_IN') cashIn += Number(r.amount||0);
        if(r.type==='BUY' || r.type==='BUY_SHARIAH'){ applyBuy(r.symbol, Math.abs(Number(r.qty||0)), Number(r.price||0)); }
        if(r.type==='SELL' || r.type==='SELL_SHARIAH'){ const pnl = applySell(r.symbol, Math.abs(Number(r.qty||0)), Number(r.price||0)); realised += pnl; }
      });
      // Filter by type/search
      let display = inMonth.filter(r=>{
        if(selectedType && selectedType!=='ALL' && r.type !== selectedType) return false;
        if(q){
          const blob = [r.type, prettyType(r.type), r.symbol, r.note, r.amount, r.price].join(' ').toLowerCase();
          return blob.includes(q);
        }
        return true;
      });
      // Pagination: 50 transactions per page
      const pageSize = 50;
      let currentPage = 1;
      if(pager && pager.dataset.page){ const p = Number(pager.dataset.page); if(!isNaN(p) && p>0) currentPage = p; }
      const totalPages = Math.max(1, Math.ceil(display.length / pageSize));
      if(currentPage > totalPages) currentPage = totalPages;
      if(pager) pager.dataset.page = String(currentPage);
      const start = (currentPage - 1) * pageSize;
      const pageRows = display.slice(start, start + pageSize);
      // Update summary
      summary.innerHTML = `
        <div style="flex:1;min-width:150px"><strong>Cash-in</strong><div>${fmtMYR(cashIn)}</div></div>
        <div style="flex:1;min-width:150px"><strong>Profit & Loss</strong><div class="${realised>=0?'price-up':'price-down'}">${fmtMYR(realised)}</div></div>
        <div style="flex:1;min-width:150px"><strong>Transactions</strong><div>${display.length}</div></div>
      `;
      // Render table body (already newest-first order from original slice)
      tbody.innerHTML='';
      pageRows.forEach(r=>{
        const dt = new Date(r.ts);
        const monthsFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const dateStr = `${dt.getDate()} ${monthsFull[dt.getMonth()]} ${dt.getFullYear()}`;
        const timeStr = dt.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        // Quantity: show up to 6 decimals but trim trailing zeros & dot
        let qtyStr = '';
        if(r.qty || r.qty===0){ const qNum = Number(r.qty); qtyStr = (Math.abs(qNum - Math.round(qNum)) < 1e-9) ? String(Math.round(qNum)) : qNum.toFixed(6).replace(/\.0+$/,'').replace(/(\.[0-9]*?)0+$/,'$1'); }
        const priceStr = r.price? fmtMYR(Number(r.price)) : '';
        const amt = Number(r.amount||0);
        const amtStr = fmtMYR(Math.abs(amt)); // no + / - sign, color indicates direction
        const tr = document.createElement('tr'); tr.style.borderBottom='1px solid rgba(11,22,34,0.06)'; tr.innerHTML = `
          <td style="padding:6px 10px;text-align:center">${dateStr}</td>
            <td style="padding:6px 10px;text-align:center">${timeStr}</td>
            <td style="padding:6px 10px;text-align:center">${statementDisplayType(r.type)}</td>
            <td style="padding:6px 10px;text-align:center">${r.symbol||''}</td>
            <td style="padding:6px 10px;text-align:center">${qtyStr}</td>
            <td style="padding:6px 10px;text-align:center">${priceStr}</td>
            <td style="padding:6px 10px;text-align:center" class="${amt>=0?'price-up':'price-down'}">${amtStr}</td>`;
        tbody.appendChild(tr);
      });
      if(display.length===0){ const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="7" class="muted" style="padding:12px 10px">No transactions for selection.</td>`; tbody.appendChild(tr); }
      // Render pager controls
      if(pager){
        pager.innerHTML = '';
        const prev = document.createElement('button'); prev.className='btn btn-ghost'; prev.textContent='Prev'; prev.disabled = (currentPage<=1);
        const next = document.createElement('button'); next.className='btn btn-ghost'; next.textContent='Next'; next.disabled = (currentPage>=totalPages);
        const info = document.createElement('span'); info.className='muted'; info.style.margin='0 6px'; info.textContent = `Page ${currentPage} of ${totalPages} — ${display.length} transactions`;
        pager.appendChild(prev); pager.appendChild(info); pager.appendChild(next);
        prev.addEventListener('click', ()=>{ pager.dataset.page = String(Math.max(1, currentPage-1)); apply(); });
        next.addEventListener('click', ()=>{ pager.dataset.page = String(Math.min(totalPages, currentPage+1)); apply(); });
      }
    }

    // Wire listeners once
    if(!monthSel.dataset.listener){ monthSel.addEventListener('change', ()=>{ if(pager) pager.dataset.page='1'; apply(); }); monthSel.dataset.listener='1'; }
    if(!yearSel.dataset.listener){ yearSel.addEventListener('change', ()=>{ if(pager) pager.dataset.page='1'; apply(); }); yearSel.dataset.listener='1'; }
    if(!typeSel.dataset.listener){ typeSel.addEventListener('change', ()=>{ if(pager) pager.dataset.page='1'; apply(); }); typeSel.dataset.listener='1'; }
    if(!searchEl.dataset.listener){ searchEl.addEventListener('input', ()=>{ if(pager) pager.dataset.page='1'; apply(); }); searchEl.dataset.listener='1'; }
    apply();
  }
  // Auto-refresh Statement when ledger changes and Statement tab is active
  document.addEventListener('ledger:changed', ()=>{ try{ if((localStorage.getItem('pw_tab')||'')==='statement'){ renderNewStatementTab(); } }catch(_){ } });

  // initial renders
  renderPortfolio(); renderRecentActivity(); renderActivityTable();

  // -------------------- Admin utilities & UI --------------------
  function getAllNonAdminUsers(){ const all = loadUsers(); return all.filter(u=> !(u.email && u.email.toLowerCase()===ADMIN_EMAIL) && !u.isAdmin); }
  function getUserState(idOrEmail){
    // Fetch user & ensure ledger is migrated/backfilled
    let user = loadUsers().find(u=> u.email===idOrEmail || u.id===idOrEmail);
    if(!user) return null;
    try{ if(!user.ledger || !Array.isArray(user.ledger) || user.ledger.length===0){ migrateActivityToLedger(); backfillLedgerFromActivityFor(user.email); user = findUser(user.email) || user; } }catch(_){ }
    const profile = { cash: user.cashBalanceMYR||0, premium: !!user.premiumActive, createdAt: user.createdAt || null, lastActive: user.lastActive || null, email: user.email, username: user.username };
    const holdings = Object.entries(user.holdings||{}).map(([symbol, h])=>({ symbol, qty: h.qty || 0, avgCost: h.avgPrice || 0 }));
    // Build normalized ledger rows (oldest->newest to compute running balance) based on user.ledger used by Statement
    const raw = (user.ledger||[]).slice().reverse(); // oldest first
    let running = 0;
    const ledger = raw.map(r=>{
      const amt = Number(r.amount||0);
      if(!isNaN(amt)) running = Number((running + amt).toFixed(2));
      return {
        ts: r.ts || nowISO(),
        type: r.type,
        symbol: r.symbol || '',
        qty: r.qty,
        price: r.price,
        amountIn: amt>0? amt : null,
        amountOut: amt<0? -amt : null,
        balance: running,
        note: r.note || ''
      };
    }).reverse(); // newest first for display conformity
    return { profile, holdings, ledger };
  }
  function getLastPrice(sym){ return Number((loadLast(sym) || loadMarketMeta()[sym]?.price || 0).toFixed(4)); }
  function calcPortfolioValue(holdings){ let total=0; holdings.forEach(h=>{ total += (h.qty || 0) * getLastPrice(h.symbol); }); return Number(total.toFixed(2)); }
  function calcAggregateAllocation(){ const users = getAllNonAdminUsers(); const alloc = { equity:0, bond:0, commodity:0, reit:0, cash:0 }; users.forEach(u=>{ const holdings = Object.entries(u.holdings||{}); holdings.forEach(([sym,h])=>{ const price = getLastPrice(sym); const val = (h.qty||0) * price; // classify by type if available in market meta
      const type = (loadMarketMeta()[sym] && loadMarketMeta()[sym].type) || 'equity'; alloc[type] = (alloc[type]||0) + val; }); alloc.cash = (alloc.cash||0) + (u.cashBalanceMYR===Infinity?0:(u.cashBalanceMYR||0)); }); const total = Object.values(alloc).reduce((s,v)=>s+v,0); return { alloc, total }; }
  function recomputeAdminMetrics(){ const users = getAllNonAdminUsers(); const usersCount = users.length; // AUM: sum of market value of holdings only
    let AUM = 0; users.forEach(u=>{ Object.entries(u.holdings||{}).forEach(([sym,h])=>{ AUM += (h.qty||0) * getLastPrice(sym); }); }); AUM = Number(AUM.toFixed(2));
    // Avg ticket (last 30 days)
    const cutoff = Date.now() - 30*24*3600*1000; let ticketSum = 0; let ticketCount = 0; users.forEach(u=>{ (u.activity||[]).forEach(a=>{ const t = new Date(a.time||a.ts||nowISO()).getTime(); if(t < cutoff) return; if(a.type && a.type.includes('BUY')){ const val = a.amount || ((a.qty||0)*(a.price||0)); if(val>0){ ticketSum += val; ticketCount++; } } if(a.type && a.type.includes('SELL')){ const val = a.amount || ((a.qty||0)*(a.price||0)); if(val>0){ ticketSum += val; ticketCount++; } } }); }); const avgTicket = ticketCount? Number((ticketSum / ticketCount).toFixed(2)) : 0;
    return { usersCount, AUM, avgTicket }; }

  // Admin render: overview + users list + detail
  function renderAdminView(){ const panel = document.querySelector('[data-content="admin"]'); if(!panel) return; // clear and render layout
    panel.innerHTML = `
      <h2>Admin Panel</h2>
      <div id="adminGiftWrap"></div>
  <div class="admin-overview grid" style="display:grid;grid-template-columns:1fr;gap:12px;align-items:start;width:100%">
        <div class="card admin-charts">
          <h4>Overview</h4>
          <div style="display:flex;gap:12px;align-items:stretch;justify-content:space-between;width:100%">
            <div style="flex:0 0 320px;max-width:360px;min-width:260px;display:flex;align-items:center;justify-content:center"><canvas id="adminDonut" style="max-height:240px;width:100%"></canvas></div>
            <div style="flex:1;min-width:300px"><canvas id="adminAumLine" style="max-height:260px;width:100%"></canvas></div>
        </div>
        <div class="card admin-stats">
          <h4>KPIs</h4>
          <div id="adminKpis"></div>
              </div>
        </div>
      </div>
      <div style="margin-top:12px" class="card admin-users">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h4>Users</h4>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="adminUserSearch" placeholder="Search by email or username" style="padding:8px;border-radius:8px;border:1px solid rgba(11,22,34,0.06)">
          </div>
        </div>
        <div id="adminUsersTable" style="margin-top:12px;overflow:auto"></div>
      </div>
      <div id="adminUserDetail" class="card hidden" style="margin-top:12px"></div>
    `;
    // render KPIs and charts
    const metrics = recomputeAdminMetrics(); const kpiEl = panel.querySelector('#adminKpis'); if(kpiEl){ kpiEl.innerHTML = `<div>Users: <strong>${metrics.usersCount}</strong></div><div>AUM: <strong>${fmtMYR(metrics.AUM)}</strong></div><div>Avg Ticket (30d): <strong>${fmtMYR(metrics.avgTicket)}</strong></div>`; }
    renderAdminOverviewCharts(); renderAdminUsersTable();

    // Inject Admin Gift form only visible to admin user
    try{
      const sess = getSession(); const curUser = sess && findUser(sess.email); const isAdminUser = curUser && ((curUser.email||'').toLowerCase()===ADMIN_EMAIL || curUser.role==='admin' || curUser.isAdmin===true);
      const giftWrap = panel.querySelector('#adminGiftWrap'); if(isAdminUser && giftWrap){
        // Combobox-based admin gift form
        giftWrap.innerHTML = `
          <div class="card" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <label style="display:flex;flex-direction:column;flex:1;min-width:260px">
              <span class="muted small">Email to gift</span>
              <div style="position:relative">
                <input id="adminGiftCombo" role="combobox" aria-expanded="false" aria-controls="adminGiftList" aria-autocomplete="list" placeholder="Search user by name or email..." style="padding:8px;border-radius:8px;border:1px solid rgba(11,22,34,0.06);width:100%">
                <div id="adminGiftList" role="listbox" style="position:absolute;z-index:1100;left:0;right:0;max-height:240px;overflow:auto;background:#fff;border:1px solid rgba(11,22,34,0.06);display:none"></div>
              </div>
            </label>
            <input type="hidden" id="adminGiftUserId">
            <label style="display:flex;flex-direction:column"><span class="muted small">Amount (MYR)</span><input type="number" id="adminGiftAmount" min="1" step="1" aria-label="Gift amount" style="padding:8px;border-radius:8px;border:1px solid rgba(11,22,34,0.06);width:120px"></label>
            <div style="display:flex;gap:6px;align-items:center;margin-left:4px">
              <button class="btn btn-ghost small" data-amt="10" type="button">RM10</button>
              <button class="btn btn-ghost small" data-amt="50" type="button">RM50</button>
              <button class="btn btn-ghost small" data-amt="100" type="button">RM100</button>
            </div>
            <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
              <button id="adminGiftBtn" class="btn" disabled>Gift Funds</button>
            </div>
            <div id="adminGiftError" style="width:100%;font-size:12px;color:#c92a2a;margin-top:8px;display:none"></div>
            <div style="width:100%;font-size:12px;color:#6b7280;margin-top:4px">Credits user cash balance and records a ledger entry.</div>
          </div>
        `;
        // Wire combobox behavior
        const combo = panel.querySelector('#adminGiftCombo'); const list = panel.querySelector('#adminGiftList'); const hiddenId = panel.querySelector('#adminGiftUserId'); const giftAmtEl = panel.querySelector('#adminGiftAmount'); const giftBtn = panel.querySelector('#adminGiftBtn'); const errorEl = panel.querySelector('#adminGiftError');

        // Ensure users have stable ids
        function ensureUserIds(){ const users = loadUsers(); let changed=false; users.forEach(u=>{ if(!u.id){ u.id = u.email; changed=true; } }); if(changed) saveUsers(users); }
        ensureUserIds();

        let combState = { results: [], active: -1, timer: null };

        function getAllUsers(){ return loadUsers(); }

        function renderComboboxResults(q){ const users = getAllUsers(); const term = String(q||'').trim().toLowerCase(); let results = users.filter(u=>{ const name = (u.username||'').toLowerCase(); const email = (u.email||'').toLowerCase(); return !term || name.includes(term) || email.includes(term); }); if(results.length>200) results = results.slice(0,200);
          combState.results = results; combState.active = -1; list.innerHTML = '';
          if(results.length===0){ list.style.display='none'; combo.setAttribute('aria-expanded','false'); return; }
          results.forEach((u,idx)=>{ const id = `adminGiftOpt_${idx}`; const opt = document.createElement('div'); opt.id = id; opt.setAttribute('role','option'); opt.dataset.userid = u.id; opt.tabIndex = -1; const label = (u.username && u.username.trim())? `${u.username} — ${u.email}` : u.email; opt.textContent = label; opt.style.padding = '8px'; opt.style.cursor='pointer'; opt.addEventListener('click', ()=>{ selectUserFromResults(idx); }); list.appendChild(opt); }); list.style.display='block'; combo.setAttribute('aria-expanded','true'); }

        function selectUserFromResults(idx){ const u = combState.results[idx]; if(!u) return; hiddenId.value = u.id; combo.value = (u.username && u.username.trim())? `${u.username} — ${u.email}` : u.email; list.style.display='none'; combo.setAttribute('aria-expanded','false'); combState.active = -1; validateGiftInputs(); }

        combo.addEventListener('input', (e)=>{ const q = e.target.value; errorEl.style.display='none'; hiddenId.value = ''; giftBtn.disabled = true; clearTimeout(combState.timer); combState.timer = setTimeout(()=> renderComboboxResults(q), 200); });
        combo.addEventListener('keydown', (e)=>{ if(e.key === 'ArrowDown'){ e.preventDefault(); if(combState.results.length===0) return; combState.active = Math.min(combState.active+1, combState.results.length-1); updateActive(); } else if(e.key === 'ArrowUp'){ e.preventDefault(); if(combState.results.length===0) return; combState.active = Math.max(combState.active-1, 0); updateActive(); } else if(e.key === 'Enter'){ e.preventDefault(); if(combState.active>=0){ selectUserFromResults(combState.active); } else { // attempt to match typed email case-insensitive
            const val = combo.value.trim().toLowerCase(); if(val){ const users = getAllUsers(); const found = users.find(u=> (u.email||'').toLowerCase()===val ); if(found){ hiddenId.value = found.id; combo.value = (found.username && found.username.trim())? `${found.username} — ${found.email}` : found.email; validateGiftInputs(); list.style.display='none'; combo.setAttribute('aria-expanded','false'); } else { errorEl.textContent = 'User not found'; errorEl.style.display = 'block'; } } } } else if(e.key === 'Escape'){ list.style.display='none'; combo.setAttribute('aria-expanded','false'); combState.active = -1; } });

        function updateActive(){ const opts = Array.from(list.children); opts.forEach((o,i)=> o.style.background = (i===combState.active)? '#eef6ff' : ''); if(combState.active>=0){ const activeEl = opts[combState.active]; combo.setAttribute('aria-activedescendant', activeEl.id); activeEl.scrollIntoView({ block: 'nearest' }); } }

        combo.addEventListener('blur', ()=>{ setTimeout(()=>{ list.style.display='none'; combo.setAttribute('aria-expanded','false'); combState.active = -1; }, 150); });

        // quick chips
        panel.querySelectorAll('button[data-amt]').forEach(b=>{ b.addEventListener('click', ()=>{ try{ giftAmtEl.value = b.dataset.amt; giftAmtEl.focus(); validateGiftInputs(); }catch(e){} }); });

        // validate amount and selected user
        function validateGiftInputs(){ errorEl.style.display='none'; const amt = Number(giftAmtEl.value||0); const uid = hiddenId.value || ''; const users = getAllUsers(); const validUser = users.find(u=> u.id === uid || (u.email||'').toLowerCase() === (uid||'').toLowerCase()); // allow if hiddenId set
          if(!validUser){ // allow typed email match
            const typed = combo.value.trim().toLowerCase(); if(typed){ const found = users.find(u=> (u.email||'').toLowerCase() === typed ); if(found){ hiddenId.value = found.id; } }
          }
          const finalUser = users.find(u=> u.id === hiddenId.value);
          const maxGift = 100000; // RM100k per gift
          if(!finalUser){ giftBtn.disabled = true; return; }
          if(isNaN(amt) || amt <= 0 || amt > maxGift){ giftBtn.disabled = true; return; }
          giftBtn.disabled = false; }

        giftAmtEl.addEventListener('input', validateGiftInputs);

        // Gift action (idempotent)
        giftBtn.addEventListener('click', ()=>{
          if(giftBtn.disabled) return; giftBtn.disabled = true; try{
            const amt = Number(giftAmtEl.value); const uid = hiddenId.value; const users = getAllUsers(); const recipient = users.find(u=> u.id === uid || (u.email||'').toLowerCase() === (uid||'').toLowerCase()); if(!recipient){ errorEl.textContent = 'User is no longer available'; errorEl.style.display = 'block'; giftBtn.disabled = false; return; }
            if(isNaN(amt) || amt < 1){ errorEl.textContent = 'Enter a valid amount'; errorEl.style.display = 'block'; giftBtn.disabled = false; return; }
            // credit recipient
            const r = findUser(recipient.email) || recipient; if(!r){ errorEl.textContent = 'User is no longer available'; errorEl.style.display = 'block'; giftBtn.disabled = false; return; }
            r.cashBalanceMYR = (r.cashBalanceMYR===Infinity)? Infinity : Number(((r.cashBalanceMYR||0) + amt).toFixed(2));
            // ledger idempotency
            const idKey = 'gift_' + nowISO().replace(/[:.]/g,'') + '_' + pseudoHash(); if(!ledgerHasEntry(r, idKey)){
              try{ pushActivity(r.email, { type:'ADMIN_GIFT', amount:amt, from: ADMIN_EMAIL, txHash: pseudoHash(), time: nowISO() }); }catch(e){}
              try{ recordLedger(r, { id: idKey, type:'ADMIN_GIFT_IN', amount: Number(amt), fee:0, balanceAfter: r.cashBalanceMYR, note: 'Admin gift', ts: nowISO() }); }catch(e){}
            }
            upsertUser(r);
            try{ pushPortfolioSnapshot(r.email); }catch(e){}
            // mirrored admin audit (optional)
            const adminAcct = findUser(ADMIN_EMAIL); if(adminAcct){ try{ pushActivity(ADMIN_EMAIL, { type:'ADMIN_GIFT_OUT', to: r.email, amount: amt, txHash: pseudoHash(), time: nowISO() }); }catch(e){} try{ recordLedger(adminAcct, { id: 'adminout_'+pseudoHash(), type:'ADMIN_GIFT_OUT', amount: Number(-amt), note: `Gifted to ${r.email}`, ts: nowISO() }); }catch(e){} }
            // refresh UI
            const newMetrics = recomputeAdminMetrics(); const kEl = panel.querySelector('#adminKpis'); if(kEl) kEl.innerHTML = `<div>Users: <strong>${newMetrics.usersCount}</strong></div><div>AUM: <strong>${fmtMYR(newMetrics.AUM)}</strong></div><div>Avg Ticket (30d): <strong>${fmtMYR(newMetrics.avgTicket)}</strong></div>`;
            renderAdminOverviewCharts(); renderAdminUsersTable(); renderActivityTable(); renderDashboard();
            toast(`Gifted RM${amt} to ${r.email}`,'success');
          }catch(err){ console.error('Gift failed', err); toast('Gift failed','warn'); }
          finally{ giftBtn.disabled = false; }
        });
        // refresh list when users change (cross-tab)
        window.addEventListener('storage', (e)=>{ if(e.key === USERS_KEY || e.key===null){ renderComboboxResults(combo.value||''); } });
      }
    }catch(e){ console.warn('Admin gift wiring failed', e); }
    // wire search & export
    panel.querySelector('#adminUserSearch')?.addEventListener('input', (e)=>{ renderAdminUsersTable(e.target.value); });
    // panel.querySelector('#adminExportCsv')?.addEventListener('click', ()=>{ const rows = collectAdminUserRows(); downloadCSV(rows, 'admin-users.csv'); });
  }

  function renderAdminOverviewCharts(){ // donut allocation & AUM line (monthly snapshots)
    const allocData = calcAggregateAllocation();
    const alloc = allocData.alloc;
    const labels = Object.keys(alloc);
    const values = labels.map(k=>Number((alloc[k]||0).toFixed(2)));
    // donut
    try{
      const ctx = document.getElementById('adminDonut')?.getContext('2d');
      if(ctx){
        if(window.adminDonutChart) window.adminDonutChart.destroy();
        const donutConfig = {
          type: 'doughnut',
          data: { labels, datasets: [{ data: values, backgroundColor: ['#0b66ff','#00b37a','#ffb020','#7c3aed','#c7cdd6'] }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        };
        window.adminDonutChart = new Chart(ctx, donutConfig);
      }
    }catch(e){ console.warn(e); }

    // aum monthly line: load history, or create demo if none
    try{
      const ctx2 = document.getElementById('adminAumLine')?.getContext('2d');
      if(ctx2){
        const hist = getAumHistoryMonthly();
        let months = Object.keys(hist).sort();
        if(months.length===0){
          // Fallback: compute current total across users (holdings + cash)
          const users = getAllNonAdminUsers();
          let totalNow = 0; users.forEach(u=>{
            const holdings = Object.entries(u.holdings||{});
            let pv = 0; holdings.forEach(([sym,h])=>{ pv += (h.qty||0) * getLastPrice(sym); });
            const cash = (u.cashBalanceMYR===Infinity)? 0 : (u.cashBalanceMYR||0);
            totalNow += pv + cash;
          });
          const key = new Date().toISOString().slice(0,7);
          hist[key] = Number(totalNow.toFixed(2));
          months = [key];
        }
        const values2 = months.map(k=> Number(hist[k]||0));
        if(window.adminAumChart) window.adminAumChart.destroy();
        const aumConfig = {
          type: 'line',
          data: { labels: months, datasets: [{ label: 'AUM', data: values2, fill: true, backgroundColor: 'rgba(11,102,255,0.08)', borderColor: '#0b66ff' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        };
        window.adminAumChart = new Chart(ctx2, aumConfig);
      }
    }catch(e){ console.warn(e); }
  }

  // Aggregate AUM monthly from user portfolio snapshots
  function getAumHistoryMonthly(){
    try{
      const users = getAllNonAdminUsers();
      const map = {};
      users.forEach(u=>{
        (u.snapshots||[]).forEach(s=>{
          try{
            const d = new Date(s.ts);
            if(isNaN(d.getTime())) return;
            const key = d.toISOString().slice(0,7);
            const total = Number(s.total||0);
            map[key] = Number(((map[key]||0) + total).toFixed(2));
          }catch(_){ }
        });
      });
      return map;
    }catch(err){ console.warn('getAumHistoryMonthly failed', err); return {}; }
  }

  function collectAdminUserRows(){ const users = getAllNonAdminUsers(); const rows = [['Email','Username','Cash (MYR)','Portfolio Value (MYR)','Premium','Last Active']]; users.forEach(u=>{ const profile = { cash: u.cashBalanceMYR||0 }; const holdings = Object.entries(u.holdings||{}).map(([sym,h])=>({ symbol: sym, qty: h.qty, avgCost: h.avgPrice })); const pv = calcPortfolioValue(holdings); const prem = u.premiumActive? 'Pro' : (u.premiumRoboActive? 'Starter' : '-'); rows.push([ u.email, u.username || '', fmtMYR(profile.cash), fmtMYR(pv), prem, u.lastActive || '' ]); }); return rows; }
  function downloadCSV(rows, filename){ const csv = rows.map(r=> r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

  function renderAdminUsersTable(filter=''){ const users = getAllNonAdminUsers(); const panel = document.querySelector('[data-content="admin"]'); if(!panel) return; const container = panel.querySelector('#adminUsersTable'); if(!container) return; const f = (filter||'').toLowerCase(); const rows = users.filter(u=> !f || (u.email||'').toLowerCase().includes(f) || (u.username||'').toLowerCase().includes(f)); let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Email</th><th>Username</th><th>Cash</th><th>Portfolio</th><th>Premium</th><th>Last Active</th><th></th></tr></thead><tbody>'; rows.forEach(u=>{ const holdings = Object.entries(u.holdings||{}).map(([sym,h])=>({ symbol:sym, qty:h.qty, avgCost:h.avgPrice })); const pv = calcPortfolioValue(holdings); const prem = u.premiumActive? 'Pro' : (u.premiumRoboActive? 'Starter' : '-'); html += `<tr><td>${u.email}</td><td>${u.username||''}</td><td>${fmtMYR(u.cashBalanceMYR||0)}</td><td>${fmtMYR(pv)}</td><td>${prem}</td><td>${u.lastActive||''}</td><td><button class=\"btn btn-ghost adminOpenUser\" data-email=\"${u.email}\">Open</button></td></tr>`; }); html += '</tbody></table>'; container.innerHTML = html; // wire Open buttons
    container.querySelectorAll('.adminOpenUser').forEach(b=> b.addEventListener('click', (e)=>{ const email = e.currentTarget.dataset.email; openAdminUserDetail(email); })); }

  function openAdminUserDetail(email){ const panel = document.querySelector('[data-content="admin"]'); if(!panel) return; const detail = panel.querySelector('#adminUserDetail'); if(!detail) return; detail.classList.remove('hidden'); const state = getUserState(email); if(!state){ detail.innerHTML = '<p class="muted">User not found</p>'; return; }
    detail.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h4>User: ${state.profile.email}</h4><button id="closeUserDetail" class="btn btn-ghost">Close</button></div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-top:12px">
        <div>
          <div class="card"><h5>Holdings</h5><div id="detailHoldings"></div></div>
        </div>
        <div>
          <div class="card"><h5>Profile</h5><div id="detailProfile"></div></div>
        </div>
        <div class="card" style="margin-top:8px; grid-column: 1 / -1">
          <h5>Transactions</h5>
          <div id="detailLedger"></div>
        </div>
      </div>`;
    // fill holdings, ledger, profile
    renderAdminUserHoldings(state); renderAdminUserLedger(state); renderAdminUserProfile(state);
    detail.querySelector('#closeUserDetail')?.addEventListener('click', ()=>{ detail.classList.add('hidden'); });
  }

  function renderAdminUserHoldings(state){ const el = document.getElementById('detailHoldings'); if(!el) return; const holdings = state.holdings || []; if(holdings.length===0){ el.innerHTML = '<p class="muted">No holdings</p>'; return; } let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>Last</th><th>Value</th><th>P&L</th></tr></thead><tbody>'; holdings.forEach(h=>{ const last = getLastPrice(h.symbol); const value = Number((h.qty * last).toFixed(2)); const cost = Number((h.qty * (h.avgCost||0)).toFixed(2)); const pnl = Number((value - cost).toFixed(2)); html += `<tr><td>${h.symbol}</td><td>${h.qty.toFixed(6)}</td><td>${h.avgCost?fmtMYR(h.avgCost):'-'}</td><td>${fmtMYR(last)}</td><td>${fmtMYR(value)}</td><td class="${pnl>=0?'price-up':'price-down'}">${fmtMYR(pnl)}</td></tr>`; }); html += '</tbody></table>'; el.innerHTML = html; }

  function renderAdminUserLedger(state){
    const el = document.getElementById('detailLedger'); if(!el) return; const allRows = state.ledger || [];
    if(allRows.length===0){ el.innerHTML = '<p class="muted">No transactions</p>'; return; }

    // Derive filter option sets
    const typeSet = new Set();
    const symbolSet = new Set();
    const yearSet = new Set();
    const monthSet = new Set(); // month numbers actually present (0-11)
    allRows.forEach(r=>{ if(r.type) typeSet.add(r.type); if(r.symbol) symbolSet.add(r.symbol); const d = new Date(r.ts); if(!isNaN(d.getTime())){ yearSet.add(d.getFullYear()); monthSet.add(d.getMonth()); } });
    const typeOptions = Array.from(typeSet).sort();
    const symbolOptions = Array.from(symbolSet).sort();
    const yearOptions = Array.from(yearSet).sort((a,b)=>a-b);
    const monthOptions = Array.from(monthSet).sort((a,b)=>a-b);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Preserve previous filter values if re-rendering
    const prev = el.querySelector('.admin-ledger-filters');
    let prevVals = {};
    if(prev){
      prevVals = {
        type: prev.querySelector('select[data-f="type"]')?.value || '',
        symbol: prev.querySelector('select[data-f="symbol"]')?.value || '',
        year: prev.querySelector('select[data-f="year"]')?.value || '',
        month: prev.querySelector('select[data-f="month"]')?.value || '',
        search: prev.querySelector('input[data-f="search"]')?.value || ''
      };
    }

    el.innerHTML = `<div class="admin-ledger-filters" style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px;align-items:flex-end;justify-content:center;width:100%">
      <div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;color:#0b1a2b">Type</label><select data-f="type" style="min-width:120px;font-size:16px;padding:8px 10px;border-radius:10px;border:1px solid rgba(11,22,34,0.12)"><option value="">All</option>${typeOptions.map(t=>`<option value="${t}">${statementDisplayType? statementDisplayType(t):t}</option>`).join('')}</select></div>
      <div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;color:#0b1a2b">Symbol</label><select data-f="symbol" style="min-width:100px;font-size:16px;padding:8px 10px;border-radius:10px;border:1px solid rgba(11,22,34,0.12)"><option value="">All</option>${symbolOptions.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
      <div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;color:#0b1a2b">Year</label><select data-f="year" style="min-width:90px;font-size:16px;padding:8px 10px;border-radius:10px;border:1px solid rgba(11,22,34,0.12)"><option value="">All</option>${yearOptions.map(y=>`<option value="${y}">${y}</option>`).join('')}</select></div>
      <div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;color:#0b1a2b">Month</label><select data-f="month" style="min-width:90px;font-size:16px;padding:8px 10px;border-radius:10px;border:1px solid rgba(11,22,34,0.12)"><option value="">All</option>${monthOptions.map(m=>`<option value="${m}">${monthNames[m]}</option>`).join('')}</select></div>
      <div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;color:#0b1a2b">Search</label><input data-f="search" placeholder="Type / Symbol / Note" style="min-width:220px;font-size:16px;padding:8px 10px;border-radius:10px;border:1px solid rgba(11,22,34,0.12)" /></div>
    </div><div class="admin-ledger-table"></div>`;

    // Restore previous values if any
    const fType = el.querySelector('select[data-f="type"]'); if(fType && prevVals.type) fType.value = prevVals.type;
    const fSymbol = el.querySelector('select[data-f="symbol"]'); if(fSymbol && prevVals.symbol) fSymbol.value = prevVals.symbol;
    const fYear = el.querySelector('select[data-f="year"]'); if(fYear && prevVals.year) fYear.value = prevVals.year;
    const fMonth = el.querySelector('select[data-f="month"]'); if(fMonth && prevVals.month) fMonth.value = prevVals.month;
    const fSearch = el.querySelector('input[data-f="search"]'); if(fSearch && prevVals.search) fSearch.value = prevVals.search;

    function applyFilters(){
      const typeVal = fType.value;
      const symbolVal = fSymbol.value;
      const yearVal = fYear.value;
      const monthVal = fMonth.value;
      const searchVal = (fSearch.value||'').toLowerCase();
      let filtered = allRows.slice();
      if(typeVal) filtered = filtered.filter(r=> r.type===typeVal);
      if(symbolVal) filtered = filtered.filter(r=> r.symbol===symbolVal);
      if(yearVal) filtered = filtered.filter(r=>{ const d=new Date(r.ts); return !isNaN(d.getTime()) && d.getFullYear().toString()===yearVal; });
      if(monthVal) filtered = filtered.filter(r=>{ const d=new Date(r.ts); return !isNaN(d.getTime()) && d.getMonth().toString()===monthVal; });
      if(searchVal) filtered = filtered.filter(r=>{
        const note = (r.note||'').toLowerCase();
        const sym = (r.symbol||'').toLowerCase();
        const typ = (r.type||'').toLowerCase();
        return note.includes(searchVal) || sym.includes(searchVal) || typ.includes(searchVal);
      });
      renderTable(filtered);
    }

    function renderTable(rows){
      // Format similar to Statement tab: Date | Time | Type | Symbol | Qty | Price / Unit | Amount
      const monthsFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Symbol</th><th>Qty</th><th>Price / Unit</th><th>Amount (RM)</th></tr></thead><tbody>';
      rows.forEach(r=>{
        const dt = new Date(r.ts);
        const dateStr = isNaN(dt.getTime())? (r.ts||'') : `${dt.getDate()} ${monthsFull[dt.getMonth()]} ${dt.getFullYear()}`;
        const timeStr = isNaN(dt.getTime())? '' : dt.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        const amtRaw = (r.amountIn? r.amountIn : 0) - (r.amountOut? r.amountOut : 0);
        const amtStr = fmtMYR(Math.abs(amtRaw));
        let qtyStr = '';
        if(r.qty || r.qty===0){ const qNum = Number(r.qty); qtyStr = (Math.abs(qNum - Math.round(qNum)) < 1e-9) ? String(Math.round(qNum)) : qNum.toFixed(6).replace(/\.0+$/,'').replace(/(\.[0-9]*?)0+$/,'$1'); }
        const priceStr = r.price? fmtMYR(Number(r.price)) : '';
        html += `<tr title="Running balance: ${fmtMYR(r.balance||0)}">
          <td style="padding:4px 8px">${dateStr}</td>
          <td style="padding:4px 8px">${timeStr}</td>
          <td style="padding:4px 8px">${statementDisplayType? statementDisplayType(r.type) : (r.type||'')}</td>
          <td style="padding:4px 8px">${r.symbol||''}</td>
          <td style="padding:4px 8px">${qtyStr}</td>
          <td style="padding:4px 8px">${priceStr}</td>
          <td style="padding:4px 8px" class="${amtRaw>=0?'price-up':'price-down'}">${amtStr}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      el.querySelector('.admin-ledger-table').innerHTML = html;
      // Show count summary
      const existingSummary = el.querySelector('.admin-ledger-summary');
      if(existingSummary) existingSummary.remove();
      const summary = document.createElement('div');
      summary.className = 'admin-ledger-summary';
  summary.style.cssText = 'font-size:16px;margin:8px 0;opacity:0.8;text-align:center;color:#6b7280';
      summary.textContent = `${rows.length} transaction${rows.length!==1?'s':''} shown`;
      el.insertBefore(summary, el.firstChild.nextSibling); // after filters
    }

    // Wire events
    [fType, fSymbol, fYear, fMonth].forEach(sel=> sel && sel.addEventListener('change', applyFilters));
    if(fSearch){ fSearch.addEventListener('input', ()=>{ applyFilters(); }); }
  // Reset button removed per request; adjust filters directly to refine results.

    // Initial render
    applyFilters();
  }

  function renderAdminUserProfile(state){ const el = document.getElementById('detailProfile'); if(!el) return; el.innerHTML = `<div><strong>Email:</strong> ${state.profile.email}</div><div><strong>Username:</strong> ${state.profile.username||''}</div><div><strong>Premium:</strong> ${state.profile.premium? 'Yes':'No'}</div><div><strong>Created:</strong> ${state.profile.createdAt? new Date(state.profile.createdAt).toLocaleString() : '-'}</div><div><strong>Last Active:</strong> ${state.profile.lastActive|| '-'}</div>`; }

  // -------------------- Statement (ledger-based) --------------------
  function getUserLedger(email){ const u = findUser(email); if(!u) return []; if(!u.ledger || !Array.isArray(u.ledger) || u.ledger.length===0){ // attempt migration on demand
      migrateActivityToLedger(); const refreshed = findUser(email); return (refreshed && refreshed.ledger) ? refreshed.ledger : []; } return u.ledger; }

  // Backfill: If a user already has a ledger but it's missing core entries (e.g., buys/sells/cash-ins/gifts),
  // reconcile from activity without creating duplicates. This is safe to run often.
  function backfillLedgerFromActivityFor(email, range){ try{
    const u = findUser(email); if(!u) return; u.ledger = Array.isArray(u.ledger)? u.ledger : [];
    const acts = Array.isArray(u.activity)? u.activity : [];
    // Build a signature set to detect duplicates: ts|type|symbol|qty|price|amount
    const sig = new Set();
    u.ledger.forEach(r=>{ const key = [r.ts, r.type, r.symbol||'', Number(r.qty||0), Number(r.price||0), Number(r.amount||0)].join('|'); sig.add(key); });
    // Map activity -> normalized candidate ledger rows
    const candidates = [];
    acts.forEach(a=>{
      try{
        const ts = a.time || a.t; // require an activity timestamp; skip if missing to avoid wrong month injection
        if(!ts) return;
        const tt = new Date(ts).getTime();
        if(range && (isFinite(range.start) && tt < range.start || isFinite(range.end) && tt >= range.end)) return;
        if(a.type && (a.type.includes('BUY') || a.type==='MARKET_BUY' || a.type==='FRACTIONAL_BUY' || a.type==='DIY_BUY')){
          const qty = Number(a.qty || 0); const price = Number(a.price || 0); const amount = -(Math.abs(Number(a.amount || (qty*price) || 0)) + (a.fee||0));
          const isSh = a.type==='BUY_SHARIAH' || /SHARIAH/i.test(a.type||'');
          candidates.push({ ts, type: (isSh? 'BUY_SHARIAH':'BUY'), symbol: a.symbol, qty: Number(qty.toFixed(6)), price: Number(price), amount: Number(amount.toFixed(2)), fee: a.fee||0 });
        } else if(a.type && (a.type.includes('SELL') || a.type==='MARKET_SELL' || a.type==='FRACTIONAL_SELL' || a.type==='DIY_SELL')){
          const qty = Number(a.qty || 0); const price = Number(a.price || 0); const amount = Math.abs(Number(a.amount || (qty*price) || 0)) - (a.fee||0);
          const isSh = a.type==='SELL_SHARIAH' || /SHARIAH/i.test(a.type||'');
          candidates.push({ ts, type: (isSh? 'SELL_SHARIAH':'SELL'), symbol: a.symbol, qty: Number((-Math.abs(qty)).toFixed(6)), price: Number(price), amount: Number(amount.toFixed(2)), fee: a.fee||0 });
        } else if(a.type && (a.type==='DEPOSIT' || a.type==='CASH_IN')){
          candidates.push({ ts, type:'CASH_IN', amount: Number(a.amount||0) });
        } else if(a.type && (a.type==='ADMIN_GIFT' || a.type==='ADMIN_GIFT_IN')){
          candidates.push({ ts, type:'ADMIN_GIFT_IN', amount: Number(a.amount||0) });
        } else if(a.type && (a.type==='PREMIUM_CHARGE' || a.type==='PREMIUM_ACTIVATED')){
          candidates.push({ ts, type:'PREMIUM_SUB', amount: -Math.abs(Number(a.amount||20)) });
        } else if(a.type && (a.type==='PREMIUM_CANCELLED' || a.type==='PREMIUM_CANCEL')){
          candidates.push({ ts, type:'PREMIUM_UNSUB', amount: 0 });
        } else {
          // skip MARKET_EVENT and other noise here (we don't backfill them)
        }
      }catch(_){ /* ignore */ }
    });
    // Insert non-duplicates (newest-first at the top like other ledger pushes)
    let inserted = 0;
  candidates.forEach(c=>{ const key = [c.ts, c.type, c.symbol||'', Number(c.qty||0), Number(c.price||0), Number(c.amount||0)].join('|'); if(!sig.has(key)){ recordLedger(u, c); sig.add(key); inserted++; } });
    if(inserted>0){ upsertUser(findUser(email)); }
  }catch(e){ console.warn('backfillLedgerFromActivityFor failed', e); } }

  // Persist a lightweight portfolio snapshot on important state changes.
  // Snapshot shape: { ts: ISOString, total: Number }
  function pushPortfolioSnapshot(email, ts){ try{ const user = findUser(email); if(!user) return null; const market = JSON.parse(localStorage.getItem(MARKET_KEY)||'{}'); const pv = Number((portfolioValue(user, market) || 0).toFixed(2)); const cash = (user.cashBalanceMYR===Infinity)? 0 : Number((user.cashBalanceMYR||0).toFixed(2)); const total = Number((pv + cash).toFixed(2)); const now = ts || nowISO(); user.snapshots = user.snapshots || []; // ensure sorted by time ascending
      user.snapshots.sort((a,b)=> new Date(a.ts).getTime() - new Date(b.ts).getTime()); // dedupe by date (one snapshot per day)
      const day = now.slice(0,10); const last = user.snapshots.length? user.snapshots[user.snapshots.length-1] : null; if(last && last.ts && last.ts.slice(0,10) === day){ // update
        last.ts = now; last.total = total; } else { user.snapshots.push({ ts: now, total }); }
      upsertUser(user); return user.snapshots[user.snapshots.length-1] || null; }catch(e){ console.warn('pushPortfolioSnapshot failed', e); return null; } }

  function reconstructHoldingsUpTo(email, cutoffTs){ // replay ledger up to cutoff (exclusive) to compute held qty and avgCost per symbol
    const ledger = getUserLedger(email).slice().reverse(); // oldest -> newest
    const state = {};
    ledger.forEach(row=>{
      const t = new Date(row.ts).getTime(); if(t >= cutoffTs) return; if(!row.type) return;
      const type = row.type;
      if(type==='BUY' || type==='BUY_SHARIAH'){
        const qty = Number(row.qty||0); const price = Number(row.price||0);
        state[row.symbol] = state[row.symbol]||{qty:0,avg:0};
        const prev = state[row.symbol];
        const newQty = prev.qty + qty;
        const newAvg = prev.qty? ((prev.qty*prev.avg) + (qty*price))/newQty : price;
        state[row.symbol] = { qty: Number(newQty.toFixed(6)), avg: Number(newAvg.toFixed(6)) };
      } else if(type==='SELL' || type==='SELL_SHARIAH'){
        const qty = Math.abs(Number(row.qty||0));
        state[row.symbol] = state[row.symbol]||{qty:0,avg:0};
        const prev = state[row.symbol];
        const newQty = Math.max(0, prev.qty - qty);
        state[row.symbol] = { qty: Number(newQty.toFixed(6)), avg: prev.qty>qty ? prev.avg : 0 };
      }
    });
    return state;
  }

  // -------------------- Admin: user deletion decorators & helper --------------------
  // Adds Delete buttons to the Admin Users table rows (safe enhancement without changing the HTML generator)
  function ensureAdminDeleteButtons(){ try{
      const panel = document.querySelector('[data-content="admin"]'); if(!panel) return; const container = panel.querySelector('#adminUsersTable'); if(!container) return; const table = container.querySelector('table'); if(!table) return; const sess = getSession(); const curUser = sess && findUser(sess.email); const isAdminUser = curUser && ( (String(curUser.email||'').toLowerCase()===ADMIN_EMAIL) || curUser.isAdmin === true || curUser.role==='admin'); if(!isAdminUser) return; const rows = table.querySelectorAll('tbody tr'); rows.forEach(r=>{ try{ const emailCell = r.querySelector('td'); if(!emailCell) return; const email = (emailCell.textContent||'').trim(); // skip seeded admin and current admin
            if(!email) return; if(String(email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase()) return; if(curUser && String(curUser.email||'').toLowerCase() === String(email).toLowerCase()) return; // ensure action cell exists
            const actionCell = r.querySelector('td:last-child'); if(!actionCell) return; // if delete button already present, skip
            if(actionCell.querySelector('.adminDeleteUser')) return; const del = document.createElement('button'); del.className = 'btn btn-danger adminDeleteUser'; del.type = 'button'; del.dataset.email = email; del.style.marginLeft = '8px'; del.textContent = 'Delete'; del.addEventListener('click', (ev)=>{ try{ ev.preventDefault(); if(!confirm(`Delete user ${email}? This will permanently remove the account and all associated data.`)) return; deleteUserByEmail(email); }catch(err){ console.warn(err); } }); actionCell.appendChild(del);
        }catch(e){} }); }catch(e){ console.warn('ensureAdminDeleteButtons failed', e); } }

  // Delete a user by email (admin-only). Prevent deleting the seeded admin or the currently signed-in admin.
  function deleteUserByEmail(email){ if(!email) return; try{ const s = getSession(); const cur = s && findUser(s.email); if(cur && (String(cur.email||'').toLowerCase() === String(email||'').toLowerCase())){ toast('Cannot delete the currently signed-in admin','warn'); return; } if(String(email||'').toLowerCase() === ADMIN_EMAIL){ toast('Cannot delete the seeded admin account','warn'); return; }
      // remove user from storage
      const all = loadUsers() || []; const remaining = all.filter(u=> (u.email||'').toLowerCase() !== String(email||'').toLowerCase()); saveUsers(remaining);
      // refresh admin UI
      try{ renderAdminUsersTable(); renderAdminSummary(); renderAdminOverviewCharts(); }catch(e){}
      // notify other tabs/windows
      try{ localStorage.setItem('pw_users_changed_at', new Date().toISOString()); }catch(e){}
      toast(`Deleted user ${email}`,'success'); }catch(e){ console.error('deleteUserByEmail', e); toast('Failed to delete user','warn'); } }

  // Periodically ensure delete buttons are present when Admin tab is active.
  setInterval(()=>{ try{ const active = localStorage.getItem('pw_tab') || ''; if(active !== 'admin') return; ensureAdminDeleteButtons(); }catch(e){} }, 1000);


  function formatTypeLabel(t){
    if(!t) return '';
    if(t==='CASH_IN') return 'Cash-in';
    if(t==='ADMIN_GIFT' || t==='ADMIN_GIFT_IN') return 'Gift';
    if(t.includes('BUY')) return t.includes('SHARIAH')? 'Buy (Shariah)' : 'Buy';
    if(t.includes('SELL')) return t.includes('SHARIAH')? 'Sell (Shariah)' : 'Sell';
    if(t==='PREMIUM_SUB' || t==='PREMIUM_ROBO_SUB') return 'Premium (sub)';
    if(t==='PREMIUM_UNSUB' || t==='PREMIUM_ROBO_UNSUB') return 'Premium (unsub)';
    if(t==='FEE') return 'Fee';
    if(t==='DIVIDEND') return 'Dividend';
    return t;
  }



})();
