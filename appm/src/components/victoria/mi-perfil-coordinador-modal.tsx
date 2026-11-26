import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { HojaVidaModal } from '@/components/victoria/hoja-vida-modal';
import { router } from 'expo-router';

import { useVictoriaToast } from '@/components/victoria/toast';
import { cerrarSesion } from '@/lib/auth';
import { VictoriaColors } from '@/constants/victoria-theme';
import { elegirDocumento } from '@/lib/documentos';
import { capitalizar, formatearFechaLarga } from '@/lib/formato-perfil';
import {
  actualizarMiPerfilCoordinador,
  type CambiosMiPerfilCoordinador,
  type MiPerfilCoordinador,
  obtenerMiPerfilCoordinador,
  subirMiHojaDeVidaCoordinador,
  TIPOS_DOCUMENTO,
} from '@/lib/mi-perfil-coordinador';
import { styles } from './mi-perfil-instructor-modal.styles';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^[0-9+()\-\s]{7,20}$/;
const REGEX_DOCUMENTO = /^[A-Za-z0-9]{4,20}$/;
const PLACEHOLDER = 'rgba(28, 53, 45, 0.5)';

/** Nombre del archivo a partir de la URL, por si no hay hoja_vida_nombre guardado. */
function nombreDesdeUrl(url: string): string {
  const ultimo = url.split('?')[0].split('/').pop() ?? 'hoja_de_vida';
  try {
    return decodeURIComponent(ultimo);
  } catch {
    return ultimo;
  }
}

/** Casilla de solo lectura (gris). */
function Lectura({ valor, vacio = 'No registrado' }: { valor: string | null | undefined; vacio?: string }) {
  return (
    <View style={styles.pillLectura}>
      <Text style={styles.pillLecturaTexto}>{valor || vacio}</Text>
    </View>
  );
}

/**
 * Ventana emergente "Actualizar datos" del coordinador. Muestra toda su
 * información (tabla Usuario + Sede + Coordinación). Solo se pueden editar
 * las casillas VERDES: correo personal, teléfono y documento; además puede
 * adjuntar o reemplazar su hoja de vida. El resto (correo SENA, contrato,
 * sede, coordinación...) es de solo lectura.
 */
