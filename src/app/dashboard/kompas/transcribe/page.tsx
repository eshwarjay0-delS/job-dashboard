import { redirect } from "next/navigation"

// Transcribe lives on the Kompas Flow page since 8 Oct 2026 (the owner: "Combine kompas flow and transcribe to be in one
// page"). This address is kept so a saved link or a bookmark still arrives, with Transcribe showing, and is not a dead end.
export default function TranscribeMoved() {
  redirect("/dashboard/kompas/flow?mode=transcribe")
}
