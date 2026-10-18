# REA: Client-Side Autofill Procedure (Simplify pattern)

**Date:** 2026-10-17
**Method:** Source+artifact analysis (open-source Autofill-Jobs extension by andrewmillercode, MIT)
**Request:** Owner: "Yes continue" — get the actual autofill procedure behind Simplify's one-click apply.

## The Actual Procedure (step by step)

### Step 1: Content script injection
Extension injects a content script into every page. On `window.load`, it checks if the
hostname matches a known ATS (greenhouse, lever, workday, dover, etc.).

### Step 2: Wait for the form (SPAs load async)
A `MutationObserver` watches the DOM for the application form to appear.
Form selectors: `#application-form, #application_form, #applicationform`.
This handles React/Vue SPAs where the form renders after page load.

### Step 3: ATS detection → field map lookup
Each ATS has a **hardcoded field map** — a dictionary mapping HTML identifiers
to canonical profile keys. Example (Greenhouse):
```
first_name → "First Name"
candidate-location → "Location (City)"
urls[LinkedIn] → "LinkedIn"  (Lever)
eeo[gender] → "Gender"  (Lever)
```
Workday is nested by wizard section:
```
"My Information": { firstName → "First Name", city → "Location (City)", ... }
"My Experience": { schoolName → "School", degree → "Degree", ... }
"Voluntary Disclosures": { ethnicity → "Race", gender → "Gender", ... }
```

### Step 4: Field discovery
`inputQuery(jobParam, form)` searches ALL `<input>` elements and matches by:
- `id`, `name`, `placeholder`
- `aria-label`, `aria-labelledby`, `aria-describedby`
- `data-qa` (Greenhouse/Lever)
- `data-automation-id`, `data-automation-label` (Workday-specific)

First match wins. Case-insensitive substring match.

### Step 5: Value injection (`setNativeValue`)
This is the critical piece — naive `el.value = x` doesn't work on React/Vue forms.
The procedure:
1. **Checkboxes/radios**: `el.click()` to toggle (don't set value directly)
2. **Selects**: iterate options, find one whose value contains the target (case-insensitive), set `el.value`
3. **Text inputs**:
   a. Handle React's `_valueTracker` (reset it so React detects the change)
   b. `el.setAttribute("value", value)`
   c. Dispatch `change` event (bubbles: true)
   d. Set `el.value = value`
   e. Dispatch `input` event (bubbles: true)
   This 5-step sequence is what makes React/Vue forms accept the fill.

### Step 6: Workday wizard handling
Workday uses a multi-step wizard. The extension:
1. Detects current stage via `[data-automation-id="progressBar"]` → `progressBarActiveStep`
2. Fills only the fields for the current section
3. User clicks Next → repeat for the next section

### Step 7: File upload (resume)
File inputs are found by the same field-map procedure. The extension sets the
FileList programmatically (via DataTransfer) — works even on tricky Greenhouse
upload widgets.

### What this means for us
This is the **client-side bridge** between our current "open portal in new tab"
and Tsenta's server-side workers. The procedure is:
1. User has a MarketFit profile (we already store this)
2. User opens a portal → our extension (or in-app script) detects the ATS
3. Field map → find fields → inject values → user reviews → submits

We don't need to build a Chrome extension on day one. The same procedure works as:
- A bookmarklet the user clicks on the portal page
- An in-app "autofill" button that opens the portal with a script injected
- Later: a proper extension

The field maps are the asset — Greenhouse, Lever, Workday, iCIMS, Taleo mappings
can be built incrementally from real forms.
