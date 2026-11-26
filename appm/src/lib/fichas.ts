import { API_BASE_URL } from '@/lib/api-config';
import { getToken } from '@/lib/auth';
import { mensajeDeError, mensajeDeRespuesta } from '@/lib/api-error';
import { DocumentoElegido, subirDocumento } from '@/lib/documentos';

/** Refleja schemas/ficha.py::FichaResponse. No hay "nombre de ficha" en la
 * BD: el número que ves en el diseño ("Ficha 3407169") ES el id_ficha. */
export type Ficha = {
  id_ficha: number;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  id_programa?: number;
  trimestre: string | null;
  id_director: number | null;
  horario?: string | null;
  /** Documento adjunto (PDF o Word). */
  archivo_url?: string | null;
  archivo_nombre?: string | null;
};

export type FichaInput = {
  id_ficha: number;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  id_programa?: number;
  trimestre?: string;
  id_director?: number;
  horario?: string;
};

async function authHeaders(json = true): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error('Debes iniciar sesión de nuevo.');
  return json
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${token}` };
}

export async function obtenerFichas(): Promise<Ficha[]> {
  const r = await fetch(`${API_BASE_URL}/api/fichas/`, { headers: await authHeaders(false) });
  if (!r.ok) throw new Error('No se pudieron cargar las fichas.');
  return r.json();
}

export async function obtenerFichasDePrograma(idPrograma: number): Promise<Ficha[]> {
  const todas = await obtenerFichas();
  return todas.filter((f) => f.id_programa === idPrograma);
}

export async function obtenerFicha(id: number): Promise<Ficha> {
  const r = await fetch(`${API_BASE_URL}/api/fichas/${id}`, { headers: await authHeaders(false) });
  if (!r.ok) throw new Error('No se pudo cargar la ficha.');
  return r.json();
}

export async function crearFicha(data: FichaInput): Promise<Ficha> {
  const r = await fetch(`${API_BASE_URL}/api/fichas/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(mensajeDeError(d.detail, 'No se pudo crear la ficha.'));
  return d;
}

export async function actualizarFicha(id: number, data: FichaInput): Promise<Ficha> {
  const r = await fetch(`${API_BASE_URL}/api/fichas/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(mensajeDeError(d.detail, 'No se pudo actualizar la ficha.'));
  return d;
}

export async function eliminarFicha(id: number): Promise<void> {
  const r = await fetch(`${API_BASE_URL}/api/fichas/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(false),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(mensajeDeRespuesta(r.status, d.detail, 'No se pudo eliminar la ficha.'));
  }
}

/** Adjunta (o reemplaza) el documento PDF/Word de una ficha. */
export function subirArchivoFicha(id: number, archivo: DocumentoElegido): Promise<Ficha> {
  return subirDocumento<Ficha>(`/api/fichas/${id}/archivo`, archivo, 'No se pudo subir el documento de la ficha.');
}

export async function quitarArchivoFicha(id: number): Promise<Ficha> {
  const r = await fetch(`${API_BASE_URL}/api/fichas/${id}/archivo`, {
    method: 'DELETE',
    headers: await authHeaders(false),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(mensajeDeRespuesta(r.status, d.detail, 'No se pudo quitar el documento.'));
  return d;
}
