# v1700-RC1 — Focused Manual QA

1. **SPCK boot** — open the app cold; no fatal boot screen may appear after the UI is already usable.
2. **Trip Board > Attention** — verify issues/checks match Readiness and each Review action opens the correct surface.
3. **Checklist due date + priority** — add a task with a due date and High priority; verify Open/Done/All filters and persistence after reload.
4. **Overdue task** — set a task date before today; it should be highlighted and appear as a Readiness issue.
5. **Today tasks** — a task due today should appear in Today and be completable there.
6. **Duplicate day plan** — duplicate a day from Day details; verify it lands on the next free date, has fresh activity IDs, and copied booking confirmations/payment state are reset.
7. **Duplicate activity** — duplicate an existing activity; verify the copy opens for editing and the original remains untouched.
8. **Archive trip** — archive a non-critical test trip; it should disappear from normal Home sections and appear under Archived trips. Restore it and confirm data is intact.
9. **Archived active trip** — archiving the active trip should return to Home without deleting it.
10. **Back + persistence** — close sheets with Android Back, close/reopen the app, and confirm tasks/archive/duplicates persist.
11. **Offline reload** — after one successful load, reload offline and confirm Trip Board/Today/archive data remain available.
12. **Language switch** — switch one existing language and back; no new keys should leak in another language.

AI/backend remains outside this QA cycle.
