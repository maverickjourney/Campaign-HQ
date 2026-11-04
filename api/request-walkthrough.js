/*
 * Campaign Seat public website: controlled, email-only beta inquiry endpoint.
 * No Supabase access, no database writes and no campaign workspace credentials.
 * Deliberately disabled until marketing-specific Resend credentials are configured.
 * Never log contact content or environment-variable values.
 */
const reply = (res, status, message, ok=false) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json({ok,message});
};
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0,max+1) : '';
const safeLine = value => value.replace(/[\r\n<>]/g,' ').replace(/[\u0000-\u001f]/g,' ').trim();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n<>]/.test(value);
const allowedRoles = new Set(['Campaign leadership','Communications','Operations / staff','Candidate','Other']);
const allowedPriorities = new Set(['Communication history','Contact relationships','Team coordination','Post-election continuity','A complete walkthrough']);
export default async function handler(req,res) {
  if (req.method !== 'POST') {res.setHeader('Allow','POST');return reply(res,405,'Only POST requests are supported.');}
  const origin=req.headers.origin;
  try {if(origin && new URL(origin).host !== req.headers.host)return reply(res,403,'Invalid request origin.');}
  catch{return reply(res,403,'Invalid request origin.');}
  if (!String(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,'This form requires JSON.');
  if (Number(req.headers['content-length']||0)>8000)return reply(res,413,'The request is too long.');
  const b=req.body||{};
  if(typeof b!=='object'||Array.isArray(b))return reply(res,400,'Invalid request.');
  if (clean(b.website,180))return reply(res,400,'This request could not be accepted.'); // honeypot
  const elapsed=Date.now()-Number(b.startedAt);
  if(!Number.isFinite(elapsed)||elapsed<2500||elapsed>4*60*60*1000)return reply(res,400,'Please refresh the form and try again.');
  const name=clean(b.name,100),email=clean(b.email,180),organization=clean(b.organization,160),role=clean(b.role,80),priority=clean(b.priority,100),message=clean(b.message,1500);
  if(name.length<2||name.length>100||!validEmail(email)||email.length>180||organization.length<2||organization.length>160||!allowedRoles.has(role)||!allowedPriorities.has(priority)||message.length>1500||b.privacyAccepted!==true)
    return reply(res,400,'Please complete the required fields with valid information.');
  if(process.env.CAMPAIGN_SEAT_WALKTHROUGH_FORM_ENABLED!=='true'||!process.env.CAMPAIGN_SEAT_WALKTHROUGH_RESEND_KEY)
    return reply(res,503,'Online requests are not enabled on this preview. Please contact the Campaign Seat team by email instead.');
  const from=process.env.CAMPAIGN_SEAT_WALKTHROUGH_FROM;
  const to=process.env.CAMPAIGN_SEAT_WALKTHROUGH_TO;
  if(!from||!to)return reply(res,503,'Online requests are not configured yet. Please contact the Campaign Seat team by email.');
  const subject=`Campaign Seat walkthrough inquiry — ${safeLine(organization).slice(0,85)}`;
  const text=[
    'New Campaign Seat private walkthrough inquiry',
    `Name: ${safeLine(name)}`,`Email: ${safeLine(email)}`,`Campaign or organization: ${safeLine(organization)}`,
    `Role: ${role}`,`Interest: ${priority}`,`Message: ${message.replace(/[<>]/g,' ')||'(not provided)'}`,
    'Privacy notice acknowledged: yes',
    'Source: campaignseat.com/walkthrough/'
  ].join('\n');
  try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${process.env.CAMPAIGN_SEAT_WALKTHROUGH_RESEND_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],reply_to:email,subject,text}),signal:AbortSignal.timeout(10000)});
    if(!r.ok)return reply(res,502,'We could not deliver your request. Please contact the team directly by email.');
    return reply(res,200,'Request received.',true);
  }catch{return reply(res,502,'We could not deliver your request. Please contact the team directly by email.');}
}
