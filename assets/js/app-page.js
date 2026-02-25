// Minimal app page script: enforce localStorage session and provide sign out
(function(){
  const AUTH_KEY = 'pw_session';
  const yearEl = document.getElementById('year'); if(yearEl) yearEl.textContent = new Date().getFullYear();

  function getUser(){ try{ return JSON.parse(localStorage.getItem(AUTH_KEY)); }catch(e){ return null; } }
  function clearUser(){ localStorage.removeItem(AUTH_KEY); }

  const user = getUser();
  const appUserEl = document.getElementById('appUser');
  const welcomeEl = document.getElementById('welcomeGreeting');
  if(!user || !user.email){
    // not signed in — redirect back to landing
    window.location.replace('PocketWealth.html');
  } else {
  if(appUserEl) appUserEl.textContent = user.email;
  if(welcomeEl) welcomeEl.textContent = `👉 \u201CWelcome to PocketWealth, ${user.username}!\u201D`;
  }

  document.getElementById('btnSignOutApp')?.addEventListener('click', ()=>{
    clearUser();
    // go back to marketing landing
    window.location.href = 'PocketWealth.html';
  });

})();
