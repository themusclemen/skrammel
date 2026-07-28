import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../supabase.js";
import { isDisplayNameTaken, createProfile, MIN_DISPLAY_NAME_LENGTH } from "../api/profile.js";
import { T } from "../theme.js";

// Supabase auth (GoTrue) returnerar felmeddelanden på engelska med stabila,
// kända strängar — översätter de vanligaste, faller tillbaka på originalet
// för allt annat så att inget bara försvinner tyst.
const AUTH_ERROR_TRANSLATIONS = {
  "User already registered": "Det finns redan ett konto med den e-postadressen.",
  "Invalid login credentials": "Fel e-postadress eller lösenord.",
  "Password should be at least 6 characters": "Lösenordet måste vara minst 6 tecken.",
  "Unable to validate email address: invalid format": "Ogiltig e-postadress.",
  "Email not confirmed": "E-postadressen är inte bekräftad än.",
  "Email rate limit exceeded": "För många försök, vänta en stund och försök igen.",
};

function translateAuthError(message) {
  return AUTH_ERROR_TRANSLATIONS[message] ?? message;
}

export default function AuthScreen({ onDone }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [nameStatus, setNameStatus] = useState(null); // null | "checking" | "available" | "taken"
  // Sätts om kontot redan skapades men profilraden misslyckades (namnet
  // togs i en kapplöpning) — då ska ett omförsök bara skapa profilen på
  // nytt, inte köra signUp igen mot samma e-post.
  const [pendingUserId, setPendingUserId] = useState(null);

  // Snabb "ledigt/upptaget"-koll medan man skriver visningsnamnet, debounced
  // — display_name måste vara unikt (se profiles-tabellens unique-index),
  // så det är bättre att flagga en kollision innan man ens trycker skicka.
  useEffect(() => {
    if (mode !== "signup" || pendingUserId) return;
    const name = signupName.trim();
    if (!name) { setNameStatus(null); return; }
    if (name.length < MIN_DISPLAY_NAME_LENGTH) { setNameStatus("too_short"); return; }
    setNameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const taken = await isDisplayNameTaken(name);
        setNameStatus(taken ? "taken" : "available");
      } catch {
        setNameStatus(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [signupName, mode, pendingUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(translateAuthError(error.message)); return; }
      onDone();
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError("Lösenorden matchar inte.");
      return;
    }

    if (signupName.trim().length < MIN_DISPLAY_NAME_LENGTH) {
      setLoading(false);
      setNameStatus("too_short");
      setError(`Visningsnamnet måste vara minst ${MIN_DISPLAY_NAME_LENGTH} tecken.`);
      return;
    }

    if (pendingUserId) {
      try {
        await createProfile(pendingUserId, signupName);
      } catch (err) {
        setLoading(false);
        setError(err.code === "23505" ? "Det namnet är redan taget, välj ett annat." : err.message);
        return;
      }
      setLoading(false);
      onDone();
      return;
    }

    // Sista, avgörande koll precis innan kontot skapas — den debouncade
    // koll ovan är bara en snabb hint medan man skriver.
    if (await isDisplayNameTaken(signupName)) {
      setLoading(false);
      setNameStatus("taken");
      setError("Det namnet är redan taget, välj ett annat.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: signupName.trim() } },
    });
    if (error) { setLoading(false); setError(translateAuthError(error.message)); return; }
    // Om projektet kräver e-postbekräftelse kommer ingen session tillbaka
    // direkt — kontot finns men användaren är inte inloggad förrän länken
    // i mejlet klickats, så vi kan inte bara köra onDone() som vid inloggning.
    // Profilraden (och därmed namnreservationen) skapas istället vid första
    // inloggningen efter bekräftelse.
    if (!data.session) { setLoading(false); setConfirmationSent(true); return; }

    try {
      await createProfile(data.user.id, signupName);
    } catch (err) {
      setLoading(false);
      if (err.code === "23505") {
        // Extremt osannolik kapplöpning: någon annan hann ta exakt samma
        // namn mellan koll och insert. Kontot finns redan — be om ett nytt
        // namn och försök igen utan att signa upp på nytt.
        setPendingUserId(data.user.id);
        setError("Det namnet blev precis taget av någon annan — välj ett nytt och försök igen.");
        return;
      }
      setError(err.message);
      return;
    }
    setLoading(false);
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
        {mode === "signup" && (
          <>
            <input
              type="text" required minLength={MIN_DISPLAY_NAME_LENGTH} placeholder="Visningsnamn" value={signupName}
              onChange={(e) => setSignupName(e.target.value)} style={styles.input}
            />
            {nameStatus === "too_short" && (
              <div style={{ color: T.accent2, fontSize: "0.8rem" }}>
                Minst {MIN_DISPLAY_NAME_LENGTH} tecken.
              </div>
            )}
            {nameStatus === "checking" && (
              <div style={{ color: T.muted, fontSize: "0.8rem" }}>Kollar om namnet är ledigt…</div>
            )}
            {nameStatus === "taken" && (
              <div style={{ color: T.accent2, fontSize: "0.8rem" }}>Namnet är redan taget.</div>
            )}
            {nameStatus === "available" && (
              <div style={{ color: T.muted, fontSize: "0.8rem" }}>✓ Ledigt</div>
            )}
          </>
        )}
        <input
          type="email" required placeholder="E-post" value={email}
          onChange={(e) => setEmail(e.target.value)} style={styles.input}
        />
        <div style={styles.passwordWrap}>
          <input
            type={showPassword ? "text" : "password"} required placeholder="Lösenord" value={password}
            onChange={(e) => setPassword(e.target.value)} style={{ ...styles.input, ...styles.passwordInput }}
          />
          <button
            type="button" onClick={() => setShowPassword((v) => !v)}
            style={styles.eyeButton} aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
        {mode === "signup" && (
          <div style={styles.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"} required placeholder="Upprepa lösenord" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} style={{ ...styles.input, ...styles.passwordInput }}
            />
            <button
              type="button" onClick={() => setShowPassword((v) => !v)}
              style={styles.eyeButton} aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        )}
        {mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword && (
          <div style={{ color: T.accent2, fontSize: "0.8rem" }}>Lösenorden matchar inte.</div>
        )}
        {error && <div style={{ color: T.accent2, fontSize: "0.85rem" }}>{error}</div>}
        <button
          type="submit"
          disabled={
            loading ||
            (mode === "signup" && (nameStatus === "taken" || nameStatus === "checking" || nameStatus === "too_short")) ||
            (mode === "signup" && (confirmPassword.length === 0 || password !== confirmPassword))
          }
          style={styles.submitButton}
        >
          {loading ? "…" : mode === "login" ? "Logga in" : "Skapa konto"}
        </button>
      </form>

      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setNameStatus(null);
          setPendingUserId(null);
          setConfirmPassword("");
        }}
        style={{ color: T.muted, fontSize: "0.85rem" }}
      >
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
    background: T.surface, color: T.text, fontSize: "1rem", width: "100%",
  },
  passwordWrap: { position: "relative", display: "flex" },
  passwordInput: { paddingRight: "2.4rem" },
  eyeButton: {
    position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "transparent", cursor: "pointer", fontSize: "1.1rem",
    padding: "0.3rem 0.5rem", lineHeight: 1,
  },
  submitButton: {
    padding: "0.7rem", borderRadius: 8, border: "none", background: T.accent, color: "#121212", fontWeight: 700,
  },
};
