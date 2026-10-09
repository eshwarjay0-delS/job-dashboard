# Resume formatting templates

The formatting page now provides ten visual templates before upload, with family filters and a single gallery selection control. Executive Brief and Staff Engineer add layouts for experienced careers. Sample thumbnails, the editable resume preview, print HTML, and Word export share template typography, colors, margins, and spacing. Reference labels describe independent designs, not university endorsement.

Word export now honors the selected format, uses proper bullet numbering, and keeps headings with the next paragraph. Plain text content stays in its original order. The old 450-line truncation is removed. DOCX extraction remains subject to review because source layout is converted to text. Fonts and pagination can differ between browsers and Word; exact page parity is not promised.

The UI no longer stores server preview HTML that can become stale after a template or text edit. The preview is derived from current text and selection. Upload/edit controls are disabled during processing. Users may paste text without uploading and can fit the page or enlarge it to actual size.

Validation: TypeScript, focused ESLint, and scripts/tests/resume-templates.test.mjs (all ten HTML/DOCX styles distinct, text round trip through Mammoth, XML/HTML escaping, and 500-bullet content preservation). The existing authenticated /api/resume/format API remains the shared export entry point.

Browser validation: rendered the actual React page in Chromium at desktop and 390px mobile sizes; confirmed gallery filters, selection, editable preview updates, fit/actual-size switching, and no horizontal page overflow or runtime errors. Visually inspected previews at both sizes.
