const SESSION_ENDED_KEY = "pmo.session-ended";
const SENTINEL_COUNT = 80;

declare global {
  interface Window {
    __pmoLoginTrapInstalled?: boolean;
  }
}

function loginBaseUrl() {
  return `${window.location.pathname}${window.location.search}`.replace(/#.*$/, "");
}

function isLoginPath(pathname: string) {
  return /\/(en|ar)\/login\/?$/.test(pathname);
}

/**
 * Use the instance pushState (Next.js-patched) so the App Router cannot treat
 * these entries as "unknown" and skip them in a single Back jump to Entra.
 * Unique hashes prevent the browser from coalescing them.
 */
function armSentinels() {
  const base = loginBaseUrl();
  for (let i = 0; i < SENTINEL_COUNT; i += 1) {
    window.history.pushState({ __pmoLoginTrap: i }, "", `${base}#s${i}`);
  }
}

export function installLoginHistoryTrap() {
  if (typeof window === "undefined" || window.__pmoLoginTrapInstalled) return;
  if (!isLoginPath(window.location.pathname)) return;

  window.__pmoLoginTrapInstalled = true;
  armSentinels();

  const onPopState = () => {
    if (!isLoginPath(window.location.pathname)) {
      const locale = window.location.pathname.split("/").filter(Boolean)[0];
      const safe = locale === "ar" ? "ar" : "en";
      window.location.replace(`/${safe}/login?error=session_expired`);
      return;
    }
    window.history.pushState(
      { __pmoLoginTrap: Date.now() },
      "",
      `${loginBaseUrl()}#s${Date.now()}`,
    );
  };
  window.addEventListener("popstate", onPopState, true);

  window.addEventListener("pageshow", (event: PageTransitionEvent) => {
    if (event.persisted) armSentinels();
  });
}

/**
 * Runs from the locale layout before Next.js hydrates.
 * Also bounces bfcache restores of protected pages after logout.
 */
export const LOGIN_HISTORY_TRAP_SCRIPT = `(function(){
  var KEY="pmo.session-ended";
  var path=location.pathname;
  var isLogin=/\\/(en|ar)\\/login\\/?$/.test(path);
  var isEmergency=path.indexOf("emergency-login")!==-1;
  function ended(){
    try{return sessionStorage.getItem(KEY)==="1";}catch(e){return false;}
  }
  function toLogin(){
    var locale=path.split("/").filter(Boolean)[0];
    if(locale!=="en"&&locale!=="ar")locale="en";
    location.replace("/"+locale+"/login?error=session_expired");
  }
  function bounceIfEnded(){
    if(ended()&&!isLogin&&!isEmergency)toLogin();
  }
  bounceIfEnded();
  addEventListener("pageshow",function(e){
    if(!e.persisted)return;
    path=location.pathname;
    isLogin=/\\/(en|ar)\\/login\\/?$/.test(path);
    isEmergency=path.indexOf("emergency-login")!==-1;
    bounceIfEnded();
  });
  if(!isLogin||window.__pmoLoginTrapInstalled)return;
  window.__pmoLoginTrapInstalled=true;
  function base(){return (location.pathname+location.search).replace(/#.*$/,"");}
  function arm(){
    var b=base();
    for(var i=0;i<80;i++)history.pushState({__pmoLoginTrap:i},"",b+"#s"+i);
  }
  arm();
  addEventListener("popstate",function(){
    if(!/\\/(en|ar)\\/login\\/?$/.test(location.pathname)){
      toLogin();
      return;
    }
    history.pushState({__pmoLoginTrap:Date.now()},"",base()+"#s"+Date.now());
  },true);
  addEventListener("pageshow",function(e){if(e.persisted)arm();});
})();`;
