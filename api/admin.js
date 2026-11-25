// Account management for the Amasga–Zamson app. Runs on Vercel with the
// Firebase Admin SDK, so only the server can create users, set passwords,
// change roles or deactivate accounts. Needs FIREBASE_SERVICE_ACCOUNT (the
// service-account JSON key) as a Vercel environment variable.
const admin = require('firebase-admin');

const ROLES = ['admin', 'entry', 'member'];
const UNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pwOk = p => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const synthEmail = u => `${u}@users.amasga-zamson.app`;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new HttpError(500, 'Server not configured: FIREBASE_SERVICE_ACCOUNT is not set in Vercel.');
  let sa;
  try { sa = JSON.parse(raw); } catch (e) { throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT is not valid JSON.'); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

async function caller(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) throw new HttpError(401, 'Please log in again.');
  let tok;
  try { tok = await admin.auth().verifyIdToken(m[1], true); } catch (e) { throw new HttpError(401, 'Your session has expired. Please log in again.'); }
  const snap = await admin.firestore().doc('users/' + tok.uid).get();
  const me = snap.exists ? snap.data() : null;
  if (!me || me.active === false || me.role !== 'admin') throw new HttpError(403, 'Only an Admin can manage accounts.');
  return { uid: tok.uid, ...me };
}

async function activeAdmins(db) {
  const q = await db.collection('users').where('role', '==', 'admin').get();
  return q.docs.filter(d => d.data().active !== false).map(d => d.id);
}

function clean(b) {
  const name = String(b.name || '').trim().slice(0, 80);
  const username = String(b.username || '').trim().toLowerCase();
  const email = String(b.email || '').trim().toLowerCase();
  return { name, username, email };
}

async function createAccount(db, b, role, by) {
  const { name, username, email } = clean(b);
  if (!name) throw new HttpError(400, 'Enter the full name.');
  if (!UNAME.test(username)) throw new HttpError(400, 'Username: 3–30 characters; letters, numbers, dot, dash or underscore.');
  if (email && !EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email or leave it blank.');
  if (!pwOk(b.password)) throw new HttpError(400, 'Password needs 8+ characters with letters and a number.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Unknown role.');
  const unameRef = db.doc('usernames/' + username);
  if ((await unameRef.get()).exists) throw new HttpError(409, 'That username is already taken.');
  const authEmail = email || synthEmail(username);
  let user;
  try {
    user = await admin.auth().createUser({ email: authEmail, password: b.password, displayName: name });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpError(409, 'Another account already uses that email.');
    throw new HttpError(400, e.message);
  }
  const now = new Date().toISOString();
  await db.doc('users/' + user.uid).set({ name, username, email, authEmail, role, active: true, createdAt: now, createdBy: by });
  await unameRef.set({ email: authEmail, uid: user.uid });
  return { uid: user.uid, authEmail };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  try {
    init();
    const db = admin.firestore();
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = b.action;

    if (action === 'status') {
      const any = await db.collection('users').limit(1).get();
      return res.json({ setup: any.empty });
    }

    if (action === 'bootstrap') {
      const any = await db.collection('users').limit(1).get();
      if (!any.empty) throw new HttpError(403, 'The Admin account already exists. Please log in.');
      const r = await createAccount(db, b, 'admin', 'setup');
      return res.json(r);
    }

    const me = await caller(req);

    if (action === 'create') {
      const r = await createAccount(db, b, b.role, me.uid);
      return res.json(r);
    }

    const uid = String(b.uid || '');
    const ref = db.doc('users/' + uid);
    const snap = uid && await ref.get();
    if (!snap || !snap.exists) throw new HttpError(404, 'Account not found.');
    const cur = snap.data();

    if (action === 'update') {
      const upd = {}, authUpd = {};
      if (b.name !== undefined) {
        const name = String(b.name).trim().slice(0, 80);
        if (!name) throw new HttpError(400, 'Enter the full name.');
        upd.name = name; authUpd.displayName = name;
      }
      if (b.email !== undefined) {
        const email = String(b.email).trim().toLowerCase();
        if (email && !EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email or leave it blank.');
        if (email !== (cur.email || '')) {
          upd.email = email; upd.authEmail = email || synthEmail(cur.username); authUpd.email = upd.authEmail;
        }
      }
      if (b.password) {
        if (!pwOk(b.password)) throw new HttpError(400, 'Password needs 8+ characters with letters and a number.');
        authUpd.password = b.password;
      }
      const demoting = (b.role !== undefined && b.role !== 'admin' && cur.role === 'admin');
      const deactivating = (b.active === false && cur.active !== false && cur.role === 'admin');
      if (b.role !== undefined) {
        if (!ROLES.includes(b.role)) throw new HttpError(400, 'Unknown role.');
        if (uid === me.uid && b.role !== 'admin') throw new HttpError(400, "You can't remove your own Admin role.");
        upd.role = b.role;
      }
      if (b.active !== undefined) {
        if (uid === me.uid && b.active === false) throw new HttpError(400, "You can't deactivate your own account.");
        upd.active = !!b.active; authUpd.disabled = !b.active;
      }
      if ((demoting || deactivating) && (await activeAdmins(db)).length < 2) throw new HttpError(400, 'Keep at least one active Admin.');
      if (Object.keys(authUpd).length) {
        try { await admin.auth().updateUser(uid, authUpd); }
        catch (e) { if (e.code === 'auth/email-already-exists') throw new HttpError(409, 'Another account already uses that email.'); throw new HttpError(400, e.message); }
      }
      if (authUpd.password || authUpd.disabled) await admin.auth().revokeRefreshTokens(uid);
      if (Object.keys(upd).length) await ref.update({ ...upd, updatedAt: new Date().toISOString(), updatedBy: me.uid });
      if (upd.authEmail) await db.doc('usernames/' + cur.username).set({ email: upd.authEmail, uid });
      return res.json({ ok: true });
    }

    if (action === 'delete') {
      if (uid === me.uid) throw new HttpError(400, "You can't delete your own account.");
      if (cur.role === 'admin' && cur.active !== false && (await activeAdmins(db)).length < 2) throw new HttpError(400, 'Keep at least one active Admin.');
      try { await admin.auth().deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
      await ref.delete();
      if (cur.username) await db.doc('usernames/' + cur.username).delete();
      return res.json({ ok: true });
    }

    throw new HttpError(400, 'Unknown action.');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    res.status(status).json({ error: e.status ? e.message : 'Server error: ' + (e.message || 'unknown') });
  }
};
