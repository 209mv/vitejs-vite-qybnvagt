import { useEffect, useRef, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { BrowserMultiFormatReader } from '@zxing/browser';

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: 'AIzaSyDg-JVhD7ah6yZPCgvw3g1j6MJlWzDVluM',
  authDomain: 'flowpasssystem.firebaseapp.com',
  projectId: 'flowpasssystem',
  storageBucket: 'flowpasssystem.appspot.com',
  messagingSenderId: '353086720712',
  appId: '1:353086720712:web:371f4684562f1146ba33fd',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

/* ================= APP ================= */

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState('');

  const [page, setPage] = useState('dashboard');

  const [passes, setPasses] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');

  const [mode, setMode] = useState('IMMEDIATE');
  const [customMinutes, setCustomMinutes] = useState(5);
  const [hasBelongings, setHasBelongings] = useState(false);

  const [scannerRunning, setScannerRunning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole('');
        return;
      }

      setUser(u);

      const snap = await getDoc(doc(db, 'users', u.uid));

      if (snap.exists()) {
        setRole(snap.data().role || '');
      }
    });
  }, []);

  /* ================= REALTIME PASSES ================= */

  useEffect(() => {
    const q = query(collection(db, 'passes'), orderBy('startTime', 'desc'));

    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setPasses(data);
    });
  }, []);

  /* ================= REALTIME LOGS ================= */

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('time', 'desc'));

    return onSnapshot(q, (snap) => {
      setLogs(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });
  }, []);

  /* ================= LOGIN ================= */

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      alert(err.message);
    }
  }

  /* ================= LOGOUT ================= */

  async function logout() {
    try {
      if (scannerRef.current) {
        scannerRef.current.reset();
      }

      await signOut(auth);

      setUser(null);
      setRole('');
      setPasses([]);
      setLogs([]);
      setPage('dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  }

  /* ================= TIME ================= */

  function timeOut(startTime: number) {
    return Math.floor((Date.now() - startTime) / 60000);
  }

  /* ================= PASS MODES ================= */

  function computeEndTime() {
    const now = Date.now();

    switch (mode) {
      case 'IMMEDIATE':
        return now;

      case 'END_OF_PERIOD':
        return now + 45 * 60000;

      case 'CUSTOM_TIME':
        return now + customMinutes * 60000;

      default:
        return null;
    }
  }

  /* ================= CREATE PASS ================= */

  async function createPass() {
    if (!studentId || !name || !destination) {
      alert('Fill all fields');
      return;
    }

    const duplicate = passes.find(
      (p) => p.studentId === studentId && p.status === 'OUT'
    );

    if (duplicate) {
      alert('Student already has active pass');
      return;
    }

    try {
      await addDoc(collection(db, 'passes'), {
        studentId,
        name,
        destination,

        status: 'OUT',

        startTime: Date.now(),

        endTime: computeEndTime(),

        mode,

        belongings: hasBelongings,

        createdBy: user.uid,
      });

      await addDoc(collection(db, 'logs'), {
        action: 'PASS_CREATED',
        studentId,
        destination,
        time: Date.now(),
      });

      setStudentId('');
      setName('');
      setDestination('');
    } catch (err: any) {
      alert(err.message);
    }
  }

  /* ================= RETURN PASS ================= */

  async function returnPass(id: string) {
    try {
      await updateDoc(doc(db, 'passes', id), {
        status: 'RETURNED',
        returnTime: Date.now(),
      });

      await addDoc(collection(db, 'logs'), {
        action: 'PASS_RETURNED',
        passId: id,
        time: Date.now(),
      });
    } catch (err: any) {
      alert(err.message);
    }
  }

  /* ================= SCANNER ================= */

  async function startScanner() {
    if (scannerRunning) return;

    if (!videoRef.current) return;

    setScannerRunning(true);

    const reader = new BrowserMultiFormatReader();

    scannerRef.current = reader;

    const devices = await BrowserMultiFormatReader.listVideoInputDevices();

    const deviceId = devices[0]?.deviceId;

    let locked = false;

    reader.decodeFromVideoDevice(deviceId, videoRef.current, async (result) => {
      if (!result || locked) return;

      locked = true;

      const code = result.getText();

      setStudentId(code);

      const found = passes.find((p) => p.studentId === code);

      if (found) {
        setName(found.name);
      }

      console.log('SCANNED:', code);

      reader.reset();

      setScannerRunning(false);
    });
  }

  /* ================= LOGIN SCREEN ================= */

  if (!user) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0f172a',
          color: 'white',
          fontFamily: 'Arial',
        }}
      >
        <div
          style={{
            width: 350,
            padding: 30,
            borderRadius: 16,
            background: '#111827',
          }}
        >
          <h1>FlowSIS</h1>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle}
          />

          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
          />

          <button style={buttonStyle} onClick={login}>
            Login
          </button>
        </div>
      </div>
    );
  }

  /* ================= ANALYTICS ================= */

  const outCount = passes.filter((p) => p.status === 'OUT').length;

  const returnedCount = passes.filter((p) => p.status === 'RETURNED').length;

  const chartData = [
    {
      name: 'OUT',
      value: outCount,
    },
    {
      name: 'RETURNED',
      value: returnedCount,
    },
  ];

  /* ================= UI ================= */

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#f1f5f9',
        fontFamily: 'Arial',
      }}
    >
      {/* SIDEBAR */}

      <div
        style={{
          width: 240,
          background: '#0f172a',
          color: 'white',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <h2>FlowSIS</h2>

        <button style={sidebarButton} onClick={() => setPage('dashboard')}>
          Dashboard
        </button>

        <button style={sidebarButton} onClick={() => setPage('passes')}>
          Active Passes
        </button>

        {(role === 'teacher' || role === 'admin') && (
          <button style={sidebarButton} onClick={() => setPage('create')}>
            Create Pass
          </button>
        )}

        <button style={sidebarButton} onClick={() => setPage('scanner')}>
          Scanner
        </button>

        <button style={sidebarButton} onClick={() => setPage('logs')}>
          Audit Logs
        </button>

        <button
          style={{
            ...sidebarButton,
            marginTop: 'auto',
            background: '#dc2626',
          }}
          onClick={logout}
        >
          Logout
        </button>
      </div>

      {/* MAIN */}

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 25,
        }}
      >
        {/* DASHBOARD */}

        {page === 'dashboard' && (
          <div>
            <h1>Dashboard</h1>

            <div
              style={{
                display: 'flex',
                gap: 20,
                marginTop: 20,
              }}
            >
              <div style={cardStyle}>
                <h3>Active</h3>
                <h1>{outCount}</h1>
              </div>

              <div style={cardStyle}>
                <h3>Returned</h3>
                <h1>{returnedCount}</h1>
              </div>

              <div style={cardStyle}>
                <h3>Total</h3>
                <h1>{passes.length}</h1>
              </div>
            </div>

            <div
              style={{
                marginTop: 30,
                width: 420,
                height: 320,
                background: 'white',
                borderRadius: 16,
                padding: 20,
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} dataKey="value">
                    <Cell fill="#ef4444" />
                    <Cell fill="#22c55e" />
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CREATE PASS */}

        {page === 'create' && (
          <div>
            <h1>Create Pass</h1>

            <div style={formContainer}>
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student ID"
                style={inputStyle}
              />

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Student Name"
                style={inputStyle}
              />

              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination"
                style={inputStyle}
              />

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={inputStyle}
              >
                <option value="IMMEDIATE">Immediate</option>

                <option value="END_OF_PERIOD">End Of Period</option>

                <option value="WHEN_AVAILABLE">When Available</option>

                <option value="CUSTOM_TIME">Custom Time</option>
              </select>

              {mode === 'CUSTOM_TIME' && (
                <input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  placeholder="Minutes"
                  style={inputStyle}
                />
              )}

              <label>
                <input
                  type="checkbox"
                  checked={hasBelongings}
                  onChange={(e) => setHasBelongings(e.target.checked)}
                />
                With belongings
              </label>

              <button style={buttonStyle} onClick={createPass}>
                Create Pass
              </button>
            </div>
          </div>
        )}

        {/* PASSES */}

        {page === 'passes' && (
          <div>
            <h1>Active Passes</h1>

            <div
              style={{
                display: 'grid',
                gap: 12,
                marginTop: 20,
              }}
            >
              {passes.map((p) => (
                <div key={p.id} style={passCard}>
                  <div>
                    <h3>{p.name}</h3>

                    <p>ID: {p.studentId}</p>

                    <p>Destination: {p.destination}</p>

                    <p>Status: {p.status}</p>

                    <p>Mode: {p.mode}</p>

                    <p>
                      Out For:{' '}
                      {p.startTime ? `${timeOut(p.startTime)} min` : '0 min'}
                    </p>

                    {p.belongings && <p>With belongings</p>}
                  </div>

                  {p.status === 'OUT' && role !== 'student' && (
                    <button
                      style={buttonStyle}
                      onClick={() => returnPass(p.id)}
                    >
                      Mark Returned
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCANNER */}

        {page === 'scanner' && (
          <div>
            <h1>Code 39 Scanner</h1>

            <video
              ref={videoRef}
              style={{
                width: 400,
                borderRadius: 12,
                marginTop: 20,
              }}
            />

            <div style={{ marginTop: 20 }}>
              <button style={buttonStyle} onClick={startScanner}>
                Start Scanner
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3>Scanned Student ID:</h3>

              <p>{studentId || 'None scanned yet'}</p>
            </div>
          </div>
        )}

        {/* LOGS */}

        {page === 'logs' && (
          <div>
            <h1>Audit Logs</h1>

            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gap: 10,
              }}
            >
              {logs.map((l: any) => (
                <div key={l.id} style={logCard}>
                  <strong>{l.action}</strong>

                  <div>{l.studentId && `Student: ${l.studentId}`}</div>

                  <div>{l.destination && `Destination: ${l.destination}`}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const inputStyle: any = {
  width: '100%',
  padding: 12,
  marginTop: 10,
  borderRadius: 10,
  border: '1px solid #ccc',
  fontSize: 15,
  boxSizing: 'border-box',
};

const buttonStyle: any = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  cursor: 'pointer',
  marginTop: 12,
};

const sidebarButton: any = {
  padding: 12,
  borderRadius: 10,
  border: 'none',
  background: '#1e293b',
  color: 'white',
  textAlign: 'left',
  cursor: 'pointer',
};

const cardStyle: any = {
  background: 'white',
  padding: 20,
  borderRadius: 16,
  width: 180,
};

const passCard: any = {
  background: 'white',
  padding: 18,
  borderRadius: 16,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const logCard: any = {
  background: 'white',
  padding: 15,
  borderRadius: 12,
};

const formContainer: any = {
  marginTop: 20,
  background: 'white',
  padding: 20,
  borderRadius: 16,
  width: 450,
};
