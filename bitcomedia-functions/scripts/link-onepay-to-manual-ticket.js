/**
 * Vincula un cobro OnePay huérfano al boleto manual activo (conciliación AURA / sala).
 * node scripts/link-onepay-to-manual-ticket.js [--dry-run]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'ticket-colombia-e6267';
const dryRun = process.argv.includes('--dry-run');

const ONEPAY_PAYMENT_ID = '01a07792-b5e7-708b-ac50-3aa5673fca65';
const DISABLED_TICKET_ID = 'gkVCAGzFxMeIDZc2aD58';
const ACTIVE_MANUAL_TICKET_ID = '0fa370cf-ab6c-45cd-a7c6-8f615a17b843';
const ONEPAY_AMOUNT_COP = 902700;

function loadToken() {
  const cfgPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg.tokens?.access_token) {
      return { mode: 'token', token: cfg.tokens.access_token };
    }
  }
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath && fs.existsSync(saPath)) {
    return { mode: 'sa', sa: require(path.resolve(saPath)) };
  }
  throw new Error('No firebase login token ni service account');
}

async function authHeaders() {
  const auth = loadToken();
  if (auth.mode === 'token') {
    return { Authorization: `Bearer ${auth.token}` };
  }
  const { GoogleAuth } = require('google-auth-library');
  const client = new GoogleAuth({
    credentials: auth.sa,
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  const token = await client.getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

function parseFields(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if ('stringValue' in v) o[k] = v.stringValue;
    else if ('integerValue' in v) o[k] = parseInt(v.integerValue, 10);
    else if ('mapValue' in v) o[k] = v.mapValue;
  }
  return o;
}

async function getDoc(id, headers) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/tickets/${id}`,
    { headers }
  );
  if (!res.ok) throw new Error(`${id}: ${res.status}`);
  return parseFields((await res.json()).fields);
}

async function patchDoc(id, fieldPaths, fieldsBody, headers) {
  const mask = fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  if (dryRun) {
    console.log('[dry-run] patch', id, fieldPaths, fieldsBody);
    return;
  }
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/tickets/${id}?${mask}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fieldsBody }),
    }
  );
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  console.log('updated', id);
}

async function main() {
  const headers = await authHeaders();
  const active = await getDoc(ACTIVE_MANUAL_TICKET_ID, headers);
  const disabled = await getDoc(DISABLED_TICKET_ID, headers);
  console.log('active manual', {
    eventId: active.eventId,
    amount: active.amount,
    paymentId: active.paymentId,
    status: active.status,
  });
  console.log('disabled online', {
    paymentId: disabled.paymentId,
    preferenceId: disabled.preferenceId,
    status: disabled.status,
  });

  const linkedAt = new Date().toISOString();
  await patchDoc(
    ACTIVE_MANUAL_TICKET_ID,
    ['paymentId', 'preferenceId', 'onepayLinkedFromTicketId', 'onepayLinkedAmountCOP', 'onepayLinkedAt'],
    {
      paymentId: { stringValue: ONEPAY_PAYMENT_ID },
      preferenceId: { stringValue: ONEPAY_PAYMENT_ID },
      onepayLinkedFromTicketId: { stringValue: DISABLED_TICKET_ID },
      onepayLinkedAmountCOP: { integerValue: String(ONEPAY_AMOUNT_COP) },
      onepayLinkedAt: { stringValue: linkedAt },
    },
    headers
  );

  await patchDoc(
    DISABLED_TICKET_ID,
    ['onepayReconciledToTicketId', 'onepayReconciledAt'],
    {
      onepayReconciledToTicketId: { stringValue: ACTIVE_MANUAL_TICKET_ID },
      onepayReconciledAt: { stringValue: linkedAt },
    },
    headers
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
