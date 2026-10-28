// The words of a PDF, for filing it: which email is written on it and what kind of work it shows.
//
// Asked on 13 Oct 2026: "for the files, take PDFs ... not just [Word] and zip, but also PDFs." A PDF is kept as it is
// and never rewritten: tailoring edits a Word file in place, and a PDF has no such text to edit. Its words are read
// only to choose its folder. When they cannot be read (a scan, a locked file, the reader failing to load) the answer is
// an empty text and the file is filed by its name: a PDF is never refused because of this.

/** Does this start the way a PDF does? The name alone is not believed. */
export function isPdf(bytes: Uint8Array | null | undefined): boolean {
  if (!bytes || bytes.length < 5) return false
  // "%PDF-" within the first kilobyte: some writers put a few bytes before it.
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1")
  return head.includes("%PDF-")
}

const MOST_PAGES = 12

export async function pdfText(bytes: Uint8Array, options: { requireComplete?: boolean } = {}): Promise<string> {
  if (!isPdf(bytes)) return ""
  try {
    const { getDocumentProxy, extractText } = await import("unpdf")
    // The reader keeps the array it is given, so it gets a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    try {
      // Library classification may sample pages. Interview evidence must never be sampled silently.
      if (pdf.numPages > (options.requireComplete ? MOST_PAGES : MOST_PAGES * 4)) return ""
      const { text } = await extractText(pdf, { mergePages: false })
      const pages = Array.isArray(text) ? text : [String(text || "")]
      if (options.requireComplete && pages.length !== pdf.numPages) return ""
      const joined = pages.slice(0, MOST_PAGES).join("\n").replace(/\u0000/g, "")
      if (options.requireComplete && joined.length > 200_000) return ""
      return joined.slice(0, 200_000)
    } finally { await pdf.loadingTask.destroy() }
  } catch (error) {
    console.error("[pdf-text] could not read a PDF", String(error).slice(0, 200))
    return ""
  }
}
