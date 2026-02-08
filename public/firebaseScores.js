// Helper functions to post and get scores using Firebase Realtime Database REST API
// Usage:
// 1) Include this file in your HTML: <script src="./firebaseScores.js"></script>
// 2) Call postScoreToFirebase(databaseUrl, score, options) or getScoresFromFirebase(databaseUrl, options)
// databaseUrl example: 'https://PROJECT_ID-default-rtdb.firebaseio.com'
const databaseUrl = 'https://type-runner-88004-default-rtdb.firebaseio.com/'; // replace with your own DB URL if needed


export  async function postScoreToFirebase( score, options = {}) {
  if (!databaseUrl) throw new Error('databaseUrl is required');
  const base = databaseUrl.replace(/\/$/, '');
  const authQuery = options.auth ? '?auth=' + encodeURIComponent(options.auth) : '';
  const url = `${base}/scores.json${authQuery}`;

  const payload = {
    score: Number(score) || 0,
    name: options.name || null,
    meta: options.meta || null,
    timestamp: new Date().toISOString()
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => null);
    throw new Error(`Failed to post score: ${res.status} ${res.statusText} ${body || ''}`);
  }
  return res.json();
}

export async function getScoresFromFirebase( options = {}) {
  if (!databaseUrl) throw new Error('databaseUrl is required');
  const base = databaseUrl.replace(/\/$/, '');
  const authQuery = options.auth ? '?auth=' + encodeURIComponent(options.auth) : '';
  const url = `${base}/scores.json${authQuery}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const body = await res.text().catch(() => null);
    throw new Error(`Failed to get scores: ${res.status} ${res.statusText} ${body || ''}`);
  }

  const data = await res.json();
  if (!data) return [];
  // Realtime DB returns an object of records; convert to array
  const arr = Object.keys(data).map(key => ({ id: key, ...data[key] }));
  // Default: sort by numeric score descending
  arr.sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)));

  if (options.limit && Number(options.limit) > 0) return arr.slice(0, Number(options.limit));
  return arr;
}

// Expose for browser global usage
if (typeof window !== 'undefined') {
  window.postScoreToFirebase = postScoreToFirebase;
  window.getScoresFromFirebase = getScoresFromFirebase;
}

// CommonJS export (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { postScoreToFirebase, getScoresFromFirebase };
}
