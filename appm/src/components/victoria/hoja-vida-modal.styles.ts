/**
 * Estilos de components/victoria/hoja-vida-modal.tsx
 * (misma estética "glass" que el resto de modales del instructor).
 */
import { StyleSheet } from 'react-native';
import { VictoriaColors, VictoriaRadius } from '@/constants/victoria-theme';

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
    maxWidth: 720,
    height: '88%',
    maxHeight: 640,
    backgroundColor: 'rgba(236, 241, 233, 0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    paddingTop: 22,
    paddingHorizontal: 26,
    paddingBottom: 22,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  divider: { height: 1, backgroundColor: 'rgba(28, 53, 45, 0.3)', marginTop: 10 },

  previewArea: {
    flex: 1,
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(28, 53, 45, 0.12)',
  },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  mensaje: { fontSize: 13, color: '#556b5c', textAlign: 'center', maxWidth: 420 },
  mensajeError: { color: '#b3261e' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  footerGrupo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  botonClaro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: VictoriaColors.mutedGreen,
    borderRadius: VictoriaRadius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  botonOscuro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: VictoriaColors.darkGreen,
    borderRadius: VictoriaRadius.pill,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  botonDeshabilitado: { opacity: 0.55 },
  botonTexto: { color: VictoriaColors.white, fontSize: 13, fontWeight: '600' },
});