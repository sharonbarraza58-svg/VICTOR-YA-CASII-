import { API_BASE_URL } from '@/lib/api-config';
import { clearStoredToken, getStoredToken, setStoredToken } from '@/lib/token-storage';
import { mensajeDeError } from '@/lib/api-error';
import {
  registrarRolPestana,
  rolEnConflictoEnOtraPestana,
  pestanaRegistrada,
  rolDeOtraPestanaConSesion,
  mensajeConflicto,
  marcarBloqueoPestana,
} from '@/lib/sesion-pestanas';

/**
 * Migrado desde static/js/auth.js de VICTORIA_integrado (victoria-admin-completo).
 * Mismo flujo: login contra POST /api/v1/auth/login (form-urlencoded),
 * guarda el JWT, y GET /api/v1/auth/me para leer el perfil real del
 * usuario autenticado. sessionStorage del navegador se reemplaza por
 * token-storage.ts, que funciona tanto en web (localStorage) como en
 * iOS/Android (SecureStore).
 */

export class AuthError extends Error {
  status?: number;
  constructor(mensaje: string, status?: number) {
    super(mensaje);
    this.status = status;
  }
}

export async function getToken(): Promise<string | null> {
  return getStoredToken();
}

async function setToken(token: string): Promise<void> {
  await setStoredToken(token);
}

async function clearToken(): Promise<void> {
  await clearStoredToken();
}

export type FichaInfo = {
  id_ficha: number;
  trimestre: string | null;
  programa: string | null;
  director: string | null;
};

export type Perfil = {
  id_usuario: number;
  nombre: string;
  apellido: string | null;
  id_rol: number;
  // Nombre del rol ("coordinador", "instructor", "aprendiz"), agregado en
  // schemas/usuario.py::UsuarioResponse. Úsalo siempre para decidir qué
  // mostrar por rol -- nunca compares contra un id_rol numérico "mágico",
  // eso se rompe si los roles se siembran en otro orden.
  nombre_rol: string | null;
  estado: string | null;
  numero_documento: string;
  tipo_documento: string;
  telefono: string | null;
  correo_personal: string;
  correo_sena: string;
  id_ficha: number | null;
  id_coordinacion: number | null;
  ficha_info: FichaInfo | null;
};


/** POST /api/v1/auth/login — el "usuario" que pide el backend es el número de documento. */
export async function iniciarSesion(numeroDocumento: string, contrasena: string): Promise<void> {
  const body = new URLSearchParams();
  body.set('username', numeroDocumento);
  body.set('password', contrasena);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    throw new AuthError(
      'No se pudo conectar con el servidor. Verifica que la API esté corriendo (uvicorn main:app --reload) y la URL en src/lib/api-config.ts.'
    );
  }

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new AuthError(mensajeDeError(datos.detail, 'Documento o contraseña incorrectos.'));
  }


  // Rol del usuario que está entrando, leído con SU token (aún sin guardarlo).
  let rolNuevo: string | null = null;
  try {
    const resPerfil = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${datos.access_token}` },
    });
    if (resPerfil.ok) rolNuevo = (await resPerfil.json()).nombre_rol ?? null;
  } catch {
    // Si no se puede leer el rol, se deja entrar como antes.
  }

  if (rolNuevo) {
    const rolEnConflicto = await rolEnConflictoEnOtraPestana(rolNuevo);
    if (rolEnConflicto) {
            throw new AuthError(mensajeConflicto(rolEnConflicto), 409);
    }
  }

  await setToken(datos.access_token);
  registrarRolPestana(rolNuevo);
  marcarSesionActiva();
}

/** GET /api/v1/auth/me — devuelve null si no hay sesión o el token ya no es válido. */
export async function obtenerPerfil(): Promise<Perfil | null> {
  const token = await getToken();
  if (!token) return null;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }

  if (!respuesta.ok) {
    // Solo se descarta el token si el servidor dice que ya no sirve (401/403).
    // Antes se borraba con CUALQUIER error, así que un 500 o un 503 pasajero
    // del servidor cerraba la sesión del usuario sin motivo.
    if (respuesta.status === 401 || respuesta.status === 403) {
      await clearToken();
      marcarSesionInactiva();
    }
    return null;
  }

  const perfil = await respuesta.json();

  // Primera carga de ESTA pestaña: si otra ya tiene sesión, esta se bloquea.
  // No se borra el token: es compartido y pertenece a la otra pestaña.
  if (!pestanaRegistrada()) {
    const rolOtra = await rolDeOtraPestanaConSesion();
    if (rolOtra) {
      marcarBloqueoPestana(mensajeConflicto(rolOtra));
      return null;
    }
  }

  registrarRolPestana(perfil.nombre_rol);
  marcarSesionActiva();
  return perfil;
}


// Bandera en memoria: saber al instante si hay sesión activa, sin esperar
// una lectura asíncrona de almacenamiento. La usa el "atrapa-historial" de
// app/_layout.tsx para reaccionar de inmediato al botón Atrás/Adelante.
let sesionActivaEnMemoria = false;

export function haySesionActiva(): boolean {
  return sesionActivaEnMemoria;
}

function marcarSesionActiva() {
  sesionActivaEnMemoria = true;
}

function marcarSesionInactiva() {
  sesionActivaEnMemoria = false;
}

export async function cerrarSesion(): Promise<void> {
  await clearToken();
  marcarSesionInactiva();
  if (typeof window !== 'undefined' && window.history) {
    // Empuja ya mismo una entrada hacia /login en el historial: así el
    // PRIMER "Atrás" después de cerrar sesión ya encuentra una barrera,
    // en vez de la pantalla protegida donde estabas parado.
    window.history.pushState(null, '', '/login');
  }
}

/** POST /api/v1/auth/olvide-contrasena — pide el código de recuperación por correo. */
export async function solicitarCodigoRecuperacion(correo: string): Promise<void> {
  const respuesta = await fetch(`${API_BASE_URL}/api/v1/auth/olvide-contrasena`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo }),
  });
  if (!respuesta.ok) {
    throw new AuthError('No se pudo procesar la solicitud. Intenta de nuevo.');
  }
  // El backend responde igual exista o no el correo (por seguridad), así
  // que aquí no hay forma de distinguir "correo no encontrado" — y está
  // bien que sea así.
}

/** POST /api/v1/auth/restablecer-contrasena — confirma el código y cambia la contraseña. */
export async function confirmarCodigoRecuperacion(
  correo: string,
  codigo: string,
  nuevaContrasena: string
): Promise<void> {
  const respuesta = await fetch(`${API_BASE_URL}/api/v1/auth/restablecer-contrasena`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, codigo, nueva_contrasena: nuevaContrasena }),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new AuthError(mensajeDeError(datos.detail, 'Código incorrecto o vencido.'));
  }
}

/** Texto del rol para el saludo: "Aprendiz", "Instructor" o "Coordinador". */
export function etiquetaRol(nombreRol: string | null | undefined): string {
  const rol = (nombreRol ?? '').toLowerCase();
  if (rol === 'coordinador') return 'Coordinador';
  if (rol === 'instructor') return 'Instructor';
  return 'Aprendiz';
}