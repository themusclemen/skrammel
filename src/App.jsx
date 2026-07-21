import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { fetchTodaysWord, fetchAllDailyWords } from "./api/dailyWord.js";
import { submitScore, fetchUserPlayedDates, hasPlayedDate, fetchUserStats } from "./api/scores.js";
import { loadWordList, getDictionary } from "./game/wordList.js";
import { computeStreak } from "./game/streak.js";
import { bestLevelReached, levelReachedForScore } from "./game/levels.js";
import { ADMIN_EMAIL } from "./game/constants.js";
import { BLIXT_DURATION_SECONDS } from "./game/blixtConstants.js";
import { parseInviteFromLocation, confirmFriendship } from "./api/friends.js";
import { fetchRandomOpponent } from "./api/scores.js";
import {
  pickBlixtWord, createChallenge, respondToChallenge, submitBlixtScore,
  fetchMyChallenges, classifyChallenge, deleteChallenge,
} from "./api/blixt.js";
import {
  createChallenge as createSkrammelpajChallenge,
  respondToChallenge as respondToSkrammelpajChallenge,
  deleteChallenge as deleteSkrammelpajChallenge,
  submitMove as submitSkrammelpajMove,
  reportLoss as reportSkrammelpajLoss,
  fetchMyChallenges as fetchMySkrammelpajChallenges,
  classifyChallenge as classifySkrammelpajChallenge,
  applyPendingForfeits as applyPendingSkrammelpajForfeits,
  computeRemainingCounts as computeSkrammelpajRemainingCounts,
} from "./api/skrammelpaj.js";
import { generateSkrammelpajPool } from "./game/skrammelpajPool.js";
import { loadSeenStatuses, saveSeenStatuses } from "./game/matchSeen.js";
import { T } from "./theme.js";
import HomeScreen from "./screens/HomeScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import ResultScreen from "./screens/ResultScreen.jsx";
import LeaderboardScreen from "./screens/LeaderboardScreen.jsx";
import ArchiveScreen from "./screens/ArchiveScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import AdminWordsScreen from "./screens/AdminWordsScreen.jsx";
import BlixtWordsAdminScreen from "./screens/BlixtWordsAdminScreen.jsx";
import FriendsScreen from "./screens/FriendsScreen.jsx";
import BlixtScreen from "./screens/BlixtScreen.jsx";
import BlixtChooseOpponentScreen from "./screens/BlixtChooseOpponentScreen.jsx";
import BlixtResultScreen from "./screens/BlixtResultScreen.jsx";
import BlixtLeaderboardScreen from "./screens/BlixtLeaderboardScreen.jsx";
import SkrammelpajScreen from "./screens/SkrammelpajScreen.jsx";
import SkrammelpajChooseOpponentScreen from "./screens/SkrammelpajChooseOpponentScreen.jsx";
import SkrammelpajGameScreen from "./screens/SkrammelpajGameScreen.jsx";
import SkrammelpajCpuScreen from "./screens/SkrammelpajCpuScreen.jsx";
import SkrammelpajResultScreen from "./screens/SkrammelpajResultScreen.jsx";
import SkrammelpajLeaderboardScreen from "./screens/SkrammelpajLeaderboardScreen.jsx";
import ReplayConfirmModal from "./components/ReplayConfirmModal.jsx";
import FriendInviteModal from "./components/FriendInviteModal.jsx";

