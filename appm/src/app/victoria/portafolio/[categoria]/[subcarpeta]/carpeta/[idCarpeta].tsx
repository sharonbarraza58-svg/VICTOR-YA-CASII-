import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { VictoriaScreenShell } from '@/components/victoria/screen-shell';
import { ExitButton, PaneHeader } from '@/components/victoria/ui';
import { VictoriaColors } from '@/constants/victoria-theme';
import { API_BASE_URL } from '@/lib/api-config';
import { obtenerPerfil, type Perfil } from '@/lib/auth';
import {
  ArchivoPortafolio,
  TareaDisponible,
  obtenerArchivosDeCarpeta,
  obtenerDetalleCarpeta,
  obtenerTareasDisponibles,
  subirArchivoACarpeta,
} from '@/lib/portafolio';
import { styles } from './[idCarpeta].styles';

const NOMBRES_CARPETA: Record<string, string> = {
  planes_mejoramiento: 'Planes de mejoramiento',
  etapa_productiva: 'Formato etapa productiva',
  evidencias_aprendizaje: 'Evidencias de aprendizaje',
  plan_trabajo_concertado: 'Plan de trabajo concertado',
  otros: 'Otros',
};

const NOMBRES_SUBCARPETA: Record<string, string> = {
  trim_1: 'TRIM_I',
  trim_2: 'TRIM_II',
  trim_3: 'TRIM_III',
  trim_4: 'TRIM_IV',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-10-06" -> "6 oct 2026" (se parsea el texto para evitar desfases de zona horaria). */
function formatearFechaLimite(valor: string | null): string | null {
  if (!valor) return null;
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return valor;
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

function LogoV({ size = 96 }: { size?: number }) {
  const escala = size / 96;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 22.8 * escala,
          top: 7 * escala,
          width: 22 * escala,
          height: 70 * escala,
          borderRadius: 11 * escala,
          backgroundColor: '#1F5A33',
          transform: [{ rotate: '-24deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 51.2 * escala,
          top: 7 * escala,
          width: 22 * escala,
          height: 70 * escala,
          borderRadius: 11 * escala,
          backgroundColor: '#4E9B68',
          transform: [{ rotate: '24deg' }],
        }}
      />
    </View>
  );
}

function ZonaSoltar({
  children,
  onArrastrando,
  onArchivo,
}: {
  children: ReactNode;
  onArrastrando: (valor: boolean) => void;
  onArchivo: (archivo: File) => void;
}) {
  if (Platform.OS !== 'web') return <View>{children}</View>;

  return createElement(
    'div',
    {
      onDragOver: (e: any) => {
        e.preventDefault();
        onArrastrando(true);
      },
      onDragLeave: () => onArrastrando(false),
      onDrop: (e: any) => {
        e.preventDefault();
        onArrastrando(false);
        const archivo = e.dataTransfer?.files?.[0];
        if (archivo) onArchivo(archivo);
      },
    },
    children,
  );
}

export default function ArchivosCarpetaScreen() {
  const { categoria, subcarpeta, idCarpeta } = useLocalSearchParams<{
    categoria: string;
    subcarpeta: string;
    idCarpeta: string;
  }>();
  const claveCategoria = categoria ?? 'otros';
  const claveSubcarpeta = subcarpeta ?? 'trim_1';
  const numeroCarpeta = Number(idCarpeta);
  const nombreCarpetaFija = NOMBRES_CARPETA[claveCategoria] ?? claveCategoria;
  const nombreSubcarpeta = NOMBRES_SUBCARPETA[claveSubcarpeta] ?? claveSubcarpeta;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nombreCarpeta, setNombreCarpeta] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<ArchivoPortafolio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  // Archivo elegido que espera confirmación en la ventana "¿A qué tarea corresponde?".
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [tareas, setTareas] = useState<TareaDisponible[] | null>(null);
  const [idTareaElegida, setIdTareaElegida] = useState<number | null>(null);
  const [errorTareas, setErrorTareas] = useState<string | null>(null);

  const cargar = useCallback(() => {
    obtenerDetalleCarpeta(claveCategoria, claveSubcarpeta, numeroCarpeta)
      .then((carpeta) => setNombreCarpeta(carpeta.nombre))
      .catch((err) => setError(err.message));
    obtenerArchivosDeCarpeta(claveCategoria, claveSubcarpeta, numeroCarpeta)
      .then(setArchivos)
      .catch((err) => setError(err.message));
  }, [claveCategoria, claveSubcarpeta, numeroCarpeta]);

  useEffect(() => {
    obtenerPerfil().then(setPerfil);
    cargar();
  }, [cargar]);

  const nombreCompleto = perfil ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') : '';

  async function subir(archivo: File, idTarea?: number | null) {
    setSubiendo(true);
    setError(null);
    try {
      await subirArchivoACarpeta(
        claveCategoria,
        claveSubcarpeta,
        numeroCarpeta,
        archivo,
        idTarea ?? undefined,
      );
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  // Paso previo a subir: abre la ventana para elegir (opcionalmente) la tarea.
  function pedirTarea(archivo: File) {
    setArchivoPendiente(archivo);
    setIdTareaElegida(null);
    setTareas(null);
    setErrorTareas(null);
    obtenerTareasDisponibles()
      .then(setTareas)
      .catch(() => {
        setTareas([]);
        setErrorTareas('No se pudieron cargar tus tareas. Puedes subir el archivo igual.');
      });
  }

  function cancelarSubida() {
    setArchivoPendiente(null);
    setIdTareaElegida(null);
    setTareas(null);
    setErrorTareas(null);
  }

  async function confirmarSubida() {
    if (!archivoPendiente) return;
    const archivo = archivoPendiente;
    const idTarea = idTareaElegida;
    cancelarSubida();
    await subir(archivo, idTarea);
  }

  function abrirSelectorArchivo() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip';
    input.onchange = () => {
      const archivo = input.files?.[0];
      if (archivo) pedirTarea(archivo);
    };
    input.click();
  }

  return (
    <VictoriaScreenShell>
      <PaneHeader
        eyebrow="Portafolio 2026"
        title={nombreCarpeta ?? '...'}
        backHref={`/victoria/portafolio/${claveCategoria}/${claveSubcarpeta}` as never}
      />

      <View style={styles.topRow}>
        <View style={styles.breadcrumbRow}>
          <Link href={'/victoria/portafolio' as never} style={styles.crumb}>
            Portafolio{nombreCompleto ? ` - ${nombreCompleto}` : ''}
          </Link>
          <Text style={styles.crumbSep}>›</Text>
          <Link href={`/victoria/portafolio/${claveCategoria}` as never} style={styles.crumb}>
            {nombreCarpetaFija.toUpperCase()}
          </Link>
          <Text style={styles.crumbSep}>›</Text>
          <Link href={`/victoria/portafolio/${claveCategoria}/${claveSubcarpeta}` as never} style={styles.crumb}>
            {nombreSubcarpeta}
          </Link>
          <Text style={styles.crumbSep}>›</Text>
          <Text style={styles.crumbActual}>{nombreCarpeta ?? '...'}</Text>
        </View>

        <Pressable style={styles.uploadButton} onPress={abrirSelectorArchivo} disabled={subiendo}>
          <Ionicons name="cloud-upload-outline" size={16} color={VictoriaColors.white} />
          <Text style={styles.uploadButtonText}>{subiendo ? 'Subiendo…' : 'Nuevo'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ZonaSoltar onArrastrando={setArrastrando} onArchivo={pedirTarea}>
        <View style={[styles.table, arrastrando && styles.tableArrastrando]}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.colNombre, styles.headerNombre]}>Nombre</Text>
            <Text style={[styles.headerCell, styles.colDato]}>Modificado</Text>
            <Text style={[styles.headerCell, styles.colDato]}>Modificado Por</Text>
            <Text style={[styles.headerCell, styles.colDato]}>Archivos</Text>
          </View>

          {!archivos && !error ? (
            <ActivityIndicator color={VictoriaColors.darkGreen} style={styles.loader} />
          ) : null}

          {archivos && archivos.length === 0 ? (
            <View style={styles.vacio}>
              <LogoV size={96} />
              <Text style={styles.vacioTitulo}>Arrastra y suelta el contenido</Text>
              <Text style={styles.vacioTexto}>O pulsa la opción “Nuevo”</Text>
            </View>
          ) : null}

          {archivos?.map((archivo) => (
            <Pressable
              key={archivo.id_archivo}
              style={styles.row}
              onPress={() => Linking.openURL(`${API_BASE_URL}${archivo.url}`)}>
              <View style={[styles.rowMain, styles.colNombre]}>
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text-outline" size={16} color={VictoriaColors.white} />
                </View>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {archivo.nombre_archivo}
                </Text>
              </View>
              <Text style={[styles.rowText, styles.colDato]}>
                {new Date(archivo.fecha_subida).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
              </Text>
              <Text style={[styles.rowText, styles.colDato]}>{nombreCompleto || '—'}</Text>
              <Text style={[styles.rowText, styles.colDato]}>—</Text>
            </Pressable>
          ))}
        </View>
      </ZonaSoltar>

      <ExitButton />

      {/* Ventana: ¿A qué tarea corresponde el archivo? (opcional) */}
      <Modal visible={archivoPendiente !== null} transparent animationType="fade" onRequestClose={cancelarSubida}>
        <View style={styles.modalFondo}>
          <View style={styles.modalTarjeta}>
            <Pressable style={styles.modalCerrar} onPress={cancelarSubida}>
              <Ionicons name="close" size={18} color={VictoriaColors.black} />
            </Pressable>

            <Text style={styles.modalTitulo}>Subir archivo</Text>
            <Text style={styles.modalSubtitulo} numberOfLines={1}>
              {archivoPendiente?.name ?? ''}
            </Text>

            <Text style={styles.modalEtiqueta}>¿ES LA ENTREGA DE UNA TAREA? (OPCIONAL)</Text>

            <ScrollView style={styles.tareaLista} nestedScrollEnabled>
              {tareas === null ? (
                <ActivityIndicator color={VictoriaColors.darkGreen} style={styles.loader} />
              ) : (
                <>
                  <Pressable
                    style={[styles.tareaOpcion, idTareaElegida === null && styles.tareaOpcionActiva]}
                    onPress={() => setIdTareaElegida(null)}>
                    <Ionicons
                      name={idTareaElegida === null ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={idTareaElegida === null ? VictoriaColors.darkGreen : '#1a1a1a'}
                    />
                    <View style={styles.tareaTextos}>
                      <Text style={styles.tareaTitulo}>Ninguna</Text>
                      <Text style={styles.tareaDetalle}>Solo guardar en el portafolio</Text>
                    </View>
                  </Pressable>

                  {tareas.map((t) => {
                    const marcada = idTareaElegida === t.id_tarea;
                    const limite = formatearFechaLimite(t.fecha_limite);
                    const detalle = [t.competencia, limite ? `Límite ${limite}` : null]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <Pressable
                        key={t.id_tarea}
                        style={[styles.tareaOpcion, marcada && styles.tareaOpcionActiva]}
                        onPress={() => setIdTareaElegida(t.id_tarea)}>
                        <Ionicons
                          name={marcada ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={marcada ? VictoriaColors.darkGreen : '#1a1a1a'}
                        />
                        <View style={styles.tareaTextos}>
                          <Text style={styles.tareaTitulo} numberOfLines={1}>
                            {t.titulo}
                          </Text>
                          {detalle ? (
                            <Text style={styles.tareaDetalle} numberOfLines={1}>
                              {detalle}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}

                  {tareas.length === 0 && !errorTareas ? (
                    <Text style={styles.tareaVacia}>No tienes tareas asignadas en tu ficha.</Text>
                  ) : null}
                </>
              )}
            </ScrollView>

            {errorTareas ? <Text style={styles.modalError}>{errorTareas}</Text> : null}

            <Pressable
              style={[styles.modalBoton, tareas === null && styles.modalBotonInactivo]}
              onPress={confirmarSubida}
              disabled={tareas === null}>
              <Text style={styles.modalBotonTexto}>
                {idTareaElegida !== null ? 'Subir y entregar' : 'Subir archivo'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </VictoriaScreenShell>
  );
}