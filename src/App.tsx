import { useEffect, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "flowpasssystem",
  storageBucket: "flowpasssystem.appspot.com",
  messagingSenderId: "XXX",
  appId: "XXX",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= APP ================= */

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState("");

  const [page, setPage] = useState("dashboard");

  const [passes, setPasses] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole("");
        return;
      }

      setUser(u);

      const snap = await getDoc(doc(db, "users", u.uid));
      setRole(snap.exists() ? snap.data().role : "");
    });
  }, []);

  /* ================= REALTIME PASSES ================= */

  useEffect(() => {
    return onSnapshot(collection(db, "passes"), (snap) => {
      setPasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  /* ================= REALTIME LOGS ================= */

  useEffect(() => {
    return onSnapshot(query(collection(db, "logs")), (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  /* ================= LOGIN ================= */

  async function login() {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setRole("");
    setPage("dashboard");
  }

  /* ================= TIME TRACKER ================= */

  function minutesOut(startTime: number) {
    return Math.floor((Date.now() - startTime) / 60000);
  }

  /* ================= CREATE PASS ================= */

  async function createPass() {
    if (!studentId || !name || !destination) return;

    await addDoc(collection(db, "passes"), {
      studentId,
      name,
      destination,
      status: "OUT",
      startTime: Date.now(),
    });

    setStudentId("");
    setName("");
    setDestination("");
  }

  /* ================= RETURN PASS ================= */

  async function returnPass(id: string) {
    await addDoc(collection(db, "logs"), {
      action: "RETURN",
      passId: id,
      time: Date.now(),
    });
  }

  /* ================= BARCODE SCANNER (FIXED) ================= */

  async function startScanner() {
    if (!videoRef.current) return;

    const reader = new BrowserMultiFormatReader();

    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    const deviceId = devices[0]?.deviceId;

    // IMPORTANT: NO reset(), NO manual control usage
    scannerRef.current = reader.decodeFromVideoDevice(
      deviceId,
      videoRef.current,
      (result) => {
        if (result) {
          setStudentId(result.getText());
        }
      }
    );
  }

  function stopScanner() {
    try {
      scannerRef.current?.stop?.();
    } catch {}
  }

  /* ================= LOGIN SCREEN ================= */

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>SIS Login</h2>

        <input placeholder="email" onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="password"
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={login}>Login</button>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      {/* SIDEBAR */}
      <div style={{ width: 220, background: "#111", color: "#fff", padding: 20 }}>
        <h3>FlowSIS</h3>

        <button onClick={() => setPage("dashboard")}>Dashboard</button>
        <button onClick={() => setPage("passes")}>Passes</button>
        <button onClick={() => setPage("create")}>Create</button>
        <button onClick={() => setPage("scanner")}>Scanner</button>
        <button onClick={() => setPage("logs")}>Logs</button>

        <button onClick={logout} style={{ marginTop: 20 }}>
          Logout
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: 20 }}>
        {/* DASHBOARD */}
        {page === "dashboard" && (
          <div>
            <h2>Admin Dashboard</h2>

            <div style={{ display: "flex", gap: 20 }}>
              <div>OUT: {passes.filter((p) => p.status === "OUT").length}</div>
              <div>RETURNED: {passes.filter((p) => p.status === "RETURNED").length}</div>
              <div>TOTAL: {passes.length}</div>
            </div>

            <div style={{ width: 300, height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: "OUT", value: passes.filter((p) => p.status === "OUT").length },
                      { name: "RETURNED", value: passes.filter((p) => p.status === "RETURNED").length },
                    ]}
                    dataKey="value"
                  >
                    <Cell fill="red" />
                    <Cell fill="green" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CREATE */}
        {page === "create" && (
          <div>
            <h2>Create Pass</h2>

            <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="ID" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" />

            <button onClick={createPass}>Create</button>
          </div>
        )}

        {/* PASSES */}
        {page === "passes" && (
          <div>
            <h2>Passes</h2>

            {passes.map((p) => (
              <div key={p.id} style={{ border: "1px solid #ccc", padding: 10, margin: 5 }}>
                <b>{p.name}</b> → {p.destination}
                <div>{minutesOut(p.startTime)} min out</div>
              </div>
            ))}
          </div>
        )}

        {/* SCANNER */}
        {page === "scanner" && (
          <div>
            <h2>Scanner</h2>

            <video ref={videoRef} style={{ width: 300 }} />

            <button onClick={startScanner}>Start</button>
            <button onClick={stopScanner}>Stop</button>

            <div>Scanned: {studentId}</div>
          </div>
        )}

        {/* LOGS */}
        {page === "logs" && (
          <div>
            <h2>Logs</h2>

            {logs.map((l) => (
              <div key={l.id}>
                {l.action} - {l.passId}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
