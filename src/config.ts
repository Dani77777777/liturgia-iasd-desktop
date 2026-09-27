export const DEV_URL = 'http://localhost:3000';
export const PROD_URL = 'https://liturgia-iasd.vercel.app';
/** `npm run dev` passes --dev so the app uses the local Next.js server. */
export const USE_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
export const BASE_URL = USE_DEV ? DEV_URL : PROD_URL;

/** GitHub Releases feed used by Squirrel (Windows only). */
export const UPDATE_SERVER_URL = 'https://github.com/Dani77777777/liturgia-iasd-desktop/releases/latest/download';
export const AUTO_UPDATE_ENABLED = !USE_DEV && process.platform === 'win32';

// Public "anon" key — the same one the website ships to every browser.
// Access control lives in Supabase, not in hiding this value.
export const SUPABASE_URL = 'https://qzmigrvjpanjoalsdsaa.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bWlncnZqcGFuam9hbHNkc2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Njk3MTEsImV4cCI6MjA3OTI0NTcxMX0._tK29U5QdHgTN7JvwKn7H7lQgLTDZ4Heb-l4Y9Pj5HM';

/** Default PowerPoint template name inside the "Modelo" folder. */
export const MODELO_PPTX_NOME = 'Apresentação para o Culto - Modelo.pptx';

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** How far back the offline copy goes (upcoming services are always included). */
export const DIAS_HISTORICO_OFFLINE = 60;

/** Controller refresh interval while online. */
export const POLL_MS = 2000;
