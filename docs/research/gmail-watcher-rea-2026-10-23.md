# gmail-watcher: REA, 23 October 2026

Method: **source and artifact analysis** of our own public repository eshwarjay0-delS/gmail-watcher (9 files), read
in source and counted with shell tools. No run.

## Rebuild map

- One GitHub Actions workflow (`.github/workflows/watcher.yml`): every 15 minutes, on demand, and on push to `main`.
- `watch_emails.py` reads several Gmail inboxes (app passwords and a Google token held as GitHub secrets), finds
  recruiter mail such as RTR and follow-up requests, and sends Twilio text alerts.
- `generate_dashboard.py` builds a static `dashboard.html` from the tracker.
- The workflow commits its state back to the repository and pushes.

## Security

One high-severity finding is recorded in the private parfAct repository
(`docs/security/2026-10-23-gmail-watcher-public-data.md`). It needs an action from the owner; the details are not
repeated here because this repository is public.

## Not done

No run; the repository history was not searched for secrets in this pass.
