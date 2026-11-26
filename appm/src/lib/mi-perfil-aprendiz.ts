import { API_BASE_URL } from '@/lib/api-config';
import { mensajeDeRespuesta } from '@/lib/api-error';
import { getToken } from '@/lib/auth';

/**
 * Perfil del aprendiz AUTENTICADO, visto por él mismo.
 * GET/PUT /api/aprendiz/perfil (el id sale del token, nunca de la URL).
 * Los campos salen de la tabla Usuario + su Ficha, el Programa de la ficha
 * y el instructor director de la ficha.
 */
export const TIPOS_DOCUMENTO = ['CC', 'TI', 'CE', 'PPT', 'PEP'] as const;

export type MiPerfilAprendiz = {
  id_usuario: number;
  nombre: string;
  apellido: string | null;
  correo_sena: string;
  correo_personal: string;
  telefono: string | null;
  tipo_documento: string;
  numero_documento: string;
  fecha_nacimiento: string | null;
  estado: string | null;
  fecha_creacion: string | null;
  // Ficha (null si el aprendiz todavía no tiene ficha asignada)
  id_ficha: number | null;
  numero_ficha: string | null;
  trimestre: string | null;
  horario: string | null;
  fecha_inicio_ficha: string | null;
  fecha_fin_ficha: string | null;
  nombre_programa: string | null;
  nivel_formacion: string | null;
  nombre_director: string | null;
};

/** Lo ÚNICO que el aprendiz puede cambiar. Solo se envían los campos modificados. */
export type CambiosMiPerfilAprendiz = {
  correo_personal?: string;
  telefono?: string | null;
  tipo_documento?: string;
  numero_documento?: string;
};

async function pedir<T>(
  fallback: string,
  opciones: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Debes iniciar sesión de nuevo.');
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE_URL}/api/aprendiz/perfil`, {
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

export function obtenerMiPerfilAprendiz() {
  return pedir<MiPerfilAprendiz>('No se pudo cargar tu perfil.');
}

export function actualizarMiPerfilAprendiz(cambios: CambiosMiPerfilAprendiz) {
  return pedir<MiPerfilAprendiz>('No se pudo actualizar tu perfil.', { method: 'PUT', body: cambios });
}