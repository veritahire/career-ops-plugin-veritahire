// @ts-check
// veritahire - a career-ops plugin.
// Live US jobs read straight from 19,000+ employers' own career sites (Workday, iCIMS, Greenhouse, Lever,
// SmartRecruiters, UKG and more), searched by keyword and commute radius. Every job is re-checked on the
// employer's site and retired within about 36 hours of the employer taking it down: no ghost jobs.
//
// Guide: https://github.com/career-ops-hq/career-ops/blob/main/docs/PLUGINS.md
// - Egress only through ctx.fetchJson to veritahire.com (manifest allowedHosts).
// - Producers return Job[] = { title, url, company, location, ... }; the engine writes the pipeline.
// - No key needed. VERITAHIRE_API_KEY (optional, see https://veritahire.com/developers/)
//   raises the limits to 100 jobs a page and adds the full job description.

const BASE = 'https://veritahire.com';
const RADII = [10, 25, 30, 50, 100];
const TYPES = ['full_time', 'part_time', 'contract', 'seasonal', 'temporary'];
const DAYS = [1, 3, 7, 14, 30];

/** "registered nurse @ Houston, TX" -> { what, where }. A query without "@" uses settings.where. */
export function parseQuery(query, settings = {}) {
  const raw = String(query || '').trim();
  const at = raw.indexOf(' @ ');
  const what = (at >= 0 ? raw.slice(0, at) : raw).trim();
  let where = (at >= 0 ? raw.slice(at + 3) : String(settings.where || '')).trim();
  let remote = Boolean(settings.remote);
  if (/^remote$/i.test(where)) { remote = true; where = ''; }
  return { what, where, remote };
}

function pick(value, allowed) {
  const n = typeof allowed[0] === 'number' ? Number(value) : String(value || '');
  return allowed.includes(/** @type {never} */ (n)) ? n : undefined;
}

function nearest(value, allowed) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return allowed.reduce((best, a) => (Math.abs(a - n) < Math.abs(best - n) ? a : best), allowed[0]);
}

/** Posted pay as an annual range: the API gives the midpoint (typical) and the top of the stated range. */
export function salaryOf(mid, top) {
  const m = Number(mid), t = Number(top);
  if (!(m > 0)) return undefined;
  const max = t > 0 ? t : m;
  const min = max > m ? Math.max(0, 2 * m - max) : m;
  return { min: Math.round(min), max: Math.round(max), currency: 'USD' };
}

function placeOf(location, remote) {
  const loc = String(location || '').trim();
  return remote && !/remote/i.test(loc) ? `${loc} (remote)`.trim() : loc;
}

function postedAt(day) {
  const ms = Date.parse(String(day || '').slice(0, 10));
  return Number.isFinite(ms) ? ms : undefined;
}

/** One keyless search row -> Job. */
export function jobFromFree(j) {
  /** @type {any} */
  const job = {
    title: String(j.title || '').trim(),
    url: String(j.apply_url || j.page || ''),
    company: String(j.employer || ''),
    location: placeOf(j.location, j.remote),
  };
  const sal = salaryOf(j.pay_annual && j.pay_annual.typical, j.pay_annual && j.pay_annual.top);
  if (sal) job.salary = sal;
  const ts = postedAt(j.first_seen);
  if (ts) job.postedAt = ts;
  return job;
}

/** One keyed (v1) search row -> Job. */
export function jobFromKeyed(j) {
  /** @type {any} */
  const job = {
    title: String(j.title || '').trim(),
    url: String(j.apply_url || j.job_page || ''),
    company: String(j.employer || ''),
    location: placeOf(j.location, j.remote),
  };
  const sal = salaryOf(j.pay_annual_mid, j.pay_annual_high);
  if (sal) job.salary = sal;
  const ts = postedAt(j.first_seen_at || j.posted_at);
  if (ts) job.postedAt = ts;
  if (j.description) job.description = String(j.description);
  return job;
}

/**
 * Run one search. s = { what, where, remote, radius_miles, min_pay, employment_type, posted_within_days,
 * title_exclude, sort, pages }.
 * @returns {Promise<any[]>}
 */
export async function runSearch(s, ctx) {
  const key = ctx.env && ctx.env.VERITAHIRE_API_KEY;
  const pages = Math.max(1, Math.min(10, Number(s.pages) || 1));
  const radius = pick(s.radius_miles, RADII) || nearest(s.radius_miles, RADII) || 25;
  const type = pick(s.employment_type, TYPES);
  const days = pick(s.posted_within_days, DAYS);
  const out = [];
  const seen = new Set();
  for (let page = 1; page <= pages; page++) {
    const p = new URLSearchParams();
    let url;
    /** @type {any} */
    let opts = { headers: { Accept: 'application/json' } };
    if (key) {
      if (s.what) p.set('q', s.what);
      if (s.remote) p.set('remote', '1'); else if (s.where) p.set('where', s.where);
      p.set('radius', String(radius));
      if (s.min_pay) p.set('min_pay', String(s.min_pay));
      if (type) p.set('employment_type', type);
      if (days) p.set('posted_within_days', String(days));
      if (s.title_exclude) p.set('title_exclude', String(s.title_exclude));
      if (s.sort) p.set('sort', String(s.sort));
      p.set('description', '1');
      p.set('page', String(page));
      url = `${BASE}/api/v1/jobs.php?${p}`;
      opts.headers['X-API-Key'] = key;
    } else {
      if (s.what) p.set('what', s.what);
      if (s.remote) p.set('remote_only', '1'); else if (s.where) p.set('where', s.where);
      p.set('radius_miles', String(radius));
      if (s.min_pay) p.set('min_pay', String(s.min_pay));
      if (type) p.set('employment_type', type);
      if (days) p.set('posted_within_days', String(days));
      if (s.title_exclude) p.set('title_exclude', String(s.title_exclude));
      if (s.sort) p.set('sort', String(s.sort));
      p.set('page', String(page));
      url = `${BASE}/api/jobs-search.php?${p}`;
    }
    const data = await ctx.fetchJson(url, opts);
    const rows = key ? (data && data.data) || [] : (data && data.jobs) || [];
    for (const r of rows) {
      const job = key ? jobFromKeyed(r) : jobFromFree(r);
      if (!job.title || !job.url) continue;
      const k = ctx.normalizePostingUrl ? ctx.normalizePostingUrl(job.url) || job.url : job.url;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(job);
    }
    if (!data || !data.next_page) break;
  }
  return out;
}

export default {
  /** node plugins.mjs run veritahire search "registered nurse @ Houston, TX" */
  async search(query, ctx) {
    const settings = ctx.settings || {};
    const q = parseQuery(query, settings);
    if (!q.what && !q.where && !q.remote) return [];
    return runSearch({ ...settings, ...q }, ctx);
  },

  /** node plugins.mjs run veritahire  -> every search in config/plugins.yml under plugins.veritahire.searches */
  async ingest(ctx) {
    const settings = ctx.settings || {};
    const searches = Array.isArray(settings.searches) ? settings.searches : [];
    const out = [];
    const seen = new Set();
    for (const s of searches) {
      const q = typeof s === 'string' ? parseQuery(s, settings) : { ...s, remote: Boolean(s.remote) || /^remote$/i.test(String(s.where || '')) };
      if (q.remote && /^remote$/i.test(String(q.where || ''))) q.where = '';
      for (const job of await runSearch({ ...settings, ...q }, ctx)) {
        if (seen.has(job.url)) continue;
        seen.add(job.url);
        out.push(job);
      }
    }
    return out;
  },
};