// Prefix för matchSeen.js — skiljer de två spelens lokala "sedd status"-lagring åt.
const BLIXT_SEEN_PREFIX = "skrammel_blixt_seen_";
const SKRAMMELPAJ_SEEN_PREFIX = "skrammel_skrammelpaj_seen_";

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
  const isBlixtAdminRoute = window.location.pathname === "/admin/blixt";
  const [user, setUser] = useState(undefined); // undefined = laddar, null = utloggad/gäst
  const displayName = user?.user_metadata?.display_name ?? null; // satt vid signup, se AuthScreen
  const [screen, setScreen] = useState("home");
  const [wordListReady, setWordListReady] = useState(false);
  const [sourceWord, setSourceWord] = useState(null);
  const [playingDate, setPlayingDate] = useState(null); // datumet för pusslet som spelas/spelades
  // Sant när spelaren valt att spela om ett redan klarat datum ur arkivet —
  // se ReplayConfirmModal. Resultatet sparas då inte till topplistan.
  const [isReplay, setIsReplay] = useState(false);
  const [leaderboardDate, setLeaderboardDate] = useState(null);
  const [lastResult, setLastResult] = useState(null); // { score, words }
  const [archiveData, setArchiveData] = useState(null); // { playableDates, playedDates }
  // Sant medan vi väntar på att spelaren bekräftar en repris av dagens ord
  // (via "Spela dagens skrammel" när den redan är klarad) — se handlePlayToday.
  const [showTodayReplayConfirm, setShowTodayReplayConfirm] = useState(false);
  // Underlag för spelstreck och bästa nivå — se HomeScreen/ResultScreen.
  const [userStats, setUserStats] = useState({ playedDates: [], levelTimesList: [] });
  // Läst en gång ur adressraden vid mount (/friend/<uuid>?name=...) — se
  // src/api/friends.js. Bekräftelsen (FriendInviteModal) är det som
  // faktiskt skapar vänskapsraden, inte länken i sig.
  const [pendingInvite, setPendingInvite] = useState(() => parseInviteFromLocation());
  // Blixtpussel v2 (async 1-mot-1-utmaning, se api/blixt.js): oriktad runda
  // pågår / väntar på mottagarval / opponenten spelar en accepterad
  // utmaning / opponentens resultat efteråt.
  const [blixtSourceWord, setBlixtSourceWord] = useState(null);
  const [blixtDraftResult, setBlixtDraftResult] = useState(null); // { score, words, sourceWord }
  // Satt när en blixt-runda startats för att utmana en specifik spelare
  // direkt (t.ex. via "Utmana" på topplistan, se BlixtLeaderboardScreen) —
  // förifyller den valda motståndaren på blixt-choose-skärmen istället för
  // att spelaren måste hitta samma person i vän-/slumplistan igen.
  const [blixtPresetOpponent, setBlixtPresetOpponent] = useState(null); // { id, name }
  const [activeBlixtChallenge, setActiveBlixtChallenge] = useState(null);
  const [blixtResult, setBlixtResult] = useState(null); // { myScore, myWords, opponentScore, opponentName }
  const [myBlixtChallenges, setMyBlixtChallenges] = useState([]);
  // Skrammelpaj (async 1-mot-1 bokstavspool-duell, se api/skrammelpaj.js):
  // till skillnad från Blixt väljs motståndaren INNAN något skapas (ingen
  // oberoende solorunda att spela i förväg — poolen är delad).
  const [skrammelpajPresetOpponent, setSkrammelpajPresetOpponent] = useState(null); // { id, name }
  const [activeSkrammelpajChallenge, setActiveSkrammelpajChallenge] = useState(null);
  const [skrammelpajResult, setSkrammelpajResult] = useState(null); // { won, endReason, opponentName, moves }
  const [mySkrammelpajChallenges, setMySkrammelpajChallenges] = useState([]);

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

  useEffect(() => {
    if (!user) { setUserStats({ playedDates: [], levelTimesList: [] }); return; }
    fetchUserStats(user.id).then(setUserStats);
  }, [user]);

  const refreshBlixtChallenges = useCallback(() => {
    if (!user) { setMyBlixtChallenges([]); return Promise.resolve(); }
    return fetchMyChallenges(user.id).then(setMyBlixtChallenges);
  }, [user]);

  useEffect(() => { refreshBlixtChallenges(); }, [refreshBlixtChallenges]);

  const pendingBlixtCount = useMemo(() => {
    if (!user) return 0;
    return myBlixtChallenges.filter((c) => {
      const status = classifyChallenge(c, user.id);
      return status === "needs_response" || status === "your_turn";
    }).length;
  }, [myBlixtChallenges, user]);

  // Räknar matcher som bytt status (t.ex. antagen eller klar) sen jag
  // senast öppnade Blixt-huben — se game/matchSeen.js. Bumpas för att
  // tvinga fram omräkning när huben markerar en ny bunt som sedd, eftersom
  // det bara skriver till localStorage och inte rör myBlixtChallenges.
  const [blixtSeenVersion, setBlixtSeenVersion] = useState(0);
  const blixtUpdatesCount = useMemo(() => {
    if (!user) return 0;
    const seen = loadSeenStatuses(BLIXT_SEEN_PREFIX, user.id);
    return myBlixtChallenges.filter((c) => {
      const status = classifyChallenge(c, user.id);
      // Redan täckt av pendingBlixtCount — ska inte dubbelräknas här.
      if (status === "needs_response" || status === "your_turn") return false;
      return seen[c.id] !== c.status;
    }).length;
  }, [myBlixtChallenges, user, blixtSeenVersion]);

  // Markerar allt som sett så fort spelaren faktiskt tittar i Blixt-huben —
  // det är den enda "jag har läst det här"-signalen vi har utan
  // server-side läststatus.
  useEffect(() => {
    if (screen !== "blixt-hub" || !user) return;
    saveSeenStatuses(BLIXT_SEEN_PREFIX, user.id, myBlixtChallenges);
    setBlixtSeenVersion((v) => v + 1);
  }, [screen, user, myBlixtChallenges]);

  // Hämtar mina Skrammelpaj-matcher, och avgör i samma veva om någon av dem
  // sprungit ut på 72-timmarsgränsen (self-reported, se
  // applyPendingForfeits — ingen cron finns i appen) — om något ändrades
  // hämtas listan om en gång till för att få de uppdaterade raderna.
  const refreshSkrammelpajChallenges = useCallback(async () => {
    if (!user) { setMySkrammelpajChallenges([]); return; }
    const list = await fetchMySkrammelpajChallenges(user.id);
    const changed = await applyPendingSkrammelpajForfeits(list, user.id);
    setMySkrammelpajChallenges(changed ? await fetchMySkrammelpajChallenges(user.id) : list);
  }, [user]);

  useEffect(() => { refreshSkrammelpajChallenges(); }, [refreshSkrammelpajChallenges]);

  const pendingSkrammelpajCount = useMemo(() => {
    if (!user) return 0;
    return mySkrammelpajChallenges.filter((c) => {
      const status = classifySkrammelpajChallenge(c, user.id);
      return status === "needs_response" || status === "your_turn";
    }).length;
  }, [mySkrammelpajChallenges, user]);

  const [skrammelpajSeenVersion, setSkrammelpajSeenVersion] = useState(0);
  const skrammelpajUpdatesCount = useMemo(() => {
    if (!user) return 0;
    const seen = loadSeenStatuses(SKRAMMELPAJ_SEEN_PREFIX, user.id);
    return mySkrammelpajChallenges.filter((c) => {
      const status = classifySkrammelpajChallenge(c, user.id);
      if (status === "needs_response" || status === "your_turn") return false;
      return seen[c.id] !== c.status;
    }).length;
  }, [mySkrammelpajChallenges, user, skrammelpajSeenVersion]);

  useEffect(() => {
    if (screen !== "skrammelpaj-hub" || !user) return;
    saveSeenStatuses(SKRAMMELPAJ_SEEN_PREFIX, user.id, mySkrammelpajChallenges);
    setSkrammelpajSeenVersion((v) => v + 1);
  }, [screen, user, mySkrammelpajChallenges]);

  const clearInviteUrl = useCallback(() => {
    if (window.location.pathname.startsWith("/friend/")) window.history.replaceState({}, "", "/");
  }, []);

  // En öppnad inbjudningslänk utan inloggning tar direkt till inloggning
  // istället för att bara landa på hemskärmen utan förklaring.
  useEffect(() => {
    if (pendingInvite && user === null && screen === "home") setScreen("auth");
  }, [pendingInvite, user, screen]);

  // Egen länk öppnad (t.ex. testat sin egen delning) — inget att bekräfta.
  useEffect(() => {
    if (pendingInvite && user && pendingInvite.inviterId === user.id) {
      setPendingInvite(null);
      clearInviteUrl();
    }
  }, [pendingInvite, user, clearInviteUrl]);

  const streak = useMemo(
    () => computeStreak(userStats.playedDates, todayStr()),
    [userStats.playedDates]
  );
  const bestLevel = useMemo(
    () => bestLevelReached(userStats.levelTimesList),
    [userStats.levelTimesList]
  );

  const navigate = useCallback((next) => setScreen(next), []);

  // Hämtar ordet för ett datum (idag eller ur arkivet) och startar spelet.
  const startGame = useCallback((date, { isReplay: replay = false } = {}) => {
    fetchTodaysWord(date).then((word) => {
      setSourceWord(word);
      setPlayingDate(date);
      setIsReplay(replay);
      setScreen("game");
    });
  }, []);

  // Fångar en repris av dagens ord från hemskärmen (Spela dagens skrammel)
  // innan spelet startar — precis som ReplayConfirmModal gör i arkivet.
  const handlePlayToday = useCallback(async () => {
    if (user && await hasPlayedDate(user.id, todayStr())) {
      setShowTodayReplayConfirm(true);
      return;
    }
    startGame(todayStr());
  }, [user, startGame]);

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
    if (!user || isReplay) return; // Gäster syns inte på topplistan; reprisresultat räknas inte.
    const name = displayName ?? user.email.split("@")[0];
    await submitScore(user.id, playingDate ?? todayStr(), score, words, name, levelTimes);
    fetchUserStats(user.id).then(setUserStats); // Uppdaterar streck/bästa nivå direkt till resultatskärmen.
  }, [user, displayName, playingDate, isReplay]);

  const handleGameFinish = useCallback((score, words, totalPossibleScore) => {
    setLastResult({ score, words, todayLevel: levelReachedForScore(score, totalPossibleScore) });
    setScreen("result");
  }, []);

  const handleSignOut = useCallback(() => {
    if (isSupabaseConfigured) supabase.auth.signOut();
  }, []);

  const handleConfirmInvite = useCallback(async () => {
    if (!pendingInvite || !user) return;
    const name = displayName ?? user.email.split("@")[0];
    await confirmFriendship(user.id, name, pendingInvite.inviterId, pendingInvite.inviterName);
    setPendingInvite(null);
    clearInviteUrl();
    setScreen("friends");
  }, [pendingInvite, user, displayName, clearInviteUrl]);

  const handleCancelInvite = useCallback(() => {
    setPendingInvite(null);
    clearInviteUrl();
  }, [clearInviteUrl]);

  const handlePlayBlixt = useCallback(async () => {
    setBlixtPresetOpponent(null);
    const word = await pickBlixtWord(getDictionary());
    setBlixtSourceWord(word);
    setScreen("blixt-play");
  }, []);

  // Utmana direkt från topplistan (global eller vänner, se
  // BlixtLeaderboardScreen) — samma flöde som "Spela en blixt", men
  // motståndaren är redan vald när blixt-choose-skärmen visas efteråt.
  const handleChallengeFromLeaderboard = useCallback(async (opponentId, opponentName) => {
    setBlixtPresetOpponent({ id: opponentId, name: opponentName });
    const word = await pickBlixtWord(getDictionary());
    setBlixtSourceWord(word);
    setScreen("blixt-play");
  }, []);

  const handleBlixtPlayFinish = useCallback((score, words) => {
    setBlixtDraftResult({ score, words, sourceWord: blixtSourceWord });
    setScreen("blixt-choose");
  }, [blixtSourceWord]);

  const handleChallengeFriend = useCallback(async (opponentId, opponentName) => {
    if (!user || !blixtDraftResult) return;
    const name = displayName ?? user.email.split("@")[0];
    await createChallenge(
      user.id, name, opponentId, opponentName,
      blixtDraftResult.sourceWord, blixtDraftResult.score, blixtDraftResult.words
    );
    await refreshBlixtChallenges();
    setBlixtDraftResult(null);
    setBlixtPresetOpponent(null);
    setScreen("blixt-hub");
  }, [user, displayName, blixtDraftResult, refreshBlixtChallenges]);

  // Slumpar en motståndare och försöker skapa utmaningen; om insert avvisas
  // (mottagarens 20-tak nått) provas en ny kandidat, upp till 5 försök.
  const handleChallengeRandom = useCallback(async () => {
    if (!user || !blixtDraftResult) return;
    const name = displayName ?? user.email.split("@")[0];
    const openOpponentIds = myBlixtChallenges
      .filter((c) => c.status === "pending" || c.status === "accepted")
      .map((c) => (c.creator_id === user.id ? c.opponent_id : c.creator_id));
    const excludeIds = [user.id, ...openOpponentIds];

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = await fetchRandomOpponent(user.id, excludeIds);
      if (!candidate) break;
      try {
        await createChallenge(
          user.id, name, candidate.opponentId, candidate.opponentName,
          blixtDraftResult.sourceWord, blixtDraftResult.score, blixtDraftResult.words
        );
        await refreshBlixtChallenges();
        setBlixtDraftResult(null);
        setBlixtPresetOpponent(null);
        setScreen("blixt-hub");
        return;
      } catch {
        excludeIds.push(candidate.opponentId);
      }
    }
    throw new Error("Hittade ingen ledig motståndare just nu, försök igen senare.");
  }, [user, displayName, blixtDraftResult, myBlixtChallenges, refreshBlixtChallenges]);

  const handleSkipBlixtChallenge = useCallback(() => {
    setBlixtDraftResult(null);
    setBlixtPresetOpponent(null);
    setScreen("blixt-hub");
  }, []);

  const handleRespondToChallenge = useCallback(async (challengeId, accept) => {
    await respondToChallenge(challengeId, accept);
    await refreshBlixtChallenges();
  }, [refreshBlixtChallenges]);

  const handleDeleteChallenge = useCallback(async (challengeId) => {
    await deleteChallenge(challengeId);
    await refreshBlixtChallenges();
  }, [refreshBlixtChallenges]);

  const handlePlayAcceptedChallenge = useCallback((challenge) => {
    setActiveBlixtChallenge(challenge);
    setScreen("blixt-respond-play");
  }, []);

  const handleBlixtResponseFinish = useCallback(async (score, words) => {
    if (!user || !activeBlixtChallenge) return;
    const name = displayName ?? user.email.split("@")[0];
    await submitBlixtScore(activeBlixtChallenge.id, user.id, name, score, words);
    setBlixtResult({
      myScore: score,
      myWords: words,
      opponentScore: activeBlixtChallenge.blixt_scores?.find(
        (s) => s.user_id === activeBlixtChallenge.creator_id
      )?.score ?? 0,
      opponentName: activeBlixtChallenge.creator_display_name,
    });
    setActiveBlixtChallenge(null);
    await refreshBlixtChallenges();
    setScreen("blixt-result");
  }, [user, displayName, activeBlixtChallenge, refreshBlixtChallenges]);

  const goToBlixt = useCallback(async () => {
    await refreshBlixtChallenges();
    setScreen("blixt-hub");
  }, [refreshBlixtChallenges]);

  const goToBlixtLeaderboard = useCallback(() => {
    setScreen("blixt-leaderboard");
  }, []);

  const handleStartSkrammelpaj = useCallback(() => {
    setSkrammelpajPresetOpponent(null);
    setScreen("skrammelpaj-choose");
  }, []);

  // Utmana direkt från topplistan — samma mönster som Blixts motsvarighet.
  const handleChallengeSkrammelpajFromLeaderboard = useCallback((opponentId, opponentName) => {
    setSkrammelpajPresetOpponent({ id: opponentId, name: opponentName });
    setScreen("skrammelpaj-choose");
  }, []);

  const handleChallengeSkrammelpajFriend = useCallback(async (opponentId, opponentName) => {
    if (!user) return;
    const name = displayName ?? user.email.split("@")[0];
    const pool = generateSkrammelpajPool(getDictionary());
    if (!pool) throw new Error("Kunde inte skapa en bra bokstavspool just nu, försök igen.");
    await createSkrammelpajChallenge(user.id, name, opponentId, opponentName, pool.letters);
    await refreshSkrammelpajChallenges();
    setSkrammelpajPresetOpponent(null);
    setScreen("skrammelpaj-hub");
  }, [user, displayName, refreshSkrammelpajChallenges]);

  // Slumpar en motståndare och försöker skapa utmaningen; om insert avvisas
  // (mottagarens 20-tak nått) provas en ny kandidat, upp till 5 försök —
  // samma mönster som Blixts handleChallengeRandom.
  const handleChallengeSkrammelpajRandom = useCallback(async () => {
    if (!user) return;
    const name = displayName ?? user.email.split("@")[0];
    const pool = generateSkrammelpajPool(getDictionary());
    if (!pool) throw new Error("Kunde inte skapa en bra bokstavspool just nu, försök igen.");
    const openOpponentIds = mySkrammelpajChallenges
      .filter((c) => c.status === "pending" || c.status === "accepted")
      .map((c) => (c.creator_id === user.id ? c.opponent_id : c.creator_id));
    const excludeIds = [user.id, ...openOpponentIds];

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = await fetchRandomOpponent(user.id, excludeIds);
      if (!candidate) break;
      try {
        await createSkrammelpajChallenge(user.id, name, candidate.opponentId, candidate.opponentName, pool.letters);
        await refreshSkrammelpajChallenges();
        setSkrammelpajPresetOpponent(null);
        setScreen("skrammelpaj-hub");
        return;
      } catch {
        excludeIds.push(candidate.opponentId);
      }
    }
    throw new Error("Hittade ingen ledig motståndare just nu, försök igen senare.");
  }, [user, displayName, mySkrammelpajChallenges, refreshSkrammelpajChallenges]);

  const handlePlaySkrammelpajCpu = useCallback(() => {
    setSkrammelpajPresetOpponent(null);
    setScreen("skrammelpaj-cpu");
  }, []);

  const handleSkipSkrammelpajChallenge = useCallback(() => {
    setSkrammelpajPresetOpponent(null);
    setScreen("skrammelpaj-hub");
  }, []);

  const handleRespondToSkrammelpajChallenge = useCallback(async (challenge, accept) => {
    await respondToSkrammelpajChallenge(challenge, accept);
    await refreshSkrammelpajChallenges();
  }, [refreshSkrammelpajChallenges]);

  const handleDeleteSkrammelpajChallenge = useCallback(async (challengeId) => {
    await deleteSkrammelpajChallenge(challengeId);
    await refreshSkrammelpajChallenges();
  }, [refreshSkrammelpajChallenges]);

  const handlePlaySkrammelpajTurn = useCallback((challenge) => {
    setActiveSkrammelpajChallenge(challenge);
    setScreen("skrammelpaj-play");
  }, []);

  function skrammelpajOpponentNameFor(challenge, userId) {
    return challenge.creator_id === userId ? challenge.opponent_display_name : challenge.creator_display_name;
  }

  // Lägger in draget; om matchen avgörs direkt (motståndarens pool tömd)
  // visas resultatskärmen, annars går vi tillbaka till huben och väntar på
  // motståndarens tur.
  const handleSkrammelpajSubmitWord = useCallback(async (word) => {
    if (!user || !activeSkrammelpajChallenge) return;
    const name = displayName ?? user.email.split("@")[0];
    const moves = activeSkrammelpajChallenge.skrammelpaj_moves ?? [];
    const outcome = await submitSkrammelpajMove(activeSkrammelpajChallenge, moves, user.id, name, word, getDictionary());
    const opponentName = skrammelpajOpponentNameFor(activeSkrammelpajChallenge, user.id);

    if (outcome.completed) {
      setSkrammelpajResult({
        won: outcome.winnerId === user.id,
        endReason: outcome.endReason,
        opponentName,
        moves: [...moves, { user_id: user.id, word }],
      });
      setActiveSkrammelpajChallenge(null);
      await refreshSkrammelpajChallenges();
      setScreen("skrammelpaj-result");
      return;
    }

    setActiveSkrammelpajChallenge(null);
    await refreshSkrammelpajChallenges();
    setScreen("skrammelpaj-hub");
  }, [user, displayName, activeSkrammelpajChallenge, refreshSkrammelpajChallenges]);

  // Självrapporterat nederlag (tiden gick ut, poolen var redan omöjlig, eller
  // spelaren gav upp via menyn) — samma slutdestination som en vinst:
  // resultatskärmen, med den hittills spelade draghistoriken.
  const handleSkrammelpajLoss = useCallback(async (endReason) => {
    if (!user || !activeSkrammelpajChallenge) return;
    await reportSkrammelpajLoss(activeSkrammelpajChallenge, user.id, endReason);
    setSkrammelpajResult({
      won: false,
      endReason,
      opponentName: skrammelpajOpponentNameFor(activeSkrammelpajChallenge, user.id),
      moves: activeSkrammelpajChallenge.skrammelpaj_moves ?? [],
    });
    setActiveSkrammelpajChallenge(null);
    await refreshSkrammelpajChallenges();
    setScreen("skrammelpaj-result");
  }, [user, activeSkrammelpajChallenge, refreshSkrammelpajChallenges]);

  const goToSkrammelpaj = useCallback(async () => {
    await refreshSkrammelpajChallenges();
    setScreen("skrammelpaj-hub");
  }, [refreshSkrammelpajChallenges]);

  const goToSkrammelpajLeaderboard = useCallback(() => {
    setScreen("skrammelpaj-leaderboard");
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

  if (isAdminRoute || isBlixtAdminRoute) {
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
    return isBlixtAdminRoute ? <BlixtWordsAdminScreen /> : <AdminWordsScreen />;
  }

  if (screen === "auth") {
    return <AuthScreen onDone={() => navigate("home")} />;
  }

  if (screen === "game" && sourceWord) {
    return (
      <GameScreen
        sourceWord={sourceWord}
        onSubmitScore={handleSubmitScore}
        onFinish={handleGameFinish}
        onBack={() => navigate("home")}
      />
    );
  }

  if (screen === "blixt-play" && blixtSourceWord) {
    return (
      <GameScreen
        sourceWord={blixtSourceWord}
        durationSeconds={BLIXT_DURATION_SECONDS}
        showLevelBar={false}
        allowFreePlay={false}
        onSubmitScore={() => {}}
        onFinish={handleBlixtPlayFinish}
        onBack={() => navigate("home")}
      />
    );
  }

  if (screen === "blixt-choose" && blixtDraftResult && user) {
    return (
      <BlixtChooseOpponentScreen
        user={user}
        draftResult={blixtDraftResult}
        presetOpponent={blixtPresetOpponent}
        onChallengeFriend={handleChallengeFriend}
        onChallengeRandom={handleChallengeRandom}
        onSkip={handleSkipBlixtChallenge}
      />
    );
  }

  if (screen === "blixt-hub" && user) {
    return (
      <BlixtScreen
        user={user}
        challenges={myBlixtChallenges}
        onRespond={handleRespondToChallenge}
        onPlay={handlePlayAcceptedChallenge}
        onPlayNew={handlePlayBlixt}
        onDelete={handleDeleteChallenge}
        onLeaderboard={goToBlixtLeaderboard}
        onBack={() => navigate("home")}
      />
    );
  }

  if (screen === "blixt-leaderboard") {
    return <BlixtLeaderboardScreen user={user} onBack={goToBlixt} onChallenge={handleChallengeFromLeaderboard} />;
  }

  if (screen === "blixt-respond-play" && activeBlixtChallenge) {
    const opponentTargetScore = activeBlixtChallenge.blixt_scores?.find(
      (s) => s.user_id === activeBlixtChallenge.creator_id
    )?.score ?? 0;
    return (
      <GameScreen
        sourceWord={activeBlixtChallenge.source_word}
        durationSeconds={BLIXT_DURATION_SECONDS}
        showLevelBar={false}
        allowFreePlay={false}
        targetScore={opponentTargetScore}
        opponentName={activeBlixtChallenge.creator_display_name}
        onSubmitScore={() => {}}
        onFinish={handleBlixtResponseFinish}
        onBack={() => navigate("blixt-hub")}
      />
    );
  }

  if (screen === "blixt-result" && blixtResult) {
    return (
      <BlixtResultScreen
        myScore={blixtResult.myScore}
        myWords={blixtResult.myWords}
        opponentScore={blixtResult.opponentScore}
        opponentName={blixtResult.opponentName}
        onHome={() => navigate("home")}
        onBlixt={goToBlixt}
      />
    );
  }

  if (screen === "skrammelpaj-choose" && user) {
    return (
      <SkrammelpajChooseOpponentScreen
        user={user}
        presetOpponent={skrammelpajPresetOpponent}
        onChallengeFriend={handleChallengeSkrammelpajFriend}
        onChallengeRandom={handleChallengeSkrammelpajRandom}
        onPlayCpu={handlePlaySkrammelpajCpu}
        onBack={handleSkipSkrammelpajChallenge}
      />
    );
  }

  if (screen === "skrammelpaj-cpu") {
    return <SkrammelpajCpuScreen onHome={() => navigate("home")} />;
  }

  if (screen === "skrammelpaj-hub" && user) {
    return (
      <SkrammelpajScreen
        user={user}
        challenges={mySkrammelpajChallenges}
        onRespond={handleRespondToSkrammelpajChallenge}
        onPlay={handlePlaySkrammelpajTurn}
        onPlayNew={handleStartSkrammelpaj}
        onDelete={handleDeleteSkrammelpajChallenge}
        onLeaderboard={goToSkrammelpajLeaderboard}
        onBack={() => navigate("home")}
      />
    );
  }

  if (screen === "skrammelpaj-leaderboard") {
    return (
      <SkrammelpajLeaderboardScreen
        user={user}
        onBack={goToSkrammelpaj}
        onChallenge={handleChallengeSkrammelpajFromLeaderboard}
      />
    );
  }

  if (screen === "skrammelpaj-play" && activeSkrammelpajChallenge && user) {
    const opponentName = activeSkrammelpajChallenge.creator_id === user.id
      ? activeSkrammelpajChallenge.opponent_display_name
      : activeSkrammelpajChallenge.creator_display_name;
    const remainingCounts = computeSkrammelpajRemainingCounts(
      activeSkrammelpajChallenge, activeSkrammelpajChallenge.skrammelpaj_moves ?? []
    );
    return (
      <SkrammelpajGameScreen
        remainingCounts={remainingCounts}
        opponentName={opponentName}
        onSubmitWord={handleSkrammelpajSubmitWord}
        onTimeout={() => handleSkrammelpajLoss("timeout")}
        onGiveUp={() => handleSkrammelpajLoss("give_up")}
        onImpossible={() => handleSkrammelpajLoss("no_words_left")}
        onBack={() => navigate("skrammelpaj-hub")}
      />
    );
  }

  if (screen === "skrammelpaj-result" && skrammelpajResult && user) {
    return (
      <SkrammelpajResultScreen
        won={skrammelpajResult.won}
        endReason={skrammelpajResult.endReason}
        opponentName={skrammelpajResult.opponentName}
        moves={skrammelpajResult.moves}
        userId={user.id}
        onHome={() => navigate("home")}
        onSkrammelpaj={goToSkrammelpaj}
      />
    );
  }

  if (screen === "result" && lastResult) {
    return (
      <ResultScreen
        score={lastResult.score}
        words={lastResult.words}
        todayLevel={lastResult.todayLevel}
        date={playingDate ?? todayStr()}
        user={user}
        streak={streak}
        bestLevel={bestLevel}
        onPlayHome={() => navigate("home")}
        onLeaderboard={() => goToLeaderboard(playingDate ?? todayStr())}
        onLogin={() => navigate("auth")}
      />
    );
  }

  if (screen === "leaderboard") {
    return (
      <LeaderboardScreen
        date={leaderboardDate ?? todayStr()}
        onDateChange={setLeaderboardDate}
        onHome={() => navigate("home")}
        onArchive={openArchive}
        user={user}
      />
    );
  }

  if (screen === "friends" && user) {
    return (
      <FriendsScreen user={user} displayName={displayName} onBack={() => navigate("home")} />
    );
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
    <>
      <HomeScreen
        user={user}
        displayName={displayName}
        streak={streak}
        bestLevel={bestLevel}
        pendingBlixtCount={pendingBlixtCount}
        blixtUpdatesCount={blixtUpdatesCount}
        pendingSkrammelpajCount={pendingSkrammelpajCount}
        skrammelpajUpdatesCount={skrammelpajUpdatesCount}
        onPlay={handlePlayToday}
        onPlayBlixt={handlePlayBlixt}
        onPlaySkrammelpaj={handleStartSkrammelpaj}
        onArchive={openArchive}
        onLeaderboard={() => goToLeaderboard(todayStr())}
        onFriends={() => navigate("friends")}
        onGoToBlixt={goToBlixt}
        onGoToSkrammelpaj={goToSkrammelpaj}
        onLogin={() => navigate("auth")}
        onSignOut={handleSignOut}
      />
      {showTodayReplayConfirm && (
        <ReplayConfirmModal
          onConfirm={() => { setShowTodayReplayConfirm(false); startGame(todayStr(), { isReplay: true }); }}
          onCancel={() => setShowTodayReplayConfirm(false)}
        />
      )}
      {pendingInvite && user && pendingInvite.inviterId !== user.id && (
        <FriendInviteModal
          inviterName={pendingInvite.inviterName}
          onConfirm={handleConfirmInvite}
          onCancel={handleCancelInvite}
        />
      )}
    </>
  );
}
