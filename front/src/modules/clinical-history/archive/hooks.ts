import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { queryClient } from "@/shared/lib/query-client"
import { clinicalHistoryKeys } from "../api/clinical-history.queries"
import type { DentalAttachment, PatientClinicalHistory } from "../types/clinical-history.types"
import { archiveApi } from "./api"
import type { ArchiveCatalog } from "./types"

export const archiveMutationKey = ["clinical-file-write"] as const
const catalogKey = ["clinical-history", "archive-catalog"] as const
export function useArchiveCatalog() { return useQuery({ queryKey: catalogKey, queryFn: archiveApi.catalog }) }
export function publishCatalog(catalog: ArchiveCatalog) { queryClient.setQueryData(catalogKey, catalog) }
export function useArchiveWrite(patientId: string) {
  return useMutation({
    mutationKey: archiveMutationKey, mutationFn: (operation: () => Promise<PatientClinicalHistory>) => operation(), onSuccess: (history) => {
      if (history.record.patientId === patientId) queryClient.setQueryData(clinicalHistoryKeys.record(patientId), history)
    }
  })
}
export function useBlobUrl(blob: Blob | null | undefined) {
  const source = useMemo(() => {
    const resource = { url: "" }
    return {
      subscribe(notify: () => void) {
        resource.url = blob ? URL.createObjectURL(blob) : ""; notify()
        return () => { if (resource.url) URL.revokeObjectURL(resource.url); resource.url = "" }
      },
      snapshot: () => resource.url,
    }
  }, [blob])
  return useSyncExternalStore(source.subscribe, source.snapshot, () => "")
}
export function useOriginal(patientId: string, file: DentalAttachment) {
  return useQuery({ queryKey: clinicalHistoryKeys.file(patientId, file.id), queryFn: () => archiveApi.original(patientId, file.id), staleTime: Infinity, retry: false })
}
export function useVisibleThumbnail(patientId: string, id: string, image: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!image || !ref.current) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { rootMargin: "120px" })
    observer.observe(ref.current); return () => observer.disconnect()
  }, [image])
  const query = useQuery({ queryKey: ["clinical-history", "thumbnail", patientId, id], queryFn: () => archiveApi.thumbnail(patientId, id), enabled: image && visible, staleTime: Infinity, retry: false })
  return { ref, query, url: useBlobUrl(query.data) }
}
