# career-ops-plugin-veritahire

A community plugin for [career-ops](https://github.com/career-ops-hq/career-ops) that adds **around 2.5 million
live US jobs, read straight from the career sites of 19,000+ employers**, to your pipeline.

career-ops scans the companies you list in `portals.yml`. This plugin finds the ones you didn't know to
list: every employer near you that is hiring for your role right now, on Workday, iCIMS, Greenhouse,
Lever, SmartRecruiters, UKG and employer-built career sites, searched by keyword and commute radius.

- **Every job is really open.** Re-checked on the employer's own site, retired within about 36 hours of
  the employer taking it down. No ghost jobs.
- **Employer URLs only.** Each result's `url` is the employer's own posting, so it deduplicates cleanly
  against career-ops' own scanners and you apply where the employer reads applications.
- **Pay when posted**, as an annual range, so `salary_filter` works.
- **No key needed.** An optional `VERITAHIRE_API_KEY` (2,000 free credits to start) adds full descriptions and 100 jobs a page.

## Install

```bash
# Install straight from this repo, pinned to release v0.1.0:
node plugins.mjs add veritahire/career-ops-plugin-veritahire --sha 1c12246b8971f05a0a9766af5b380ddea5ef3b95
```

Then enable + consent:

```bash
node plugins.mjs enable veritahire            # shows the capability card
node plugins.mjs enable veritahire --confirm  # grants it
```

## Use

```bash
node plugins.mjs run veritahire search "registered nurse @ Houston, TX"
node plugins.mjs run veritahire search "data analyst @ remote"
node plugins.mjs run veritahire                # runs your saved searches (below) into the pipeline
```

## Configure

Optional settings in `config/plugins.yml`:

```yaml
plugins:
  veritahire:
    where: "Austin, TX"
    radius_miles: 25           # 10, 25, 30, 50 or 100
    min_pay: 70000             # annual, or hourly if under 300
    posted_within_days: 7      # 1, 3, 7, 14 or 30
    searches:
      - "registered nurse @ Austin, TX"
      - { what: "clinical informatics", where: "remote" }
```

Optional secret in `.env`: `VERITAHIRE_API_KEY` (2,000 free credits at https://veritahire.com/verified-jobs-feed/).
Without it the plugin uses the free search: about 30 searches an hour, 25 jobs a page.

Full reference for agents: [skill.md](skill.md).

## Egress

Only `https://veritahire.com` (`allowedHosts`), only through career-ops' guarded `ctx.fetchJson`.
Requests carry the search words, the place and your filters, never your CV.

## Test

```bash
node test/smoke.mjs
```

## About

Built by [VeritaHire](https://veritahire.com), which reads US job postings straight from employers' own
career sites and publishes its freshness live at https://veritahire.com/jobdata.php. Also available as a
Claude Code plugin: [jobhunt](https://github.com/veritahire/jobhunt).

## License

MIT
