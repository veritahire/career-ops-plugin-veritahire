// Zero-network smoke test: the entry imports cleanly, exposes only valid hooks that match the manifest,
// and the pure helpers map API rows to career-ops Job objects correctly. Run: node test/smoke.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const KINDS = ['provider', 'ingest', 'search', 'notify', 'export'];

const manifest = JSON.parse(readFileSync(path.join(here, '..', 'manifest.json'), 'utf8'));
const mod = await import(pathToFileURL(path.join(here, '..', manifest.entry || 'index.mjs')).href);
const hooks = mod.default;

assert(hooks && typeof hooks === 'object', 'default export must be an object of hooks');
const keys = Object.keys(hooks);
assert(keys.length > 0, 'declare at least one hook');
for (const k of keys) assert(KINDS.includes(k), `unknown hook "${k}"`);
for (const h of manifest.hooks) assert(keys.includes(h), `manifest declares hook "${h}" but index.mjs does not export it`);
assert.strictEqual(manifest.humanInTheLoop, true);
assert.deepStrictEqual(manifest.allowedHosts, ['veritahire.com']);

// query parsing
assert.deepStrictEqual(mod.parseQuery('registered nurse @ Houston, TX'), { what: 'registered nurse', where: 'Houston, TX', remote: false });
assert.deepStrictEqual(mod.parseQuery('data analyst @ remote'), { what: 'data analyst', where: '', remote: true });
assert.deepStrictEqual(mod.parseQuery('cdl a driver', { where: 'Dayton, OH' }), { what: 'cdl a driver', where: 'Dayton, OH', remote: false });

// salary: midpoint 95,680 and top 131,040 of "$29.00 to $63.00 per hour" -> 60,320 to 131,040
assert.deepStrictEqual(mod.salaryOf(95680, 131040), { min: 60320, max: 131040, currency: 'USD' });
assert.deepStrictEqual(mod.salaryOf(91520, 91520), { min: 91520, max: 91520, currency: 'USD' });
assert.strictEqual(mod.salaryOf(null, null), undefined);

// a free search row (shape of https://veritahire.com/api/jobs-search.php)
const free = mod.jobFromFree({
  job_id: 1, title: 'Infusion RN', employer: 'CommonSpirit Health', location: 'Houston, TX', remote: false,
  pay_annual: { typical: 91520, top: 91520 }, first_seen: '2026-10-10',
  apply_url: 'https://example.wd1.myworkdayjobs.com/External/job/Infusion-RN_R1', page: 'https://veritahire.com/j/1',
});
assert.strictEqual(free.title, 'Infusion RN');
assert.strictEqual(free.url, 'https://example.wd1.myworkdayjobs.com/External/job/Infusion-RN_R1');
assert.strictEqual(free.company, 'CommonSpirit Health');
assert.strictEqual(free.salary.max, 91520);
assert.strictEqual(typeof free.postedAt, 'number');

// a keyed search row (shape of https://veritahire.com/api/v1/jobs.php search mode)
const keyed = mod.jobFromKeyed({
  job_id: 2, title: 'Data Analyst', employer: 'Acme', location: 'Remote', remote: true,
  pay_annual_mid: 85000, pay_annual_high: 95000, first_seen_at: '2026-10-09 12:00:00',
  apply_url: 'https://boards.greenhouse.io/acme/jobs/2', description: 'Analyze data.',
});
assert.strictEqual(keyed.location, 'Remote');
assert.deepStrictEqual(keyed.salary, { min: 75000, max: 95000, currency: 'USD' });
assert.strictEqual(keyed.description, 'Analyze data.');

console.log('✓ smoke ok:', keys.join(', '));
