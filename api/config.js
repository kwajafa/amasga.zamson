// Returns the Firebase *web* config (public by design; security comes from
// Firebase Auth + firestore.rules). Set FIREBASE_WEB_CONFIG in Vercel to the
// JSON object Firebase shows under Project settings → Your apps → Web app.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const raw = process.env.FIREBASE_WEB_CONFIG;
  if (!raw) return res.status(200).json({ error: 'FIREBASE_WEB_CONFIG is not set in Vercel.' });
  try {
    const c = JSON.parse(raw);
    if (!c.apiKey || !c.projectId) throw new Error('missing apiKey/projectId');
    res.status(200).json(c);
  } catch (e) {
    res.status(200).json({ error: 'FIREBASE_WEB_CONFIG is not valid JSON: ' + e.message });
  }
};