export function MiPerfilCoordinadorModal({
  visible,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado?: () => void;
}) {
  const { mostrarExito, mostrarInfo } = useVictoriaToast();
  const [datos, setDatos] = useState<MiPerfilCoordinador | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoDoc, setTipoDoc] = useState('CC');
  const [numDoc, setNumDoc] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Hoja de vida
  const [verHoja, setVerHoja] = useState(false);
  // La hoja elegida NO se sube al instante: queda pendiente y se sube al pulsar "Actualizar datos".
  const [hojaPendiente, setHojaPendiente] =
    useState<NonNullable<Awaited<ReturnType<typeof elegirDocumento>>> | null>(null);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);

  function rellenar(p: MiPerfilCoordinador) {
    setDatos(p);
    setCorreo(p.correo_personal ?? '');
    setTelefono(p.telefono ?? '');
    setTipoDoc(p.tipo_documento ?? 'CC');
    setNumDoc(p.numero_documento ?? '');
  }

  // Cada vez que se abre, se traen los datos frescos del servidor.
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    setDatos(null);
    setErrorCarga(null);
    setErrorForm(null);
    setErrorHoja(null);
    setVerHoja(false);
    setHojaPendiente(null);
    obtenerMiPerfilCoordinador()
      .then((p) => {
        if (!cancelado) rellenar(p);
      })
      .catch((err: any) => {
        if (!cancelado) setErrorCarga(err?.message ?? 'No se pudo cargar tu perfil.');
      });
    return () => {
      cancelado = true;
    };
  }, [visible]);

  // Solo se envía lo que realmente cambió.
  const cambios: CambiosMiPerfilCoordinador = {};
  if (datos) {
    if (correo.trim() !== (datos.correo_personal ?? '')) cambios.correo_personal = correo.trim();
    if (telefono.trim() !== (datos.telefono ?? '')) cambios.telefono = telefono.trim() || null;
    if (tipoDoc !== (datos.tipo_documento ?? '')) cambios.tipo_documento = tipoDoc;
    if (numDoc.trim() !== (datos.numero_documento ?? '')) cambios.numero_documento = numDoc.trim();
  }
  const camposCambiaron = Object.keys(cambios).length > 0;
  // Una hoja de vida pendiente también cuenta como cambio: habilita "Actualizar datos".
  const hayCambios = camposCambiaron || !!hojaPendiente;
  const subiendoHoja = guardando;

  function validar(): string | null {
    if (!correo.trim()) return 'El correo personal es obligatorio.';
    if (!REGEX_CORREO.test(correo.trim())) return 'Escribe un correo personal válido.';
    if (telefono.trim() && !REGEX_TELEFONO.test(telefono.trim())) {
      return 'El teléfono debe tener entre 7 y 20 dígitos.';
    }
    if (!numDoc.trim()) return 'El número de documento es obligatorio.';
    if (!REGEX_DOCUMENTO.test(numDoc.trim())) {
      return 'El documento debe tener entre 4 y 20 caracteres, solo letras y números.';
    }
    return null;
  }

  // Sirve para "Adjuntar hoja de vida" y "Reemplazar hoja de vida". Solo elige el
  // archivo; se sube al pulsar "Actualizar datos". Lo escrito en las casillas
  // verdes (sin guardar) no se pierde.
  async function elegirHoja() {
    if (guardando) return;
    setErrorHoja(null);
    try {
      const archivo = await elegirDocumento();
      if (!archivo) return; // canceló
      setHojaPendiente(archivo);
      setVerHoja(false);
    } catch (err: any) {
      setErrorHoja(err?.message ?? 'No se pudo seleccionar el archivo.');
    }
  }

  async function guardar() {
    if (!hayCambios || guardando) return;
    if (camposCambiaron) {
      const problema = validar();
      if (problema) {
        setErrorForm(problema);
        return;
      }
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      if (hojaPendiente) {
        await subirMiHojaDeVidaCoordinador(hojaPendiente);
        setHojaPendiente(null);
      }
      if (camposCambiaron) {
        await actualizarMiPerfilCoordinador(cambios);
      }
      // El número de documento es el usuario con el que se inicia sesión: al
      // cambiarlo, la sesión actual deja de ser válida. Se cierra y se pide
      // volver a entrar con el número nuevo (en vez de dejar el perfil roto).
      if (cambios.numero_documento !== undefined) {
        await cerrarSesion();
        onClose();
        router.replace('/login');
        mostrarInfo('Cambiaste tu número de documento. Inicia sesión de nuevo con el número nuevo.');
        return;
      }
      mostrarExito('Datos actualizados correctamente');
      onGuardado?.();
      onClose();
    } catch (err: any) {
      setErrorForm(err?.message ?? 'No se pudo actualizar tu perfil.');
    } finally {
      setGuardando(false);
    }
  }

  const nombreCompleto = datos ? [datos.nombre, datos.apellido].filter(Boolean).join(' ') : '';
  const nombreHojaCompleto = datos?.hoja_vida_url
    ? datos.hoja_vida_nombre || nombreDesdeUrl(datos.hoja_vida_url)
    : null;
  const nombreHojaVisible = nombreHojaCompleto ? nombreHojaCompleto.replace(/\.[^.]+$/, '') : null;

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {errorCarga ? (
            <View style={{ paddingBottom: 18 }}>
              <Pressable style={styles.cerrar} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={20} color={VictoriaColors.darkerGreen} />
              </Pressable>
              <Text style={styles.error}>{errorCarga}</Text>
            </View>
          ) : !datos ? (
            <ActivityIndicator color={VictoriaColors.darkGreen} style={styles.loader} />
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="layers-outline" size={18} color={VictoriaColors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre} numberOfLines={1}>
                    {nombreCompleto}
                  </Text>
                  <Text style={styles.subLinea}>Perfil del coordinador</Text>
                </View>
                <Pressable style={styles.cerrar} onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={20} color={VictoriaColors.darkerGreen} />
                </Pressable>
              </View>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.seccion}>DATOS PERSONALES</Text>

                <View style={styles.fila}>
                  <Ionicons name="mail-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>Correo SENA:</Text>
                  <Text style={styles.valorLink} onPress={() => Linking.openURL(`mailto:${datos.correo_sena}`)}>
                    {datos.correo_sena}
                  </Text>
                </View>

                <View style={styles.fila}>
                  <Ionicons name="mail-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>Correo Personal:</Text>
                  <TextInput
                    style={styles.pillEditable}
                    value={correo}
                    onChangeText={setCorreo}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor={PLACEHOLDER}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    maxLength={100}
                  />
                </View>

                <View style={styles.fila}>
                  <Ionicons name="call-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>Número Teléfono:</Text>
                  <TextInput
                    style={styles.pillEditable}
                    value={telefono}
                    onChangeText={setTelefono}
                    placeholder="3001234567"
                    placeholderTextColor={PLACEHOLDER}
                    keyboardType="phone-pad"
                    maxLength={20}
                  />
                </View>

                <View style={[styles.fila, { alignItems: 'flex-start' }]}>
                  <Ionicons name="card-outline" size={18} color="#556b5c" style={{ marginTop: 6 }} />
                  <Text style={[styles.etiqueta, { marginTop: 6 }]}>Documento:</Text>
                  <View style={styles.docColumna}>
                    <View style={styles.chipsTipo}>
                      {TIPOS_DOCUMENTO.map((t) => (
                        <Pressable
                          key={t}
                          style={[styles.chipTipo, tipoDoc === t && styles.chipTipoActivo]}
                          onPress={() => setTipoDoc(t)}>
                          <Text style={[styles.chipTipoTexto, tipoDoc === t && styles.chipTipoTextoActivo]}>{t}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={styles.pillEditable}
                      value={numDoc}
                      onChangeText={setNumDoc}
                      placeholder="Número de documento"
                      placeholderTextColor={PLACEHOLDER}
                      autoCapitalize="characters"
                      maxLength={20}
                    />
                    <Text style={styles.ayuda}>Este número es con el que inicias sesión.</Text>
                  </View>
                </View>

                <View style={styles.fila}>
                  <Ionicons name="gift-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>Nacimiento:</Text>
                  <Lectura valor={formatearFechaLarga(datos.fecha_nacimiento)} />
                </View>

                <View style={styles.fila}>
                  <Ionicons name="ribbon-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>SEDE:</Text>
                  <Lectura valor={datos.nombre_sede} vacio="Sin sede asignada" />
                </View>

                <View style={styles.divider} />

                <Text style={styles.seccion}>INFORMACION CONTRACTUAL</Text>

                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Tipo de contrato</Text>
                  <Lectura valor={datos.tipo_contrato} vacio="Sin asignar" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Estado del contrato</Text>
                  <Lectura valor={datos.estado_contrato} vacio="Sin asignar" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Vigencia del contrato</Text>
                  <Lectura valor={formatearFechaLarga(datos.vigencia_contrato)} vacio="Sin definir" />
                </View>

                {datos.hoja_vida_url ? (
                  // Con hoja de vida: queda el nombre del archivo; al tocarlo se abre la vista previa.
                  <Pressable style={styles.hojaVida} onPress={() => setVerHoja(true)} accessibilityRole="button">
                    <Ionicons name="document-text-outline" size={18} color={VictoriaColors.darkGreen} />
                    <Text style={styles.hojaVidaTexto} numberOfLines={1}>
                      {nombreHojaVisible}
                    </Text>
                    <Ionicons name="eye-outline" size={16} color={VictoriaColors.darkGreen} />
                  </Pressable>
                ) : (
                  // Sin hoja de vida: botoncito para adjuntarla. Al subirse desaparece.
                  <View style={styles.adjuntarBloque}>
                    <Pressable
                      style={[styles.botonAdjuntar, subiendoHoja && styles.botonDeshabilitado]}
                      onPress={elegirHoja}
                      disabled={guardando}
                      accessibilityRole="button">
                      {subiendoHoja ? (
                        <ActivityIndicator color={VictoriaColors.darkGreen} size="small" />
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={16} color={VictoriaColors.darkGreen} />
                      )}
                      <Text style={styles.botonAdjuntarTexto}>
                        {subiendoHoja ? 'Subiendo…' : hojaPendiente ? 'Cambiar archivo seleccionado' : 'Adjuntar hoja de vida'}
                      </Text>
                    </Pressable>
                    <Text style={styles.ayuda}>PDF o Word, máximo 15 MB.</Text>
                  </View>
                )}
                {hojaPendiente ? (
                  <Text style={styles.ayuda}>
                    Hoja de vida seleccionada: se subirá al pulsar "Actualizar datos".
                  </Text>
                ) : null}
                {errorHoja ? <Text style={styles.error}>{errorHoja}</Text> : null}

                <View style={styles.divider} />

                <Text style={styles.seccion}>INFORMACION INSTITUCIONAL</Text>

                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Coordinación</Text>
                  <Lectura valor={datos.nombre_coordinacion} vacio="Sin coordinación" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Área de enfoque</Text>
                  <Lectura valor={capitalizar(datos.area_enfoque)} vacio="Sin definir" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Estado de la cuenta</Text>
                  <Lectura valor={capitalizar(datos.estado)} vacio="Sin estado" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Registrado en Victoria</Text>
                  <Lectura valor={formatearFechaLarga(datos.fecha_creacion)} vacio="—" />
                </View>

                {errorForm ? <Text style={styles.error}>{errorForm}</Text> : null}

                <Pressable
                  style={[styles.boton, (!hayCambios || guardando) && styles.botonDeshabilitado]}
                  onPress={guardar}
                  disabled={!hayCambios || guardando}>
                  {guardando ? (
                    <ActivityIndicator color={VictoriaColors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={16} color={VictoriaColors.white} />
                      <Text style={styles.botonTexto}>Actualizar datos</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <HojaVidaModal
      visible={verHoja && !!datos?.hoja_vida_url}
      onClose={() => setVerHoja(false)}
      nombreInstructor={nombreCompleto}
      subtitulo="Perfil del coordinador"
      url={datos?.hoja_vida_url ?? null}
      nombreArchivo={nombreHojaCompleto ?? 'hoja_de_vida'}
      subiendo={subiendoHoja}
      onReemplazar={elegirHoja}
    />
    </>
  );
}