import { isVisionConfigured } from "@/lib/vision";
import { VisionDebugView } from "@/components/debug/vision-debug-view";

/**
 * TEMPORARY dev tool (Milestone 19 verification): validate the Vision provider on a single image
 * before wiring it into identities. No persistence, no Prisma, no Blob, no identity package, no
 * generation. Remove once Vision is integrated.
 */
export default function VisionDebugPage() {
  return <VisionDebugView visionConfigured={isVisionConfigured()} />;
}
