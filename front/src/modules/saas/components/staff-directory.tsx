import { useState, type ReactNode } from "react"
import { LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { AccountStatusBadge, ProfessionalStatusBadge, SaasSelect } from "./controls"
import { accountStates, professionalStates, type AccountState, type ProfessionalState } from "../types"
import styles from "./administrative-ui.module.css"
import directory from "./staff-directory.module.css"
export type DirectoryPerson = {
 id:string; name:string; username:string; email:string; registration:string; typeId:string; typeName:string;
 specialtyIds:string[]; specialtyNames:string[]; roleIds:string[]; roleNames:string[]; siteIds:string[]; siteNames:string[];
 accountState?:AccountState; professionalState?:ProfessionalState; actions:ReactNode; createAccount?:ReactNode
}
type Option = {id:string;name:string}
export function StaffDirectory({people,roles,types,specialties,sites,loading,error}:{people:DirectoryPerson[];roles:Option[];types:Option[];specialties:Option[];sites:Option[];loading?:boolean;error?:string}) {
 const [search,setSearch]=useState(""),[role,setRole]=useState("all"),[type,setType]=useState("all"),[specialty,setSpecialty]=useState("all"),[site,setSite]=useState("all"),[account,setAccount]=useState("all"),[professional,setProfessional]=useState("all"),[cards,setCards]=useState(false)
 const needle=search.trim().normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("es")
 const rows=people.filter(person=>(!needle||[person.name,person.username,person.email,person.registration,person.typeName,...person.specialtyNames,...person.roleNames].join(" ").normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("es").includes(needle))&&(role==="all"||person.roleIds.includes(role))&&(type==="all"||person.typeId===type)&&(specialty==="all"||person.specialtyIds.includes(specialty))&&(site==="all"||person.siteIds.includes(site))&&(account==="all"||(account==="none"?!person.accountState:person.accountState===account))&&(professional==="all"||person.professionalState===professional))
 const options=(all:string,items:Option[])=>({all,...Object.fromEntries(items.map(item=>[item.id,item.name]))})
 const columns:DataTableColumn<DirectoryPerson>[]=[
 {key:"person",header:"Persona",cell:p=><div className={directory.person}><span className="saas-avatar">{p.name.split(" ").filter(Boolean).slice(0,2).map(part=>part[0]).join("")}</span><div><strong>{p.name}</strong><p className="saas-hint">{p.email||"Sin correo registrado"}</p><p className="saas-hint" title={p.siteNames.join(" · ")}>{p.siteNames.join(" · ")||"Sin sede asignada"}</p></div></div>},
 {key:"username",header:"Usuario",cell:p=>p.accountState?p.username||"Sin nombre de usuario":<div className="saas-stack saas-compact"><span className="saas-hint">Sin cuenta</span>{p.createAccount}</div>},
 {key:"type",header:"Tipo profesional",cell:p=><div>{p.typeName}<p className="saas-hint">{p.specialtyNames.join(" · ")||"—"}</p>{p.registration&&<p className="saas-hint">Registro: {p.registration}</p>}</div>},
 {key:"roles",header:"Rol",cell:p=><div className={`${styles.roleSummary} ${directory.roles}`}>{p.roleNames.slice(0,2).map((name,i)=><Badge key={p.roleIds[i]} variant="secondary">{name}</Badge>)}{p.roleNames.length>2&&<details><summary aria-label={"Ver "+(p.roleNames.length-2)+" roles adicionales de "+p.name}><Badge variant="outline">+{p.roleNames.length-2}</Badge></summary><div>{p.roleNames.slice(2).map((name,i)=><Badge key={p.roleIds[i+2]} variant="secondary">{name}</Badge>)}</div></details>}</div>},
 {key:"state",header:"Estado",cell:p=><div className={directory.statuses}>{p.accountState&&<span className={directory.statusLine} title="Estado de cuenta"><small className="saas-hint">Cuenta: </small><AccountStatusBadge state={p.accountState}/></span>}{p.professionalState&&<span className={directory.statusLine} title="Estado profesional"><small className="saas-hint">Profesional: </small><ProfessionalStatusBadge state={p.professionalState}/></span>}</div>},
 {key:"actions",header:"",cell:p=>p.actions},
 ]
 return <div className={directory.root}><div className={directory.filters}><SearchInput className={directory.search} value={search} onChange={setSearch} ariaLabel="Buscar personal" placeholder="Buscar por nombre, usuario, correo o profesional"/>
 <div className={directory.selects}><SaasSelect label="Estado de cuenta" value={account} onChange={setAccount} statusKind="account" items={{all:"Todos",...accountStates,none:"Sin cuenta"}}/>
 <SaasSelect label="Estado profesional" value={professional} onChange={setProfessional} statusKind="professional" items={{all:"Todos",...professionalStates}}/>
 <SaasSelect label="Sede" value={site} onChange={setSite} items={options("Todas las sedes",sites)}/>
 <SaasSelect label="Especialidad" value={specialty} onChange={setSpecialty} items={options("Todas",specialties)}/>
 <SaasSelect label="Rol" value={role} onChange={setRole} items={options("Todos los roles",roles)}/>
 <SaasSelect label="Tipo profesional" value={type} onChange={setType} items={options("Todos",types)}/></div>
 <div className={directory.reset}><ResetFiltersButton disabled={!search&&[role,type,specialty,site,account,professional].every(item=>item==="all")} onReset={()=>{setSearch("");setRole("all");setType("all");setSpecialty("all");setSite("all");setAccount("all");setProfessional("all")}}/></div></div>
 <div className={directory.views}><Button size="sm" variant={!cards?"secondary":"ghost"} aria-pressed={!cards} onClick={()=>setCards(false)}><List/>Lista</Button><Button size="sm" variant={cards?"secondary":"ghost"} aria-pressed={cards} onClick={()=>setCards(true)}><LayoutGrid/>Tarjetas</Button></div>
 {cards&&!loading&&!error?<div className={directory.cards}>{rows.map(person=><article className={`saas-professional ${directory.card}`} key={person.id}>{columns.map(column=><div key={column.key}>{column.key==="person"?column.cell(person):column.key==="actions"?<div className="saas-actions">{column.cell(person)}</div>:<div><span className="saas-hint">{column.header}</span><div>{column.cell(person)}</div></div>}</div>)}</article>)}{!rows.length&&<p>No hay personas con estos filtros.</p>}</div>:<DataTable tableBreakpoint="wide" className={`${styles.table} ${directory.table}`} data={rows} getRowId={p=>p.id} columns={columns} mobileTitleKey="person" isLoading={loading} isError={Boolean(error)} errorMessage={error}/>}
 </div>
}
