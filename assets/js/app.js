// App interactions: modal, mobile nav, KPI counters, load data
/* App interactions: marketing modal, auth, session persistence, dashboard toggles, KPI counters, charts */
(function(){
  const yearEl = document.getElementById('year'); if(yearEl) yearEl.textContent = new Date().getFullYear();

  // Simple app state
  const STATE = { user: null };

  // Elements
  const modal = document.getElementById('modalOverlay');
  const marketing = document.getElementById('marketing');
  const appShell = document.getElementById('app-shell');
  const startBtns = [document.getElementById('openPremium'), /* openPremium2 intentionally excluded from modal open list */ document.getElementById('upgradePremium'), document.getElementById('startJourney'), document.getElementById('subscribeStarter'), document.getElementById('subscribePro')];
  const logo = document.querySelector('.brand');

  // mobile nav
  const mobileToggle = document.querySelector('.mobile-toggle');
  mobileToggle?.addEventListener('click', ()=>{
    const nav = document.querySelector('.main-nav ul');
    const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
    mobileToggle.setAttribute('aria-expanded', String(!expanded));
    nav.style.display = expanded ? 'none' : 'flex';
  });

  // Open modal when clicking start CTAs or logo
  function bindOpeners(){
    startBtns.forEach(b=>b?.addEventListener('click', (e)=>{
      // store intended plan for later use in app post-signup
      try{
        const id = e?.currentTarget?.id || '';
        if(id==='subscribeStarter') localStorage.setItem('pw_intended_plan','starter');
        if(id==='subscribePro') localStorage.setItem('pw_intended_plan','pro');
      }catch(_){ }
      showModal();
    }));
    document.getElementById('openPremium')?.addEventListener('click', ()=>showModal());
    // "Why Premium?" button (openPremium2) scrolls to Premium section instead of opening modal
    const whyBtn = document.getElementById('openPremium2');
    if(whyBtn){
      whyBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const target = document.getElementById('premium');
        if(target){
          target.scrollIntoView({ behavior:'smooth', block:'start' });
          // brief highlight effect
          target.classList.add('pulse-highlight');
          setTimeout(()=> target.classList.remove('pulse-highlight'), 1600);
        }
      });
    }
    logo?.addEventListener('click', (e)=>{ e.preventDefault(); showModal(); });
  }
  bindOpeners();

  // Modal controls
  function showModal(){ if(!modal) return; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); }
  function hideModal(){ if(!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }
  document.getElementById('closeModal')?.addEventListener('click', hideModal);
  window.addEventListener('click', (e)=>{ if(e.target === modal) hideModal(); });

  // ---- Demo auth helpers (unified with app-core) ----
  const USERS_KEY = 'pw_users';
  const SESSION_KEY = 'pw_session';
  const getSession = () => { try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null } };
  const setSession = s => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  function loadUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }catch(e){ return []; } }
  function saveUsers(users){ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  function findUserByEmail(email){ if(!email) return null; return loadUsers().find(a => a.email.toLowerCase() === email.toLowerCase()); }
  function upsertUser(user){ const all = loadUsers(); const idx = all.findIndex(a=>a.email.toLowerCase()===user.email.toLowerCase()); if(idx>=0){ all[idx]=user } else { all.push(user); } saveUsers(all); }

  // ---- App/marketing toggles ----
  function showApp(email){
    document.body.classList.add('app-mode');
    document.getElementById('app-shell')?.classList.remove('hidden');
    document.getElementById('userEmail') && (document.getElementById('userEmail').textContent = email || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showMarketing(){
    document.body.classList.remove('app-mode');
    document.getElementById('app-shell')?.classList.add('hidden');
  }

  // ---- Entry points open modal (logo / CTAs) ----
  ['#ctaGetStarted', '#ctaStartJourney', '#brandLogo'].forEach(sel=>{
    const el = document.querySelector(sel);
    el && el.addEventListener('click', e=>{
      e.preventDefault();
      const modalEl = document.getElementById('modalOverlay');
      modalEl?.classList.remove('hidden');
      modalEl?.setAttribute('aria-hidden','false');
    });
  });

  // ---- Register/Login via modal ----
  const form = document.getElementById('signupForm');
  const createBtn = document.getElementById('createAccount');
  const signupError = document.getElementById('signupError');
  form && form.addEventListener('submit', e=>{
    e.preventDefault();
    const username = document.getElementById('username')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const pwd = document.getElementById('password')?.value.trim();
    if(!username || !email || !pwd){ if(signupError) signupError.textContent = 'Please provide username, email and password.'; return; }

    // unique email enforcement
    if(findUserByEmail(email)){
      if(signupError) signupError.textContent = '⚠️ This email is already registered. Please log in instead.';
      return;
    }

    // create full user record matching app-core shape
    const user = {
      email: email.toLowerCase(),
      username,
      password: pwd,
      role: 'user',
      cashBalanceMYR: 0,
      premiumActive: false,
       premiumActivatedAt: null,
       premiumHistory: [],
      holdings: {},
      roboPortfolio: { targetWeights: {} },
      activity: [],
      createdAt: Date.now()
    };
    upsertUser(user);
    // set session (pw_session)
    setSession({ email: user.email });

  // Handle intended plan after signup by redirecting to app and letting app-core present the proper premium tab
  try{ const plan = localStorage.getItem('pw_intended_plan'); if(plan){ localStorage.setItem('pw_after_signup_open_tab','premium'); localStorage.setItem('pw_after_signup_plan', plan); } }catch(_){ }

    if(signupError) signupError.textContent = '';
    if(createBtn){ createBtn.classList.add('success'); createBtn.textContent = 'Account created'; }
    setTimeout(()=>{
      if(createBtn){ createBtn.classList.remove('success'); createBtn.textContent = 'Create account'; }
       window.location.href = 'app.html';
    }, 700);
  });

  // Login modal handlers
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginButton = document.getElementById('loginButton');
  const closeLogin = document.getElementById('closeLogin');
  const btnSignInTop = document.getElementById('btnSignInTop');

  // open login modal
  btnSignInTop?.addEventListener('click', ()=>{
    loginOverlay?.classList.remove('hidden');
    loginOverlay?.setAttribute('aria-hidden','false');
  });
  closeLogin?.addEventListener('click', ()=>{ loginOverlay?.classList.add('hidden'); loginOverlay?.setAttribute('aria-hidden','true'); });
  window.addEventListener('click', (e)=>{ if(e.target === loginOverlay) { loginOverlay?.classList.add('hidden'); loginOverlay?.setAttribute('aria-hidden','true'); } });

  loginForm && loginForm.addEventListener('submit', e=>{
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const pwd = document.getElementById('loginPassword')?.value.trim();
    if(!email || !pwd){ if(loginError) loginError.textContent = 'Please enter email and password.'; return; }

    const acct = findUserByEmail(email);
    if(!acct || acct.password !== pwd){ if(loginError) loginError.textContent = 'Invalid email or password. Please try again.'; return; }

    // success: set session and redirect
    setSession({ email: acct.email });
    // If user arrived via subscribe CTA, carry intent to app to open Premium tab
    try{ const plan = localStorage.getItem('pw_intended_plan'); if(plan){ localStorage.setItem('pw_after_signup_open_tab','premium'); localStorage.setItem('pw_after_signup_plan', plan); } }catch(_){ }
    if(loginError) loginError.textContent = '';
    if(loginButton){ loginButton.classList.add('success'); loginButton.textContent = 'Signing in...'; }
    setTimeout(()=>{ window.location.href = 'app.html'; }, 600);
  });

  // ---- Sign out in the app toolbar ----
  document.getElementById('btnSignOut')?.addEventListener('click', ()=>{
    clearUser();
    // redirect back to landing page
    window.location.href = 'PocketWealth.html';
  });

  // ---- Restore session on load ----
  const existing = getUser();
  existing?.email ? (showApp(existing.email), loadAppData()) : showMarketing();

  // On load, restore session
  function restoreSession(){
    const raw = localStorage.getItem('pw_session');
    if(raw){ try{ const s = JSON.parse(raw); STATE.user = s && (findUserByEmail(s.email) || null); }catch(e){ STATE.user = null; } }
    renderApp();
    if(STATE.user) loadAppData();
  }

  // Render app vs marketing
  function renderApp(){
    if(STATE.user){ marketing?.classList.add('hidden'); appShell?.classList.remove('hidden'); appShell?.setAttribute('aria-hidden','false');
      // show user info
      document.getElementById('userFee').textContent = (STATE.user.feeBps ? (STATE.user.feeBps/100)+'%' : '0.35%');
    }else{ marketing?.classList.remove('hidden'); appShell?.classList.add('hidden'); appShell?.setAttribute('aria-hidden','true'); }
  }

  // KPI counters
  function animateCounters(){
    document.querySelectorAll('.kpi-value').forEach(el=>{
      const target = Number(el.getAttribute('data-target'))||0; const duration = 1200; const start = 0; const stepTime = Math.max(20, Math.floor(duration / target));
      let current = start; const inc = Math.ceil(target/(duration/20));
      const t = setInterval(()=>{
        current = Math.min(target, current + inc);
        el.textContent = current.toLocaleString();
        if(current>=target) clearInterval(t);
      }, 20);
    });
  }

  // Load marketing demo data (charts and KPI counters removed from marketing page)
  fetch('data/demo.json').then(r=>r.json()).then(data=>{
    window.PW_DEMO = data;
    // Marketing KPI counters and charts have been removed from the public site.
  }).catch(err=>{console.warn('demo data failed', err)});

  // Load app-specific data when signed in
  function loadAppData(){
    // fetch ETFs, fees, demo portfolios
    Promise.all([
      fetch('data/etfs.json').then(r=>r.json()),
      fetch('data/fees.json').then(r=>r.json()),
      fetch('data/demo-portfolios.json').then(r=>r.json()),
      fetch('data/learning.json').then(r=>r.json())
    ]).then(([etfs, fees, portfolios, learning])=>{
      window.PW_ETFS = etfs; window.PW_FEES = fees; window.PW_PORTFOLIOS = portfolios; window.PW_LEARN = learning;
      if(window.initAppCharts) window.initAppCharts({portfolios, etfs});
      renderPortfolioSummary();
    }).catch(e=>console.warn('app data failed', e));
  }

  function renderPortfolioSummary(){
    const el = document.getElementById('portfolioSummary');
    if(!el) return;
    // simple placeholder content
    el.innerHTML = `<p><strong>Recommended:</strong> Balanced Portfolio (Moderate risk)</p><p class="muted small">VaR(99%): annual loss unlikely to exceed 12% (simulated)</p>`;
  }

  // wallet float micro interactions
  const wallet = document.querySelector('.wallet-mascot');
  wallet?.addEventListener('pointerenter', ()=>{ wallet.style.transform='translateY(-8px) scale(1.04)'; });
  wallet?.addEventListener('pointerleave', ()=>{ wallet.style.transform=''; });

  // initialize
  restoreSession();

  // FAQ micro-interactions: keyboard accessibility for summaries
  function initFAQ(){
    const container = document.querySelector('.faq-section'); if(!container) return;
    const details = Array.from(container.querySelectorAll('.faq-list details'));
    // allow Enter/Space to toggle and focus the answer for keyboard users
    details.forEach(d=>{
      const s = d.querySelector('summary');
      s?.addEventListener('keydown', e=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); d.open = !d.open; if(d.open){ const p = d.querySelector('p'); if(p){ p.setAttribute('tabindex','-1'); p.focus(); } } }
      });
    });
  }
  // call after short delay to ensure DOM ready
  setTimeout(initFAQ, 120);

})();
