import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useVictoriaToast } from '@/components/victoria/toast';
import { VictoriaColors } from '@/constants/victoria-theme';
import { actualizarProgramaSede, crearProgramaSede } from '@/lib/coordinador';
import { obtenerCoordinaciones, type Coordinacion } from '@/lib/coordinaciones';
import {
  elegirDocumento,
  formatearTamano,
  MENSAJE_SOLO_DOCUMENTOS,
  type DocumentoElegido,
} from '@/lib/documentos';
import { quitarArchivoPrograma, subirArchivoPrograma, type Programa } from '@/lib/programas';
import { styles } from './programa-form-modal.styles';

/** Niveles de formación del SENA (la columna admite hasta 20 caracteres). */
const NIVELES = ['Técnico', 'Tecnólogo', 'Especialización'];

type Campo = 'nombre' | 'descripcion' | 'url' | null;

export function ProgramaFormModal({
  visible,
  idSede,
  programa,
  subtitulo,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  idSede: number;
  programa?: Programa | null;
  subtitulo: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const editando = !!programa;
  const { mostrarExito, mostrarError } = useVictoriaToast();

  const [nombre, setNombre] = useState('');
  const [nivel, setNivel] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [idCoordinacion, setIdCoordinacion] = useState<number | null>(null);
  const [coordinaciones, setCoordinaciones] = useState<Coordinacion[]>([]);
  const [documentoNuevo, setDocumentoNuevo] = useState<DocumentoElegido | null>(null);
  const [quitarDocumento, setQuitarDocumento] = useState(false);
  const [foco, setFoco] = useState<Campo>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al ABRIR el modal el formulario arranca limpio (añadir) o con los datos
  // del programa (administrar). Se hace al abrir y no al cerrar para que no
  // se vea vacío durante la animación de salida.
  useEffect(() => {
    if (!visible) return;
    setNombre(programa?.nombre ?? '');
    setNivel(programa?.nivel_formacion ?? '');
    setDescripcion(programa?.descripcion ?? '');
    setUrl(programa?.url_programa ?? '');
    setIdCoordinacion(programa?.id_coordinacion ?? null);
    setDocumentoNuevo(null);
    setQuitarDocumento(false);
    setError(null);
    obtenerCoordinaciones()
      .then(setCoordinaciones)
      .catch(() => setCoordinaciones([]));
  }, [visible, programa]);

  // Si el programa ya trae un nivel que no está en la lista, también se muestra.
  const niveles = nivel && !NIVELES.includes(nivel) ? [...NIVELES, nivel] : NIVELES;

  const documentoActual =
    !documentoNuevo && !quitarDocumento && programa?.archivo_url ? programa.archivo_nombre : null;

  async function elegirArchivo() {
    setError(null);
    try {
      const asset = await elegirDocumento(); // solo PDF / Word, máx. 15 MB
      if (!asset) return;
      setDocumentoNuevo(asset);
      setQuitarDocumento(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : MENSAJE_SOLO_DOCUMENTOS);
    }
  }

  function quitarArchivo() {
    setDocumentoNuevo(null);
    if (programa?.archivo_url) setQuitarDocumento(true);
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError('El nombre del programa es obligatorio.');
      return;
    }
    if (url.trim() && !/^https?:\/\/\S+$/i.test(url.trim())) {
      setError('El enlace debe empezar por http:// o https://');
      return;
    }
    setGuardando(true);
    setError(null);

    let guardado: { id_programa: number };
    try {
      if (programa) {
        // En edición se envían siempre (incluso vacíos) para poder borrar valores.
        guardado = await actualizarProgramaSede(idSede, programa.id_programa, {
          nombre: nombre.trim(),
          nivel_formacion: nivel.trim(),
          descripcion: descripcion.trim(),
          url_programa: url.trim(),
          id_coordinacion: idCoordinacion ?? undefined,
        });
      } else {
        guardado = await crearProgramaSede(idSede, {
          nombre: nombre.trim(),
          nivel_formacion: nivel.trim() || undefined,
          descripcion: descripcion.trim() || undefined,
          url_programa: url.trim() || undefined,
          id_coordinacion: idCoordinacion ?? undefined,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editando
            ? 'No se pudo actualizar el programa.'
            : 'No se pudo crear el programa.'
      );
      setGuardando(false);
      return;
    }

    // El programa ya está guardado; ahora el documento (necesita el id).
    try {
      if (documentoNuevo) {
        await subirArchivoPrograma(guardado.id_programa, documentoNuevo);
      } else if (quitarDocumento && programa?.archivo_url) {
        await quitarArchivoPrograma(guardado.id_programa);
      }
      mostrarExito(editando ? 'Programa actualizado con éxito' : 'Programa creado con éxito');
    } catch (err) {
      mostrarError(
        `El programa se guardó, pero el documento no se pudo ${documentoNuevo ? 'subir' : 'quitar'}: ` +
          (err instanceof Error ? err.message : 'inténtalo de nuevo desde Administrar programa.')
      );
    } finally {
      setGuardando(false);
    }
    onClose();
    onGuardado();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          styles.backdrop,
          { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as object,
        ]}
        onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)' } as object,
          ]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{editando ? 'Administrar Programa' : 'Añadir Programa'}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitulo}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={22} color={VictoriaColors.textOnLight} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Nombre del programa *</Text>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              onFocus={() => setFoco('nombre')}
              onBlur={() => setFoco(null)}
              placeholder="Ej. Análisis y Desarrollo de Software"
              placeholderTextColor="rgba(28, 53, 45, 0.6)"
              maxLength={120}
              style={[styles.input, foco === 'nombre' && styles.inputFocused]}
            />

            <Text style={styles.label}>Nivel de formación</Text>
            <View style={styles.chips}>
              {niveles.map((n) => {
                const activo = nivel === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setNivel(activo ? '' : n)}
                    style={[styles.chip, activo && styles.chipActive]}>
                    <Text style={[styles.chipText, activo && styles.chipTextActive]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              onFocus={() => setFoco('descripcion')}
              onBlur={() => setFoco(null)}
              placeholder="Información principal del programa"
              placeholderTextColor="rgba(28, 53, 45, 0.6)"
              maxLength={300}
              multiline
              style={[styles.input, styles.textArea, foco === 'descripcion' && styles.inputFocused]}
            />
            <Text style={styles.counter}>{descripcion.length}/300</Text>

            <Text style={styles.label}>Enlace del programa</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              onFocus={() => setFoco('url')}
              onBlur={() => setFoco(null)}
              placeholder="https://..."
              placeholderTextColor="rgba(28, 53, 45, 0.6)"
              maxLength={200}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, foco === 'url' && styles.inputFocused]}
            />

            <Text style={styles.label}>Coordinación académica</Text>
            {coordinaciones.length === 0 ? (
              <Text style={styles.hint}>
                {editando
                  ? 'Se conserva la coordinación actual del programa.'
                  : 'Se asignará tu coordinación automáticamente.'}
              </Text>
            ) : (
              <View style={styles.chips}>
                {coordinaciones.map((c) => {
                  const activo = idCoordinacion === c.id_coordinacion;
                  return (
                    <Pressable
                      key={c.id_coordinacion}
                      onPress={() => setIdCoordinacion(activo ? null : c.id_coordinacion)}
                      style={[styles.chip, activo && styles.chipActive]}>
                      <Text style={[styles.chipText, activo && styles.chipTextActive]}>
                        {c.nombre_coordinacion}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.label}>Documento del programa</Text>
            {documentoNuevo || documentoActual ? (
              <View style={styles.docRow}>
                <Ionicons name="document-text-outline" size={22} color={VictoriaColors.mutedGreen} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {documentoNuevo ? documentoNuevo.name : documentoActual}
                  </Text>
                  <Text style={styles.docMeta}>
                    {documentoNuevo
                      ? `Se subirá al guardar${documentoNuevo.size ? ' · ' + formatearTamano(documentoNuevo.size) : ''}`
                      : 'Documento actual'}
                  </Text>
                </View>
                <Pressable onPress={elegirArchivo} hitSlop={8} accessibilityLabel="Reemplazar documento">
                  <Ionicons name="swap-horizontal-outline" size={20} color={VictoriaColors.textOnLight} />
                </Pressable>
                <Pressable onPress={quitarArchivo} hitSlop={8} accessibilityLabel="Quitar documento">
                  <Ionicons name="trash-outline" size={20} color="#b3261e" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.dropzone} onPress={elegirArchivo} accessibilityRole="button">
                <Ionicons name="cloud-upload-outline" size={26} color={VictoriaColors.mutedGreen} />
                <Text style={styles.dropzoneText}>
                  {quitarDocumento
                    ? 'Se quitará al guardar. Toca para elegir otro documento'
                    : 'Adjuntar documento del programa'}
                </Text>
                <Text style={styles.docMeta}>PDF o Word (.pdf, .doc, .docx) · máx. 15 MB</Text>
              </Pressable>
            )}
          </ScrollView>

          <Pressable
            style={[styles.submit, (guardando || !nombre.trim()) && styles.submitDisabled]}
            onPress={guardar}
            disabled={guardando || !nombre.trim()}>
            {guardando ? (
              <ActivityIndicator color={VictoriaColors.white} />
            ) : (
              <Text style={styles.submitText}>
                {editando ? 'Guardar cambios Programa' : 'Añadir Programa'}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
