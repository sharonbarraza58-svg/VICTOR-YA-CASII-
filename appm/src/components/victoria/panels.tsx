import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { cerrarSesion, obtenerPerfil, type Perfil } from '@/lib/auth';
import { formatearDocumento } from '@/lib/formato-perfil';
import {
  eliminarNotificacion,
  esNoLeida,
  marcarNotificacionLeida,
  obtenerNotificaciones,
  SesionExpiradaError,
  type Notificacion,
} from '@/lib/notificaciones';
import { MiPerfilCoordinadorModal } from '@/components/victoria/mi-perfil-coordinador-modal';
import { MiPerfilAprendizModal } from '@/components/victoria/mi-perfil-aprendiz-modal';
import { MiPerfilInstructorModal } from '@/components/victoria/mi-perfil-instructor-modal';
import { useVictoriaToast } from '@/components/victoria/toast';
import { styles } from './panels.styles';

/**
 * Antes esto era un arreglo fijo de 3 notificaciones de ejemplo (siempre
 * las mismas, para cualquier usuario). Ahora agrupamos por fecha real las
 * notificaciones que devuelve GET /api/notificaciones/ (ver lib/notificaciones.ts),
 * usando el mismo criterio "Hoy / Ayer / Antes" que ya traía el diseño.
 */
function grupoDeFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const esMismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (esMismoDia(fecha, hoy)) return 'Hoy';
  if (esMismoDia(fecha, ayer)) return 'Ayer';
  return 'Antes';
}

/**
 * Traduce el código técnico del evento (lo que manda el backend en
 * titulo_notificacion, ej. "entrega_calificada") a un título legible.
 * Si aparece un código nuevo que no está en el mapa, igual se muestra
 * de forma decente (sin guiones bajos, con mayúscula inicial) en vez
 * de romperse o mostrar el crudo.
 */
const TITULOS_NOTIFICACION: Record<string, string> = {
  entrega_calificada: 'Se calificó tu entrega',
  tarea_nueva: 'Nueva tarea asignada',
  observacion_asignacion: 'Nueva observación en tu asignación',
  recordatorio_entrega: 'Recordatorio de entrega próxima',
};

