import { createContext } from "react"
export type MessagingDraft = { pending: boolean; discard: () => void }
export const MessagingDraftContext = createContext<(draft: MessagingDraft | null) => void>(() => {})
