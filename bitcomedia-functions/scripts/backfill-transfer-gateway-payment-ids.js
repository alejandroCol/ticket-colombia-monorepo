/**
 * Reasocia paymentId / preferenceId reales (OnePay o MP) en boletos pagados que quedaron con transfer_*.
 * Uso: node scripts/backfill-transfer-gateway-payment-ids.js [--dry-run]
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS o firebase login (Firestore REST vía token en configstore).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'ticket-colombia-e6267';
const dryRun = process.argv.includes('--dry-run');

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
  }
  return o;
}

async function getDoc(collection, id, headers) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`,
    { headers }
  );
  if (!res.ok) return null;
  return parseFields((await res.json()).fields);
}

async function patchTicket(id, paymentId, preferenceId, headers) {
  if (dryRun) {
    console.log('[dry-run] patch', id, { paymentId, preferenceId });
    return;
  }
  const body = {
    fields: {
      paymentId: { stringValue: String(paymentId) },
      preferenceId: { stringValue: String(preferenceId) },
    },
  };
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/tickets/${id}?updateMask.fieldPaths=paymentId&updateMask.fieldPaths=preferenceId`,
    { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  console.log('updated', id);
}

function isGatewayRef(ref) {
  const r = String(ref || '').trim();
  if (!r || r.startsWith('transfer_')) return false;
  if (/^3526506746-/i.test(r)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(r);
}

async function main() {
  const headers = await authHeaders();
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'tickets' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'preferenceId' },
              op: 'GREATER_THAN_OR_EQUAL',
              value: { stringValue: 'transfer_' },
            },
          },
        },
      }),
    }
  );
  const rows = JSON.parse(await res.text());
  let updated = 0;
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split('/').pop();
    const t = parseFields(row.document.fields);
    const pref = String(t.preferenceId || '');
    if (!pref.startsWith('transfer_')) continue;
    if (t.ticketStatus !== 'paid') continue;
    const fromId = String(t.transferredFrom || '').trim();
    if (!fromId) continue;
    const src = await getDoc('tickets', fromId, headers);
    if (!src) continue;
    const realPref = String(src.preferenceId || src.paymentId || '').trim();
    const realPay = String(src.paymentId || src.preferenceId || '').trim();
    if (!isGatewayRef(realPref) && !isGatewayRef(realPay)) continue;
    const paymentId = realPay || realPref;
    const preferenceId = realPref || realPay;
    if (pref === preferenceId && String(t.paymentId) === paymentId) continue;
    await patchTicket(id, paymentId, preferenceId, headers);
    updated++;
  }
  console.log('done, updated', updated, dryRun ? '(dry-run)' : '');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
