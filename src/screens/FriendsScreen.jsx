import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "../theme.js";
import { useShare } from "../hooks/useShare.js";
import {
  buildInviteUrl, fetchFriends, removeFriendship,
  sendFriendRequest, fetchIncomingRequests, acceptFriendRequest,
} from "../api/friends.js";
import { searchProfiles, MIN_SEARCH_QUERY_LENGTH } from "../api/profile.js";
import { classifyChallenge as classifyBlixtChallenge } from "../api/blixt.js";
import { classifyChallenge as classifySkrammelpajChallenge } from "../api/skrammelpaj.js";
import { computeOngoingByOpponent } from "../game/matchActivity.js";

function FriendRow({ friend, onSelect, activity }) {
  const needsAction = activity?.needsAction ?? false;
  const ongoingCount = activity?.ongoingCount ?? 0;
  return (
    <button
      onClick={() => onSelect(friend)}
      style={{
        ...styles.row, ...styles.friendRowButton,
        animation: needsAction ? "skrammelBlink 1.2s steps(1, end) infinite" : "none",
      }}
    >
      <span>{friend.friendName}</span>
      <span style={{ color: T.muted, fontSize: "0.8rem" }}>
        {ongoingCount > 0 ? `${ongoingCount} match${ongoingCount > 1 ? "er" : ""} på gång` : "Inga matcher på gång"}
      </span>
    </button>
  );
}

