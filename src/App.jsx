import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { fetchTodaysWord } from "./api/dailyWord.js";
import { fetchDisplayName } from "./api/profile.js";
import { submitScore } from "./api/scores.js";
import { loadWordList } from "./game/wordList.js";
import { T } from "./theme.js";
import HomeScreen from "./screens/HomeScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import ResultScreen from "./screens/ResultScreen.jsx";
import LeaderboardScreen from "./screens/LeaderboardScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = laddar, null = utloggad/gäst
  const [displayName, setDisplayName] = useState(null);
  const [screen, setScreen] = useState("home");
  const [sourceWord, setSourceWord] = useState(null);
  const [wordListReady, setWordListReady] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { score, words }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null); // Ingen backend lokalt — kör direkt som gäst, ingen krasch.
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) fetchDisplayName(u.id).then(setDisplayName);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchDisplayName(u.id).then(setDisplayName);
      else setDisplayName(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchTodaysWord(todayStr()).then(setSourceWord);
  }, []);

  useEffect(() => {
    loadWordList().then(() => setWordListReady(true));
  }, []);

  const navigate = useCallback((next) => setScreen(next), []);

  const handleGameFinish = useCallback(async (score, words) => {
    setLastResult({ score, words });
    setScreen("result");
    // Gäster spelar men syns inte på topplistan.
    if (user) {
      const name = displayName ?? user.email.split("@")[0];
      await submitScore(user.id, todayStr(), score, words, name);
    }
  }, [user, displayName]);

  const handleSignOut = useCallback(() => {
    if (isSupabaseConfigured) supabase.auth.signOut();
  }, []);

  if (user === undefined || !sourceWord || !wordListReady) {
    return (
      <div style={{
        minHeight: "100dvh", background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: T.muted, fontFamily: "system-ui, sans-serif" }}>Laddar…</div>
      </div>
    );
  }

  if (screen === "auth") {
    return <AuthScreen onDone={() => navigate("home")} />;
  }

  if (screen === "game") {
    return <GameScreen sourceWord={sourceWord} onFinish={handleGameFinish} />;
  }

  if (screen === "result" && lastResult) {
    return (
      <ResultScreen
        score={lastResult.score}
        words={lastResult.words}
        user={user}
        onPlayHome={() => navigate("home")}
        onLeaderboard={() => navigate("leaderboard")}
        onLogin={() => navigate("auth")}
      />
    );
  }

  if (screen === "leaderboard") {
    return <LeaderboardScreen date={todayStr()} onBack={() => navigate("home")} />;
  }

  return (
    <HomeScreen
      user={user}
      displayName={displayName}
      onPlay={() => navigate("game")}
      onLeaderboard={() => navigate("leaderboard")}
      onLogin={() => navigate("auth")}
      onSignOut={handleSignOut}
    />
  );
}
