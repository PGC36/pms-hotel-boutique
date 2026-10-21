import { getUserFacingErrorMessage, httpClient } from './http-client';
import {
  defaultAccountPreferences,
  type AccountPreferences,
  type AccountProfile,
} from '@/private/workspace/accountSettings';

export type AccountData = {
  id: string;
  displayName: string;
  email: string;
  avatarDataUrl: string | null;
  defaultView: string;
  dateFormat: AccountPreferences['dateFormat'];
  density: AccountPreferences['density'];
};

type AccountResponse = Omit<AccountData, 'avatarDataUrl'> & { avatarDataUrl?: string | null };

function normalize(response: AccountResponse): AccountData {
  return {
    ...response,
    avatarDataUrl: response.avatarDataUrl ?? null,
    defaultView: response.defaultView ?? defaultAccountPreferences.defaultView,
    dateFormat:
      response.dateFormat === 'yyyy-mm-dd' || response.dateFormat === 'dd/mmm/yyyy'
        ? response.dateFormat
        : defaultAccountPreferences.dateFormat,
    density:
      response.density === 'compact' || response.density === 'spacious'
        ? response.density
        : defaultAccountPreferences.density,
  };
}

async function request<T>(call: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(getUserFacingErrorMessage(error, fallback));
  }
}

export const accountService = {
  get: () =>
    request(
      async () => normalize(await httpClient.get<AccountResponse>('/auth/account')),
      'No pudimos cargar tu perfil y preferencias. Intenta nuevamente.',
    ),
  updateProfile: (profile: AccountProfile) =>
    request(
      async () =>
        normalize(
          await httpClient.put<AccountResponse>('/auth/account/profile', {
            displayName: profile.displayName,
            avatarDataUrl: profile.avatarDataUrl,
          }),
        ),
      'No pudimos guardar tu perfil. Intenta nuevamente.',
    ),
  updatePreferences: (preferences: AccountPreferences) =>
    request(
      async () =>
        normalize(
          await httpClient.put<AccountResponse>('/auth/account/preferences', preferences),
        ),
      'No pudimos guardar tus preferencias. Intenta nuevamente.',
    ),
};
