import 'server-only';

import { getSupabaseAdmin } from './supabase';

export type AffiliateNotificationPreference =
  | 'application_updates'
  | 'agreement_updates'
  | 'referral_updates'
  | 'commission_created'
  | 'commission_status_updates'
  | 'commission_paid'
  | 'payout_summaries';

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

async function deliver(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.info('affiliate_email_skipped', { code: 'provider_not_configured' });
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Rapid Rise AI <team@rapidriseai.com>',
      to,
      subject,
      html,
    }),
  });
  if (!response.ok) throw new Error(`affiliate_email_http_${response.status}`);
}

export async function sendAffiliateNotification({
  authUserId,
  preference,
  subject,
  html,
}: {
  authUserId: string;
  preference: AffiliateNotificationPreference;
  subject: string;
  html: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: preferences, error: preferenceError } = await supabase
    .from('affiliate_portal_notification_preferences')
    .select(preference)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (preferenceError) {
    console.error('affiliate_email_preference_failed', { code: preferenceError.code });
    return;
  }
  if (preferences && (preferences as unknown as Record<string, boolean>)[preference] === false) return;
  const { data, error } = await supabase.auth.admin.getUserById(authUserId);
  if (error || !data.user?.email) {
    console.error('affiliate_email_recipient_failed', { code: error?.code ?? 'missing_email' });
    return;
  }
  await deliver(data.user.email, subject, html);
}

export async function affiliateAuthUserId(affiliateId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('affiliate_portal_user_links')
    .select('auth_user_id')
    .eq('affiliate_id', affiliateId)
    .maybeSingle();
  if (error) throw new Error(`affiliate_recipient_lookup_${error.code}`);
  return data?.auth_user_id ?? null;
}

export function affiliateAgreementUrl() {
  const configured = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL || 'https://affiliate-system.vercel.app';
  return new URL('/affiliate/agreement', configured).toString();
}
