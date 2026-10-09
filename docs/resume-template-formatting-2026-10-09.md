# Resume formatting templates

The formatting page now provides ten visual templates before upload, with family filters and a single gallery selection control. Executive Brief and Staff Engineer add layouts for experienced careers. Sample thumbnails, the editable resume preview, print HTML, and Word export share template typography, colors, margins, and spacing. Reference labels describe independent designs, not university endorsement.

Word export now honors the selected format, uses proper bullet numbering, and keeps headings with the next paragraph. Plain text content stays in its original order. The old 450-line truncation is removed. DOCX extraction remains subject to review because source layout is converted to text. Fonts and pagination can differ between browsers and Word; exact page parity is not promised.

The UI no longer stores server preview HTML that can become stale after a template or text edit. The preview is derived from current text and selection. Upload/edit controls are disabled during processing. Users may paste text without uploading and can fit the page or enlarge it to actual size.

Validation: TypeScript, focused ESLint, and scripts/tests/resume-templates.test.mjs (all ten HTML/DOCX styles distinct, text round trip through Mammoth, XML/HTML escaping, and 500-bullet content preservation). The existing authenticated /api/resume/format API remains the shared export entry point.

Browser validation: rendered the actual React page in Chromium at desktop and 390px mobile sizes; confirmed gallery filters, selection, editable preview updates, fit/actual-size switching, and no horizontal page overflow or runtime errors. Visually inspected previews at both sizes.

## Mobile clipping correction

A user screenshot exposed a dashboard-shell media query at 1024px that sets `iframe { max-width:100% }`. It shrank the fixed 816px resume viewport before CSS scaling, clipping most of the document. The isolated first check did not load this stylesheet. The scoped preview frame now opts out of max-width/max-height constraints; its container remains responsive. Reproduced the failure with the real dashboard-shell stylesheet (frames measured 144px instead of 816px) and verified the correction at 390px and 900px, including the three-column professional gallery and editable preview. Other embedded content retains the dashboard's responsive behavior.
