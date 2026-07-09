import { NextRequest, NextResponse } from "next/server"
import { getJob, latestJob } from "@/lib/jobs"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// Poll a background tailoring job. ?id=<job> for a specific job, or no id to recover
// the user's most recent job (when the client lost the id).
export async function GET(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get("id") || ""
    if (id) {
      const job = await getJob(id)
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
      return NextResponse.json(job)
    }
    let userId: string | undefined
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id
    } catch { /* ignore */ }
    const job = await latestJob(userId)
    return NextResponse.json({ job: job ?? null })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
