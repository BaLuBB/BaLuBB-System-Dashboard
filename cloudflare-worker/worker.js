// Startet den Workflow „Status-Seite (GitHub Pages)“ nach Zeitplan. GitHubs eigener Zeitplan (schedule) läuft bei
// diesem Repository nicht zuverlässig; der Cloudflare-Zeitplan (Cron-Trigger) schon.
// Geheimnis in Cloudflare: GH_TOKEN (nur Berechtigung „Actions: Read and write“ für dieses eine Repository).
const REPO = 'BaLuBB/BaLuBB-System-Dashboard';
const WORKFLOW = 'pages.yml';
const REF = 'main';

export async function dispatch(env, fetchImpl = fetch) {
  if (!env.GH_TOKEN) throw new Error('GH_TOKEN fehlt (Worker → Settings → Variables and Secrets)');
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'balubb-dashboard-trigger',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: REF }),
  });
  if (res.status !== 204) throw new Error(`GitHub antwortet mit HTTP ${res.status}`); // 204 = Lauf gestartet
  return res.status;
}

export default {
  // Automatisch nach Zeitplan (siehe wrangler.toml)
  async scheduled(_event, env, ctx) { ctx.waitUntil(dispatch(env)); },
  // Von außen ist der Worker nicht bedienbar, damit niemand Läufe auslösen kann
  async fetch() { return new Response('Not found', { status: 404 }); },
};
