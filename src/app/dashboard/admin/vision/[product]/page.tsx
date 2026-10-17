import { requireVisionAdmin } from "@/lib/plan-vision-access"
import { notFound } from "next/navigation"
import { PLAN_REVISION, PRODUCT_PLANS, productPlan } from "@/lib/plan-vision"
import { VISION_DOCS } from "@/lib/visionDocs"
import PlanVision from "../../plan-vision/plan-vision"
export default async function VisionProductPage({ params }: { params: Promise<{ product: string }> }) {
  await requireVisionAdmin()
  const { product } = await params
  const id = product === "apply" ? "applications" : product
  if (!productPlan(id)) notFound()
  return <PlanVision plans={PRODUCT_PLANS} revision={PLAN_REVISION} initialArea={id} sourceDocs={VISION_DOCS} />
}
