import { Platform } from 'react-native';

/**
 * Solo se permite UNA pestaña con sesión a la vez (sin importar el rol).
 *
 * El token vive en localStorage (compartido entre pestañas), así que una
 * segunda pestaña con sesión pisaría o reutilizaría el de la primera. Para
 * evitarlo, cada pestaña con sesión responde a un "ping" (BroadcastChannel)
 * diciendo qué rol tiene. Una pestaña que quiere entrar (login o primera
 * carga con token guardado) pregunta antes; si alguien responde, se bloquea
 * con un error 409.
 *
 * Solo aplica en web; en móvil no hay "pestañas" y todo devuelve null.
 */

const NOMBRE_CANAL = 'victoria-sesion';
const ESPERA_RESPUESTAS_MS = 400;

type Mensaje =
  | { tipo: 'ping'; id: string }
  | { tipo: 'pong'; id: string; rol: string };

// Rol con el que ESTA pestaña tiene la sesión iniciada (null = sin sesión).
let rolPestana: string | null = null;
let canal: BroadcastChannel | null = null;
let avisoBloqueo: string | null = null;

function obtenerCanal(): BroadcastChannel | null {
  if (Platform.OS !== 'web' || typeof BroadcastChannel === 'undefined') return null;
  if (!canal) {
    canal = new BroadcastChannel(NOMBRE_CANAL);
    // Toda pestaña con sesión responde a las preguntas de las demás.
    canal.onmessage = (evento: MessageEvent<Mensaje>) => {
      const mensaje = evento.data;
      if (mensaje?.tipo === 'ping' && rolPestana) {
        canal?.postMessage({ tipo: 'pong', id: mensaje.id, rol: rolPestana } satisfies Mensaje);
      }
    };
  }
  return canal;
}

/** Guarda el rol de esta pestaña (null al cerrar sesión o si el token ya no sirve). */
export function registrarRolPestana(rol: string | null): void {
  rolPestana = rol;
  obtenerCanal();
}

/** true si esta pestaña ya tiene su sesión registrada (no hace falta volver a preguntar). */
export function pestanaRegistrada(): boolean {
  return rolPestana !== null;
}

/** Texto del error 409 que se muestra al usuario. */
export function mensajeConflicto(rolOtraPestana: string): string {
  return `Error 409 – Conflicto de sesión: ya hay una sesión abierta (${rolOtraPestana}) en otra pestaña. Solo se permite una pestaña a la vez. Cierra la otra pestaña o su sesión para continuar.`;
}

/**
 * Pregunta a las otras pestañas si tienen sesión. Devuelve el rol de la
 * primera que responda, o null si ninguna tiene sesión.
 */
export function rolDeOtraPestanaConSesion(): Promise<string | null> {
  const canalActual = obtenerCanal();
  if (!canalActual) return Promise.resolve(null);

  return new Promise((resolver) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let rolEncontrado: string | null = null;

    const alResponder = (evento: MessageEvent<Mensaje>) => {
      const mensaje = evento.data;
      if (mensaje?.tipo === 'pong' && mensaje.id === id && !rolEncontrado) {
        rolEncontrado = mensaje.rol;
      }
    };

    canalActual.addEventListener('message', alResponder as EventListener);
    canalActual.postMessage({ tipo: 'ping', id } satisfies Mensaje);

    setTimeout(() => {
      canalActual.removeEventListener('message', alResponder as EventListener);
      resolver(rolEncontrado);
    }, ESPERA_RESPUESTAS_MS);
  });
}

/** Igual que rolDeOtraPestanaConSesion; se conserva el nombre para no tocar el import de auth.ts. */
export function rolEnConflictoEnOtraPestana(_rolNuevo?: string): Promise<string | null> {
  return rolDeOtraPestanaConSesion();
}

/** La pantalla de login lee este aviso una sola vez al abrirse. */
export function marcarBloqueoPestana(mensaje: string): void {
  avisoBloqueo = mensaje;
}

export function consumirBloqueoPestana(): string | null {
  const aviso = avisoBloqueo;
  avisoBloqueo = null;
  return aviso;
}

// Se abre el canal al importar el módulo, para responder desde el principio.
obtenerCanal();