const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/* ================= ROLE CHECK ================= */

async function getRole(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data().role : null;
}

/* ================= CREATE PASS (LOCKED) ================= */

exports.createPass = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new Error('Not authenticated');

  const role = await getRole(context.auth.uid);

  // ONLY teacher/admin can create
  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Permission denied');
  }

  const { studentId, name, destination } = data;

  // conflict detection (SERVER SIDE)
  const existing = await db
    .collection('passes')
    .where('studentId', '==', studentId)
    .where('status', '==', 'OUT')
    .get();

  if (!existing.empty) {
    throw new Error('Student already OUT');
  }

  return db.collection('passes').add({
    studentId,
    name,
    destination,
    status: 'OUT',
    startTime: Date.now(),
    createdBy: context.auth.uid,
  });
});

/* ================= RETURN PASS (LOCKED) ================= */

exports.returnPass = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new Error('Not authenticated');

  const role = await getRole(context.auth.uid);

  if (role !== 'teacher' && role !== 'yard') {
    throw new Error('Permission denied');
  }

  const { passId } = data;

  return db.collection('passes').doc(passId).update({
    status: 'RETURNED',
    endTime: Date.now(),
    returnedBy: context.auth.uid,
  });
});
