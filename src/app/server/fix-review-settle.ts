import { replyToReviewThread, resolveReviewThread } from '@/core/git-pr';
import type { FixReviewResult, ReviewThread } from '@/types/index';

function validateFixReviewVerdict(
  candidate: string,
  threads: ReviewThread[],
): FixReviewResult | undefined {
  try {
    const parsed = JSON.parse(candidate) as {
      commit?: { title?: string; message?: string };
      addressed?: number[];
      skipped?: { n?: number; why?: string }[];
    };
    if (!parsed.commit?.title) return undefined;
    const addressedNs = parsed.addressed ?? [];
    const skipped = parsed.skipped ?? [];
    const seen = new Set<number>();
    for (const n of addressedNs) seen.add(n);
    for (const s of skipped) {
      if (typeof s.n !== 'number' || !s.why) return undefined;
      seen.add(s.n);
    }
    const total = addressedNs.length + skipped.length;
    const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= threads.length;
    // Every thread index must appear exactly once: no gaps, dupes, or overlap.
    if (total !== threads.length || seen.size !== threads.length) return undefined;
    if (![...seen].every(inRange)) return undefined;
    const idAt = (n: number): string => threads[n - 1].id;
    return {
      commit: { title: parsed.commit.title, message: parsed.commit.message ?? '' },
      addressed: addressedNs.map(idAt),
      skipped: skipped.map((s) => ({ threadId: idAt(s.n as number), why: s.why as string })),
    };
  } catch {
    return undefined;
  }
}

// Scans lines backwards for the last valid verdict JSON, since models wrap it in
// a ```json fence and an earlier quoted snippet could otherwise win instead.
export function parseFixReviewResult(
  taskLines: string[],
  threads: ReviewThread[],
): FixReviewResult | undefined {
  const lines = taskLines.flatMap((entry) => entry.split('\n'));
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i].trim();
    if (!candidate.startsWith('{')) continue;
    const result = validateFixReviewVerdict(candidate, threads);
    if (result) return result;
  }
  return undefined;
}

// Not deferred to the push: the verdict lives in memory and a restart in the
// human-paced gap before a push would silently drop it.
export function settleReviewThreads(
  root: string,
  result: FixReviewResult,
  onLine: (text: string) => void,
): void {
  void (async () => {
    const resolved = await Promise.all(
      result.addressed.map((id) => resolveReviewThread(root, id).catch(() => false)),
    );
    const replied = await Promise.all(
      result.skipped.map((s) =>
        replyToReviewThread(root, s.threadId, `Left as-is by the fix-review agent: ${s.why}`).catch(
          () => false,
        ),
      ),
    );
    const ok = resolved.filter(Boolean).length;
    const said = replied.filter(Boolean).length;
    onLine(`Resolved ${ok}/${result.addressed.length} review threads, replied to ${said}`);
  })();
}
