/**
 * Estilos de components/victoria/mi-perfil-instructor-modal.tsx
 * (misma estética "glass" que instructor-perfil.styles.ts).
 * Verde = casilla que el instructor SÍ puede editar; gris = solo lectura.
 */
import { StyleSheet } from 'react-native';
import { VictoriaColors, VictoriaRadius } from '@/constants/victoria-theme';

const VERDE_EDITABLE = 'rgba(143, 164, 126, 0.5)';
const GRIS_LECTURA = 'rgba(28, 53, 45, 0.1)';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: 'rgba(236, 241, 233, 0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    paddingTop: 22,
    paddingHorizontal: 26,
    paddingBottom: 8,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 10, paddingBottom: 18 },
  loader: { marginVertical: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: VictoriaColors.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { fontSize: 26, color: VictoriaColors.darkGreen },
  subLinea: { fontSize: 11, color: '#556b5c' },
  cerrar: { padding: 4, alignSelf: 'flex-start' },

  seccion: { fontSize: 12, letterSpacing: 0.5, color: VictoriaColors.darkGreen, marginTop: 10 },
  divider: { height: 1, backgroundColor: 'rgba(28, 53, 45, 0.25)', marginTop: 8 },

  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  etiqueta: { width: 118, fontSize: 13, color: VictoriaColors.textOnLight },
  valorLink: { flex: 1, fontSize: 13, color: '#556b5c', textDecorationLine: 'underline' },

  // Casillas
  pillEditable: {
    flex: 1,
    backgroundColor: VERDE_EDITABLE,
    borderRadius: VictoriaRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(20, 53, 32, 0.25)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    fontSize: 13,
    color: VictoriaColors.darkGreen,
    ...({ outlineStyle: 'none' } as object),
  },
  pillLectura: {
    flex: 1,
    backgroundColor: GRIS_LECTURA,
    borderRadius: VictoriaRadius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pillLecturaTexto: { fontSize: 13, color: '#556b5c' },

  // Documento: tipo (chips) + número
  docColumna: { flex: 1, gap: 6 },
  chipsTipo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipTipo: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: VictoriaRadius.pill,
    backgroundColor: 'rgba(143, 164, 126, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(20, 53, 32, 0.2)',
  },
  chipTipoActivo: { backgroundColor: VictoriaColors.darkGreen, borderColor: VictoriaColors.darkGreen },
  chipTipoTexto: { fontSize: 12, color: VictoriaColors.darkGreen },
  chipTipoTextoActivo: { color: VictoriaColors.white, fontWeight: '600' },
  ayuda: { fontSize: 10, color: 'rgba(28, 53, 45, 0.65)' },

  // Bloques de la información contractual (etiqueta arriba, casilla abajo)
  bloque: { gap: 4 },
  etiquetaBloque: { fontSize: 13, color: VictoriaColors.textOnLight },

  hojaVida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: VictoriaColors.mutedGreen,
    borderRadius: VictoriaRadius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  hojaVidaTexto: { flex: 1, fontSize: 13, color: VictoriaColors.darkGreen },

  adjuntarBloque: { alignItems: 'flex-start', gap: 4, marginTop: 4 },
  botonAdjuntar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: VictoriaRadius.pill,
    backgroundColor: 'rgba(143, 164, 126, 0.35)',
    borderWidth: 1,
    borderColor: VictoriaColors.mutedGreen,
  },
  botonAdjuntarTexto: { fontSize: 12, fontWeight: '600', color: VictoriaColors.darkGreen },

  error: { color: '#b3261e', fontSize: 12, marginTop: 4 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: VictoriaColors.darkGreen,
    borderRadius: VictoriaRadius.pill,
    paddingVertical: 13,
    marginTop: 8,
  },
  botonDeshabilitado: { opacity: 0.45 },
  botonTexto: { color: VictoriaColors.white, fontSize: 13, fontWeight: '600' },
});
