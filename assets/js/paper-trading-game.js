// <PaperTradingGame/> React UMD component for PocketWealth
(function(){
  if(!window.React || !window.ReactDOM) return;
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const e = React.createElement;

  // Symbol list (mock prices from Market tab)
  const SYMBOLS = [
    { ticker:'5681', name:'PETRONAS Dagangan', type:'stock', volatility:'moderate', priceRM:24.50, shariah:true },
    { ticker:'6888', name:'AXIATA Group', type:'stock', volatility:'moderate', priceRM:1.40, shariah:true },
    { ticker:'PWSTK', name:'PocketWealth Stock', type:'stock', volatility:'moderate', priceRM:10.00 },
    { ticker:'PWETF', name:'Pocket ETF', type:'etf', volatility:'low', priceRM:100.00 },
    { ticker:'PWGOLD', name:'Pocket Gold', type:'stock', volatility:'low', priceRM:60.00 },
    { ticker:'0166', name:'INARI Amerton', type:'stock', volatility:'moderate', priceRM:3.60, shariah:true },
    { ticker:'DJIM', name:'Dow Jones Islamic Market ETF', type:'etf', volatility:'low', priceRM:45.20, shariah:true },
    { ticker:'MYSML', name:'Malaysia SmallCaps', type:'stock', volatility:'high', priceRM:5.20 },
    { ticker:'TECHSEA', name:'SEA Technology ETF', type:'etf', volatility:'high', priceRM:18.40 },
    { ticker:'HEALTHMY', name:'Malaysia Healthcare', type:'stock', volatility:'moderate', priceRM:12.75 },
    { ticker:'COMMEX', name:'Commodities Ex-China', type:'etf', volatility:'moderate', priceRM:21.00 },
    { ticker:'OILFUT', name:'Energy & Oil Futures Proxy', type:'etf', volatility:'high', priceRM:34.50 },
    { ticker:'INFRA', name:'Malaysia Infrastructure Fund', type:'etf', volatility:'low', priceRM:27.10 },
    { ticker:'AGROMY', name:'Malaysia Agribusiness', type:'stock', volatility:'moderate', priceRM:6.80 },
    { ticker:'FINBANK', name:'Malaysia Banking Blend', type:'etf', volatility:'moderate', priceRM:14.20 },
    { ticker:'TELEMY', name:'Malaysia Telecoms', type:'stock', volatility:'low', priceRM:8.90 },
    { ticker:'GLOBALESG', name:'Global ESG Leaders', type:'etf', volatility:'moderate', priceRM:47.50 }
  ];
  const VOL_MODEL = {
    low:    { mu: 0.004, sigma: 0.015 },
    moderate:{ mu: 0.006, sigma: 0.03 },
    high:   { mu: 0.01,  sigma: 0.05 }
  };

  // LocalStorage helpers
  const LS_KEY = 'pw_paper_trading_game';
  function loadState(){ try{ return JSON.parse(localStorage.getItem(LS_KEY))||null; }catch(e){ return null; } }
  function saveState(state){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  // leaderboard helper (reads leaderboard from saved game state)
  function loadLeaderboard(){ try{ const s = loadState(); return (s && Array.isArray(s.leaderboard))? s.leaderboard : []; }catch(e){ return []; } }
  // Achievements storage
  const ACH_KEY = 'pw-achievements';
  const DEFAULT_ACHIEVEMENTS = [
    { id:'perf_high_return', section:'Performance', icon:'🚀', name:'High Return', description:'Return ≥ 10%', unlocked:false },
    { id:'perf_positive',   section:'Performance', icon:'📈', name:'Positive Return', description:'Return > 0%', unlocked:false },
    { id:'perf_low_dd',     section:'Performance', icon:'🛡️', name:'Low Drawdown', description:'Max Drawdown ≤ 5%', unlocked:false },
    { id:'strat_diversify', section:'Strategy', icon:'🌐', name:'Diversified', description:'Diversification score ≤ 0.25', unlocked:false },
    { id:'strat_focus',     section:'Strategy', icon:'🎯', name:'Focused', description:'Held 1–2 assets only', unlocked:false },
    { id:'exp_complete_year', section:'Experience', icon:'📅', name:'Completed Year', description:'Simulated 12 months', unlocked:false },
    { id:'exp_play_more',     section:'Experience', icon:'🔁', name:'Repeat Player', description:'Played 3+ games', unlocked:false },
    { id:'learn_variety', section:'Learning', icon:'🧪', name:'Tried Many', description:'Bought 5+ different symbols in one game', unlocked:false }
  ];
  function loadAchievements(){ try{ const x = JSON.parse(localStorage.getItem(ACH_KEY)); return x && Array.isArray(x) ? x : DEFAULT_ACHIEVEMENTS.map(a=> ({...a})); }catch(e){ return DEFAULT_ACHIEVEMENTS.map(a=> ({...a})); } }
  function saveAchievements(list){ localStorage.setItem(ACH_KEY, JSON.stringify(list)); }
  function resetAchievements(){ saveAchievements(DEFAULT_ACHIEVEMENTS.map(a=>({...a}))); }

  // Unlock rules based on result
  // res: { returnPct, maxDDPct, hIndex, holdingsCount, month, gamesPlayed }
  function unlockAchievementsForResult(res){
    const list = loadAchievements();
    const before = list.filter(a=>a.unlocked).map(a=>a.id);
    let changed = false;
    list.forEach(a=>{
      if(a.unlocked) return;
      if(a.id==='perf_high_return' && res.returnPct>=10) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='perf_positive' && res.returnPct>0) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='perf_low_dd' && res.maxDDPct<=5) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='strat_diversify' && typeof res.hIndex==='number' && res.hIndex<=0.25) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='strat_focus' && res.holdingsCount>0 && res.holdingsCount<=2) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='exp_complete_year' && res.month>=12) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='exp_play_more' && res.gamesPlayed>=3) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
      if(a.id==='learn_variety' && res.holdingsCount>=5) { a.unlocked=true; a.unlockedAt=new Date().toISOString(); changed=true; }
    });
    if(changed) {
      saveAchievements(list);
      const after = list.filter(a=>a.unlocked).map(a=>a.id);
      const newly = after.filter(id=>!before.includes(id));
      // dispatch custom event so UI can animate
      try{ window.dispatchEvent(new CustomEvent('pw:achievements-updated',{detail:{list, newly}})); }catch(e){}
    }
    return list;
  }

  // Utility
  function fmtMYR(v){ return 'RM ' + Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function randLogNormal(mu, sigma){
    // lognormal step: exp(mu + sigma*N(0,1))
    let n = Math.random();
    let z = Math.sqrt(-2*Math.log(n))*Math.cos(2*Math.PI*n);
    return Math.exp(mu + sigma*z);
  }
  function herfindahl(holdings){
    const total = holdings.reduce((s,h)=>s+h.value,0)||1;
    return holdings.reduce((s,h)=>s+Math.pow(h.value/total,2),0);
  }

  // Detect if current session user is a Starter or Pro subscriber
  function isSubscribed(){
    try{
      const raw = localStorage.getItem('pw_session');
      if(!raw) return false;
      const s = JSON.parse(raw);
      if(!s || !s.email) return false;
      const users = JSON.parse(localStorage.getItem('pw_users') || '[]');
      const user = users.find(u=> (u.email||'').toLowerCase() === (s.email||'').toLowerCase());
      return !!(user && (user.premiumActive || user.premiumRoboActive));
    }catch(e){ return false; }
  }

  // Main component
  function PaperTradingGame(){
    // State machine: idle → running → finished
    const [state, setState] = React.useState(()=>loadState()||{
      phase:'idle', cash:10000, holdings:[], watchlist:[], month:0, history:[], leaderboard:loadState()?.leaderboard||[]
    });
    const [search, setSearch] = React.useState('');
  const [showRules, setShowRules] = React.useState(false);
  const [showInlineRules, setShowInlineRules] = React.useState(true);
  const [orderQty, setOrderQty] = React.useState({});
  const [buyModal, setBuyModal] = React.useState(null); // {ticker,name,priceRM,volatility,qty}
  const [showColor, setShowColor] = React.useState(false);

  // Risk vs Reward Simulator state
  const [riskLevel, setRiskLevel] = React.useState(5); // 1-10
  const [investAmount, setInvestAmount] = React.useState(1000); // RM
  const [timeHorizon, setTimeHorizon] = React.useState(12); // months
  const [simSeries, setSimSeries] = React.useState([]); // full generated series
  const [displaySeries, setDisplaySeries] = React.useState([]); // for animation
  const [simulating, setSimulating] = React.useState(false);
  const [simMetrics, setSimMetrics] = React.useState(null);

  // Generate a simulated price series based on riskLevel, timeHorizon and invest amount
  function generateSimulation(){
    const months = Math.max(1, Math.round(timeHorizon));
    const base = Number(investAmount) || 1000;
    // riskLevel 1..10 maps to mu and sigma
    const rl = Math.max(1, Math.min(10, Number(riskLevel)||5));
    const mu = 0.002 * rl; // higher risk -> higher expected drift
    const sigma = 0.01 * rl; // higher risk -> higher volatility
    const series = [base];
    for(let i=1;i<=months;i++){
      // lognormal step
      const z = (Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random()));
      const factor = Math.exp(mu + sigma * z);
      const next = Math.max(0.01, series[series.length-1] * factor);
      series.push(next);
    }
    return series;
  }

  // compute metrics: return %, max drawdown %, volatility (std dev of returns %)
  function computeSimMetrics(series){
    if(!series || series.length<2) return null;
    const start = series[0];
    const last = series[series.length-1];
    const retPct = (last/start - 1) * 100;
    // max drawdown
    let peak = series[0];
    let maxDD = 0;
    for(let v of series){
      if(v>peak) peak=v;
      const dd = (peak - v)/peak;
      if(dd>maxDD) maxDD=dd;
    }
    const maxDDpct = maxDD * 100;
    // volatility: std dev of monthly returns
    const returns = [];
    for(let i=1;i<series.length;i++) returns.push((series[i]-series[i-1])/ (series[i-1]||1));
    const mean = returns.reduce((s,x)=>s+x,0)/returns.length;
    const variance = returns.reduce((s,x)=>s+Math.pow(x-mean,2),0)/Math.max(1,returns.length-1);
    const vol = Math.sqrt(variance) * 100; // percent
    return { returnPct: retPct, maxDrawdownPct: maxDDpct, volatilityPct: vol };
  }

  // Generate short human-friendly insights based on the latest simulation metrics
  function generateInsights(metrics){
    if(!metrics) return [];
    const notes = [];
    const months = Math.max(1, Math.round(timeHorizon));
    notes.push(`Over ${months} month${months>1?'s':''}, simulated return: ${metrics.returnPct.toFixed(2)}%.`);
    if(metrics.returnPct >= 5){
      notes.push('Strong simulated performance — consider whether your risk tolerance matches this outcome.');
    } else if(metrics.returnPct > 0){
      notes.push('Modest positive return — long-term holding or diversification may help improve outcomes.');
    } else {
      notes.push('Negative simulated return — reducing risk or reviewing allocation could help.');
    }

    if(metrics.maxDrawdownPct > 15){
      notes.push('High drawdown observed — this strategy may suffer large peak-to-trough losses.');
    } else if(metrics.maxDrawdownPct > 7){
      notes.push('Moderate drawdown — consider risk management (stop-loss, rebalance).');
    } else {
      notes.push('Low drawdown — relatively stable in this simulation.');
    }

    if(metrics.volatilityPct > 10){
      notes.push('High month-to-month volatility — expect wide swings in short-term performance.');
    } else {
      notes.push('Lower monthly volatility — smoother short-term behaviour expected.');
    }

    // Tailored suggestion based on slider
    if(Number(riskLevel) >= 8) notes.push('Your risk level is high; consider lowering it if you prefer steadier returns.');
    if(Number(riskLevel) <= 3) notes.push('Your risk level is low; you may trade off potential return for more stability.');

    return notes;
  }

  // --- Investor Trivia Quest component (mobile & web friendly) ---
  const TRIVIA_CATEGORIES = [
    { id: 'basics', name: 'Financial Basics', color:'#0066FF', tip:'Start with budgeting, saving and compounding.' },
    { id: 'stocks', name: 'Stocks & ETFs', color:'#00C896', tip:'Diversify across sectors and market caps.' },
    { id: 'crypto', name: 'Crypto & Blockchain', color:'#0066FF', tip:'High volatility — only allocate what you can afford.' }
  ];

  const SAMPLE_QUESTIONS = {
    basics: [
      {q:'What is the main benefit of diversification?', a:['Lower fees','Reduced risk from single holding','Guaranteed returns'], correct:1, explain:'Diversification reduces the impact of any one asset.'},
      {q:'Compound interest is best described as:', a:['Interest on principal only','Interest on interest too','A one-time bonus'], correct:1, explain:'You earn interest on accumulated interest over time.'}
    ],
    stocks: [
      {q:'An ETF is:', a:['A single company stock','A basket of assets','A loan product'], correct:1, explain:'ETFs hold multiple securities, giving instant diversification.'},
      {q:'Blue-chip stocks typically are:', a:['High growth, high risk','Large, established companies','Penny stocks'], correct:1, explain:'Blue-chips are typically large, established firms.'}
    ],
    crypto: [
      {q:'Blockchain is best described as:', a:['A centralized database','A distributed ledger','A hardware wallet'], correct:1, explain:'A distributed ledger maintained across many nodes.'},
      {q:'A key risk in crypto investing is:', a:['Liquidity & regulation','No volatility','Guaranteed yields'], correct:0, explain:'Liquidity and regulation change rapidly in crypto markets.'}
    ]
  };

  function InvestorTriviaQuest(){
    const [screen, setScreen] = React.useState('home'); // home, quiz, end
    const [category, setCategory] = React.useState(null);
    const [questions, setQuestions] = React.useState([]);
    const [index, setIndex] = React.useState(0);
    const [score, setScore] = React.useState(0);
    const [timeLeft, setTimeLeft] = React.useState(15);
    const [feedback, setFeedback] = React.useState(null); // {ok, text}
    const [badges, setBadges] = React.useState([]);

    // streak stored in localStorage
    const STREAK_KEY = 'pw_trivia_streak';

    React.useEffect(()=>{
      // Start/continue countdown only while on quiz screen and not showing feedback
      let iv;
      if(screen==='quiz' && !feedback){
        setTimeLeft(15);
        iv = setInterval(()=>{
          setTimeLeft(t=>{
            if(t<=1){
              clearInterval(iv);
              handleAnswer(null); // timeout as wrong -> show feedback, no auto-advance
              return 0;
            }
            return t-1;
          });
        },1000);
      }
      return ()=> clearInterval(iv);
    },[screen,index,feedback]);

    function startCategory(cat){
      setCategory(cat);
      const q = (SAMPLE_QUESTIONS[cat.id]||[]).slice();
      // shuffle
      for(let i=q.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [q[i],q[j]]=[q[j],q[i]]; }
      setQuestions(q);
      setIndex(0); setScore(0); setBadges([]);
      setScreen('quiz');
    }

    function handleAnswer(choice){
      const curr = questions[index];
      const correct = curr && typeof curr.correct==='number' ? curr.correct : -1;
      const ok = (choice===correct);
      if(ok) setScore(s=>s+1);
      // Show feedback and pause timer; advance only when user taps Next
      setFeedback({ok, text: ok? `✅ Correct! ${curr && curr.explain || ''}` : `❌ Nope. ${curr && curr.explain || ''}`});
    }

    function nextQuestion(){
      if(index+1 < questions.length){ setFeedback(null); setIndex(i=>i+1); setTimeLeft(15); }
      else { setFeedback(null); finishQuiz(); }
    }

    function finishQuiz(){
      // compute XP and badges
      const xp = score * 10 + Math.min(20, questions.length*2);
      const newBadges = [];
      if(score===questions.length) newBadges.push({id:'perfect_'+(category?category.id:'all'), name:'Perfect Streak', icon:'🌟'});
      if(score>=Math.ceil(questions.length/2)) newBadges.push({id:'pass_'+(category?category.id:'all'), name:'Quiz Novice', icon:'🏅'});
      setBadges(newBadges);
      // update streak
      try{
        const raw = localStorage.getItem(STREAK_KEY);
        let s = raw? JSON.parse(raw): {streak:0, last: null};
        const today = (new Date()).toDateString();
        if(s.last === today) { /* already did today */ }
        else {
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
          if(s.last === yesterday.toDateString()) s.streak = (s.streak||0) + 1; else s.streak = 1;
          s.last = today;
          localStorage.setItem(STREAK_KEY, JSON.stringify(s));
        }
      }catch(e){}
      setScreen('end');
      // simple confetti / star glow effect when earning badges
      if(newBadges.length) triggerSimpleConfetti();
    }

    function triggerSimpleConfetti(){
      const id = 'pw-trivia-confetti';
      let container = document.getElementById(id);
      if(!container){ container = document.createElement('div'); container.id = id; container.style.position='fixed'; container.style.left=0; container.style.top=0; container.style.width='100%'; container.style.height='100%'; container.style.pointerEvents='none'; container.style.zIndex=9999; document.body.appendChild(container); }
      const colors = ['#0066FF','#00C896','#FFD166','#FF6B6B'];
      for(let i=0;i<24;i++){
        const span = document.createElement('div'); span.textContent = ['🎉','✨','🌟','⭐'][Math.floor(Math.random()*4)]; span.style.position='absolute'; span.style.left = (20+Math.random()*60)+'%'; span.style.top = (10+Math.random()*60)+'%'; span.style.fontSize = (12+Math.random()*20)+'px'; span.style.opacity = '1'; span.style.transform = `translateY(0) scale(${0.8+Math.random()*0.8}) rotate(${Math.random()*360}deg)`; span.style.transition = 'all 1300ms cubic-bezier(.2,.9,.2,1)'; container.appendChild(span);
        // animate
        setTimeout(()=>{ span.style.top = (Math.random()*80)+'%'; span.style.opacity='0'; span.style.transform = `translateY(-40px) scale(1.2)`; }, 20 + Math.random()*200);
        setTimeout(()=>{ try{ span.remove(); }catch(e){} }, 1700 + Math.random()*400);
      }
    }

    // Small UI helpers
    function renderHome(){
      return e('div', {className:'grid grid-cols-1 sm:grid-cols-3 gap-3'},
        TRIVIA_CATEGORIES.map(c=> e('div', {key:c.id, className:'bg-white rounded-xl p-4 shadow-sm flex flex-col items-start gap-3', style:{borderLeft:`4px solid ${c.color}`}},
          e('div', {className:'text-lg font-semibold'}, c.name),
          e('div', {className:'text-xs text-slate-500'}, c.tip),
          e('div', {className:'mt-2 w-full flex justify-end'}, e('button', {className:'btn btn-primary px-3 py-1 rounded-lg', onClick: ()=> startCategory(c), style:{background:c.color, border:'none'}}, 'Play'))
        ))
      );
    }

    function renderQuiz(){
      const curr = questions[index] || {};
      const pct = questions.length? Math.round((index/ questions.length)*100) : 0;
      return e('div', {className:'mt-4 bg-white rounded-2xl p-4 shadow-md'},
        e('div', {className:'flex items-center justify-between mb-3'},
          e('div', {style:{flex:1, marginRight:12}}, e('div', {className:'h-2 bg-slate-200 rounded-full overflow-hidden'}, e('div', {style:{width: `${pct}%`, height:6, background:'#0066FF', borderRadius:6}}))),
          e('div', {className:'text-xs text-slate-500'}, `${index+1}/${questions.length}`)
        ),
        e('div', {className:'text-lg font-semibold mb-3'}, curr.q || '—'),
        e('div', {className:'grid grid-cols-1 gap-2'},
          (curr.a||[]).map((opt,i)=> e('button', {key:i, className:'rounded-lg p-3 text-left border', onClick: ()=> handleAnswer(i), disabled: !!feedback, style:{background:'#fff', borderColor:'#e6eefc', opacity: feedback?0.7:1, cursor: feedback?'not-allowed':'pointer'}} , opt))
        ),
        e('div', {className:'mt-3 flex items-center justify-between'},
          e('div', {className:'text-xs text-slate-500'}, `Time: ${timeLeft}s`),
          e('a', {href:'#', onClick: ev=>{ ev.preventDefault(); window.open('https://www.investopedia.com','_blank'); }, className:'text-xs text-sky-600'}, 'Learn More')
        ),
        feedback && e('div', {className:`mt-3 p-3 rounded-lg ${feedback.ok? 'bg-emerald-50 border border-emerald-100 text-emerald-700':'bg-red-50 border border-red-100 text-red-600'}`}, feedback.text),
        feedback && e('div', {className:'mt-3 flex justify-end'},
          e('button', {className:'btn btn-primary px-4 py-2', onClick: nextQuestion}, index+1<questions.length? 'Next' : 'Finish')
        )
      );
    }

    function renderEnd(){
      const xp = score * 10 + Math.min(20, questions.length*2);
      let streak=0; try{ streak = JSON.parse(localStorage.getItem(STREAK_KEY)||'{}').streak||0 }catch(e){}
      return e('div', {className:'mt-4 bg-white rounded-2xl p-4 shadow-md text-center'},
        e('div', {className:'text-2xl font-bold mb-2'}, `Score: ${score}/${questions.length}`),
        e('div', {className:'text-sm text-slate-600 mb-3'}, `XP Earned: ${xp} • Daily Streak: ${streak}`),
        badges.length>0 && e('div', {className:'flex items-center justify-center gap-3 mb-3'}, badges.map(b=> e('div', {key:b.id, className:'p-3 bg-white rounded-full shadow-sm text-center'}, e('div',{className:'text-xl'}, b.icon), e('div',{className:'text-xs text-slate-500 mt-1'}, b.name)))),
        e('div', {className:'flex items-center justify-center gap-3 mt-2'}, e('button', {className:'btn btn-primary px-4 py-2', onClick: ()=> setScreen('home')}, 'Play Again'), e('button',{className:'btn btn-ghost px-4 py-2', onClick: ()=> setScreen('home')}, 'Close'))
      );
    }

    return e('div', {className:'mt-4'},
      e('div', {className:'card p-4 trivia-card'},
  // Tweak sizing so it visually matches the Paper Trading Game header scale
  e('h3', {className:'text-xl md:text-2xl font-semibold text-slate-800 text-center'}, 'Investor Trivia Quest'),
  e('p', {className:'mt-2 text-xs md:text-sm text-slate-500 text-center mb-3'}, 'Learn fast with bite-sized quizzes — fun, short and mobile-friendly.'),
        screen==='home' && renderHome(),
        screen==='quiz' && renderQuiz(),
        screen==='end' && renderEnd()
      )
    );
  }

  // Animate and run a simulation
  function runSimulation(){
    if(simulating) return;
    const full = generateSimulation();
    setSimSeries(full);
    setDisplaySeries([]);
    setSimMetrics(null);
    setSimulating(true);
    let i = 0;
    const step = Math.max(20, Math.floor(600 / full.length));
    const iv = setInterval(()=>{
      i++;
      setDisplaySeries(curr=> {
        const next = full.slice(0, Math.min(i, full.length));
        return next;
      });
      if(i>=full.length){
        clearInterval(iv);
        const metrics = computeSimMetrics(full);
        setSimMetrics(metrics);
        setSimulating(false);
      }
    }, step);
  }

  // Render a larger chart for the simulator (area + line)
  function renderSimulatorChart(series, opts){
    opts = opts||{};
    const w = opts.width || 420;
    const h = opts.height || 160;
    const pad = 8;
    if(!series || series.length<2){
      return e('svg', {width:w, height:h, style:{background:'transparent', borderRadius:8}}, e('rect',{x:0,y:0,width:w,height:h,fill:'transparent'}));
    }
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = (max - min) || 1;
    const step = (w - pad*2) / (series.length - 1);
    const points = series.map((val,i)=>{
      const x = pad + i*step;
      const y = pad + (1 - (val - min)/range) * (h - pad*2);
      return [x,y,val];
    });
    const pathD = points.map((p,i)=> (i===0? 'M':'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
    // area path
    const areaD = pathD + ` L ${w-pad} ${h-pad} L ${pad} ${h-pad} Z`;
    const first = series[0];
    const last = series[series.length-1];
    const up = last >= first;
    const stroke = up? '#16a34a' : '#ef4444';
    const accent = '#0066FF';
    return e('svg', {width:w, height:h, viewBox:`0 0 ${w} ${h}`, style:{display:'block', borderRadius:10, overflow:'visible'}},
      // subtle gradient fill
      e('defs', null,
        e('linearGradient', {id:'pwSimGrad', x1:'0', x2:'0', y1:'0', y2:'1'},
          e('stop', {offset:'0%', stopColor: up? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)'}),
          e('stop', {offset:'100%', stopColor: 'rgba(255,255,255,0)'})
        )
      ),
      e('path', {d:areaD, fill:'url(#pwSimGrad)', stroke:'none'}),
      e('path', {d:pathD, fill:'none', stroke: stroke, strokeWidth:2.8, strokeLinecap:'round', strokeLinejoin:'round'}),
      // endpoint circle
      (function(){
        const p = points[points.length-1];
        return e('circle', {cx: p[0], cy: p[1], r:3.5, fill: accent, stroke: '#ffffff', strokeWidth:1});
      })()
    );
  }

    // Persist state
    React.useEffect(()=>{ saveState(state); },[state]);

    // Achievements dashboard component
    function AchievementsDashboard(){
      const [rows, setRows] = React.useState(()=>loadAchievements());
      const [glowIds, setGlowIds] = React.useState([]);
      const [modal, setModal] = React.useState(null); // {achievement, history}
      React.useEffect(()=>{
        const onStorage = ()=> setRows(loadAchievements());
        window.addEventListener('storage', onStorage);
        const onUpdated = (ev)=>{
          const newly = (ev.detail && ev.detail.newly) || [];
          if(newly.length){
            setRows(loadAchievements());
            setGlowIds(newly);
            // clear glow after animation
            setTimeout(()=> setGlowIds([]), 2000);
          }
        };
        window.addEventListener('pw:achievements-updated', onUpdated);
        return ()=>{
          window.removeEventListener('storage', onStorage);
          window.removeEventListener('pw:achievements-updated', onUpdated);
        };
      },[]);
      
      

      function openBadge(a){
        // historical context: read local achievements and show unlockedAt + description
        const all = loadAchievements();
        const found = all.find(x=>x.id===a.id);
        setModal({achievement: found});
      }

      function closeModal(){ setModal(null); }
      return e('div', {className:'flex-1 flex flex-col'},
        e('div', {className:'grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3 flex-1 overflow-auto'},
          rows.map(a=>{
            const isGlow = glowIds.includes(a.id);
            // New gradient-border highlight via .ach-card classes (see CSS). Keep a subtle pulse for newly unlocked.
            const className = `ach-card ${a.unlocked? 'ach-unlocked shadow-md':'ach-locked'} p-4 transition-all duration-300 ${isGlow? 'animate-pulse':''}`;
            return e('div', {key:a.id, className:className, onClick:()=>openBadge(a)},
              e('div', {className:'ach-icon text-2xl'}, a.icon),
              e('div', {className:'ach-body'},
                e('div', {className:'font-semibold'}, a.name),
                e('div', {className:'text-xs text-slate-500 mt-1'}, a.description),
                a.unlocked && e('span', {className:'ach-pill unlocked mt-2'}, 'Unlocked')
              )
            );
          })
        ),
        null,
        // modal
        modal && ReactDOM.createPortal(
          e('div', {className:'fixed inset-0 z-50 flex items-center justify-center bg-black/40'},
            e('div', {className:'bg-white rounded-2xl p-6 max-w-lg w-full'},
              e('h3', {className:'text-lg font-semibold mb-2'}, modal.achievement.name),
              e('p', {className:'text-sm text-slate-600 mb-2'}, modal.achievement.description),
              (modal.achievement.unlocked
                ? e('div', {className:'mb-4'}, e('span', {className:'ach-pill unlocked'}, 'Unlocked'))
                : e('div', {className:'mb-4'}, e('span', {className:'ach-pill locked'}, 'Locked'))
              ),
              e('div', {className:'flex justify-end'}, e('button', {className:'btn btn-primary', onClick:closeModal}, 'Close'))
            )
          ), document.body
        )
      );
    }

    // Actions
    function addToWatchlist(ticker){
      if(state.watchlist.includes(ticker)) return;
      setState(s=>({...s, watchlist:[...s.watchlist, ticker]}));
    }
    function placeOrder({ticker, qty, priceRM}){
      if(state.phase!=='running'||qty<=0||state.cash<qty*priceRM) return;
      // New order placed — hide colored result until next month advance
      try{ setShowColor(false); }catch(e){}
      setState(s=>{
        let holdings = s.holdings.slice();
        let idx = holdings.findIndex(h=>h.ticker===ticker);
        if(idx>=0){
          // Weighted average cost per unit; keep avgCost stable across months
          const h = holdings[idx];
          const prevQty = h.qty;
          const newQty = prevQty + qty;
          const prevAvg = (typeof h.avgCost==='number')? h.avgCost : (typeof h.priceRM==='number'? h.priceRM : priceRM);
          const newAvg = ((prevAvg*prevQty) + (priceRM*qty)) / newQty;
          h.qty = newQty;
          h.avgCost = newAvg;
          h.priceRM = priceRM; // current price at purchase time
          h.value = newQty * priceRM; // current total value at purchase time
        } else {
          holdings.push({ticker, qty, value: qty*priceRM, priceRM, avgCost: priceRM});
        }
        return {...s, cash: s.cash - qty*priceRM, holdings};
      });
    }
    // Atomic buy: start the game if needed and place a 1-unit buy in a single state update
    function buyNow(ticker){
      const sym = SYMBOLS.find(s=>s.ticker===ticker);
      if(!sym) return;
      setState(prev=>{
        // If game not running, initialize base state like resetGame
        let base = prev;
        if(prev.phase!=='running'){
          base = {phase:'running', cash:10000, holdings:[], watchlist:prev.watchlist||[], month:0, history:[], leaderboard:prev.leaderboard||[]};
        }
        // Ensure watchlist contains ticker
        const wl = base.watchlist.includes(ticker)? base.watchlist : [...base.watchlist, ticker];
  // Place one unit buy if enough cash
  if(base.cash < sym.priceRM) return {...base, watchlist: wl};
  // hide colored total until month advances
  try{ setShowColor(false); }catch(e){}
        let holdings = base.holdings.slice();
        let idx = holdings.findIndex(h=>h.ticker===ticker);
        if(idx>=0){
          const h = holdings[idx];
          const prevQty = h.qty;
          const newQty = prevQty + 1;
          const prevAvg = (typeof h.avgCost==='number')? h.avgCost : (typeof h.priceRM==='number'? h.priceRM : sym.priceRM);
          const newAvg = ((prevAvg*prevQty) + sym.priceRM) / newQty;
          h.qty = newQty;
          h.avgCost = newAvg;
          h.priceRM = sym.priceRM; // current price
          h.value = newQty * sym.priceRM;
        } else {
          holdings.push({ticker, qty:1, value: 1*sym.priceRM, priceRM: sym.priceRM, avgCost: sym.priceRM});
        }
        return {...base, cash: +(base.cash - sym.priceRM).toFixed(6), holdings, watchlist: wl};
      });
    }

    // Open buy confirmation modal from Watchlist
    function openBuyModal(sym){
      if(!sym) return;
      setBuyModal({ ticker: sym.ticker, name: sym.name, priceRM: sym.priceRM, volatility: sym.volatility, qty: 1 });
    }
    function closeBuyModal(){ setBuyModal(null); }
    function confirmBuy(){
      if(!buyModal) return;
      const {ticker, priceRM} = buyModal;
      const qty = Math.max(1, Number(buyModal.qty||1));
      // Apply a buy similar to buyNow, but with custom qty and modal context
  // hide colored total until month advances
  try{ setShowColor(false); }catch(e){}
  setState(prev=>{
        let base = prev;
        if(prev.phase!=='running'){
          base = {phase:'running', cash:10000, holdings:[], watchlist:prev.watchlist||[], month:0, history:[], leaderboard:prev.leaderboard||[]};
        }
        // Ensure watchlist contains ticker
        const wl = base.watchlist.includes(ticker)? base.watchlist : [...base.watchlist, ticker];
        // Not enough cash -> no-op but keep modal closed to avoid blocking UX
        if(base.cash < qty*priceRM) return {...base, watchlist: wl};
        let holdings = base.holdings.slice();
        let idx = holdings.findIndex(h=>h.ticker===ticker);
        if(idx>=0){
          const h = holdings[idx];
          const prevQty = h.qty;
          const newQty = prevQty + qty;
          const prevAvg = (typeof h.avgCost==='number')? h.avgCost : (typeof h.priceRM==='number'? h.priceRM : priceRM);
          const newAvg = ((prevAvg*prevQty) + (priceRM*qty)) / newQty;
          h.qty = newQty;
          h.avgCost = newAvg;
          h.priceRM = priceRM;
          h.value = newQty * priceRM;
        } else {
          holdings.push({ticker, qty, value: qty*priceRM, priceRM, avgCost: priceRM});
        }
        return {...base, cash: +(base.cash - qty*priceRM).toFixed(6), holdings, watchlist: wl};
      });
      setBuyModal(null);
    }
    function nextMonth(){
      // don't advance if game not running, already at 12 months, or no orders placed
      const hadOrdersLocal = (state.holdings && state.holdings.length>0) || (state.history && state.history.some(h=> Array.isArray(h.holdings) && h.holdings.some(x=> x && (x.qty || x.value))));
      if(state.phase!=='running'||state.month>=12||!hadOrdersLocal) return;
      // show colored total when advancing months
      try{ setShowColor(true); }catch(e){}
      setState(s=>{
        let holdings = s.holdings.map(h=>{
          let sym = SYMBOLS.find(a=>a.ticker===h.ticker);
          let {mu,sigma}=VOL_MODEL[sym.volatility];
          let newPrice = h.priceRM*randLogNormal(mu,sigma);
          // Preserve avgCost across months
          return {...h, priceRM:newPrice, value:h.qty*newPrice, avgCost: (typeof h.avgCost==='number'? h.avgCost : (h.qty? (h.value/h.qty) : newPrice))};
        });
        let history = [...s.history, {month:s.month+1, holdings:JSON.parse(JSON.stringify(holdings)), cash:s.cash}];
        const newMonth = s.month+1;
        // If we've reached month 12, mark the game finished so Save Result becomes enabled
        if(newMonth>=12){
          return {...s, month:newMonth, holdings, history, phase:'finished'};
        }
        return {...s, month:newMonth, holdings, history};
      });
    }
    function simulateYear(){
      // don't fast-forward if game not running or no orders placed
      const hadOrdersLocal = (state.holdings && state.holdings.length>0) || (state.history && state.history.some(h=> Array.isArray(h.holdings) && h.holdings.some(x=> x && (x.qty || x.value))));
      if(state.phase!=='running' || !hadOrdersLocal) return;
      // show colored total when advancing months
      try{ setShowColor(true); }catch(e){}
      for(let i=state.month;i<12;i++) nextMonth();
      setState(s=>({...s, phase:'finished'}));
    }
  // resetAndStart: reset state and immediately start the game
  function resetGame(){
    // Reset achievements stored in localStorage
    try{ resetAchievements(); }catch(e){}
    // Clear any achievement message shown in the UI
    try{ setAchMessage(''); }catch(e){}
    // Notify other components (AchievementsDashboard listens for this custom event)
    try{ window.dispatchEvent(new CustomEvent('pw:achievements-updated',{detail:{list: loadAchievements(), newly:[]}})); }catch(e){}
    // Reset the game state (preserve leaderboard if present)
    setState({phase:'running', cash:10000, holdings:[], watchlist:[], month:0, history:[], leaderboard:state.leaderboard});
  }
    function finishGame(){
      // Compute results
      let totalValue = state.cash + state.holdings.reduce((s,h)=>s+h.value,0);
      let startValue = 10000;
      let returns = (totalValue-startValue)/startValue*100;
      let maxDrawdown = Math.max(0,...state.history.map(h=>{
        let v = h.cash + h.holdings.reduce((s,x)=>s+x.value,0);
        return (startValue-v)/startValue;
      }));
      let hIndex = herfindahl(state.holdings);
      let badge = returns<3?'Beginner':(returns>=8&&maxDrawdown<=0.08)?'Expert':(returns>=3&&maxDrawdown<=0.10)?'Balanced':'Beginner';
      let entry = {name:'Player', totalReturn:returns, riskScore:maxDrawdown, badge};
      setState(s=>({...s, phase:'finished', leaderboard:[...s.leaderboard, entry]}));
      // Unlock achievements based on this game's result
      const res = {
        returnPct: returns,
        maxDDPct: maxDrawdown*100,
        hIndex: hIndex,
        holdingsCount: state.holdings.length,
        month: state.month,
        gamesPlayed: (loadLeaderboard().length||0) + 1
      };
      unlockAchievementsForResult(res);
    }

    // Compute result metrics from current state (returns percentages where appropriate)
    function computeResultMetrics(){
      const totalValue = state.cash + state.holdings.reduce((s,h)=>s+h.value,0);
      const startValue = 10000;
      const returnPct = (totalValue - startValue)/startValue*100;
      const maxDD = Math.max(0,...state.history.map(h=>{ let v = h.cash + h.holdings.reduce((s,x)=>s+x.value,0); return (startValue - v)/startValue; }));
      const maxDDPct = maxDD*100;
      const hIndex = herfindahl(state.holdings);
      const holdingsCount = state.holdings.length;
      const month = state.month;
      const gamesPlayed = (loadLeaderboard().length||0) + (state.phase==='finished'?1:0);
      return { returnPct, maxDDPct, hIndex, holdingsCount, month, gamesPlayed };
    }

    // Save/submit the current Game Console result to unlock achievements (can be called after finishing)
    const [achMessage, setAchMessage] = React.useState('');
    function saveResultAndUnlock(){
      // If the player never placed any orders in this game, don't unlock achievements
      const hadOrders = (state.holdings && state.holdings.length>0) || (state.history && state.history.some(h=> Array.isArray(h.holdings) && h.holdings.some(x=> x && (x.qty || x.value))));
      if(!hadOrders){
        setAchMessage('No orders placed — nothing to save');
        setTimeout(()=>setAchMessage(''), 2500);
        return;
      }

      const before = loadAchievements().filter(a=>a.unlocked).map(a=>a.id);
      const res = computeResultMetrics();
      unlockAchievementsForResult(res);
      const after = loadAchievements().filter(a=>a.unlocked).map(a=>a.id);
      const newly = after.filter(id=>!before.includes(id));
      if(newly.length){
        const names = loadAchievements().filter(a=>newly.includes(a.id)).map(a=>a.name).join(', ');
        setAchMessage(`Unlocked: ${names}`);
        setTimeout(()=>setAchMessage(''), 3500);
      } else {
        setAchMessage('No new achievements');
        setTimeout(()=>setAchMessage(''), 2000);
      }
    }

    // UI - Market-like shell with 3 aligned cards
    return e('div', {className:'w-full'},
      // centered page container
      e('div', {className:'max-w-6xl mx-auto px-6 md:px-8'},
  // main surface panel (match app card effects)
  e('div', {className:'card rounded-3xl bg-white/70 backdrop-blur-md ring-1 ring-black/5 p-6 md:p-8'},
          // Header
          e('div', {className:'text-center'},
            e('h1', {className:'text-2xl md:text-3xl font-semibold text-slate-800'}, 'Paper Trading Game'),
            e('p', {className:'mt-2 text-sm text-slate-500'}, 'Practice with RM10,000 virtual cash — simulate 12 months, track P/L, drawdown and diversification.')
          ),

          // Controls row (Start removed; Reset starts the game)
          e('div', {className:'mt-4 flex items-center justify-start gap-3 flex-wrap'},
            e('button', {className:'btn btn-ghost h-10 px-4 rounded-xl shadow-sm', onClick: resetGame}, 'Reset'),
            e('button', {className:'btn btn-ghost h-10 px-4 rounded-xl shadow-sm', onClick: ()=>setShowRules(true)}, '📜 Rules')
          ),

          // Highlighted Rules callout for visibility (dismisses after viewing full rules)
          showInlineRules && e('div', {id:'game-rules', className:'mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-3'},
            e('div', {className:'text-lg leading-none pt-0.5'}, '📜'),
            e('div', {className:'flex-1'},
              e('div', {className:'font-semibold mb-1 text-center'}, 'Paper Trading Game — Rules'),
              e('div', null, 'Start with RM10,000 virtual cash. Simulate 12 months of returns. Track P/L, drawdown, diversification, and unlock badges. Demo only — no real money or advice.'),
              e('div', {className:'mt-2 text-center'},
                e('button', {className:'btn btn-ghost small', onClick: ()=> { setShowRules(true); setShowInlineRules(false); }}, 'View full rules')
              )
            )
          ),

          // Cards grid
          e('div', {className:'grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6'},
            // Watchlist
            e('div', {className:'card bg-white rounded-2xl p-5 md:p-6 ring-1 ring-black/5 h-full flex flex-col'},
              e('h3', {className:'text-xl font-semibold tracking-tight mb-4 text-slate-800'}, 'Watchlist'),
              e('input', {type:'search', className:'w-full rounded-xl border border-slate-200 px-3 h-10 focus:ring-2 focus:ring-sky-400 mb-3', placeholder:'Search symbols...', value: search, onChange: ev=>setSearch(ev.target.value)}),
              // compact list: show all symbols when search is empty; otherwise filter by search
              e('div', {className:'overflow-y-auto max-h-[820px] pr-0', style: {padding: '0', margin: '0'}},
                (function(){
                  const q = (search||'').trim().toLowerCase();
                  const rows = q ? SYMBOLS.filter(s=> (s.name.toLowerCase().includes(q)||s.ticker.toLowerCase().includes(q))) : SYMBOLS.slice();
                  return rows.map(s=>
                    e('div', {key:s.ticker, className:'flex items-center border-b last:border-0', style: {padding: '8px 0'}},
                      e('div', {className:'flex-1 pr-2'}, e('div', {className:'text-slate-700 truncate', style:{fontSize:'14px', lineHeight:'18px'}}, `${s.ticker} - ${s.name}`), e('div', {className:'text-xs text-slate-500', style:{marginTop:'2px'}}, isSubscribed() ? s.volatility : '')),
                      e('button', {className:'btn btn-primary btn-xs px-3 py-1 rounded-md flex-shrink-0', onClick:()=>openBuyModal(s), style:{height:'30px', padding:'0 10px'}}, 'Buy')
                    )
                  );
                })()
              )
            ),

            // Game Console
            e('div', {className:'card bg-white rounded-2xl p-5 md:p-6 ring-1 ring-black/5 h-full min-h-0 flex flex-col'},
              e('h3', {className:'text-xl font-semibold tracking-tight mb-4 text-slate-800'}, 'Game Console'),
              e('div', {className:'grid grid-cols-2 gap-4 text-slate-600', style:{marginBottom:'12px'}},
                e('div', null, `Cash: ${fmtMYR(state.cash)}`),
                e('div', null, `Month: ${state.month}`)
              ),
              // Positions / holdings
              e('div', {className:'flex-1 min-h-0 overflow-y-auto', style: {maxHeight: '80vh', paddingBottom: '140px'}},
                state.holdings.length===0?e('div', {className:'text-sm text-slate-500'}, 'No holdings yet.'):
                e('table', {className:'w-full text-sm'},
                  e('thead', {className:'sticky top-0 bg-white'},
                    e('tr', null,
                      e('th', {className:'text-left pb-2'}, 'Symbol'),
                      e('th', {className:'text-right pb-2'}, 'Qty'),
                      e('th', {className:'text-right pb-2'}, 'Buy Price'),
                      e('th', {className:'text-right pb-2'}, 'Current Value')
                    )
                  ),
                  e('tbody', null, state.holdings.map(h=>
                    e('tr', {key:h.ticker, className:'border-t'},
                      e('td', {className:'py-2'}, h.ticker),
                      e('td', {className:'py-2 text-right'}, Number(h.qty).toLocaleString()),
                      e('td', {className:'py-2 text-right'}, fmtMYR((typeof h.avgCost==='number'? h.avgCost : (h.qty? (h.value/h.qty) : 0)) * h.qty)),
                      e('td', {className:'py-2 text-right'}, fmtMYR(h.value))
                    )
                  ))
                )
              ),
              // Buy inputs removed per request — keep only the holdings table and action buttons
              null,
              // Action buttons
                (function(){
                const hadOrders = (state.holdings && state.holdings.length>0) || (state.history && state.history.some(h=> Array.isArray(h.holdings) && h.holdings.some(x=> x && (x.qty || x.value))));
                return e('div', null,
                  // spacer to provide extra gap between table and buttons on all viewports
                  e('div', {style:{height:'56px'}}),
                  e('div', {className:'mt-4 flex items-center justify-center gap-3 flex-wrap'},
                    e('button', {className:'btn btn-primary h-10 px-4', onClick: nextMonth, disabled: state.phase!=='running'||state.month>=12||!hadOrders}, 'Next Month'),
                    e('button', {className:'btn btn-primary h-10 px-4', onClick: simulateYear, disabled: state.phase!=='running'||state.month>=12||!hadOrders}, 'Fast-Forward 12 Months'),
                    null,
                    e('button', {className:'btn btn-ghost h-10 px-4', onClick: saveResultAndUnlock, disabled: state.phase!=='finished'}, 'Save Result')
                  )
                );
              })(),
              // KPI stack - vertical
              e('div', {className:'mt-4 flex flex-col gap-2'},
                (function(){
                  const totalReturnAmount = (state.cash + state.holdings.reduce((s,h)=>s+h.value,0) - 10000);
                  const formatted = fmtMYR(totalReturnAmount);
                  const hadOrders = (state.holdings && state.holdings.length>0) || (state.history && state.history.some(h=> Array.isArray(h.holdings) && h.holdings.some(x=> x && (x.qty || x.value))));
                  // If no orders, neutral display
                  if(!hadOrders){
                    return e('div', {className:'text-sm text-slate-700'}, `Total Return: ${formatted}`);
                  }
                  // Only show colored text/dot after month-advance action
                  if(!showColor){
                    return e('div', {className:'text-sm text-slate-700'}, `Total Return: ${formatted}`);
                  }
                  const isPositive = totalReturnAmount >= 0;
                  const cls = `text-sm ${isPositive? 'text-green-600':'text-red-600'} font-medium`;
                  const emoji = isPositive? '🟢 ' : '🔴 ';
                  return e('div', {className: cls}, `${emoji}Total Return: ${formatted}`);
                })(),
                e('div', {className:'text-sm text-slate-700'}, `Max Drawdown: ${ (Math.max(0,...state.history.map(h=>{let v=h.cash+h.holdings.reduce((s,x)=>s+x.value,0);return (10000-v)/10000;}))*100).toFixed(2)}%`),
                e('div', {className:'text-sm text-slate-700'}, `Diversification: ${herfindahl(state.holdings).toFixed(2)}`),
                e('div', {className:'text-sm text-slate-700 text-center text-sky-600 mt-2'}, achMessage),
                e('div', {className:'text-xs text-slate-400 text-center mt-1'}, 'Results can only be saved after completing 12 months.')
              )
            ),

            // Achievements dashboard
            e('div', {className:'card bg-white rounded-2xl p-5 md:p-6 ring-1 ring-black/5 h-full flex flex-col'},
              e('h3', {className:'text-xl font-semibold tracking-tight mb-4 text-slate-800'}, 'Achievements'),
              e(AchievementsDashboard, {className:'flex-1'})
            )
          )
          ,
          // removed inline Risk vs Reward Simulator so it can be rendered as a separate box
        )
        // Investor Trivia Quest component (educational mini-quiz)
        , e('div', {className:'max-w-6xl mx-auto px-6 md:px-8 mt-6'}, e(InvestorTriviaQuest))
      ),
      // Separate Risk vs Reward Simulator box (moved out of the main Paper Trading Game card)
      e('div', {className:'max-w-6xl mx-auto px-6 md:px-8 mt-6'},
        e('div', {className:'card bg-white rounded-3xl p-6 ring-1 ring-black/5'},
          e('div', {className:'text-center mb-4'},
            e('h3', {className:'text-xl font-semibold tracking-tight mb-1 text-slate-800'}, 'Risk vs Reward Simulator'),
            e('p', {className:'mt-1 text-sm text-slate-500 mb-3'}, 'Learn by simulating')
          ),
          e('div', {className:'grid grid-cols-1 md:grid-cols-3 gap-4'},
            // Left: controls
            e('div', {className:'col-span-1 flex flex-col gap-4'},
              e('label', {className:'text-sm font-medium text-slate-700'}, 'Risk Level'),
              e('input', {type:'range', min:1, max:10, value: riskLevel, onChange: ev=> setRiskLevel(Number(ev.target.value)), className:'w-full'}, null),
              e('div', {className:'flex items-center justify-between text-xs text-slate-500'}, e('div', null, 'Low'), e('div', null, 'High')),

              e('label', {className:'text-sm font-medium text-slate-700'}, 'Investment Amount (RM)'),
              e('input', {type:'range', min:100, max:50000, step:100, value: investAmount, onChange: ev=> setInvestAmount(Number(ev.target.value)), className:'w-full'}, null),
              e('div', {className:'flex items-center justify-between text-xs text-slate-500'}, e('div', null, 'RM 100'), e('div', null, `RM ${Number(investAmount).toLocaleString()}`)),

              e('label', {className:'text-sm font-medium text-slate-700'}, 'Time Horizon (months)'),
              e('input', {type:'range', min:1, max:60, step:1, value: timeHorizon, onChange: ev=> setTimeHorizon(Number(ev.target.value)), className:'w-full'}, null),
              e('div', {className:'flex items-center justify-between text-xs text-slate-500'}, e('div', null, '1 mo'), e('div', null, `${timeHorizon} mo`)),

              // Simulate button
              e('div', {className:'mt-3'},
                e('button', {className:`btn btn-primary px-4 py-2 rounded-xl ${simulating? 'opacity-80 animate-pulse':''}`, onClick: runSimulation, disabled: simulating, style:{background: 'linear-gradient(90deg,#0066FF,#4DA6FF)', boxShadow:'0 8px 20px rgba(3,102,255,0.12)'}}, simulating? 'Simulating...' : 'Simulate Market')
              ),
              // small tip / badge
              e('div', {className:'mt-4 p-3 bg-white border rounded-lg shadow-sm'},
                e('div', {className:'text-xs text-slate-500 mb-1'}, 'Tip:'),
                e('div', {className:'text-sm text-slate-700'}, 'Higher risk increases both upside potential and volatility. Try different time horizons.')
              )
            ),
            // Center: chart
            e('div', {className:'col-span-1 md:col-span-1 flex items-center justify-center'},
              e('div', {style:{width:'100%', maxWidth:460}}, renderSimulatorChart(displaySeries.length? displaySeries : simSeries, {width:420, height:160}) )
            ),
            // Right: metrics
            e('div', {className:'col-span-1 flex flex-col justify-between'},
              e('div', {className:'bg-white rounded-xl p-4 shadow-sm border'},
                e('div', {className:'text-sm text-slate-500'}, 'Return (%)'),
                e('div', {className:'text-xl font-semibold text-slate-800 mt-2'}, simMetrics? `${simMetrics.returnPct.toFixed(2)}%` : '-'),
                e('div', {className:'text-xs text-slate-400 mt-1'}, 'Final vs. start')
              ),
              e('div', {className:'bg-white rounded-xl p-4 shadow-sm border mt-3'},
                e('div', {className:'text-sm text-slate-500'}, 'Max Drawdown (%)'),
                e('div', {className:'text-xl font-semibold text-slate-800 mt-2'}, simMetrics? `${simMetrics.maxDrawdownPct.toFixed(2)}%` : '-'),
                e('div', {className:'text-xs text-slate-400 mt-1'}, 'Worst peak-to-trough')
              ),
              e('div', {className:'bg-white rounded-xl p-4 shadow-sm border mt-3'},
                e('div', {className:'text-sm text-slate-500'}, 'Volatility (%)'),
                e('div', {className:'text-xl font-semibold text-slate-800 mt-2'}, simMetrics? `${simMetrics.volatilityPct.toFixed(2)}%` : '-'),
                e('div', {className:'text-xs text-slate-400 mt-1'}, 'Std. dev monthly returns')
              ),
              // Optional achievement badge
              simMetrics && simMetrics.maxDrawdownPct<5 && e('div', {className:'mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 font-medium'}, 'Achievement: Low Risk, Steady Return')
              // Insights notes: show after a simulation completes
              , simMetrics && e('div', {className:'mt-4 bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700'},
                e('div', {className:'font-semibold text-slate-800 mb-2'}, 'Simulation Insights'),
                (function(){
                  const notes = generateInsights(simMetrics);
                  return notes.map((n,i)=> e('p', {key:i, className:'mb-1'}, n));
                })()
              )
            )
          )
        )
      ),
      // Buy confirmation modal
      buyModal && ReactDOM.createPortal(
        e('div', {className:'fixed inset-0 bg-black/40 z-50 flex items-center justify-center'},
          e('div', {className:'bg-white rounded-2xl p-6 w-full max-w-md shadow-xl'},
            e('h3', {className:'text-lg font-semibold mb-2'}, `Confirm Buy: ${buyModal.ticker} — ${buyModal.name}`),
            e('div', {className:'text-sm text-slate-600 mb-3'}, `Current Price: ${fmtMYR(buyModal.priceRM)}${isSubscribed() ? ' | Volatility: ' + buyModal.volatility : ''}`),
            e('div', {className:'flex items-center gap-3 mb-4'},
              e('label', {className:'text-sm text-slate-700'}, 'Quantity'),
              e('input', {type:'number', min:1, step:1, value: buyModal.qty, onChange: ev=> setBuyModal(m=>({...m, qty: ev.target.value})), className:'border rounded px-2 h-9 w-24'})
            ),
            e('div', {className:'text-sm text-slate-600 mb-4'}, `Total: ${fmtMYR(Math.max(1, Number(buyModal.qty||1))*buyModal.priceRM)}`),
            e('div', {className:'flex justify-end gap-2'},
              e('button', {className:'btn btn-ghost', onClick: closeBuyModal}, 'Cancel'),
              e('button', {className:'btn btn-primary', onClick: confirmBuy, disabled: state.cash < Math.max(1, Number(buyModal.qty||1))*buyModal.priceRM}, 'Confirm Buy')
            )
          )
        ), document.body
      ),

      // rules modal portal
      showRules && ReactDOM.createPortal(
        e('div', {className:'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'},
          e('div', {className:'bg-white rounded shadow-lg p-6 max-w-md text-left'},
            e('h3', {className:'font-bold mb-2'}, 'Paper Trading Game Rules'),
            e('ul', {className:'mb-2 list-disc pl-5'},
              e('li', null, 'Start with RM10,000 virtual cash.'),
              e('li', null, 'Add stocks/ETFs to your watchlist and place buy orders.'),
              e('li', null, 'Simulate 12 months of market returns (lognormal model).'),
              e('li', null, 'Track P/L, drawdown, and diversification. Earn badges.'),
              e('li', null, 'No real money or financial advice. Demo only.')
            ),
            e('div', {className:'flex justify-end'}, e('button', {className:'btn btn-primary', onClick:()=>setShowRules(false)}, 'Close'))
          )
        ), document.body
      )
    );
  }

  // Mount
  const mount = document.getElementById('paperTradingGameRoot');
  if(mount){
    ReactDOM.createRoot(mount).render(React.createElement(PaperTradingGame));
  }
})();
