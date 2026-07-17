import { isVisionConfigured } from "@/lib/vision";
import { SelectionDebugView } from "@/components/debug/selection-debug-view";

/**
 * TEMPORARY dev tool (Milestone 20): make Smart Reference Selection fully transparent — prompt →
 * requirements → per-image match → optimized package + reasons + warnings. No persistence, no
 * generation. Demos the selector on ad-hoc images without needing a saved identity.
 */
export default function SelectionDebugPage() {
  return <SelectionDebugView visionConfigured={isVisionConfigured()} />;
}
