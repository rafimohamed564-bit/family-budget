import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

// ============================================================
// 🔥 FIREBASE SETUP — FREE (Spark Plan)
// Steps to get your own free Firebase:
// 1. Go to console.firebase.google.com
// 2. Create a project → Add a Web App
// 3. Copy your firebaseConfig and paste it below
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyC3zxK9A6GSPYo0GvHb4EB7um8LhlTlGqI",
  authDomain: "family-budget-rna.firebaseapp.com",
  databaseURL: "https://family-budget-rna-default-rtdb.firebaseio.com",
  projectId: "family-budget-rna",
  storageBucket: "family-budget-rna.firebasestorage.app",
  messagingSenderId: "406790434701",
  appId: "1:406790434701:web:c65ef257de5984b6c317c4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const CATEGORIES = {
  income: ["Salary", "Freelance", "Business", "Investment", "Other Income"],
  expense: ["Food", "Groceries", "Rent/EMI", "Utilities", "Transport", "Education", "Medical", "Shopping", "Entertainment", "Other"],
};

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function FamilyBudget() {
  const now = new Date();
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState(["Dad", "Mom", "Son", "Daughter"]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("syncing");
  const [tab, setTab] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [form, setForm] = useState({ type: "expense", amount: "", category: "", member: "Dad", note: "", date: new Date().toISOString().split("T")[0] });
  const [newMember, setNewMember] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Listen to Firebase in real time
  useEffect(() => {
    const dataRef = ref(db, "family-budget");
    const unsub = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTransactions(data.transactions || []);
        if (data.members?.length) setMembers(data.members);
      }
      setLoading(false);
      setSyncStatus("synced");
    }, () => {
      setSyncStatus("error");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const saveData = useCallback(async (txns, mems) => {
    setSyncStatus("syncing");
    try {
      await set(ref(db, "family-budget"), { transactions: txns, members: mems });
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }
  }, []);

  const filteredTxns = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const totalIncome = filteredTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filteredTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const addTransaction = async () => {
    if (!form.amount || !form.category) return;
    let updatedTxns;
    if (editingId) {
      updatedTxns = transactions.map(t => t.id === editingId ? { ...form, id: editingId, amount: parseFloat(form.amount) } : t);
      setEditingId(null);
    } else {
      const newTxn = { ...form, id: Date.now().toString(), amount: parseFloat(form.amount) };
      updatedTxns = [newTxn, ...transactions];
    }
    setTransactions(updatedTxns);
    setForm({ type: "expense", amount: "", category: "", member: members[0], note: "", date: new Date().toISOString().split("T")[0] });
    await saveData(updatedTxns, members);
  };

  const deleteTransaction = async (id) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    await saveData(updated, members);
  };

  const addMember = async () => {
    if (!newMember.trim() || members.includes(newMember.trim())) return;
    const updated = [...members, newMember.trim()];
    setMembers(updated);
    setNewMember("");
    await saveData(transactions, updated);
  };

  const removeMember = async (m) => {
    const updated = members.filter(x => x !== m);
    setMembers(updated);
    await saveData(transactions, updated);
  };

  const expenseByCategory = CATEGORIES.expense.map(cat => ({
    cat,
    val: filteredTxns.filter(t => t.type === "expense" && t.category === cat).reduce((s, t) => s + t.amount, 0)
  })).filter(x => x.val > 0).sort((a, b) => b.val - a.val);

  const expenseByMember = members.map(m => ({
    m,
    val: filteredTxns.filter(t => t.type === "expense" && t.member === m).reduce((s, t) => s + t.amount, 0)
  })).filter(x => x.val > 0);

  const maxCat = expenseByCategory[0]?.val || 1;
  const maxMem = Math.max(...expenseByMember.map(x => x.val), 1);

  const statusColor = { syncing: "#f0a500", synced: "#4caf50", error: "#f44336" };
  const statusLabel = { syncing: "⟳ Syncing...", synced: "✓ Live", error: "✗ Error" };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap'); @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 48, height: 48, border: "4px solid #2a2d3e", borderTop: "4px solid #f0a500", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
      <p style={{ color: "#aaa", fontSize: 14 }}>Connecting to family cloud...</p>
    </div>
  );

  const cardStyle = { background: "#1a1d2e", borderRadius: 16, padding: "20px 24px", border: "1px solid #2a2d3e" };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'Nunito', sans-serif", color: "#e0e0e0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1a1d2e; } ::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 3px; }
        input, select { background: #12141f; border: 1.5px solid #2a2d3e; color: #e0e0e0; border-radius: 10px; padding: 10px 14px; font-family: inherit; font-size: 14px; outline: none; transition: border 0.2s; width: 100%; }
        input:focus, select:focus { border-color: #f0a500; }
        button { cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .tab-btn { background: none; border: none; color: #888; padding: 10px 16px; font-size: 13px; font-weight: 700; border-bottom: 2.5px solid transparent; }
        .tab-btn.active { color: #f0a500; border-bottom-color: #f0a500; }
        .tab-btn:hover { color: #f0a500; }
        .primary-btn { background: linear-gradient(135deg, #f0a500, #e08000); color: #0f1117; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 800; font-size: 14px; width: 100%; }
        .primary-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(240,165,0,0.4); }
        .danger-btn { background: none; border: 1px solid #f4436633; color: #f44336; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 700; }
        .danger-btn:hover { background: #f4433622; }
        .edit-btn { background: none; border: 1px solid #f0a50033; color: #f0a500; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 700; }
        .edit-btn:hover { background: #f0a50022; }
        .chip { display: inline-flex; align-items: center; gap: 6px; background: #12141f; border: 1px solid #2a2d3e; border-radius: 20px; padding: 4px 10px; font-size: 11px; font-weight: 700; }
        @keyframes spin { to { transform: rotate(360deg) } }
        .spin { animation: spin 0.8s linear infinite; display: inline-block; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1a1d2e", borderBottom: "1px solid #2a2d3e", padding: "0 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 0" }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#f0a500" }}>Family Budget</h1>
              <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Real-time cloud sync • Free forever</p>
            </div>
            <span style={{ fontSize: 12, color: statusColor[syncStatus], fontWeight: 700 }}>
              {syncStatus === "syncing" ? <span><span className="spin">⟳</span> Syncing</span> : statusLabel[syncStatus]}
            </span>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 12 }}>
            {["dashboard", "add", "history", "members"].map(t => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t === "dashboard" ? "📊 Dashboard" : t === "add" ? "➕ Add" : t === "history" ? "📋 History" : "👨‍👩‍👧 Members"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        {/* Month selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} style={{ width: "auto", padding: "8px 12px" }}>
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} style={{ width: "auto", padding: "8px 12px" }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "#555" }}>{filteredTxns.length} entries</span>
        </div>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "Income", val: totalIncome, color: "#4caf50", icon: "↑" },
                { label: "Expenses", val: totalExpense, color: "#f44336", icon: "↓" },
                { label: "Balance", val: balance, color: balance >= 0 ? "#4caf50" : "#f44336", icon: "=" },
              ].map(c => (
                <div key={c.label} style={{ ...cardStyle, textAlign: "center" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: c.color }}>{formatINR(c.val)}</div>
                </div>
              ))}
            </div>

            {totalIncome > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Savings Rate</span>
                  <span style={{ fontWeight: 900, color: balance >= 0 ? "#4caf50" : "#f44336", fontSize: 14 }}>{Math.round((balance / totalIncome) * 100)}%</span>
                </div>
                <div style={{ height: 8, background: "#2a2d3e", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, (totalExpense / totalIncome) * 100))}%`, background: "linear-gradient(90deg, #f44336, #f0a500)", borderRadius: 4 }}></div>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Spent {Math.round((totalExpense / totalIncome) * 100)}% of income</div>
              </div>
            )}

            {expenseByCategory.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ fontWeight: 800, marginBottom: 14, fontSize: 14 }}>Expenses by Category</h3>
                {expenseByCategory.map(({ cat, val }) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{cat}</span>
                      <span style={{ color: "#f0a500", fontWeight: 800 }}>{formatINR(val)}</span>
                    </div>
                    <div style={{ height: 6, background: "#2a2d3e", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${(val / maxCat) * 100}%`, background: "linear-gradient(90deg, #f0a500, #e08000)", borderRadius: 3 }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expenseByMember.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ fontWeight: 800, marginBottom: 14, fontSize: 14 }}>Expenses by Member</h3>
                {expenseByMember.map(({ m, val }) => (
                  <div key={m} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{m}</span>
                      <span style={{ color: "#4caf50", fontWeight: 800 }}>{formatINR(val)}</span>
                    </div>
                    <div style={{ height: 6, background: "#2a2d3e", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${(val / maxMem) * 100}%`, background: "linear-gradient(90deg, #4caf50, #2e7d32)", borderRadius: 3 }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredTxns.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
                <p style={{ fontWeight: 700 }}>No transactions this month</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>Tap "Add" to record your first entry</p>
              </div>
            )}
          </div>
        )}

        {/* ADD */}
        {tab === "add" && (
          <div style={cardStyle}>
            <h3 style={{ fontWeight: 900, marginBottom: 20, fontSize: 16 }}>{editingId ? "✏️ Edit Transaction" : "➕ Add Transaction"}</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["expense", "income"].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category: "" }))}
                  style={{ flex: 1, padding: "10px", borderRadius: 12, border: "2px solid", fontWeight: 800, fontSize: 14,
                    borderColor: form.type === t ? (t === "expense" ? "#f44336" : "#4caf50") : "#2a2d3e",
                    background: form.type === t ? (t === "expense" ? "#f4433622" : "#4caf5022") : "transparent",
                    color: form.type === t ? (t === "expense" ? "#f44336" : "#4caf50") : "#666" }}>
                  {t === "expense" ? "↓ Expense" : "↑ Income"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="number" placeholder="Amount (₹)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select Category</option>
                {CATEGORIES[form.type].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.member} onChange={e => setForm(f => ({ ...f, member: e.target.value }))}>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              <input type="text" placeholder="Note (optional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              <button className="primary-btn" onClick={addTransaction}>
                {editingId ? "Update Transaction" : "Save Transaction"}
              </button>
              {editingId && <button onClick={() => { setEditingId(null); setForm({ type: "expense", amount: "", category: "", member: members[0], note: "", date: new Date().toISOString().split("T")[0] }); }}
                style={{ background: "none", border: "1px solid #2a2d3e", borderRadius: 12, padding: 12, color: "#888", fontWeight: 700, fontSize: 14, width: "100%" }}>Cancel</button>}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredTxns.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <p style={{ fontWeight: 700 }}>No transactions this month</p>
              </div>
            )}
            {[...filteredTxns].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
              <div key={t.id} style={{ ...cardStyle, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{t.category}</span>
                      <span className="chip">{t.member}</span>
                    </div>
                    {t.note && <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>{t.note}</div>}
                    <div style={{ fontSize: 11, color: "#555" }}>{new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: t.type === "income" ? "#4caf50" : "#f44336", marginBottom: 6 }}>
                      {t.type === "income" ? "+" : "-"}{formatINR(t.amount)}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="edit-btn" onClick={() => { setEditingId(t.id); setForm({ type: t.type, amount: t.amount.toString(), category: t.category, member: t.member, note: t.note, date: t.date }); setTab("add"); }}>Edit</button>
                      <button className="danger-btn" onClick={() => deleteTransaction(t.id)}>Del</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MEMBERS */}
        {tab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={cardStyle}>
              <h3 style={{ fontWeight: 900, marginBottom: 16, fontSize: 16 }}>👨‍👩‍👧 Family Members</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {members.map(m => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#12141f", borderRadius: 10, padding: "10px 14px" }}>
                    <div>
                      <span style={{ fontWeight: 800 }}>{m}</span>
                      <span style={{ fontSize: 12, color: "#666", marginLeft: 10 }}>{transactions.filter(t => t.member === m).length} transactions</span>
                    </div>
                    <button className="danger-btn" onClick={() => removeMember(m)}>Remove</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Add member name" onKeyDown={e => e.key === "Enter" && addMember()} />
                <button className="primary-btn" style={{ width: "auto", whiteSpace: "nowrap", padding: "10px 20px" }} onClick={addMember}>Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
