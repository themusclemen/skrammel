import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { supabase } from "../supabase.js";
import { updateDisplayName, isDisplayNameTaken, MIN_DISPLAY_NAME_LENGTH } from "../api/profile.js";
import { translateAuthError } from "../api/authErrors.js";
import PasswordField from "../components/PasswordField.jsx";

function ChangeNamePanel({ user, currentName, onClose }) {
  const [name, setName] = useState(currentName ?? "");
  const [status, setStatus] = useState(null); // null | "checking" | "available" | "taken" | "too_short"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Samma debouncade ledigt/upptaget-koll som signup i AuthScreen, men
  // exkluderar en själv (annars ser man alltid "upptaget" på sitt eget
  // redan-satta namn) och räknar en oförändrad text som "inget att kolla".
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === (currentName ?? "").trim()) { setStatus(null); return; }
    if (trimmed.length < MIN_DISPLAY_NAME_LENGTH) { setStatus("too_short"); return; }
    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const taken = await isDisplayNameTaken(trimmed, user.id);
        setStatus(taken ? "taken" : "available");
      } catch {
        setStatus(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [name, currentName, user.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(user.id, name);
      setSaved(true);
    } catch (err) {
      setError(err.code === "23505" ? "Det namnet är redan taget." : err.message);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div style={styles.panel}>
        <div style={{ color: T.accent }}>✓ Visningsnamn uppdaterat!</div>
        <button onClick={onClose} style={styles.smallButtonMuted}>Stäng</button>
      </div>
    );
  }

  const trimmed = name.trim();
  const unchanged = trimmed === (currentName ?? "").trim();
  const disabled = saving || !trimmed || unchanged || status === "taken" || status === "checking" || status === "too_short";

  return (
    <div style={styles.panel}>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Nytt visningsnamn" style={styles.input}
      />
      {status === "too_short" && <div style={styles.hintError}>Minst {MIN_DISPLAY_NAME_LENGTH} tecken.</div>}
      {status === "checking" && <div style={styles.hintMuted}>Kollar om namnet är ledigt…</div>}
      {status === "taken" && <div style={styles.hintError}>Namnet är redan taget.</div>}
      {status === "available" && <div style={styles.hintMuted}>✓ Ledigt</div>}
      {error && <div style={styles.hintError}>{error}</div>}
      <div style={styles.panelActions}>
        <button onClick={handleSave} disabled={disabled} style={styles.smallButton}>
          {saving ? "Sparar…" : "Spara"}
        </button>
        <button onClick={onClose} style={styles.smallButtonMuted}>Avbryt</button>
      </div>
    </div>
  );
}

function ChangePasswordPanel({ onClose }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (password !== confirmPassword) { setError("Lösenorden matchar inte."); return; }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) { setError(translateAuthError(updateError.message)); return; }
    setSaved(true);
  };

  if (saved) {
    return (
      <div style={styles.panel}>
        <div style={{ color: T.accent }}>✓ Lösenord uppdaterat!</div>
        <button onClick={onClose} style={styles.smallButtonMuted}>Stäng</button>
      </div>
    );
  }

  const disabled = saving || password.length === 0 || password !== confirmPassword;

  return (
    <div style={styles.panel}>
      <PasswordField
        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nytt lösenord"
        showPassword={showPassword} onToggleShow={() => setShowPassword((v) => !v)}
      />
      <PasswordField
        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Upprepa nytt lösenord"
        showPassword={showPassword} onToggleShow={() => setShowPassword((v) => !v)}
      />
      {confirmPassword.length > 0 && password !== confirmPassword && (
        <div style={styles.hintError}>Lösenorden matchar inte.</div>
      )}
      {error && <div style={styles.hintError}>{error}</div>}
      <div style={styles.panelActions}>
        <button onClick={handleSave} disabled={disabled} style={styles.smallButton}>
          {saving ? "Sparar…" : "Spara"}
        </button>
        <button onClick={onClose} style={styles.smallButtonMuted}>Avbryt</button>
      </div>
    </div>
  );
}

export default function SettingsScreen({ user, displayName, onBack }) {
  const [activePanel, setActivePanel] = useState(null); // null | "name" | "password"

  const toggle = (panel) => setActivePanel((current) => (current === panel ? null : panel));

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>Inställningar</h2>
      <div style={{ color: T.muted, fontSize: "0.9rem" }}>
        Inloggad som {displayName ?? user.email}
      </div>

      <div style={styles.list}>
        <div style={styles.row}>
          <span>Byt visningsnamn</span>
          <button onClick={() => toggle("name")} style={styles.smallButtonMuted}>
            {activePanel === "name" ? "Stäng" : "Ändra"}
          </button>
        </div>
        {activePanel === "name" && (
          <ChangeNamePanel user={user} currentName={displayName} onClose={() => setActivePanel(null)} />
        )}

        <div style={styles.row}>
          <span>Byt lösenord</span>
          <button onClick={() => toggle("password")} style={styles.smallButtonMuted}>
            {activePanel === "password" ? "Stäng" : "Ändra"}
          </button>
        </div>
        {activePanel === "password" && <ChangePasswordPanel onClose={() => setActivePanel(null)} />}

        <div style={styles.row}>
          <span>Statistik</span>
          <span style={styles.soon}>Kommer snart</span>
        </div>
      </div>

      <button onClick={onBack} style={styles.navButton}>Till start</button>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1rem", textAlign: "center",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.7rem 0.9rem",
    background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`,
  },
  soon: { color: T.muted, fontSize: "0.8rem" },
  panel: {
    display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.9rem",
    background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "left",
  },
  panelActions: { display: "flex", gap: "0.5rem" },
  input: {
    padding: "0.7rem", borderRadius: 6, border: `1px solid ${T.border}`,
    background: T.bg, color: T.text, fontSize: "1rem", width: "100%",
  },
  hintMuted: { color: T.muted, fontSize: "0.8rem" },
  hintError: { color: T.accent2, fontSize: "0.8rem" },
  smallButton: {
    padding: "0.5rem 0.9rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
  },
  smallButtonMuted: {
    padding: "0.4rem 0.8rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.8rem", cursor: "pointer",
  },
  navButton: {
    marginTop: "0.5rem", padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
