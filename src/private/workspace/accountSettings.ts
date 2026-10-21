export type AccountDateFormat = 'dd-mm-yyyy' | 'yyyy-mm-dd' | 'dd/mmm/yyyy';
export type AccountDensity = 'comfortable' | 'compact' | 'spacious';

export type AccountPreferences = {
  defaultView: string;
  dateFormat: AccountDateFormat;
  density: AccountDensity;
};

export type AccountProfile = {
  displayName: string;
  avatarDataUrl: string | null;
};

export const defaultAccountPreferences: AccountPreferences = {
  defaultView: '',
  dateFormat: 'dd-mm-yyyy',
  density: 'comfortable',
};

export function applyAccountPreferences(preferences: AccountPreferences) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.dataset.dateFormat = preferences.dateFormat;
  document.documentElement.dataset.density = preferences.density;
}
