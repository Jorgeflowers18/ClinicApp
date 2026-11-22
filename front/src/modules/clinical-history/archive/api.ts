import { env } from "@/shared/lib/env"

import type { ArchiveApi } from "./archive.contract"
import { httpArchiveApi } from "./archive.http"
import { mockArchiveApi } from "./archive.mock"

/** La única elección entre la API y la demostración (IndexedDB) para el archivo clínico. */
export const archiveApi: ArchiveApi = env.usesApi("clinical-history") ? httpArchiveApi : mockArchiveApi
