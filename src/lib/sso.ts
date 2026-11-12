// Prijava iz huba (TomsStudios): povezava do aplikacije lahko nosi fragment
// `#sb_at=<access_token>&sb_rt=<refresh_token>`.
//
// Inline skripta, ki teče sinhrono med razčlenjevanjem HTML (v <head>, pred
// prvim izrisom telesa). Če naslov nosi omenjena žetona, postavi
// `data-sso="pending"` na <html>. Na prijavni strani ta atribut skrije
// prijavni obrazec in pokaže nalagalnik, dokler se samodejna prijava ne
// zaključi (glej src/app/login/page.tsx in [data-sso] pravila v globals.css).
// Ob neuspehu useEffect na /login vrne `data-sso="idle"` in obrazec se pokaže.
//
// Enak vzorec kot data-theme (src/lib/theme.ts): atribut je naveden tudi v
// JSX na <html>, zato ga React ob hidraciji ne povozi.
export const SSO_PREPAINT_SCRIPT = `(function(){try{var h=(location.hash||"").replace(/^#/,"");if(h.indexOf("sb_at=")>-1&&h.indexOf("sb_rt=")>-1){document.documentElement.setAttribute("data-sso","pending");}}catch(e){}})()`;
