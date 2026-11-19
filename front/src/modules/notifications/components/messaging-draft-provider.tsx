import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { UNSAFE_NavigationContext, useLocation, type Navigator, type To } from "react-router-dom"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { MessagingDraftContext, type MessagingDraft } from "../hooks/messaging-draft-context"
import { guardMessagingHistory } from "../hooks/messaging-history-events"

/** Context adapter for the existing router. Its navigator and stored routes are never mutated. */
export function MessagingDraftProvider({children}: {children: ReactNode}) {
  const context = useContext(UNSAFE_NavigationContext), location = useLocation()
  const [draft, setDraft] = useState<MessagingDraft | null>(null), [requested,setRequested] = useState<{run:()=>void}|null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const register = useCallback((next: MessagingDraft | null) => { setDraft(next); if(!next) setRequested(null) }, [])
  const queue = useCallback((run:()=>void) => setRequested(current=>current ?? {run}), [])
  const enabled = Boolean(draft) && location.pathname === "/notificaciones"
  const adapted = useMemo(() => {
    if(!enabled) return context
    const staying = (to: To) => (typeof to === "string" ? new URL(to,window.location.href).pathname : to.pathname ?? location.pathname) === location.pathname
    const navigator: Navigator = {
      ...context.navigator,
      push: (...args) => { if(staying(args[0])) context.navigator.push(...args); else queue(()=>context.navigator.push(...args)) },
      replace: (...args) => { if(staying(args[0])) context.navigator.replace(...args); else queue(()=>context.navigator.replace(...args)) },
    }
    return {...context,navigator}
  }, [context,enabled,location.pathname,queue])
  useEffect(() => {
    if(!enabled) return
    const index = window.history.state?.idx, currentPath = location.pathname
    let restoring=false,allowPop=false
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""}
    const pop=(event:PopStateEvent)=>{
      if(allowPop){allowPop=false;return}
      const target=window.history.state?.idx
      if(typeof index!=="number" || typeof target!=="number")return
      if(restoring){event.stopImmediatePropagation();if(target===index)restoring=false;else window.history.go(index-target);return}
      if(window.location.pathname===currentPath)return
      const delta=target-index
      if(!delta)return
      event.stopImmediatePropagation();restoring=true;window.history.go(-delta)
      queue(()=>{allowPop=true;window.history.go(delta)})
    }
    const release = guardMessagingHistory(pop)
    window.addEventListener("beforeunload",beforeUnload)
    return ()=>{window.removeEventListener("beforeunload",beforeUnload);release()}
  },[enabled,location.key,location.pathname,queue])
  return <MessagingDraftContext.Provider value={register}><UNSAFE_NavigationContext.Provider value={adapted}>{children}</UNSAFE_NavigationContext.Provider>
    <AlertDialog open={Boolean(requested && draft)} onOpenChange={open=>{if(!open)setRequested(null)}}>
      <AlertDialogContent className="messaging-discard" initialFocus={cancelRef}>
        <AlertDialogHeader><AlertDialogTitle>{draft?.pending?"Guardando plantilla":"¿Descartar los cambios de la plantilla?"}</AlertDialogTitle><AlertDialogDescription>{draft?.pending?"Espera a que termine el guardado antes de abandonar la pantalla.":"Hay cambios sin guardar. Puedes seguir editando o salir sin guardarlos."}</AlertDialogDescription></AlertDialogHeader>
        <div className="messaging-discard-actions"><Button ref={cancelRef} variant="outline" onClick={()=>setRequested(null)}>Continuar editando</Button>{!draft?.pending&&<Button variant="destructive" onClick={()=>{const next=requested;draft?.discard();setRequested(null);setDraft(null);next?.run()}}>Descartar cambios</Button>}</div>
      </AlertDialogContent>
    </AlertDialog>
  </MessagingDraftContext.Provider>
}
