import { Ionicons } from '@expo/vector-icons';
import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';

import { VictoriaColors } from '@/constants/victoria-theme';
import { abrirDocumento, urlAbsoluta } from '@/lib/documentos';
import { styles } from './hoja-vida-modal.styles';

type Tipo = 'pdf' | 'docx' | 'imagen' | 'otro';
type Estado = 'cargando' | 'listo' | 'sin-vista' | 'error';

function tipoDe(texto: string | null | undefined): Tipo {
  const t = (texto ?? '').toLowerCase().split('?')[0];
  if (t.endsWith('.pdf')) return 'pdf';
  if (t.endsWith('.docx')) return 'docx';
  if (/\.(png|jpe?g|webp)$/.test(t)) return 'imagen';
  return 'otro';
}

function mimeDe(texto: string | null | undefined): string {
  const t = (texto ?? '').toLowerCase().split('?')[0];
  if (t.endsWith('.png')) return 'image/png';
  if (t.endsWith('.webp')) return 'image/webp';
  if (/\.jpe?g$/.test(t)) return 'image/jpeg';
  return 'application/pdf';
}

/**
 * Cuerpo de la vista previa. En web descarga el archivo y lo muestra con una
 * URL blob: (un <iframe> directo a la API lo bloquearía X-Frame-Options: DENY).
 *  - PDF / imagen -> <iframe> / <img>.
 *  - .docx        -> se dibuja con `docx-preview`.
 *  - .doc antiguo y celular -> no hay vista previa; se ofrece abrirlo.
 */
function VistaPrevia({ url, nombre }: { url: string; nombre: string }) {
  const tipo = tipoDe(nombre) !== 'otro' ? tipoDe(nombre) : tipoDe(url);
  const nombreParaMime = tipoDe(nombre) !== 'otro' ? nombre : url;
  const [estado, setEstado] = useState<Estado>('cargando');
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxDatos, setDocxDatos] = useState<ArrayBuffer | null>(null);
  const contenedor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    let blobCreado: string | null = null;
    setError(null);
    setBlobUrl(null);
    setDocxDatos(null);

    if (Platform.OS !== 'web' || (tipo !== 'pdf' && tipo !== 'docx' && tipo !== 'imagen')) {
      setEstado('sin-vista');
      return;
    }
    // Navegadores sin visor de PDF mostrarían el iframe en blanco.
    if (tipo === 'pdf' && (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === false) {
      setEstado('sin-vista');
      return;
    }
    setEstado('cargando');

    (async () => {
      try {
        const respuesta = await fetch(urlAbsoluta(url), { cache: 'no-store' });
        if (!respuesta.ok) {
          throw new Error(
            respuesta.status === 404
              ? 'El archivo ya no está disponible en el servidor.'
              : 'No se pudo descargar el archivo.'
          );
        }
        const datos = await respuesta.arrayBuffer();
        if (cancelado) return;
        if (tipo === 'pdf' || tipo === 'imagen') {
          blobCreado = URL.createObjectURL(new Blob([datos], { type: mimeDe(nombreParaMime) }));
          setBlobUrl(blobCreado);
        } else {
          setDocxDatos(datos);
        }
        setEstado('listo');
      } catch (err) {
        if (cancelado) return;
        setError(err instanceof Error && err.message ? err.message : 'No se pudo conectar con el servidor.');
        setEstado('error');
      }
    })();

    return () => {
      cancelado = true;
      if (blobCreado) URL.revokeObjectURL(blobCreado);
    };
  }, [url, tipo, nombreParaMime]);

  // Un .docx se dibuja dentro del contenedor cuando ya existe en pantalla.
  useEffect(() => {
    if (tipo !== 'docx' || estado !== 'listo' || !docxDatos || !contenedor.current) return;
    const destino = contenedor.current;
    let cancelado = false;
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelado) return;
        destino.innerHTML = '';
        await renderAsync(docxDatos, destino, undefined, { className: 'victoria-docx', breakPages: true });
      } catch {
        if (cancelado) return;
        setError('No se pudo mostrar este documento Word. Puedes abrirlo para verlo.');
        setEstado('error');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tipo, estado, docxDatos]);

  if (estado === 'cargando') {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator color={VictoriaColors.darkGreen} />
        <Text style={styles.mensaje}>Cargando hoja de vida…</Text>
      </View>
    );
  }
  if (estado === 'error') {
    return (
      <View style={styles.centrado}>
        <Text style={[styles.mensaje, styles.mensajeError]}>{error}</Text>
      </View>
    );
  }
  if (estado === 'sin-vista') {
    return (
      <View style={styles.centrado}>
        <Ionicons name="document-text-outline" size={34} color={VictoriaColors.mutedGreen} />
        <Text style={styles.mensaje}>
          {Platform.OS !== 'web'
            ? 'En el celular la hoja de vida se abre en su propia aplicación. Usa “Abrir en una nueva pestaña”.'
            : 'Este archivo no tiene vista previa en el navegador (por ejemplo, un Word .doc antiguo). Ábrelo o descárgalo para verlo.'}
        </Text>
      </View>
    );
  }
  if (tipo === 'pdf' && blobUrl) {
    return createElement('iframe', {
      src: `${blobUrl}#toolbar=0&navpanes=0&view=FitH`,
      title: 'Hoja de vida',
      style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' },
    });
  }
  if (tipo === 'imagen' && blobUrl) {
    return createElement('img', {
      src: blobUrl,
      alt: 'Hoja de vida',
      style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#ffffff' },
    });
  }
  return createElement('div', {
    ref: contenedor,
    style: { width: '100%', height: '100%', overflow: 'auto', backgroundColor: '#e9ece7' },
  });
}

