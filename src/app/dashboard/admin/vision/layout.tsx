import { requireVisionAdmin } from "@/lib/plan-vision-access"
export const dynamic = "force-dynamic"
export default async function VisionLayout({ children }: { children: React.ReactNode }) {
  await requireVisionAdmin()
  return children
}
