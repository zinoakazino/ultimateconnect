import type { TFunction } from 'i18next';

/** Turns whatever went wrong at sign-in / sign-up (Supabase or our own checks) into a sentence for the person. */
export function translateAuthError(t: TFunction, err: any): string {
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '').toLowerCase();
  switch (code) {
    case 'app/invalid-invite-code':
      return t('auth.errorInvalidCode');
    case 'app/profile-missing':
      return t('auth.errorNoProfile');
    case 'app/roster-taken':
      return t('auth.errorRosterTaken');
    case 'app/confirm-email':
    case 'email_not_confirmed':
      return t('auth.errorConfirmEmail');
    case 'app/not-configured':
      return t('auth.errorNotConfigured');
    case 'invalid_credentials':
      return t('auth.errorInvalidCredential');
    case 'user_already_exists':
    case 'email_exists':
      return t('auth.errorEmailInUse');
    case 'weak_password':
      return t('auth.errorWeakPassword');
    case 'validation_failed':
    case 'email_address_invalid':
      return t('auth.errorInvalidEmail');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('auth.errorTooMany');
    default:
      break;
  }
  if (message.includes('invalid login credentials')) return t('auth.errorInvalidCredential');
  if (message.includes('already registered')) return t('auth.errorEmailInUse');
  if (message.includes('password') && message.includes('least')) return t('auth.errorWeakPassword');
  if (message.includes('roster_unavailable')) return t('auth.errorRosterTaken');
  if (message.includes('invalid_invite_code') || message.includes('database error saving new user')) {
    return t('auth.errorInvalidCode');
  }
  if (message.includes('failed to fetch') || message.includes('network')) return t('auth.errorNetwork');
  return t('auth.errorGeneric');
}
