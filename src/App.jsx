import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { fetchTodaysWord, fetchAllDailyWords } from "./api/dailyWord.js";
import { submitScore, fetchUserPlayedDates } from "./api/scores.js";
import { loadWordList } from "./game/wordList.js";
import { ADMIN_EMAIL } from "./game/constants.js";
import { T } from "./theme.js";
import HomeScreen from "./screens/HomeScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import ResultScreen from "./screens/ResultScreen.jsx";
import LeaderboardScreen from "./screens/LeaderboardScreen.jsx";
import ArchiveScreen from "./screens/ArchiveScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import AdminWordsScreen from "./screens/AdminWordsScreen.jsx";

function pad(n) { return String(n).padStart(2, "0"); }

// Lokala datumkomponenter, inte toISOString() — den konverterar till UTC och
// kan visa gårdagens datum under de första timmarna på dygnet i tidszoner
// öster om UTC (t.ex. CEST), vilket skulle ge fel dagens-ord/topplista.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function App() {
  const isAdminRoute = window.location.pathname === "/admin";
  const [user, setUser] = useState(undefined); // undefined = laddar, null = utloggad/gäst
  const displayName = user?.user_metadata?.display_name ?? null; // satt vid signup, se AuthScreen
  const [screen, setScreen] = useState("home");
  const [wordListReady, setWordListReady] = useState(false);
  const [sourceWord, setSourceWord] = useState(null);
  const [playingDate, setPlayingDate] = useState(null); // datumet för pusslet som spelas/spelades
  const [leaderboardDate, setLeaderboardDate] = useState(null);
  const [lastResult, setLastResult] = useState(null); // { score, words }
  const [archiveData, setArchiveData] = useState(null); // { playableDates, playedDates }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null); // Ingen backend lokalt — kör direkt som gäst, ingen krasch.
      return;
    }
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadWordList().then(() => setWordListReady(true));
  }, []);

  const navigate = useCallback((next) => setScreen(next), []);

  // Hämtar ordet för ett datum (idag eller ur arkivet) och startar spelet.
  const startGame = useCallback((date) => {
    fetchTodaysWord(date).then((word) => {
      setSourceWord(word);
      setPlayingDate(date);
      setScreen("game");
    });
  }, []);

  const goToLeaderboard = useCallback((date) => {
    setLeaderboardDate(date);
    setScreen("leaderboard");
  }, []);

  const openArchive = useCallback(async () => {
    setScreen("archive");
    const [published, playedDates] = await Promise.all([
      fetchAllDailyWords(),
      user ? fetchUserPlayedDates(user.id) : Promise.resolve([]),
    ]);
    setArchiveData({
      playableDates: published.map((p) => p.date),
      playedDates,
    });
  }, [user]);

  // Sparar resultatet så fort tiden går ut (eller spelaren avslutar
  // tidigare) — oavsett om spelaren sen väljer att fortsätta utan tävling
  // eller avsluta direkt. Navigerar INTE bort från spelskärmen.
  const handleSubmitScore = useCallback(async (score, words, levelTimes) => {
    if (!user) return; // Gäster spelar men syns inte på topplistan.
    const name = displayName ?? user.email.split("@")[0];
    await submitScore(user.id, playingDate ?? todayStr(), score, words, name, levelTimes);
  }, [user, displayName, playingDate]);

  const handleGameFinish = useCallback((score, words) => {
    setLastResult({ score, words });
    setScreen("result");
  }, []);

  const handleSignOut = useCallback(() => {
    if (isSupabaseConfigured) supabase.auth.signOut();
  }, []);

  if (user === undefined || !wordListReady) {
    return (
      <div style={{
        minHeight: "100dvh", background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: T.muted, fontFamily: "system-ui, sans-serif" }}>Laddar…</div>
      </div>
    );
  }

  if (isAdminRoute) {
    if (!user) return <AuthScreen onDone={() => {}} />;
    if (user.email !== ADMIN_EMAIL) {
      return (
        <div style={{
          minHeight: "100dvh", background: T.bg, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ color: T.muted, fontFamily: "system-ui, sans-serif" }}>Åtkomst nekad.</div>
        </div>
      );
    }
    return <AdminWordsScreen />;
  }

  if (screen === "auth") {
    return <AuthScreen onDone={() => navigate("home")} />;
  }

  if (screen === "game" && sourceWord) {
    return <GameScreen sourceWord={sourceWord} onSubmitScore={handleSubmitScore} onFinish={handleGameFinish} />;
  }

  if (screen === "result" && lastResult) {
    return (
      <ResultScreen
        score={lastResult.score}
        words={lastResult.words}
        user={user}
        onPlayHome={() => navigate("home")}
        onLeaderboard={() => goToLeaderboard(playingDate ?? todayStr())}
        onLogin={() => navigate("auth")}
      />
    );
  }

  if (screen === "leaderboard") {
    return <LeaderboardScreen date={leaderboardDate ?? todayStr()} onBack={() => navigate("home")} />;
  }

  if (screen === "archive") {
    if (!archiveData) {
      return (
        <div style={{
          minHeight: "100dvh", background: T.bg, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ color: T.muted, fontFamily: "system-ui, sans-serif" }}>Laddar…</div>
        </div>
      );
    }
    return (
      <ArchiveScreen
        playableDates={archiveData.playableDates}
        playedDates={archiveData.playedDates}
        onSelectDate={startGame}
        onBack={() => navigate("home")}
      />
    );
  }

  return (
    <HomeScreen
      user={user}
      displayName={displayName}
      onPlay={() => startGame(todayStr())}
      onArchive={openArchive}
      onLeaderboard={() => goToLeaderboard(todayStr())}
      onLogin={() => navigate("auth")}
      onSignOut={handleSignOut}
    />
  );
}
