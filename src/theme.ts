/**
 * The brand look is light. Team members can switch the dashboard to dark;
 * customer pages always use the brand look.
 */
export type Theme = 'light' | 'dark'

const KEY = 'whimsy-bloom:theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Remembering the theme is a nicety only.
  }
}

export function applyTheme(theme: Theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
}
