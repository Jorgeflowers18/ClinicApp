import type { Page } from "@playwright/test"

/** Resizing can switch between two calendar presentations during sidebar motion. */
export async function settleCalendarLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const shell = document.querySelector(".clinic-app-shell")
    await Promise.allSettled((shell?.getAnimations() ?? []).map(animation => animation.finished))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
}
