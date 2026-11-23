import type { ArchiveApi } from "./archive.contract"
import { httpArchiveApi } from "./archive.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const archiveApi: ArchiveApi = httpArchiveApi
