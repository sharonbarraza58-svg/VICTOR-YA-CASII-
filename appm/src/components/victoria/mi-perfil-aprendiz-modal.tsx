import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { router } from 'expo-router';

import { useVictoriaToast } from '@/components/victoria/toast';
import { cerrarSesion } from '@/lib/auth';
import { VictoriaColors } from '@/constants/victoria-theme';
import { calcularEdad, capitalizar, etiquetaTrimestre, formatearFechaLarga } from '@/lib/formato-perfil';
import {
  actualizarMiPerfilAprendiz,
  type CambiosMiPerfilAprendiz,
  type MiPerfilAprendiz,
  obtenerMiPerfilAprendiz,
  TIPOS_DOCUMENTO,
} from '@/lib/mi-perfil-aprendiz';
// Misma estética que la ventana del instructor: se reutilizan sus estilos.
import { styles } from './mi-perfil-instructor-modal.styles';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^[0-9+()\-\s]{7,20}$/;
const REGEX_DOCUMENTO = /^[A-Za-z0-9]{4,20}$/;
const PLACEHOLDER = 'rgba(28, 53, 45, 0.5)';

/** Casilla de solo lectura (gris). */
function Lectura({ valor, vacio = 'No registrado' }: { valor: string | null | undefined; vacio?: string }) {
  return (
    <View style={styles.pillLectura}>
      <Text style={styles.pillLecturaTexto}>{valor || vacio}</Text>
    </View>
  );
}

/**
 * Ventana emergente "Actualizar datos" del aprendiz. Muestra toda su
 * información (tabla Usuario + Ficha + Programa). Solo se pueden editar las
 * casillas VERDES: correo personal, teléfono y documento; el resto (correo
 * SENA, ficha, programa, estado...) lo gestiona el instructor o el
 * coordinador y aquí es de solo lectura.
 */
export function MiPerfilAprendizModal({
  visible,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado?: () => void;
}) {
  const { mostrarExito, mostrarInfo } = useVictoriaToast();
  const [datos, setDatos] = useState<MiPerfilAprendiz | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoDoc, setTipoDoc] = useState('CC');
  const [numDoc, setNumDoc] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  function rellenar(p: MiPerfilAprendiz) {
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
    obtenerMiPerfilAprendiz()
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
  const cambios: CambiosMiPerfilAprendiz = {};
  if (datos) {
    if (correo.trim() !== (datos.correo_personal ?? '')) cambios.correo_personal = correo.trim();
    if (telefono.trim() !== (datos.telefono ?? '')) cambios.telefono = telefono.trim() || null;
    if (tipoDoc !== (datos.tipo_documento ?? '')) cambios.tipo_documento = tipoDoc;
    if (numDoc.trim() !== (datos.numero_documento ?? '')) cambios.numero_documento = numDoc.trim();
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
    return null;
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
      const actualizado = await actualizarMiPerfilAprendiz(cambios);
      rellenar(actualizado);
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
  const edad = datos ? calcularEdad(datos.fecha_nacimiento) : null;
  const nacimiento = datos
    ? [formatearFechaLarga(datos.fecha_nacimiento), edad != null ? `${edad} años` : ''].filter(Boolean).join(' · ')
    : '';

  return (
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
                  <Text style={styles.subLinea}>Perfil del aprendiz</Text>
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
                  <Lectura valor={nacimiento} />
                </View>

                <View style={styles.fila}>
                  <Ionicons name="ribbon-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>Número Ficha:</Text>
                  <Lectura valor={datos.numero_ficha} vacio="Sin ficha asignada" />
                </View>

                <View style={styles.fila}>
                  <Ionicons name="briefcase-outline" size={18} color="#556b5c" />
                  <Text style={styles.etiqueta}>Programa:</Text>
                  <Lectura valor={datos.nombre_programa} vacio="Sin programa" />
                </View>

                <View style={styles.divider} />

                <Text style={styles.seccion}>INFORMACION ACADEMICA</Text>

                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Estado</Text>
                  <Lectura valor={capitalizar(datos.estado)} vacio="Sin estado" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Nivel de formación</Text>
                  <Lectura valor={capitalizar(datos.nivel_formacion)} vacio="Sin definir" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Trimestre actual</Text>
                  <Lectura valor={etiquetaTrimestre(datos.trimestre)} vacio="Sin definir" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Horario</Text>
                  <Lectura valor={capitalizar(datos.horario)} vacio="Sin definir" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Inicio de la ficha</Text>
                  <Lectura valor={formatearFechaLarga(datos.fecha_inicio_ficha)} vacio="Sin definir" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Fin de la ficha</Text>
                  <Lectura valor={formatearFechaLarga(datos.fecha_fin_ficha)} vacio="Sin definir" />
                </View>
                <View style={styles.bloque}>
                  <Text style={styles.etiquetaBloque}>Instructor jefe de la ficha</Text>
                  <Lectura valor={datos.nombre_director} vacio="Sin asignar" />
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
  );
}