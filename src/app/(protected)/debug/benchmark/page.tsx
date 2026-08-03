import { BenchmarkView } from "@/components/debug/benchmark-view";

/**
 * DEV tool (Milestone 24.8): the Model Benchmark grid — same source + prompt across edit models, side
 * by side. Client-driven per-cell loop (timeout-safe, progressive fill). See docs/MODEL_BENCHMARK.md.
 */
export default function BenchmarkDebugPage() {
  return <BenchmarkView />;
}
