// api/usage.js
// ── Shared utility: checkAndIncrementUsage
// Imported by api/meals.js — NOT called via HTTP between functions.
//
// GET /api/usage — returns { count, limit, plan } for authenticated user.
// Frontend calls this on app load to populate the usage indicator.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ── Initialise Firebase Admin (singleton — safe to call multiple times in Vercel)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores \n as literal \n in env vars — replace them
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const adminAuth = getAuth();
const db = getFirestore();

// ── In-memory rate limiter (same pattern as meals.js / scan.js)
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

const PLAN_LIMITS = { free: 2, standard: 15, unlimited: Infinity };

// ── Get or create the user's profile document
async function getUserPlan(uid) {
  const ref = db.collection('profiles').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ plan: 'free', createdAt: new Date().toISOString() });
    return 'free';
  }
  return snap.data().plan || 'free';
}

// ── Today's date as YYYY-MM-DD (UTC)
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// ── Atomic check-and-increment via Firestore transaction
async function atomicIncrement(uid, limit) {
  const today = todayUTC();
  const docId = `${uid}_${today}`;
  const ref = db.collection('usage').doc(docId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data().count || 0) : 0;

    if (current >= limit) {
      return { count: current, limited: true };
    }

    const newCount = current + 1;
    tx.set(ref, { userId: uid, date: today, count: newCount }, { merge: true });
    return { count: newCount, limited: false };
  });
}

// ── Get today's count without incrementing (used by GET /api/usage)
async function getTodayCount(uid) {
  const docId = `${uid}_${todayUTC()}`;
  const snap = await db.collection('usage').doc(docId).get();
  return snap.exists ? (snap.data().count || 0) : 0;
}

// ── Main exported function — used by api/meals.js
export async function checkAndIncrementUsage(idToken) {
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (e) {
    const isNetworkError = e.code === 'auth/network-request-failed';
    return { error: isNetworkError ? 'service_unavailable' : 'unauthorized' };
  }
  const uid = decodedToken.uid;

  let plan;
  try {
    plan = await getUserPlan(uid);
  } catch (e) {
    plan = 'free';
  }
  const limit = PLAN_LIMITS[plan] ?? 2;

  if (limit === Infinity) return { count: 0, limit: Infinity, plan };

  let result;
  try {
    result = await atomicIncrement(uid, limit);
  } catch (e) {
    console.error('[usage] atomicIncrement failed for uid', uid, e.message);
    return { count: 0, limit, plan };
  }

  if (result.limited) return { error: 'limit_reached' };
  return { count: result.count, limit, plan };
}

// ── GET /api/usage — returns current count for authenticated user
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (e) {
    const isNetworkError = e.code === 'auth/network-request-failed';
    return res.status(isNetworkError ? 503 : 401).json({
      error: isNetworkError ? 'Service unavailable' : 'Unauthorized'
    });
  }
  const uid = decodedToken.uid;

  const plan = await getUserPlan(uid).catch(() => 'free');
  const limit = PLAN_LIMITS[plan] ?? 2;
  const count = await getTodayCount(uid).catch(() => 0);

  return res.status(200).json({ count, limit, plan });
}
