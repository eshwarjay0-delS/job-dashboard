import type { ReactNode } from "react"
import { enterAppIfAuthDisabled } from "@/lib/authDisabledEnter"

export default function AuthLayout({ children }: { children: ReactNode }) {
  enterAppIfAuthDisabled()
  return children
}
