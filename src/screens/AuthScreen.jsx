import { useState } from "react";
import { supabase, isSupabaseConfigured } from "../supabase.js";
import { T } from "../theme.js";

export default function AuthScreen({ onDone }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
      onDone();
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // Om projektet kräver e-postbekräftelse kommer ingen session tillbaka
    // direkt — kontot finns men användaren är inte inloggad förrän länken
    // i mejlet klickats, så vi kan inte bara köra onDone() som vid inloggning.
    if (!data.session) { setConfirmationSent(true); return; }
    onDone();
  };

  if (confirmationSent) {
    return (
      <div style={styles.page}>
        <h2 style={{ color: T.accent }}>Kolla din mejl</h2>
        <p style={{ color: T.muted, textAlign: "center", maxWidth: 300 }}>
          Vi har skickat en bekräftelselänk till {email}. Klicka på den för att aktivera kontot, logga sedan in.
        </p>
        <a href="#" onClick={(e) => { e.preventDefault(); setConfirmationSent(false); setMode("login"); }} style={{ color: T.muted, fontSize: "0.85rem" }}>
          Till inloggning
        </a>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div style={styles.page}>
        <h2 style={{ color: T.accent }}>Inloggning ej tillgänglig</h2>
        <p style={{ color: T.muted, textAlign: "center", maxWidth: 300 }}>
          Ingen backend är konfigurerad i den här lokala miljön, så
          inloggning och topplistor är avstängda. Du kan fortfarande spela.
        </p>
        <a href="#" onClick={(e) => { e.preventDefault(); onDone(); }} style={{ color: T.muted, fontSize: "0.85rem" }}>
          Fortsätt som gäst
        </a>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h2 style={{ color: T.accent }}>{mode === "login" ? "Logga in" : "Skapa konto"}</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="email" required placeholder="E-post" value={email}
          onChange={(e) => setEmail(e.target.value)} style={styles.input}
        />
        <input
          type="password" required placeholder="Lösenord" value={password}
          onChange={(e) => setPassword(e.target.value)} style={styles.input}
        />
        {error && <div style={{ color: T.accent2, fontSize: "0.85rem" }}>{error}</div>}
        <button type="submit" disabled={loading} style={styles.submitButton}>
          {loading ? "…" : mode === "login" ? "Logga in" : "Skapa konto"}
        </button>
      </form>

      <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "signup" : "login"); }} style={{ color: T.muted, fontSize: "0.85rem" }}>
        {mode === "login" ? "Skapa konto istället" : "Logga in istället"}
      </a>
      <a href="#" onClick={(e) => { e.preventDefault(); onDone(); }} style={{ color: T.muted, fontSize: "0.85rem" }}>
        Fortsätt som gäst
      </a>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "1rem", padding: "1.5rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%", maxWidth: 300 },
  input: {
    padding: "0.7rem", borderRadius: 6, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "1rem",
  },
  submitButton: {
    padding: "0.7rem", borderRadius: 8, border: "none", background: T.accent, color: "#121212", fontWeight: 700,
  },
};
