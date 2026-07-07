# Feature — Season calendar (the ESPN schedule)

## What
A schedule view that maps the league's fixtures to real-world post dates on a sports-calendar rhythm, so the app tells the user "here's today's slate" and drives the content drop.

## Why
The user's north-star framing: an ESPN calendar (e.g. rugby Saturday nights, golf Thu–Sun, soccer midweek/weekends). A fixed posting ritual builds habit + concentrates early engagement (research §5). It also kills the operator's decision fatigue — the calendar decides what to post.

## Acceptance criteria
- [ ] Calendar maps sim-world matchdays to real-world dates on a configurable cadence (per sport later).
- [ ] "Today / next drop" surfaces the exact slate to produce, one click from the batch sim.
- [ ] Cadence configurable (start 3×/week at a fixed time; can scale toward daily).
- [ ] Designed so a future GitHub Action can read this same schedule to auto-run drops (Stage 7).

## Technical notes
The calendar is just a mapping over the fixture list + a cadence config, stored in the league JSON. Keep it data-driven so the Stage 7 automation reads it directly.

## Open Questions
- Exact launch cadence: mirror real sports calendars from day one, or start simple 3×/week and add the multi-sport rhythm once Rugby/Golf exist?
- One master calendar across all sports, or per-sport schedules that merge? (Per-sport, merged into one network calendar, matches the ESPN vision.)
- Should the app enforce/remind the schedule (notifications) or just display it? (Reminders help the ritual; may need Stage 7 infra.)