export default function FriendsScreen({
  user, displayName, myBlixtChallenges, mySkrammelpajChallenges, onBack, onSelectFriend,
}) {
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState(null);
  const { share, copied } = useShare();
  const inviterName = displayName ?? user.email.split("@")[0];

  const [incomingRequests, setIncomingRequests] = useState(null);
  const [requestBusyId, setRequestBusyId] = useState(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [sentIds, setSentIds] = useState(new Set());

  const loadFriends = useCallback(() => {
    fetchFriends(user.id).then(setFriends).catch((err) => setError(err.message));
  }, [user.id]);

  const loadIncomingRequests = useCallback(() => {
    fetchIncomingRequests(user.id).then(setIncomingRequests).catch(() => setIncomingRequests([]));
  }, [user.id]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadIncomingRequests(); }, [loadIncomingRequests]);

  // Sökning kräver minst MIN_SEARCH_QUERY_LENGTH tecken innan den ens
  // triggas, debounced — annars skulle varje tangenttryckning slå mot
  // profiles-tabellen i onödan.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_SEARCH_QUERY_LENGTH) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const friendIds = (friends ?? []).map((f) => f.friendId);
    const timer = setTimeout(async () => {
      try {
        const results = await searchProfiles(q, [user.id, ...friendIds]);
        setSearchResults(results);
        setSearchError(null);
      } catch (err) {
        setSearchError(err.message);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, friends, user.id]);

  // Räknar pågående (ej avslutade) matcher per vän, över båda spelen, och
  // om någon av dem faktiskt kräver ett drag från mig (blinkning) — se
  // game/matchActivity.js.
  const friendActivity = useMemo(() => {
    const blixt = computeOngoingByOpponent(myBlixtChallenges, user.id, classifyBlixtChallenge);
    const skrammelpaj = computeOngoingByOpponent(mySkrammelpajChallenges, user.id, classifySkrammelpajChallenge);
    const merged = new Map();
    for (const map of [blixt, skrammelpaj]) {
      for (const [opponentId, activity] of map) {
        const entry = merged.get(opponentId) ?? { ongoingCount: 0, needsAction: false };
        entry.ongoingCount += activity.ongoingCount;
        entry.needsAction = entry.needsAction || activity.needsAction;
        merged.set(opponentId, entry);
      }
    }
    return merged;
  }, [myBlixtChallenges, mySkrammelpajChallenges, user.id]);

  const handleInvite = () => {
    share(`${inviterName} bjuder in dig att bli vän i Skrammel!\n${buildInviteUrl(user.id, inviterName)}`);
  };

  const handleSendRequest = async (targetId, targetName) => {
    setSendingId(targetId);
    setSearchError(null);
    try {
      await sendFriendRequest(user.id, inviterName, targetId, targetName);
      setSentIds((prev) => new Set(prev).add(targetId));
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSendingId(null);
    }
  };

  const handleAccept = async (friendshipId) => {
    setRequestBusyId(friendshipId);
    await acceptFriendRequest(friendshipId);
    await Promise.all([loadIncomingRequests(), loadFriends()]);
    setRequestBusyId(null);
  };

  const handleDecline = async (friendshipId) => {
    setRequestBusyId(friendshipId);
    await removeFriendship(friendshipId);
    await loadIncomingRequests();
    setRequestBusyId(null);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes skrammelBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
      <h2 style={{ margin: 0, color: T.accent }}>Vänner</h2>

      <button onClick={handleInvite} style={styles.inviteButton}>
        {copied ? "Kopierat!" : "Bjud in vän"}
      </button>

      <div style={styles.searchBox}>
        <input
          type="text" placeholder="Sök efter användare…" value={query}
          onChange={(e) => setQuery(e.target.value)} style={styles.searchInput}
        />
        {query.trim().length > 0 && query.trim().length < MIN_SEARCH_QUERY_LENGTH && (
          <div style={{ color: T.muted, fontSize: "0.8rem" }}>
            Skriv minst {MIN_SEARCH_QUERY_LENGTH} tecken för att söka.
          </div>
        )}
        {searching && <div style={{ color: T.muted, fontSize: "0.85rem" }}>Söker…</div>}
        {searchError && <div style={{ color: T.accent2, fontSize: "0.85rem" }}>{searchError}</div>}
        {!searching && searchResults && searchResults.length === 0 && (
          <div style={{ color: T.muted, fontSize: "0.85rem" }}>Inga användare hittades.</div>
        )}
        {searchResults && searchResults.length > 0 && (
          <div style={styles.list}>
            {searchResults.map((r) => (
              <div key={r.id} style={styles.row}>
                <span>{r.display_name}</span>
                <button
                  onClick={() => handleSendRequest(r.id, r.display_name)}
                  disabled={sendingId === r.id || sentIds.has(r.id)}
                  style={styles.smallButton}
                >
                  {sentIds.has(r.id) ? "Skickad" : sendingId === r.id ? "Skickar…" : "Lägg till"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {incomingRequests && incomingRequests.length > 0 && (
        <div style={styles.requestsSection}>
          <div style={{ color: T.muted, fontSize: "0.85rem" }}>Väntande förfrågningar</div>
          <div style={styles.list}>
            {incomingRequests.map((r) => (
              <div key={r.friendshipId} style={styles.row}>
                <span>{r.requesterName}</span>
                <div style={styles.rowActions}>
                  <button
                    onClick={() => handleAccept(r.friendshipId)}
                    disabled={requestBusyId === r.friendshipId}
                    style={styles.smallButton}
                  >
                    Acceptera
                  </button>
                  <button
                    onClick={() => handleDecline(r.friendshipId)}
                    disabled={requestBusyId === r.friendshipId}
                    style={styles.smallButtonMuted}
                  >
                    Avvisa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: T.accent2 }}>Kunde inte hämta vänner just nu — försök igen om en stund.</div>
      )}
      {!error && friends === null && <div style={{ color: T.muted }}>Laddar…</div>}
      {friends && friends.length === 0 && (
        <div style={{ color: T.muted }}>Inga vänner än — bjud in någon eller sök!</div>
      )}

      {friends && friends.length > 0 && (
        <div style={styles.list}>
          {friends.map((f) => (
            <FriendRow
              key={f.friendshipId} friend={f} onSelect={onSelectFriend}
              activity={friendActivity.get(f.friendId)}
            />
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
  searchBox: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  searchInput: {
    padding: "0.7rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "1rem", width: "100%",
  },
  requestsSection: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  rowActions: { display: "flex", gap: "0.4rem" },
  friendRowButton: {
    width: "100%", fontFamily: "inherit", fontSize: "1rem", color: T.text, cursor: "pointer",
  },
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