/** Nombre a mostrar de la hoja de vida: el guardado al subirla o, si no hay, el que trae la URL. */
export function nombreDeHojaVida(url: string | null | undefined, nombreGuardado?: string | null): string | null {
  if (!url) return null;
  if (nombreGuardado) return nombreGuardado;
  const ultimo = url.split('?')[0].split('/').pop() ?? 'hoja_de_vida';
  try {
    return decodeURIComponent(ultimo);
  } catch {
    return ultimo;
  }
}

/** Baja el archivo con su nombre original (web) o lo abre en el visor del sistema (celular). */
async function descargar(url: string, nombre: string) {
  if (Platform.OS !== 'web') {
    abrirDocumento(url);
    return;
  }
  try {
    const respuesta = await fetch(urlAbsoluta(url), { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('descarga fallida');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(await respuesta.blob());
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  } catch {
    abrirDocumento(url); // si falla la descarga directa, al menos se abre
  }
}

/**
 * Ventana con la vista previa de la hoja de vida del instructor, con los
 * botones: abrir en una pestaña nueva, descargar y reemplazar.
 */
export function HojaVidaModal({
  visible,
  onClose,
  nombreInstructor,
  subtitulo = 'Perfil del instructor',
  url,
  nombreArchivo,
  subiendo,
  onReemplazar,
}: {
  visible: boolean;
  onClose: () => void;
  nombreInstructor: string;
  /** Texto bajo el nombre; por defecto "Perfil del instructor". */
  subtitulo?: string;
  url: string | null;
  nombreArchivo: string;
  subiendo: boolean;
  onReemplazar: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="layers-outline" size={18} color={VictoriaColors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre} numberOfLines={1}>
                {nombreInstructor}
              </Text>
              <Text style={styles.subLinea}>{subtitulo}</Text>
            </View>
            <Pressable style={styles.cerrar} onPress={onClose} hitSlop={8} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={20} color={VictoriaColors.darkerGreen} />
            </Pressable>
          </View>
          <View style={styles.divider} />

          <View style={styles.previewArea}>
            {visible && url ? <VistaPrevia key={url} url={url} nombre={nombreArchivo} /> : null}
          </View>

          <View style={styles.footer}>
            <View style={styles.footerGrupo}>
              <Pressable style={styles.botonClaro} onPress={() => abrirDocumento(url)} accessibilityRole="button">
                <Ionicons name="eye-outline" size={16} color={VictoriaColors.white} />
                <Text style={styles.botonTexto}>Abrir en una nueva pestaña</Text>
              </Pressable>
              <Pressable
                style={styles.botonClaro}
                onPress={() => url && descargar(url, nombreArchivo)}
                accessibilityRole="button">
                <Ionicons name="download-outline" size={16} color={VictoriaColors.white} />
                <Text style={styles.botonTexto}>Descargar</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.botonOscuro, subiendo && styles.botonDeshabilitado]}
              onPress={onReemplazar}
              disabled={subiendo}
              accessibilityRole="button">
              {subiendo ? (
                <ActivityIndicator color={VictoriaColors.white} size="small" />
              ) : (
                <Ionicons name="document-text-outline" size={16} color={VictoriaColors.white} />
              )}
              <Text style={styles.botonTexto}>{subiendo ? 'Subiendo…' : 'Reemplazar hoja de vida'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}