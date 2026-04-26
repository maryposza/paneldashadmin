// ============================================================
// supabase-config.js — Panel de administración (admin/)
// Supabase Dashboard → Settings → API
// ============================================================

// URL del proyecto Supabase
// Formato: https://XXXXXXXXXX.supabase.co
const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';

// Clave pública anon (solo para operaciones de lectura desde admin)
// Supabase Dashboard → Settings → API → anon / public
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';

// URL del Cloudflare Worker (backend seguro)
// El panel admin usa ÚNICAMENTE el Worker (con X-Admin-Key)
// La service_role key NUNCA llega al navegador
const WORKER_URL = 'https://postres-worker.TU_SUBDOMAIN.workers.dev';

// URL pública de la tienda (para links de "Ver tienda" en el panel)
// Formato: https://TU_TIENDA.com  (sin slash final)
const TIENDA_URL = 'https://TU_TIENDA.com';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inyectar TIENDA_URL en todos los links marcados con data-tienda-link
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tienda-link]').forEach(el => {
    const suffix = el.dataset.tiendaLink || '';
    el.href = TIENDA_URL + suffix;
  });
});
