import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthLayout, AuthNotice } from "@/modules/auth/components/auth-layout";
import { useDemoContext, useSaasData } from "../state";
import { updateDemoData } from "../adapters/demo-repository";
import { nameOf } from "../lib/identity";
export function ActivationPage() { const id = useDemoContext(state => state.userId), data = useSaasData(), user = data.users.find(item => item.id === id), navigate = useNavigate(); return <AuthLayout title="Activa tu cuenta" description="Bienvenida y activación de demostración.">{user ? <div className="auth-form"><p>{nameOf(user)}</p><p>Tu usuario de acceso es: <strong>{user.username}</strong></p><AuthNotice>Este recorrido no valida una invitación del servidor ni genera credenciales reales.</AuthNotice><Button onClick={() => { updateDemoData(next => { const current = next.users.find(item => item.id === id)!; current.state = "active"; current.activation = "temporary"; current.mustChangePassword = true; }); navigate("/cambio-inicial-contrasena"); }}>Configurar contraseña personal</Button></div> : <AuthNotice error>Abre una cuenta de demostración para revisar su activación.</AuthNotice>}</AuthLayout>; }