function tituloLegible(codigo: string): string {
  if (TITULOS_NOTIFICACION[codigo]) return TITULOS_NOTIFICACION[codigo];
  return codigo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function horaLegible(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-CO', {
    day: fecha.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PanelOverlay({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panelWrap} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={70} tint="light" style={styles.panel}>
            {children}
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function NotificationsPanel({
  visible,
  onClose,
  onUnreadChange,
}: {
  visible: boolean;
  onClose: () => void;
  /** Avisa al navbar cuántas notificaciones sin leer quedan, para el globito de la campana. */
  onUnreadChange?: (cantidad: number) => void;
}) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const { mostrarExito, mostrarError } = useVictoriaToast();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const datos = await obtenerNotificaciones();
      // Más recientes primero, igual que cualquier bandeja de notificaciones.
      datos.sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
      setNotificaciones(datos);
      onUnreadChange?.(datos.filter(esNoLeida).length);
    } catch (err) {
      if (err instanceof SesionExpiradaError) {
        onClose();
        await cerrarSesion();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus notificaciones.');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (visible) cargar();
  }, [visible, cargar]);

  async function tocarNotificacion(n: Notificacion) {
    if (!esNoLeida(n)) return;
    // Optimista: se ve marcada de una vez, y si el backend falla se revierte.
    setNotificaciones((prev) =>
      prev.map((item) => (item.id_notificacion === n.id_notificacion ? { ...item, estado: 'leida' } : item))
    );
    try {
      const actualizada = await marcarNotificacionLeida(n.id_notificacion);
      setNotificaciones((prev) => {
        const siguiente = prev.map((item) => (item.id_notificacion === n.id_notificacion ? actualizada : item));
        onUnreadChange?.(siguiente.filter(esNoLeida).length);
        return siguiente;
      });
    } catch {
      // Revertimos el optimismo si el servidor no confirmó el cambio.
      setNotificaciones((prev) =>
        prev.map((item) => (item.id_notificacion === n.id_notificacion ? n : item))
      );
    }
  }

  async function borrarNotificacion(n: Notificacion) {
    const anterior = notificaciones;
    setNotificaciones((prev) => prev.filter((item) => item.id_notificacion !== n.id_notificacion));
    try {
      await eliminarNotificacion(n.id_notificacion);
      onUnreadChange?.(anterior.filter((item) => item.id_notificacion !== n.id_notificacion && esNoLeida(item)).length);
      mostrarExito('Notificación eliminada');
    } catch {
      setNotificaciones(anterior);
      mostrarError('No se pudo eliminar la notificación');
    }
  }

  const grupos: Record<string, Notificacion[]> = { Hoy: [], Ayer: [], Antes: [] };
  notificaciones.forEach((n) => grupos[grupoDeFecha(n.fecha_creacion)].push(n));

  return (
    <PanelOverlay visible={visible} onClose={onClose}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Notificaciones</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color="#556b5c" />
        </Pressable>
      </View>

      {cargando ? (
        <ActivityIndicator color="#8fa47e" style={styles.notifLoader} />
      ) : error ? (
        <Text style={styles.notifError}>{error}</Text>
      ) : notificaciones.length === 0 ? (
        <Text style={styles.notifEmpty}>No tienes notificaciones por ahora.</Text>
      ) : (
        (['Hoy', 'Ayer', 'Antes'] as const).map((grupo) =>
          grupos[grupo].length === 0 ? null : (
            <View key={grupo}>
              {grupos[grupo].map((n) => (
                <Pressable
                  key={n.id_notificacion}
                  style={styles.notifRow}
                  onPress={() => tocarNotificacion(n)}>
                  <View style={[styles.notifDot, !esNoLeida(n) && styles.notifDotLeida]} />
                  <View style={styles.notifTextWrap}>
                    <Text style={styles.notifLabel}>{grupo}</Text>
                    <Text style={styles.notifTitle}>{tituloLegible(n.titulo_notificacion)}</Text>
                    {n.mensaje ? <Text style={styles.notifText}>{n.mensaje}</Text> : null}
                    <Text style={styles.notifTime}>{horaLegible(n.fecha_creacion)}</Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    style={styles.notifDeleteBtn}
                    onPress={() => borrarNotificacion(n)}>
                    <Ionicons name="trash-outline" size={15} color="#8a8a8a" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )
        )
      )}
    </PanelOverlay>
  );
}

export function ProfilePanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [editando, setEditando] = useState(false);
  const { mostrarInfo } = useVictoriaToast();

  useEffect(() => {
    if (!visible) return;
    obtenerPerfil().then(setPerfil);
  }, [visible]);

  async function handleLogout() {
    await cerrarSesion();
    onClose();
    router.replace('/login');
    mostrarInfo('Sesión cerrada correctamente');
  }

  // Instructor, aprendiz y coordinador: el panel muestra su rol y el botón
  // "Actualizar datos", que cierra el panel y abre la ventana emergente de
  // edición (cada rol tiene la suya). El cierre de sesión sigue disponible
  // con el ícono de salida de abajo a la izquierda; cualquier otro rol
  // conserva el botón "Cerrar sesión" del panel.
  function abrirEdicion() {
    onClose();
    setEditando(true);
  }

  const nombreCompleto = perfil ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') : '…';
  const rol = (perfil?.nombre_rol ?? '').toLowerCase();
  const esInstructor = rol === 'instructor';
  const esAprendiz = rol === 'aprendiz';
  const esCoordinador = rol === 'coordinador';
  const perfilEditable = esInstructor || esAprendiz || esCoordinador;

  return (
    <>
      <PanelOverlay visible={visible} onClose={onClose}>
        <View style={styles.panelHeaderRight}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="#556b5c" />
          </Pressable>
        </View>
        <View style={styles.profileCenter}>
          <Text style={styles.panelTitle}>Perfil</Text>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#556b5c" />
          </View>
          <Text style={styles.profileName}>{nombreCompleto}</Text>
          {perfilEditable ? <Text style={styles.profileRole}>{esInstructor ? 'Instructor' : esAprendiz ? 'Aprendiz' : 'Coordinador'}</Text> : null}
        </View>
        <View style={styles.divider} />
        {perfil ? (
          <View style={styles.profileInfo}>
            <ProfileInfoRow
              icon="card-outline"
              text={
                perfilEditable
                  ? formatearDocumento(perfil.tipo_documento, perfil.numero_documento)
                  : `${perfil.tipo_documento} ${perfil.numero_documento}`
              }
            />
            <ProfileInfoRow icon="mail-outline" text={perfil.correo_sena} />
            <ProfileInfoRow icon="mail-open-outline" text={perfil.correo_personal} />
          </View>
        ) : null}
        {perfilEditable ? (
          <Pressable style={styles.actualizarButton} onPress={abrirEdicion}>
            <Text style={styles.actualizarButtonText}>Actualizar datos</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </Pressable>
        )}
      </PanelOverlay>

      {esInstructor ? (
        <MiPerfilInstructorModal
          visible={editando}
          onClose={() => setEditando(false)}
          onGuardado={() => obtenerPerfil().then(setPerfil)}
        />
      ) : null}
      {esCoordinador ? (
        <MiPerfilCoordinadorModal
          visible={editando}
          onClose={() => setEditando(false)}
          onGuardado={() => obtenerPerfil().then(setPerfil)}
        />
      ) : null}
      {esAprendiz ? (
        <MiPerfilAprendizModal
          visible={editando}
          onClose={() => setEditando(false)}
          onGuardado={() => obtenerPerfil().then(setPerfil)}
        />
      ) : null}
    </>
  );
}

function ProfileInfoRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={12} color={VICTORIA_WHITE} />
      </View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const VICTORIA_WHITE = '#ffffff';