import { redirect } from "next/navigation"
import { isAuthDisabled } from "@/lib/authDisabled"
import { safeDisabledAuthNext } from "@/lib/authRedirect"

/** Server pages: when login is off, go straight into the app as the owner. */
export function enterAppIfAuthDisabled(next?: string | null): void {
  if (isAuthDisabled()) redirect(safeDisabledAuthNext(next))
}
