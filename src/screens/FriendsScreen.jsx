import { useCallback, useEffect, useState } from "react";
import { T } from "../theme.js";
import { useShare } from "../hooks/useShare.js";
import { buildInviteUrl, fetchFriends, removeFriendship } from "../api/friends.js";

function FriendRow({ friend, onRemove }) {
  const { share, copied } = useShare();
  const handleChallenge = () => {
    share(`🎯 ${friend.friendName} utmanar dig till dagens Skrammel! Hitta fler ord än mig: ${window.location.origin}`);
  };

  return (
    <div style={styles.row}>
      <span>{friend.friendName}</span>
      <div style={styles.rowActions}>
        <button onClick={handleChallenge} style={styles.smallButton}>{copied ? "Kopierat!" : "Utmana"}</button>
        <button onClick={() => onRemove(friend.friendshipId)} style={styles.smallButtonMuted}>Ta bort</button>
      </div>
    </div>
  );
}

export default function FriendsScreen({ user, displayName, onBack }) {
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState(null);
  const { share, copied } = useShare();
  const inviterName = displayName ?? user.email.split("@")[0];

  const loadFriends = useCallback(() => {
    fetchFriends(user.id).then(setFriends).catch((err) => setError(err.message));
  }, [user.id]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const handleInvite = () => {
    share(`${inviterName} bjuder in dig att bli vän i Skrammel!\n${buildInviteUrl(user.id, inviterName)}`);
  };

  const handleRemove = async (friendshipId) => {
    await removeFriendship(friendshipId);
    loadFriends();
  };

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>Vänner</h2>

      <button onClick={handleInvite} style={styles.inviteButton}>
        {copied ? "Kopierat!" : "Bjud in vän"}
      </button>

      {error && <div style={{ color: T.muted }}>Kunde inte hämta vänner.</div>}
      {!error && friends === null && <div style={{ color: T.muted }}>Laddar…</div>}
      {friends && friends.length === 0 && (
        <div style={{ color: T.muted }}>Inga vänner än — bjud in någon!</div>
      )}

      {friends && friends.length > 0 && (
        <div style={styles.list}>
          {friends.map((f) => (
            <FriendRow key={f.friendshipId} friend={f} onRemove={handleRemove} />
          ))}
        </div>
      )}

      <div style={styles.navRow}>
        <button onClick={onBack} style={styles.navButton}>Till start</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1rem", textAlign: "center",
  },
  inviteButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  rowActions: { display: "flex", gap: "0.4rem" },
  smallButton: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
  },
  smallButtonMuted: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.8rem", cursor: "pointer",
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
