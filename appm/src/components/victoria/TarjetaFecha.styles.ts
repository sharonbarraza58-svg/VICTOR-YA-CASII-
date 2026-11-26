/**
 * Estilos de components/victoria/TarjetaFecha.tsx
 * (extraídos del .tsx para mantener la pantalla ordenada).
 */
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 522 / 860,
    backgroundColor: '#f5f5f5',
    borderRadius: 40,
    overflow: 'hidden',
  },

  // Círculo verde. Su centro (53% / 50%) es el que usa el halo del
  // vidrio en el .tsx, así que si lo mueves hay que mover también el halo.
  circulo: {
    position: 'absolute',
    left: '21%',
    top: '30%',
    width: '64.5%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#1f4a2d',
  },

  // V grande. El PNG trae margen transparente, por eso el cuadro es más
  // grande que la tarjeta. La V queda "a la mitad": la parte izquierda
  // queda tapada por la columna de vidrio y solo se ve la derecha.
  //   - Más grande / más pequeña: cambia "width".
  //   - Mover a los lados: cambia "left".  - Subir / bajar: cambia "top".
  //   - Inclinación: cambia "rotate" (más grados = más inclinada a la derecha).
  iconoWrap: {
    position: 'absolute',
    left: '4.8%',
    top: '21.8%',
    width: '98%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '8deg' }],
  },
  icono: {
    width: '100%',
    height: '100%',
  },

  // Columna de vidrio esmerilado (opaca, con el halo dibujado adentro).
  panel: {
    position: 'absolute',
    left: '6%',
    top: '2.6%',
    bottom: '2%',
    width: '46.6%',
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    paddingTop: '3.5%',
  },
  mes: {
    color: '#111111',
    fontWeight: '300',
  },
  anio: {
    color: '#8a8a8a',
    fontWeight: '300',
  },

  // Logo del SENA, abajo en la columna de vidrio.
  logoSena: {
    position: 'absolute',
    bottom: '6%',
    width: '30%',
    aspectRatio: 220 / 213,
  },
});