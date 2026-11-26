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
  TextInput,
  View,
} from 'react-native';

import { VictoriaScreenShell } from '@/components/victoria/screen-shell';
import { ExitButton, PaneHeader } from '@/components/victoria/ui';
import { VictoriaColors } from '@/constants/victoria-theme';
import { API_BASE_URL } from '@/lib/api-config';
import { obtenerPerfil, type Perfil } from '@/lib/auth';
import {
  ArchivoPortafolio,
  CarpetaAprendiz,
  TareaDisponible,
  crearCarpetaEnSubcarpeta,
  obtenerArchivosDeSubcarpeta,
  obtenerCarpetasDeSubcarpeta,
  obtenerTareasDisponibles,
  subirArchivoASubcarpeta,
} from '@/lib/portafolio';
import { styles } from './index.styles';

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

// Logo V hecho con vistas normales, sin imágenes ni librerías.
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

// Zona donde se pueden soltar archivos. Solo funciona en web: en móvil
// devuelve un View normal sin arrastrar y soltar.
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

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-10-06" -> "6 oct 2026" (se parsea el texto para evitar desfases de zona horaria). */
function formatearFechaLimite(valor: string | null): string | null {
  if (!valor) return null;
  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return valor;
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

export default function ArchivosSubcarpetaScreen() {
  const { categoria, subcarpeta } = useLocalSearchParams<{ categoria: string; subcarpeta: string }>();
  const claveCategoria = categoria ?? 'otros';
  const claveSubcarpeta = subcarpeta ?? 'trim_1';
  const nombreCarpeta = NOMBRES_CARPETA[claveCategoria] ?? claveCategoria;
  const nombreSubcarpeta = NOMBRES_SUBCARPETA[claveSubcarpeta] ?? claveSubcarpeta;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [archivos, setArchivos] = useState<ArchivoPortafolio[] | null>(null);
  const [carpetas, setCarpetas] = useState<CarpetaAprendiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modalCarpeta, setModalCarpeta] = useState(false);
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState('');
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);
  const [errorCarpeta, setErrorCarpeta] = useState<string | null>(null);

  // Archivo elegido que espera confirmación en la ventana "¿A qué tarea corresponde?".
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [tareas, setTareas] = useState<TareaDisponible[] | null>(null);
  const [idTareaElegida, setIdTareaElegida] = useState<number | null>(null);
  const [errorTareas, setErrorTareas] = useState<string | null>(null);

  const cargar = useCallback(() => {
    obtenerArchivosDeSubcarpeta(claveCategoria, claveSubcarpeta)
      .then(setArchivos)
      .catch((err) => setError(err.message));
    obtenerCarpetasDeSubcarpeta(claveCategoria, claveSubcarpeta)
      .then(setCarpetas)
      .catch((err) => setError(err.message));
  }, [claveCategoria, claveSubcarpeta]);

  useEffect(() => {
    obtenerPerfil().then(setPerfil);
    cargar();
  }, [cargar]);

  const nombreCompleto = perfil ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') : '';

  async function subir(archivo: File, idTarea?: number | null) {
    setSubiendo(true);
    setError(null);
    try {
      await subirArchivoASubcarpeta(claveCategoria, claveSubcarpeta, archivo, idTarea ?? undefined);
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
    setMenuAbierto(false);
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

  function abrirVentanaCarpeta() {
    setMenuAbierto(false);
    setNombreNuevaCarpeta('');
    setErrorCarpeta(null);
    setModalCarpeta(true);
  }

  function cerrarVentanaCarpeta() {
    setModalCarpeta(false);
    setNombreNuevaCarpeta('');
    setErrorCarpeta(null);
  }

  async function crearCarpeta() {
    const nombre = nombreNuevaCarpeta.trim();
    if (!nombre || creandoCarpeta) return;
    setCreandoCarpeta(true);
    setErrorCarpeta(null);
    try {
      await crearCarpetaEnSubcarpeta(claveCategoria, claveSubcarpeta, nombre);
      cerrarVentanaCarpeta();
      cargar();
    } catch (err) {
      setErrorCarpeta((err as Error).message);
    } finally {
      setCreandoCarpeta(false);
    }
  }

  const cargando = (!archivos || !carpetas) && !error;
  const vacio = archivos?.length === 0 && carpetas?.length === 0;

  return (
    <VictoriaScreenShell>
      <PaneHeader
        eyebrow="Portafolio 2026"
        title={nombreCompleto ? `Portafolio - ${nombreCompleto}` : 'Portafolio'}
        backHref={`/victoria/portafolio/${claveCategoria}` as never}
      />

      <View style={styles.topRow}>
        <View style={styles.breadcrumbRow}>
          <Link href={'/victoria/portafolio' as never} style={styles.crumb}>
            Portafolio{nombreCompleto ? ` - ${nombreCompleto}` : ''}
          </Link>
          <Text style={styles.crumbSep}>›</Text>
          <Link href={`/victoria/portafolio/${claveCategoria}` as never} style={styles.crumb}>
            {nombreCarpeta.toUpperCase()}
          </Link>
          <Text style={styles.crumbSep}>›</Text>
          <Text style={styles.crumbActual}>{nombreSubcarpeta}</Text>
        </View>

        <View style={styles.nuevoContenedor}>
          <Pressable
            style={styles.uploadButton}
            onPress={() => setMenuAbierto((abierto) => !abierto)}
            disabled={subiendo}>
            <Ionicons name="cloud-upload-outline" size={16} color={VictoriaColors.white} />
            <Text style={styles.uploadButtonText}>{subiendo ? 'Subiendo…' : 'Nuevo'}</Text>
          </Pressable>

          {menuAbierto ? (
            <View style={styles.menu}>
              <Pressable style={styles.menuItem} onPress={abrirVentanaCarpeta}>
                <Ionicons name="folder-outline" size={16} color={VictoriaColors.white} />
                <Text style={styles.menuTexto}>Carpeta Nueva</Text>
              </Pressable>
              <View style={styles.menuLinea} />
              <Pressable style={styles.menuItem} onPress={abrirSelectorArchivo}>
                <Ionicons name="cloud-upload-outline" size={16} color={VictoriaColors.white} />
                <Text style={styles.menuTexto}>Subir Archivos</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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

          {cargando ? <ActivityIndicator color={VictoriaColors.darkGreen} style={styles.loader} /> : null}

          {vacio ? (
            <View style={styles.vacio}>
              <LogoV size={96} />
              <Text style={styles.vacioTitulo}>Arrastra y suelta el contenido</Text>
              <Text style={styles.vacioTexto}>O pulsa la opción “Nuevo”</Text>
            </View>
          ) : null}

          {carpetas?.map((carpeta) => (
            <Link
              key={`carpeta-${carpeta.id_carpeta}`}
              href={`/victoria/portafolio/${claveCategoria}/${claveSubcarpeta}/carpeta/${carpeta.id_carpeta}` as never}
              asChild>
              <Pressable style={styles.row}>
                <View style={[styles.rowMain, styles.colNombre]}>
                  <View style={styles.folderIcon}>
                    <Ionicons name="folder" size={16} color={VictoriaColors.white} />
                  </View>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {carpeta.nombre}
                  </Text>
                </View>
                <Text style={[styles.rowText, styles.colDato]}>{formatearFecha(carpeta.ultima_modificacion)}</Text>
                <Text style={[styles.rowText, styles.colDato]}>{nombreCompleto || '—'}</Text>
                <Text style={[styles.rowText, styles.colDato]}>
                  {carpeta.total_archivos} {carpeta.total_archivos === 1 ? 'doc' : 'docs'}
                </Text>
              </Pressable>
            </Link>
          ))}

          {archivos?.map((archivo) => (
            <Pressable
              key={`archivo-${archivo.id_archivo}`}
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
              <Text style={[styles.rowText, styles.colDato]}>{formatearFecha(archivo.fecha_subida)}</Text>
              <Text style={[styles.rowText, styles.colDato]}>{nombreCompleto || '—'}</Text>
              <Text style={[styles.rowText, styles.colDato]}>—</Text>
            </Pressable>
          ))}
        </View>
      </ZonaSoltar>

      <ExitButton />

      {/* Ventana: Carpeta Nueva */}
      <Modal visible={modalCarpeta} transparent animationType="fade" onRequestClose={cerrarVentanaCarpeta}>
        <View style={styles.modalFondo}>
          <View style={styles.modalTarjeta}>
            <Pressable style={styles.modalCerrar} onPress={cerrarVentanaCarpeta}>
              <Ionicons name="close" size={18} color={VictoriaColors.black} />
            </Pressable>

            <Text style={styles.modalTitulo}>Carpeta Nueva</Text>
            <Text style={styles.modalSubtitulo}>
              Portafolio{nombreCompleto ? ` - ${nombreCompleto}` : ''}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la carpeta"
              placeholderTextColor="#777777"
              value={nombreNuevaCarpeta}
              onChangeText={setNombreNuevaCarpeta}
              onSubmitEditing={crearCarpeta}
              maxLength={100}
              autoFocus
            />

            {errorCarpeta ? <Text style={styles.modalError}>{errorCarpeta}</Text> : null}

            <Pressable
              style={[
                styles.modalBoton,
                (!nombreNuevaCarpeta.trim() || creandoCarpeta) && styles.modalBotonInactivo,
              ]}
              onPress={crearCarpeta}
              disabled={!nombreNuevaCarpeta.trim() || creandoCarpeta}>
              <Text style={styles.modalBotonTexto}>{creandoCarpeta ? 'Creando…' : 'Crear carpeta'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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