// Register before BrowserRouter starts listening. At the Window target, listener order matters:
// a later listener can be removed by a route unmount before it receives the same popstate event.
let active: ((event: PopStateEvent) => void) | null = null
const dispatch = (event: PopStateEvent) => active?.(event)
if (typeof window !== "undefined") window.addEventListener("popstate", dispatch, true)
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener("popstate", dispatch, true))

export function guardMessagingHistory(listener: (event: PopStateEvent) => void) {
  active = listener
  return () => { if (active === listener) active = null }
}
