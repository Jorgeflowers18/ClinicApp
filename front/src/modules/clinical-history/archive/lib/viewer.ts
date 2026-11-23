import { ApiError } from "@/shared/types/common"
import { downloadBlob } from "../../lib/dental-export"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { archiveApi } from "../api"
import { fileClinicalType, isClinicalImage } from "./classification"

export interface ImageTransform { zoom: number; rotation: number; x: number; y: number }
export const initialTransform = (): ImageTransform => ({ zoom: 1, rotation: 0, x: 0, y: 0 })
export async function downloadOriginal(patientId: string, file: DentalAttachment) { downloadBlob(await archiveApi.original(patientId, file.id), file.name) }
/** `410`: el protocolo de conservación borró el original. */
export const isGone = (error: unknown) => error instanceof ApiError && error.status === 410
export async function toggleFullscreen(element: HTMLElement | null) {
  if (document.fullscreenElement) await document.exitFullscreen()
  else if (element?.requestFullscreen) await element.requestFullscreen()
  else throw new Error("Este navegador no ofrece pantalla completa. Puedes ampliar el navegador para consultar el original.")
}
export function comparisonCompatible(files: DentalAttachment[]) { return files.length === 2 && files.every(isClinicalImage) && fileClinicalType(files[0]) === fileClinicalType(files[1]) }
