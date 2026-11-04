// Aerial · Fundacja Cyrkarium · konfiguracja
// Ta sama baza Supabase co Aerial Events. Oba klucze są publiczne z założenia;
// dane chronią reguły RLS w bazie. NIGDY nie wklejaj tu klucza service_role.
window.AC_CONFIG = {
  supabaseUrl: "https://ggggimsfdusczeorobpm.supabase.co",
  supabaseAnonKey: "sb_publishable_4n51q63NUKKytiPWOX-UJg_ijE64Euu",
  eventsUrl: "https://aerial.cyrkarium.com/kalendarz",  // pełny kalendarz (kopia Aerial Events w podfolderze)
};
