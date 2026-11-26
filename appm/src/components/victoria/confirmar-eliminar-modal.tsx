import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { styles } from './confirmar-eliminar-modal.style';

/**
 * Confirmación antes de eliminar algo (sede, programa, ficha, aprendiz o
 * instructor). Alert no funciona en web, así que se usa un modal propio.
 *
 * `onConfirmar` debe hacer la eliminación y LANZAR un Error si falla: el
 * mensaje se muestra aquí mismo y el modal sigue abierto. Si termina bien, el
 * modal se cierra solo (llamando a `onCancelar`).
 */
export function ConfirmarEliminarModal({
  visible,
  titulo,
  mensaje,
  etiquetaConfirmar = 'Eliminar',
  onCancelar,
  onConfirmar,
}: {
  visible: boolean;
  titulo: string;
  mensaje: string;
  etiquetaConfirmar?: string;
  onCancelar: () => void;
  onConfirmar: () => Promise<void>;
}) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEliminando(false);
      setError(null);
    }
  }, [visible]);

  async function confirmar() {
    setEliminando(true);
    setError(null);
    try {
      await onConfirmar();
      onCancelar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <Pressable style={styles.backdrop} onPress={eliminando ? undefined : onCancelar}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="trash-outline" size={24} color="#9b2c2c" />
          </View>
          <Text style={styles.title}>{titulo}</Text>
          <Text style={styles.message}>{mensaje}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancel, eliminando && styles.disabled]}
              onPress={onCancelar}
              disabled={eliminando}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirm, eliminando && styles.disabled]}
              onPress={confirmar}
              disabled={eliminando}>
              {eliminando ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmText}>{etiquetaConfirmar}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
