---
name: career-ops-plugin-veritahire
description: How to use the veritahire plugin to add live US jobs, read straight from 19,000+ employers' own career sites, to the career-ops pipeline.
license: MIT
---

# veritahire

> This file teaches an AI agent how to drive THIS plugin. It does not change scoring, core files, or
> anything outside the plugin's search and ingest hooks.

VeritaHire reads 2.5 million+ live US jobs straight from the career sites of 19,000+ employers (Workday,
iCIMS, Greenhouse, Lever, SmartRecruiters, UKG and more). Each job is re-checked on the employer's site and
retired within about 36 hours of the employer taking it down, so every result is open and every URL is the
employer's own posting. Use it to find jobs at employers that are not in `portals.yml`, near a place.

## How to run it

- `node plugins.mjs run veritahire search "registered nurse @ Houston, TX"` — one search. The part after
  ` @ ` is the place: "City, ST", a 5-digit ZIP, or `remote`. Without ` @ `, `settings.where` is used.
- `node plugins.mjs run veritahire` — runs every search in `settings.searches` (the daily scan).

Build searches from the candidate's actual titles: their current and recent job titles as employers write
them, the next step up, and a licence when it defines the job (RN, CDL A, CPA). Keep each short (2 to 4
words); run several rather than one long query.

## What it produces

`Job[]` with:
- `title`, `company`, `location` (with "(remote)" when the employer marks it remote)
- `url` — the employer's own posting (the apply link), so it deduplicates against career-ops' own scanners
- `salary` — `{ min, max, currency: "USD" }`, annual, only when the employer posted pay
- `postedAt` — when VeritaHire first saw the posting (epoch ms)
- `description` — the full posting text, only when `VERITAHIRE_API_KEY` is set

## Settings

In `config/plugins.yml` under `plugins.veritahire` (all optional):

```yaml
plugins:
  veritahire:
    where: "Austin, TX"        # default place for searches without " @ "
    radius_miles: 25           # 10, 25, 30, 50 or 100
    min_pay: 70000             # annual, or hourly if under 300; jobs without posted pay are kept, listed last
    employment_type: full_time # full_time, part_time, contract, seasonal, temporary
    posted_within_days: 7      # 1, 3, 7, 14 or 30
    title_exclude: "senior, director"
    sort: new                  # new, pay, near (default: best match)
    pages: 1                   # pages per search (25 jobs a page free, 100 with a key)
    searches:
      - "registered nurse @ Austin, TX"
      - { what: "charge nurse", where: "Round Rock, TX", radius_miles: 30 }
      - { what: "clinical informatics", where: "remote" }
```

## Limits

No key: about 30 searches an hour from one network, 25 jobs a page. With `VERITAHIRE_API_KEY` in `.env`
(2,000 free credits at https://veritahire.com/verified-jobs-feed/): 100 jobs a page plus full descriptions,
one credit per job returned.
