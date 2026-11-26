import { useEditableInstitutionProfile, institutionKeys } from "@/modules/institution/api/institution.queries"
import type { InstitutionProfile } from "@/modules/institution/types/institution.types"
import { queryClient } from "@/shared/lib/query-client"
import { useDemoContext } from "../state"

// The current API has no institution id. This is a local workspace key, never a server id.
export const localInstitutionScope = "frontend-institution-current"
export function activeInstitutionScope() {
  const context = useDemoContext.getState()
  return context.userId ? context.organizationId : localInstitutionScope
}
export function confirmedStaffInstitution() {
  return queryClient.getQueryData<InstitutionProfile>(institutionKeys.profileFor(activeInstitutionScope()))
}
export function useStaffInstitution() {
  const context = useDemoContext(), { profile, error } = useEditableInstitutionProfile()
  const organizationId = context.userId ? context.organizationId : localInstitutionScope
  return { organizationId, profile, error, organization: {
    id: organizationId, businessAccountId: "", name: profile?.name.trim() || "Institución sin configurar",
    logo: profile?.logoImage ?? null, branches: profile?.branches ?? [],
  } }
}
