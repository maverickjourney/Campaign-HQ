/**
 * Campaign Seat V116 — invitation-only walkthrough inquiry endpoint.
 * Scope: marketing project only. No Supabase access, credentials, or workspace writes.
 * Fail closed: delivery requires explicit server enablement, Resend configuration,
 * and a verified Cloudflare Turnstile token. Never log submitted personal data.
 */
const MAX_BODY_BYTES = 8_000;
const ROLES = new Set(['Campaign leadership', 'Communications', 'Operations / staff', 'Candidate', 'Other']);
const PRIORITIES = new Set(['Communication history', 'Contact relationships', 'Team coordination', 'Post-election continuity', 'A complete walkthrough']);

function sendJson(res, status, message, ok = false) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.status(status).json({ ok, message });
}
const readString = (value, max) => typeof value === 'string' && value.length <= max ? value.trim() : '';
const oneLine = value => value.replace(/[\r\n<>\u0000-\u001f]/g, ' ').trim();
const validEmail = value => value.length < 181 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
const validMailbox = value => validEmail(value) || (/^[^\r\n<>]+<[^\r\n<>@]+@[^\r\n<>@]+\.[^\r\n<>@]+>$/.test(value));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, 'Only POST requests are supported.');
  }
  const host = String(req.headers.host || '').toLowerCase().trim();
  const origin = String(req.headers.origin || '');
  let pageOrigin;
  try {
    pageOrigin = new URL(origin);
    if (pageOrigin.protocol !== 'https:' || pageOrigin.host.toLowerCase() !== host || !host)
      return sendJson(res, 403, 'Request origin could not be verified.');
  } catch {
    return sendJson(res, 403, 'Request origin could not be verified.');
  }
  if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || '')))
    return sendJson(res, 415, 'This form requires JSON.');
  if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES)
    return sendJson(res, 413, 'The request is too long.');

  let b = req.body;
  try { if (typeof b === 'string') b = JSON.parse(b); } catch { return sendJson(res, 400, 'Invalid request.'); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return sendJson(res, 400, 'Invalid request.');
  if (Buffer.byteLength(JSON.stringify(b), 'utf8') > MAX_BODY_BYTES) return sendJson(res, 413, 'The request is too long.');
  if (b.website) return sendJson(res, 400, 'This request could not be accepted.'); // invisible honeypot

  const elapsed = Date.now() - Number(b.startedAt);
  if (!Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 4 * 60 * 60 * 1000)
    return sendJson(res, 400, 'Please refresh the form and try again.');
  const name = readString(b.name, 100);
  const email = readString(b.email, 180);
  const organization = readString(b.organization, 160);
  const role = readString(b.role, 80);
  const priority = readString(b.priority, 100);
  const message = readString(b.message || '', 1_500);
  if (name.length < 2 || organization.length < 2 || !validEmail(email) || !ROLES.has(role) || !PRIORITIES.has(priority) || b.privacyAccepted !== true || !uuid(b.requestId) || message.length > 1_500)
    return sendJson(res, 400, 'Please complete the required fields with valid information.');

  // No sending whatsoever unless ALL server-side settings were explicitly set.
  const key = process.env.CAMPAIGN_SEAT_WALKTHROUGH_RESEND_KEY;
  const from = process.env.CAMPAIGN_SEAT_WALKTHROUGH_FROM || '';
  const to = process.env.CAMPAIGN_SEAT_WALKTHROUGH_TO || '';
  const turnstileSecret = process.env.CAMPAIGN_SEAT_WALKTHROUGH_TURNSTILE_SECRET;
  if (process.env.CAMPAIGN_SEAT_WALKTHROUGH_FORM_ENABLED !== 'true' || !key || !turnstileSecret || !validMailbox(from) || !validEmail(to))
    return sendJson(res, 503, 'Online requests are not enabled. Please use the direct email option.');
  const token = readString(b.turnstileToken, 2_048);
  if (!token || token.length < 6) return sendJson(res, 403, 'Complete the security check and try again.');

  try {
    const verifyBody = new URLSearchParams({ secret: turnstileSecret, response: token });
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody, signal: AbortSignal.timeout(8_000),
    });
    if (!verification.ok) return sendJson(res, 503, 'Security verification is temporarily unavailable. Please try again.');
    const check = await verification.json();
    if (check.success !== true || check.action !== 'campaignseat_walkthrough' || String(check.hostname || '').toLowerCase() !== pageOrigin.hostname.toLowerCase())
      return sendJson(res, 403, 'The security check expired or could not be verified. Please try again.');
  } catch {
    return sendJson(res, 503, 'Security verification is temporarily unavailable. Please try again.');
  }

  const subject = `Campaign Seat walkthrough request — ${oneLine(organization).slice(0, 80)}`;
  const body = [
    'New Campaign Seat private-beta walkthrough inquiry',
    `Name: ${oneLine(name)}`, `Email: ${email}`, `Campaign / organization: ${oneLine(organization)}`,
    `Role: ${role}`, `Area of interest: ${priority}`,
    `Context: ${message.replace(/[<>]/g, ' ') || '(not provided)'}`,
    'Privacy notice acknowledged: yes',
    'Source: https://campaignseat.com/walkthrough/'
  ].join('\n');
  try {
    const delivered = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `campaignseat-walkthrough-${b.requestId}`
      },
      body: JSON.stringify({ from, to: [to], reply_to: email, subject, text: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!delivered.ok) return sendJson(res, 502, 'We could not confirm delivery. Please contact us directly by email.');
    const receipt = await delivered.json();
    if (!receipt || typeof receipt.id !== 'string' || !receipt.id)
      return sendJson(res, 502, 'We could not confirm delivery. Please contact us directly by email.');
    // Resend accepted the notification; final inbox receipt requires separate monitoring.
    return sendJson(res, 200, 'Your request was submitted to Campaign Seat.', true);
  } catch {
    return sendJson(res, 502, 'We could not confirm delivery. Please contact us directly by email.');
  }
}
