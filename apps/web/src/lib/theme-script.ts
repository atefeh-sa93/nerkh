import { THEME_ATTRIBUTE } from '@nerkh/ui';

export const THEME_STORAGE_KEY = 'nerkh-theme';

/**
 * Runs in <head> before the page paints: applies the saved theme choice so
 * there is no flash of the wrong theme. With no saved choice it does nothing
 * and tokens.css follows the OS setting. Storage errors (private mode) are ignored.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='dark'||t==='light')document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t);}catch(e){}})();`;
