"use client"

import { useSyncExternalStore } from "react"

// The person's first name from the profile kept on this device (Settings writes it), or "" when there is none. Read
// after the page has drawn, so the server's copy and the first draw agree. Used by Today, Summary's greeting and the
// MFit Agent's hello; one reader, so a name is never looked up two ways.
const noChanges = () => () => {}

export function profileFirstName(): string {
  try {
    const profile = JSON.parse(localStorage.getItem("jd_profile") || "{}")
    return profile.full_name?.split(" ")[0] || profile.name?.split(" ")[0] || ""
  } catch { return "" }
}

export function useFirstName(): string {
  return useSyncExternalStore(noChanges, profileFirstName, () => "")
}
