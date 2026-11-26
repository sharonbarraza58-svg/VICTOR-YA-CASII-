import { API_BASE_URL } from '@/lib/api-config';
import { mensajeDeRespuesta } from '@/lib/api-error';
import { getToken } from '@/lib/auth';
import { type DocumentoElegido, subirDocumento } from '@/lib/documentos';

/**
 * Perfil del instructor AUTENTICADO, visto por él mismo.
 * GET/PUT /api/instructor/perfil (el id sale del token, nunca de la URL).
 * Los campos salen de la tabla Usuario (+ nombre de Sede y Coordinacion).
 */
export const TIPOS_DOCUMENTO = ['CC', 'TI', 'CE', 'PPT', 'PEP'] as const;

export type MiPerfilInstructor = {
  id_usuario: number;
  nombre: string;
  apellido: string | null;
  correo_sena: string;
  correo_personal: string;
  telefono: string | null;
  tipo_documento: string;
  numero_documento: string;
  fecha_nacimiento: string | null;
  especialidad: string | null;
  tipo_contrato: string | null;
  estado_contrato: string | null;
  vigencia_contrato: string | null;
  tipo_instructor: string | null;
  hoja_vida_url: string | null;
  hoja_vida_nombre: string | null;
  nombre_sede: string | null;
  nombre_coordinacion: string | null;
};

/** Lo ÚNICO que el instructor puede cambiar. Solo se envían los campos modificados. */
export type CambiosMiPerfil = {
  correo_personal?: string;
  telefono?: string | null;
  tipo_documento?: string;
  numero_documento?: string;
  especialidad?: string | null;
};

async function pedir<T>(
  fallback: string,
  opciones: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Debes iniciar sesión de nuevo.');
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE_URL}/api/instructor/perfil`, {
      method: opciones.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(mensajeDeRespuesta(respuesta.status, datos.detail, fallback));
  return datos as T;
}

export function obtenerMiPerfilInstructor() {
  return pedir<MiPerfilInstructor>('No se pudo cargar tu perfil.');
}

export function actualizarMiPerfilInstructor(cambios: CambiosMiPerfil) {
  return pedir<MiPerfilInstructor>('No se pudo actualizar tu perfil.', { method: 'PUT', body: cambios });
}

/** Sube (o reemplaza) la hoja de vida: POST /api/instructor/perfil/hoja-vida (PDF o Word, máx. 15 MB). */
export function subirMiHojaDeVida(archivo: DocumentoElegido) {
  return subirDocumento<MiPerfilInstructor>(
    '/api/instructor/perfil/hoja-vida',
    archivo,
    'No se pudo subir la hoja de vida.'
  );
}