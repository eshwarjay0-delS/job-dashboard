import type { ReactNode } from "react"
import { enterAppIfAuthDisabled } from "@/lib/authDisabledEnter"

export default function SignupLayout({ children }: { children: ReactNode }) {
  enterAppIfAuthDisabled()
  return children
}
