import { T } from "../theme.js";

// Delad mellan AuthScreen (signup/logga in) och SettingsScreen (byt
// lösenord) — showPassword/onToggleShow styrs av föräldern så att t.ex.
// AuthScreen kan låta ETT öga visa/dölja både lösenord- och
// upprepa-lösenord-fältet samtidigt.
export default function PasswordField({ value, onChange, placeholder = "Lösenord", showPassword, onToggleShow }) {
  return (
    <div style={styles.wrap}>
      <input
        type={showPassword ? "text" : "password"} required placeholder={placeholder} value={value}
        onChange={onChange} style={styles.input}
      />
      <button
        type="button" onClick={onToggleShow}
        style={styles.eyeButton} aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
      >
        {showPassword ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

const styles = {
  wrap: { position: "relative", display: "flex" },
  input: {
    padding: "0.7rem", paddingRight: "2.4rem", borderRadius: 6, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "1rem", width: "100%",
  },
  eyeButton: {
    position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "transparent", cursor: "pointer", fontSize: "1.1rem",
    padding: "0.3rem 0.5rem", lineHeight: 1,
  },
};
