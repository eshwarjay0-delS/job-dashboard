import { redirect } from "next/navigation"
import { productPlan } from "@/lib/plan-vision"
// Compatibility link; the existing developer hub is the single canonical entry point.
export default async function PlanVisionPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams
  const plan = productPlan(area)
  redirect(plan ? `/dashboard/admin/vision/${plan.id === "applications" ? "apply" : plan.id}` : "/dashboard/admin/vision")
}
