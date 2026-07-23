import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { fetchTodaysWord, fetchAllDailyWords } from "./api/dailyWord.js";
import { submitScore, fetchUserPlayedDates, fetchUserStats } from "./api/scores.js";
import { submitHetsScore, fetchMyHetsBest } from "./api/hets.js";
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
  applyPendingExpirations as applyPendingBlixtExpirations,
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
  applyPendingExpirations as applyPendingSkrammelpajExpirations,
  computeRemainingCounts as computeSkrammelpajRemainingCounts,
} from "./api/skrammelpaj.js";
import { generateSkrammelpajPool } from "./game/skrammelpajPool.js";
import { loadSeenStatuses, saveSeenStatuses } from "./game/matchSeen.js";
import { T } from "./theme.js";
import HomeScreen from "./screens/HomeScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import GameInfoScreen from "./screens/GameInfoScreen.jsx";
import ResultScreen from "./screens/ResultScreen.jsx";
import HetsGameScreen from "./screens/HetsGameScreen.jsx";
import HetsResultScreen from "./screens/HetsResultScreen.jsx";
import HetsLeaderboardScreen from "./screens/HetsLeaderboardScreen.jsx";
import LeaderboardScreen from "./screens/LeaderboardScreen.jsx";
import TopplistorScreen from "./screens/TopplistorScreen.jsx";
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
  // Sant när spelaren valt att spela om ett redan klarat datum — antingen
  // dagens (se handleStartDailyFromInfo) eller ett ur arkivet (se
  // ArchiveScreen.jsx:s egen ReplayConfirmModal). Resultatet sparas då inte
  // till topplistan.
  const [isReplay, setIsReplay] = useState(false);
  const [leaderboardDate, setLeaderboardDate] = useState(null);
  const [lastResult, setLastResult] = useState(null); // { score, words }
  // Hets (solo tidsrusning, se game/hetsWords.js): spelarens eget rekord,
  // hämtat INNAN en runda startar så det kan visas som ett ständigt mål
  // under hela spelet (se HetsGameScreen) — inte bara i efterhand på
  // topplistan.
  const [hetsPersonalBest, setHetsPersonalBest] = useState(null);
  const [hetsResult, setHetsResult] = useState(null); // { highestCompletedLength, totalTimeMs, revealWord, previousBest }
  const [archiveData, setArchiveData] = useState(null); // { playableDates, playedDates }
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
  // Sant bara när rundan startas via hemskärmens nya förklaringsskärm
  // (GameInfoScreen) — se handleStartBlixtFromInfo.
  const [blixtSkipIntro, setBlixtSkipIntro] = useState(false);
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

  // Hämtar mina Blixt-utmaningar och avgör i samma veva om någon obesvarad
  // utmaning där jag är opponent sprungit ut på 24-timmarsgränsen
  // (self-reported, se applyPendingExpirations — ingen cron finns i appen).
  const refreshBlixtChallenges = useCallback(async () => {
    if (!user) { setMyBlixtChallenges([]); return; }
    let list = await fetchMyChallenges(user.id);
    const expired = await applyPendingBlixtExpirations(list, user.id);
    if (expired) list = await fetchMyChallenges(user.id);
    setMyBlixtChallenges(list);
  }, [user]);

  useEffect(() => { refreshBlixtChallenges(); }, [refreshBlixtChallenges]);

  // "Ditt drag" (your_turn) och "väntar på svar" (needs_response) är olika
  // sorters uppmärksamhet — det förra kräver att man spelar ett drag, det
  // senare bara att man antar/avböjer en utmaning. De hölls tidigare ihop i
  // en enda räkning, vilket fick badgen att visa t.ex. "6" fast bara 2 var
  // faktiska drag att göra. Separata räkningar nu, se HomeScreen.jsx.
  const pendingBlixtCount = useMemo(() => {
    if (!user) return 0;
    return myBlixtChallenges.filter((c) => classifyChallenge(c, user.id) === "your_turn").length;
  }, [myBlixtChallenges, user]);

  const pendingBlixtInviteCount = useMemo(() => {
    if (!user) return 0;
    return myBlixtChallenges.filter((c) => classifyChallenge(c, user.id) === "needs_response").length;
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
  // sprungit ut på 72-timmarsgränsen för en pågående tur eller 24-timmars-
  // gränsen för en obesvarad utmaning (båda self-reported, se
  // applyPendingForfeits/applyPendingExpirations — ingen cron finns i
  // appen) — om något ändrades hämtas listan om en gång till för att få de
  // uppdaterade raderna. Returnerar listan så anropare (t.ex. pollningen på
  // spelskärmen) kan läsa av den direkt utan ett extra state-varv.
  const refreshSkrammelpajChallenges = useCallback(async () => {
    if (!user) { setMySkrammelpajChallenges([]); return []; }
    let list = await fetchMySkrammelpajChallenges(user.id);
    const forfeited = await applyPendingSkrammelpajForfeits(list, user.id);
    const expired = await applyPendingSkrammelpajExpirations(list, user.id);
    if (forfeited || expired) list = await fetchMySkrammelpajChallenges(user.id);
    setMySkrammelpajChallenges(list);
    return list;
  }, [user]);

  useEffect(() => { refreshSkrammelpajChallenges(); }, [refreshSkrammelpajChallenges]);

  const pendingSkrammelpajCount = useMemo(() => {
    if (!user) return 0;
    return mySkrammelpajChallenges.filter((c) => classifySkrammelpajChallenge(c, user.id) === "your_turn").length;
  }, [mySkrammelpajChallenges, user]);

  const pendingSkrammelpajInviteCount = useMemo(() => {
    if (!user) return 0;
    return mySkrammelpajChallenges.filter((c) => classifySkrammelpajChallenge(c, user.id) === "needs_response").length;
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
  // Styr blinket på "Dagens Skrammel"-knappen på hemskärmen — okänt (gäst)
  // räknas som "inte spelat" så knappen fortsätter blinka och uppmana till inloggning.
  const playedToday = useMemo(
    () => userStats.playedDates.includes(todayStr()),
    [userStats.playedDates]
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

  // Startar dagens ord från "Skrammel"-infoskärmen (se screen === "daily-info")
  // — playedToday är redan känt och visat där, så till skillnad från den
  // gamla direktknappen behövs ingen reaktiv ReplayConfirmModal-bekräftelse
  // här; spelaren har redan sett statusen och valt medvetet.
  const handleStartDailyFromInfo = useCallback(() => {
    startGame(todayStr(), { isReplay: playedToday });
  }, [startGame, playedToday]);

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

  // Hämtar spelarens Hets-rekord innan förklaringsskärmen visas, så målet
  // syns redan där (inte bara på resultatskärmen efteråt).
  const goToHetsInfo = useCallback(() => {
    setScreen("hets-info");
    if (user) fetchMyHetsBest(user.id).then(setHetsPersonalBest);
    else setHetsPersonalBest(null);
  }, [user]);

  // Sparar bara om resultatet faktiskt slår det gamla rekordet (se
  // submitHetsScore) och hämtar sen om det egna rekordet, så en efterföljande
  // "Spela igen" visar det uppdaterade målet — inte det som gällde innan den
  // här rundan.
  const handleHetsFinish = useCallback(async ({ highestCompletedLength, totalTimeMs, revealWord }) => {
    const previousBest = hetsPersonalBest;
    if (user) {
      const name = displayName ?? user.email.split("@")[0];
      await submitHetsScore(user.id, name, highestCompletedLength, totalTimeMs);
      setHetsPersonalBest(await fetchMyHetsBest(user.id));
    }
    setHetsResult({ highestCompletedLength, totalTimeMs, revealWord, previousBest });
    setScreen("hets-result");
  }, [user, displayName, hetsPersonalBest]);

  const goToHetsLeaderboard = useCallback(() => {
    setScreen("hets-leaderboard");
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

  // Hemskärmens "Blixt-Duell"-knapp går via en förklaringsskärm
  // (GameInfoScreen) innan själva rundan — skipIntro=true på GameScreen
  // efteråt så spelaren inte förklaras samma regler två gånger i rad.
  const handleStartBlixtFromInfo = useCallback(async () => {
    setBlixtSkipIntro(true);
    await handlePlayBlixt();
  }, [handlePlayBlixt]);

  // Blixt-hubbens egna "Spela en blixt"-knapp går INTE via
  // förklaringsskärmen (spelaren är redan inne i Blixt) — nollställer
  // skipIntro ifall den råkat stå kvar sant från ett tidigare, avbrutet
  // info-skärm-flöde.
  const handlePlayBlixtFromHub = useCallback(async () => {
    setBlixtSkipIntro(false);
    await handlePlayBlixt();
  }, [handlePlayBlixt]);

  // Utmana direkt från topplistan (global eller vänner, se
  // BlixtLeaderboardScreen) — samma flöde som "Spela en blixt", men
  // motståndaren är redan vald när blixt-choose-skärmen visas efteråt.
  const handleChallengeFromLeaderboard = useCallback(async (opponentId, opponentName) => {
    setBlixtSkipIntro(false);
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

  function skrammelpajOpponentIdFor(challenge, userId) {
    return challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
  }

  // Lägger in draget och uppdaterar matchen lokalt — men navigerar INTE
  // bort. Spelaren stannar kvar på spelskärmen, som själv (via challenge-
  // proppen nedan) visar "väntar på motståndaren", pollar för motståndarens
  // svar, och visar den pedagogiska sluta-modalen om draget avgjorde
  // matchen. Se SkrammelpajGameScreen + handleSkrammelpajMatchEndContinue.
  const handleSkrammelpajSubmitWord = useCallback(async (word) => {
    if (!user || !activeSkrammelpajChallenge) return;
    const name = displayName ?? user.email.split("@")[0];
    const moves = activeSkrammelpajChallenge.skrammelpaj_moves ?? [];
    const outcome = await submitSkrammelpajMove(activeSkrammelpajChallenge, moves, user.id, name, word);
    const opponentId = skrammelpajOpponentIdFor(activeSkrammelpajChallenge, user.id);
    const newMove = { id: `local-${Date.now()}`, user_id: user.id, display_name: name, move_number: moves.length + 1, word };

    setActiveSkrammelpajChallenge((prev) => prev && {
      ...prev,
      skrammelpaj_moves: [...moves, newMove],
      ...(outcome.completed
        ? { status: "completed", winner_id: outcome.winnerId, loser_id: opponentId, end_reason: outcome.endReason }
        : { current_turn_user_id: opponentId, turn_started_at: new Date().toISOString() }),
    });
    await refreshSkrammelpajChallenges();
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

  // Anropas av spelskärmens pedagogiska sluta-modal (både efter ett eget
  // avgörande drag och efter att pollningen upptäckt att motståndaren
  // avgjorde matchen) när spelaren klickar sig vidare — själva DB-skrivningen
  // har redan skett (av vinnaren), så här återstår bara att visa
  // resultatskärmen.
  const handleSkrammelpajMatchEndContinue = useCallback(({ won, endReason, moves, opponentName }) => {
    setSkrammelpajResult({ won, endReason, opponentName, moves });
    setActiveSkrammelpajChallenge(null);
    setScreen("skrammelpaj-result");
  }, []);

  const goToSkrammelpaj = useCallback(async () => {
    await refreshSkrammelpajChallenges();
    setScreen("skrammelpaj-hub");
  }, [refreshSkrammelpajChallenges]);

  // Lämnar spelskärmen utan att avgöra matchen — bara giltigt när det är
  // motståndarens tur (annars finns ingen sådan knapp att trycka på), så
  // inget mer än att gå tillbaka behövs.
  const handleLeaveSkrammelpajGame = useCallback(async () => {
    setActiveSkrammelpajChallenge(null);
    await goToSkrammelpaj();
  }, [goToSkrammelpaj]);

  const handleLeaveSkrammelpajGameToHome = useCallback(() => {
    setActiveSkrammelpajChallenge(null);
    setScreen("home");
  }, []);

  const goToSkrammelpajLeaderboard = useCallback(() => {
    setScreen("skrammelpaj-leaderboard");
  }, []);

  // Ingen realtidskanal finns i appen (se applyPendingForfeits-kommentaren)
  // — så länge spelaren sitter kvar på spelskärmen och väntar på
  // motståndarens tur pollar vi istället med jämna mellanrum, så att draget
  // syns utan att spelaren behöver navigera bort och tillbaka. Stannar
  // automatiskt så fort det blir min tur igen eller matchen avgörs (då
  // ändras beroendena nedan och effekten städas/startas inte om).
  useEffect(() => {
    if (screen !== "skrammelpaj-play" || !user || !activeSkrammelpajChallenge) return;
    if (activeSkrammelpajChallenge.status !== "accepted") return;
    if (activeSkrammelpajChallenge.current_turn_user_id === user.id) return;

    const id = setInterval(async () => {
      const list = await refreshSkrammelpajChallenges();
      const updated = list.find((c) => c.id === activeSkrammelpajChallenge.id);
      if (updated) setActiveSkrammelpajChallenge(updated);
    }, 8000);
    return () => clearInterval(id);
  }, [
    screen, user, refreshSkrammelpajChallenges,
    activeSkrammelpajChallenge?.id, activeSkrammelpajChallenge?.status, activeSkrammelpajChallenge?.current_turn_user_id,
  ]);

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

  if (screen === "daily-info") {
    return (
      <GameInfoScreen
        title="✨ Skrammel"
        description={
          playedToday
            ? ["Du har redan spelat dagens Skrammel!", "Du kan spela igen (räknas inte till topplistan), eller kika på tidigare dagar i kalendern."]
            : ["Hitta så många ord du kan ur dagens ord innan tiden går ut (5 minuter).", "Ett nytt ord varje dag — missar du en dag kan du alltid spela den i efterhand via kalendern."]
        }
        startLabel={playedToday ? "Spela igen" : "Starta"}
        onBack={() => navigate("home")}
        onStart={handleStartDailyFromInfo}
        secondaryAction={{ label: "📅 Kalender — tidigare dagar", onClick: openArchive }}
      />
    );
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

  if (screen === "hets-info") {
    return (
      <GameInfoScreen
        title="🔥 Solo-Hets"
        description={[
          "Datorn slumpar bokstäver som bildar ett ord — du har 30 sekunder på dig att skriva vilket giltigt ord som helst av exakt de bokstäverna.",
          "Första rundan är 3 bokstäver, sen blir det en bokstav till för varje runda du klarar. Du får gissa om och om igen, bara tiden inte tar slut.",
          hetsPersonalBest
            ? `Ditt rekord just nu: ${hetsPersonalBest.best_length} bokstäver.`
            : "Du spelar helt själv, men det finns en topplista att klättra på.",
        ]}
        onBack={() => navigate("home")}
        onStart={() => setScreen("hets-play")}
      />
    );
  }

  if (screen === "hets-play") {
    return (
      <HetsGameScreen
        personalBest={hetsPersonalBest}
        loggedIn={Boolean(user)}
        onFinish={handleHetsFinish}
        onBack={() => navigate("home")}
      />
    );
  }

  if (screen === "hets-result" && hetsResult) {
    return (
      <HetsResultScreen
        highestCompletedLength={hetsResult.highestCompletedLength}
        totalTimeMs={hetsResult.totalTimeMs}
        revealWord={hetsResult.revealWord}
        previousBest={hetsResult.previousBest}
        user={user}
        onPlayAgain={() => setScreen("hets-play")}
        onLeaderboard={goToHetsLeaderboard}
        onHome={() => navigate("home")}
        onLogin={() => navigate("auth")}
      />
    );
  }

  if (screen === "hets-leaderboard") {
    return <HetsLeaderboardScreen onHome={() => navigate("home")} />;
  }

  if (screen === "blixt-info") {
    return (
      <GameInfoScreen
        title="⚡ Blixt-Duell"
        description={[
          "Du spelar en snabb 2-minutersrunda själv och försöker hitta så många ord som möjligt ur ett slumpat ord.",
          "Efteråt utmanar du en vän eller en slumpad motståndare med din poäng — den som hittar flest poäng vinner duellen.",
        ]}
        onBack={() => navigate("home")}
        onStart={handleStartBlixtFromInfo}
        secondaryAction={user ? { label: "📋 Mina matcher", onClick: goToBlixt } : undefined}
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
        skipIntro={blixtSkipIntro}
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
        onPlayNew={handlePlayBlixtFromHub}
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

  if (screen === "skrammelpaj-info") {
    return (
      <GameInfoScreen
        title="🔤 Bokstavs-Duell"
        description={[
          "Du och en motståndare turas om att bilda ord ur en gemensam bokstavspool — bokstäverna försvinner ur poolen allt eftersom de används.",
          "Den som inte hittar ett ord inom 2 minuter, eller inte kan hitta något mer alls, förlorar.",
          "Du väljer om du vill utmana en vän, slumpa en motståndare, eller öva mot CPU (räknas inte till topplistan).",
        ]}
        onBack={() => navigate("home")}
        onStart={handleStartSkrammelpaj}
        secondaryAction={user ? { label: "📋 Mina matcher", onClick: goToSkrammelpaj } : undefined}
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
        poolLetters={activeSkrammelpajChallenge.letters}
        remainingCounts={remainingCounts}
        opponentName={opponentName}
        challenge={activeSkrammelpajChallenge}
        userId={user.id}
        onSubmitWord={handleSkrammelpajSubmitWord}
        onTimeout={() => handleSkrammelpajLoss("timeout")}
        onGiveUp={() => handleSkrammelpajLoss("give_up")}
        onImpossible={() => handleSkrammelpajLoss("no_words_left")}
        onMatchEndContinue={handleSkrammelpajMatchEndContinue}
        onBack={handleLeaveSkrammelpajGame}
        onHome={handleLeaveSkrammelpajGameToHome}
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

  if (screen === "topplistor") {
    return (
      <TopplistorScreen
        onDailyLeaderboard={() => goToLeaderboard(todayStr())}
        onHetsLeaderboard={goToHetsLeaderboard}
        onBlixtLeaderboard={goToBlixtLeaderboard}
        onSkrammelpajLeaderboard={goToSkrammelpajLeaderboard}
        onBack={() => navigate("home")}
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
        playedToday={playedToday}
        pendingBlixtCount={pendingBlixtCount}
        pendingBlixtInviteCount={pendingBlixtInviteCount}
        blixtUpdatesCount={blixtUpdatesCount}
        pendingSkrammelpajCount={pendingSkrammelpajCount}
        pendingSkrammelpajInviteCount={pendingSkrammelpajInviteCount}
        skrammelpajUpdatesCount={skrammelpajUpdatesCount}
        onPlay={() => navigate("daily-info")}
        onPlayHets={goToHetsInfo}
        onPlayBlixt={() => navigate("blixt-info")}
        onPlaySkrammelpaj={() => navigate("skrammelpaj-info")}
        onTopplistor={() => navigate("topplistor")}
        onFriends={() => navigate("friends")}
        onGoToBlixt={goToBlixt}
        onGoToSkrammelpaj={goToSkrammelpaj}
        onLogin={() => navigate("auth")}
        onSignOut={handleSignOut}
      />
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
