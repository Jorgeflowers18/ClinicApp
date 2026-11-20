/** Each item owns its state; successes never enter a later retry. */
export type BatchState = "pending" | "validating" | "saving" | "saved" | "correction" | "error"
export interface BatchItem { id: string; status: BatchState }
export interface BatchResult { saved: string[]; failed: string[] }
export async function processBatch<T extends BatchItem>(items: readonly T[], options: {
  validate: (item: T) => boolean
  save: (item: T) => Promise<unknown>
  update: (item: T, state: BatchState, error?: unknown) => void
  active?: () => boolean
}): Promise<BatchResult> {
  const result: BatchResult = { saved: [], failed: [] }
  for (const item of items) {
    if (options.active && !options.active()) break
    if (item.status === "saved") continue
    options.update(item, "validating")
    if (!options.validate(item)) {
      options.update(item, "correction"); result.failed.push(item.id); continue
    }
    options.update(item, "saving")
    try { await options.save(item); options.update(item, "saved"); result.saved.push(item.id) }
    catch (error) { options.update(item, "error", error); result.failed.push(item.id) }
  }
  return result
}
