// Skupne konstante za temo (svetla / temna / sistem).
//
// Privzeta tema je TEMNA: če uporabnik ni izbral ničesar, se uporabi "dark".
// "system" pomeni: sledi nastavitvi operacijskega sistema (prefers-color-scheme).
// Izbrana vrednost se hrani v localStorage; dejansko stanje na <html> je vedno
// konkretno "light" ali "dark" prek atributa data-theme.

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "pisi-theme";

/** Privzeta izbira, kadar v localStorage ni shranjene veljavne vrednosti. */
export const DEFAULT_THEME: ThemePreference = "dark";

/**
 * Inline skripta, ki teče sinhrono med razčlenjevanjem HTML (pred prvim
 * izrisom), da se prava tema nastavi brez utripa. Prebere shranjeno izbiro:
 * "system" razreši prek sistemske nastavitve, "light"/"dark" uporabi
 * neposredno, karkoli drugega (tudi manjkajočo vrednost) pa nadomesti s
 * privzeto temno temo. Vse v try/catch, ker localStorage ni vedno na voljo.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(p==="system"){p=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}else if(p!=="light"&&p!=="dark"){p="dark";}document.documentElement.setAttribute("data-theme",p);}catch(e){}})()`;
