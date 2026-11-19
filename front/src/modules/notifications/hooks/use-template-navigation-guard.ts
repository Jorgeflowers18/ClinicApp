import { useContext, useEffect, useRef } from "react"
import { MessagingDraftContext } from "./messaging-draft-context"

export function useTemplateNavigationGuard(dirty: boolean, pending: boolean, discard: () => void) {
  const register = useContext(MessagingDraftContext), discardRef = useRef(discard)
  useEffect(() => { discardRef.current = discard })
  useEffect(() => {
    register(dirty ? {pending,discard:()=>discardRef.current()} : null)
    return () => register(null)
  }, [dirty, pending, register])
}
