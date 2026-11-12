// VAPID material comes from the host environment only. Never log these values.
// Coach-channel notifications (WhatsApp/SMS) are a separate track and do not use these keys.

export function vapidPublicKey(): string | null {
  const key = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  return key || null;
}

/** Null when any of the three sender values is missing. Sending then becomes a no-op. */
export function vapidSenderConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = vapidPublicKey();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (process.env.VAPID_SUBJECT || "").trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
