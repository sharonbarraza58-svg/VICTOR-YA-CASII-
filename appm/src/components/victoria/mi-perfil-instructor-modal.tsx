import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { HojaVidaModal } from '@/components/victoria/hoja-vida-modal';
import { useVictoriaToast } from '@/components/victoria/toast';
import { VictoriaColors } from '@/constants/victoria-theme';
import { elegirDocumento } from '@/lib/documentos';
import { formatearFechaLarga } from '@/lib/formato-perfil';
import {
  actualizarMiPerfilInstructor,
  type CambiosMiPerfil,
  type MiPerfilInstructor,
  obtenerMiPerfilInstructor,
  subirMiHojaDeVida,
  TIPOS_DOCUMENTO,
} from '@/lib/mi-perfil-instructor';
import { styles } from './mi-perfil-instructor-modal.styles';

const TIPOS_INSTRUCTOR: Record<string, string> = {
  planta: 'De planta',
  tecnico: 'Técnico',
  transversal: 'Transversal',
  contratista: 'Contratista',
};

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
 * Ventana emergente "Actualizar datos" del instructor. Muestra toda su
 * información (tabla Usuario + Sede + Coordinación). Solo se pueden editar
 * las casillas VERDES: correo personal, teléfono, documento y especialidad;
 * el resto (correo SENA, contrato, hoja de vida, sede...) lo gestiona el
 * coordinador y aquí es de solo lectura.
 */
export function MiPerfilInstructorModal({
  visible,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado?: () => void;
}) {
  const { mostrarExito } = useVictoriaToast();
  const [datos, setDatos] = useState<MiPerfilInstructor | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoDoc, setTipoDoc] = useState('CC');
  const [numDoc, setNumDoc] = useState('');
  const [especialidad, setEspecialidad] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Hoja de vida
  const [verHoja, setVerHoja] = useState(false);
  const [subiendoHoja, setSubiendoHoja] = useState(false);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);

  function rellenar(p: MiPerfilInstructor) {
    setDatos(p);
    setCorreo(p.correo_personal ?? '');
    setTelefono(p.telefono ?? '');
    setTipoDoc(p.tipo_documento ?? 'CC');
    setNumDoc(p.numero_documento ?? '');
    setEspecialidad(p.especialidad ?? '');
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
    obtenerMiPerfilInstructor()
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
  const cambios: CambiosMiPerfil = {};
  if (datos) {
    if (correo.trim() !== (datos.correo_personal ?? '')) cambios.correo_personal = correo.trim();
    if (telefono.trim() !== (datos.telefono ?? '')) cambios.telefono = telefono.trim() || null;
    if (tipoDoc !== (datos.tipo_documento ?? '')) cambios.tipo_documento = tipoDoc;
    if (numDoc.trim() !== (datos.numero_documento ?? '')) cambios.numero_documento = numDoc.trim();
    if (especialidad.trim() !== (datos.especialidad ?? '')) cambios.especialidad = especialidad.trim() || null;
  }
  const hayCambios = Object.keys(cambios).length > 0;

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
    if (especialidad.trim().length > 150) return 'La especialidad no puede superar 150 caracteres.';
    return null;
  }

  // Sirve para "Adjuntar hoja de vida" (no hay ninguna) y "Reemplazar hoja de vida".
  // Solo actualiza los campos de la hoja de vida: lo que el instructor ya
  // escribió en las casillas verdes (sin guardar) no se pierde.
  async function elegirYSubirHoja() {
    if (subiendoHoja) return;
    setErrorHoja(null);
    try {
      const archivo = await elegirDocumento();
      if (!archivo) return; // canceló
      setSubiendoHoja(true);
      const actualizado = await subirMiHojaDeVida(archivo);
      setDatos((prev) =>
        prev
          ? { ...prev, hoja_vida_url: actualizado.hoja_vida_url, hoja_vida_nombre: actualizado.hoja_vida_nombre }
          : prev
      );
      mostrarExito('Hoja de vida actualizada correctamente');
    } catch (err: any) {
      setErrorHoja(err?.message ?? 'No se pudo subir la hoja de vida.');
    } finally {
      setSubiendoHoja(false);
    }
  }

  async function guardar() {
    if (!hayCambios || guardando) return;
    const problema = validar();
    if (problema) {
      setErrorForm(problema);
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const actualizado = await actualizarMiPerfilInstructor(cambios);
      rellenar(actualizado);
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
                  <Text style={styles.subLinea}>Perfil del instructor</Text>
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
                  <Text style={styles.etiqueta}>Especialidad:</Text>
                  <TextInput
                    style={styles.pillEditable}
                    value={especialidad}
                    onChangeText={setEspecialidad}
                    placeholder="Ej. Python"
                    placeholderTextColor={PLACEHOLDER}
                    maxLength={150}
                  />
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
                      onPress={elegirYSubirHoja}
                      disabled={subiendoHoja}
                      accessibilityRole="button">
                      {subiendoHoja ? (
                        <ActivityIndicator color={VictoriaColors.darkGreen} size="small" />
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={16} color={VictoriaColors.darkGreen} />
                      )}
                      <Text style={styles.botonAdjuntarTexto}>
                        {subiendoHoja ? 'Subiendo…' : 'Adjuntar hoja de vida'}
                      </Text>
                    </Pressable>
                    <Text style={styles.ayuda}>PDF o Word, máximo 15 MB.</Text>
                  </View>
                )}
                {errorHoja ? <Text style={styles.error}>{errorHoja}</Text> : null}

                <View style={styles.divider} />

                <Text style={styles.seccion}>INFORMACION INSTITUCIONAL</Text>

                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Tipo de instructor</Text>
                  <Lectura
                    valor={datos.tipo_instructor ? TIPOS_INSTRUCTOR[datos.tipo_instructor] ?? datos.tipo_instructor : null}
                    vacio="Sin asignar"
                  />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Sede</Text>
                  <Lectura valor={datos.nombre_sede} vacio="Sin sede" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Coordinación</Text>
                  <Lectura valor={datos.nombre_coordinacion} vacio="Sin coordinación" />
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
      url={datos?.hoja_vida_url ?? null}
      nombreArchivo={nombreHojaCompleto ?? 'hoja_de_vida'}
      subiendo={subiendoHoja}
      onReemplazar={elegirYSubirHoja}
    />
    </>
  );
}