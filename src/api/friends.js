import { supabase, isSupabaseConfigured } from "../supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildInviteUrl(userId, displayName) {
  return `${window.location.origin}/friend/${userId}?name=${encodeURIComponent(displayName)}`;
}

// Läser en delad inbjudningslänk (/friend/<uuid>?name=...) ur adressraden —
// samma stil som /admin-specialfallet i App.jsx, ingen router behövs.
export function parseInviteFromLocation() {
  const match = window.location.pathname.match(/^\/friend\/([0-9a-f-]{36})$/i);
  if (!match || !UUID_RE.test(match[1])) return null;
  const name = new URLSearchParams(window.location.search).get("name");
  return { inviterId: match[1], inviterName: name ?? "Din vän" };
}

// Bekräftar en vänskap — anropas av mottagaren (addressee) som öppnat
// länken, i enlighet med RLS-policyn "auth.uid() = addressee_id".
// Unique-violation (23505, dvs redan vänner via user_a/user_b) tolkas som
// lyckad bekräftelse istället för fel.
export async function confirmFriendship(currentUserId, currentDisplayName, inviterId, inviterName) {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("friendships").insert({
    requester_id: inviterId,
    requester_display_name: inviterName,
    addressee_id: currentUserId,
    addressee_display_name: currentDisplayName,
  });
  if (error && error.code !== "23505") throw error;
}

export async function fetchFriends(userId) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, requester_display_name, addressee_id, addressee_display_name")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    friendshipId: row.id,
    friendId: row.requester_id === userId ? row.addressee_id : row.requester_id,
    friendName: row.requester_id === userId ? row.addressee_display_name : row.requester_display_name,
  }));
}

export async function removeFriendship(friendshipId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

// Samma dags topplista som fetchLeaderboard (src/api/scores.js), men bara
// spelarens egna resultat + vänners — inkluderar spelaren själv så man ser
// sin egen placering bland vännerna.
export async function fetchFriendsLeaderboard(date, userId) {
  if (!isSupabaseConfigured) return [];

  const friends = await fetchFriends(userId);
  const ids = [userId, ...friends.map((f) => f.friendId)];

  const { data, error } = await supabase
    .from("scores")
    .select("display_name, score, created_at")
    .eq("date", date)
    .in("user_id", ids)
    .order("score", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
