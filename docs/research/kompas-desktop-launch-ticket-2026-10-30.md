# Kompas website-to-desktop launch repair — 30 October 2026

## Incident
Selecting Desktop app / Connect & start after adding a complete resume, JD and interview details on the MarketFit website did not launch the associated Windows session.

## Reproduced design defect
The page previously navigated directly to `marketfit-kompas://open?d=<base64url(session)>`. The serialized session included resume, JD, optional documents, JWT and refresh token, routinely exceeding the Chromium/Windows external-protocol launch limit (roughly 2046 characters). This explains why small sessions could work and realistic saved interviews could fail silently. That legacy long-link path is no longer used in the MarketFit website.

## Repair
- Website pre-generates a 256-bit random capability during Desktop app selection and launches `marketfit-kompas://open?ticket=<43-url-safe-characters>` on click. The user also gets a real clickable fallback if the browser loses activation after an async request.
- Full selected session (including all resume/JD content, no legacy 6k/8k truncation) travels by authenticated HTTPS to an RLS-protected Supabase table. Token hashed at rest; five-minute expiry; server-only table grants; server-only atomic redeem-and-delete function. Neither resume nor auth token is carried in the Windows launch URL.
- Windows executable forwards the new ticket through the launcher, redeems through the HTTPS endpoint, feeds the retrieved data through its existing authenticated session parser, and retains queued transfers until the renderer takes or acknowledges delivery. The original `kompas://` standalone behavior remains.
- Failure preserves the website's saved interview and shows a recoverable error instead of silently starting a different one.

## Verification limits
Checked database presence, grants and invalid-ticket behavior: anonymous and authenticated roles cannot select handoffs or execute the claim function; service role can issue and redeem. Automated website regression and desktop connector unit tests are attached to code branches. A successful Windows CI package and a real clean-Windows click-through are still required. Installing the newly built desktop executable is necessary; web deploy alone does not update an older copy.

## Rollout dependency
Deploy API and website first; only then publish and install the new desktop executable. Do not claim Windows end-to-end verification until clicking Connect & start with an actual populated session succeeds on Windows.
