// Supabase auth (GoTrue) returnerar felmeddelanden på engelska med stabila,
// kända strängar — översätter de vanligaste, faller tillbaka på originalet
// för allt annat så att inget bara försvinner tyst. Delad mellan AuthScreen
// och SettingsScreen (byt lösenord) eftersom båda anropar supabase.auth.*.
const AUTH_ERROR_TRANSLATIONS = {
  "User already registered": "Det finns redan ett konto med den e-postadressen.",
  "Invalid login credentials": "Fel e-postadress eller lösenord.",
  "Password should be at least 6 characters": "Lösenordet måste vara minst 6 tecken.",
  "Unable to validate email address: invalid format": "Ogiltig e-postadress.",
  "Email not confirmed": "E-postadressen är inte bekräftad än.",
  "Email rate limit exceeded": "För många försök, vänta en stund och försök igen.",
};

export function translateAuthError(message) {
  return AUTH_ERROR_TRANSLATIONS[message] ?? message;
}
