let active=false
/** Only an environment boundary; real authorization remains entirely on the server. */
export const isDemonstrationActive=()=>active
export function setDemonstrationActive(value:boolean){active=value}
