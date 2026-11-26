/**
 * Estilos de components/victoria/confirmar-eliminar-modal.tsx
 */
import { StyleSheet } from 'react-native';
import { VictoriaColors, VictoriaRadius } from '@/constants/victoria-theme';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(236, 241, 233, 0.97)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: 26,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(155, 44, 44, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: VictoriaColors.darkGreen,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: VictoriaColors.textOnLight,
  },
  error: {
    color: '#b3261e',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    borderRadius: VictoriaRadius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    backgroundColor: 'rgba(28, 53, 45, 0.1)',
  },
  cancelText: {
    color: VictoriaColors.textOnLight,
    fontSize: 14,
    fontWeight: '600',
  },
  confirm: {
    backgroundColor: '#9b2c2c',
  },
  confirmText: {
    color: VictoriaColors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});
