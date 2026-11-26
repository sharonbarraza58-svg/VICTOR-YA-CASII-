import { useEffect, useState } from 'react';
import { Image, Text, View, Platform } from 'react-native';
import { styles } from './TarjetaFecha.styles';

// Icono que va en el centro del círculo verde
const ICONO_CENTRO = require('@/assets/images/victoria/v-logo.png');

// Logo del SENA (recortado de tu diseño; va embebido, no necesitas archivo).
// Si tienes el archivo oficial en mejor calidad, guárdalo en
// assets/images/victoria/sena-logo.png y cambia la línea de abajo por:
//   const LOGO_SENA = require('@/assets/images/victoria/sena-logo.png');
const LOGO_SENA = { uri: 'data:image/png;base64,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' };

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fechaActual() {
  const hoy = new Date(); // calendario del dispositivo
  return { mes: MESES[hoy.getMonth()], anio: String(hoy.getFullYear()) };
}

const pct = (n: number): `${number}%` => `${n}%`;

/**
 * Capas apiladas para simular un desenfoque suave.
 * Van de afuera hacia adentro; la opacidad acumulada sigue una curva
 * suave (smoothstep) de 0 hasta `opacidadMax`, así no se notan "anillos".
 */
function capasSuaves(escalaExterior: number, escalaInterior: number, n: number, opacidadMax: number) {
  const suave = (t: number) => t * t * (3 - 2 * t);
  const capas: { escala: number; alpha: number }[] = [];
  let previo = 0;
  for (let i = 0; i < n; i++) {
    const escala = escalaExterior + ((escalaInterior - escalaExterior) * i) / (n - 1);
    const acumulado = opacidadMax * suave((i + 1) / n);
    const alpha = Math.min(0.99, 1 - (1 - acumulado) / (1 - previo));
    capas.push({ escala, alpha: Math.max(0, alpha) });
    previo = acumulado;
  }
  return capas;
}

// Se calculan una sola vez (no en cada render)
const CAPAS_OSCURAS = capasSuaves(1.2, 0.8, 28, 0.96);

/**
 * Vidrio esmerilado SIMULADO (se ve igual en web, Android e iOS).
 * Dibuja ya "desenfocado" lo que se vería a través del vidrio: la mitad
 * izquierda del círculo verde (oscura). La V desenfocada se hace aparte
 * (VDesenfocada) con la imagen real de la V.
 * Medidas en % de la columna de vidrio.
 */
function HaloVidrio() {
  // Círculo verde visto a través del vidrio
  const CX = 101.4;
  const CY = 49.3;
  const AN = 138.4;
  const AL = 41.1;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {CAPAS_OSCURAS.map((c, i) => (
        <View
          key={`d${i}`}
          style={{
            position: 'absolute',
            left: pct(CX - (AN * c.escala) / 2),
            top: pct(CY - (AL * c.escala) / 2),
            width: pct(AN * c.escala),
            height: pct(AL * c.escala),
            borderRadius: 999,
            backgroundColor: `rgba(31, 74, 45, ${c.alpha.toFixed(3)})`,
          }}
        />
      ))}
    </View>
  );
}


// Puntos para desenfocar la V: varias copias de la imagen desplazadas en
// círculos (centro + 6 + 12). Con opacidad 1/1, 1/2, 1/3... el resultado
// es el promedio de todas, o sea un desenfoque con la forma REAL de la V.
// Puntos repartidos en espiral (disco de Vogel): cubren el área de forma
// pareja, sin anillos visibles. Solo se usa en celular; en web se usa blur real.
const N_PUNTOS = 48;
const PUNTOS_BLUR: [number, number][] = Array.from({ length: N_PUNTOS }, (_, i): [number, number] => {
  const r = Math.sqrt((i + 0.5) / N_PUNTOS);
  const t = i * 2.399963; // ángulo áureo
  return [r * Math.cos(t), r * Math.sin(t)];
});


/**
 * La V vista a través del vidrio: misma posición, tamaño e inclinación que
 * la V de la tarjeta (iconoWrap en TarjetaFecha.styles.ts), pero desenfocada.
 * Si cambias left / top / width / rotate de iconoWrap, cambia también los
 * números de aquí (están convertidos a % de la columna de vidrio):
 *   left = (left de iconoWrap - 6) / 46.6 * 100
 *   top  = (top de iconoWrap - 2.6) / 95.4 * 100
 *   width = (width de iconoWrap) / 46.6 * 100
 */
function VDesenfocada({ ancho }: { ancho: number }) {
  if (ancho <= 0) return null;

  const posicion = {
    position: 'absolute' as const,
    left: pct(-2.575),
    top: pct(20.13),
    width: pct(210.3),
    aspectRatio: 1,
  };

  // Web: desenfoque real, suave y continuo.
  if (Platform.OS === 'web') {
    return (
      <View
        pointerEvents="none"
        style={[posicion, { filter: `blur(${(ancho * 0.035).toFixed(1)}px)` } as any]}>
        <Image
          source={ICONO_CENTRO}
          style={{ width: '100%', height: '100%', transform: [{ rotate: '8deg' }] }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Celular: muchas copias con opacidad 1/(i+1) = promedio = desenfoque.
  const radio = ancho * 0.065;
  return (
    <>
      {PUNTOS_BLUR.map(([fx, fy], i) => (
        <View
          key={`v${i}`}
          pointerEvents="none"
          style={[
            posicion,
            {
              opacity: 1 / (i + 1),
              transform: [{ translateX: fx * radio }, { translateY: fy * radio }],
            },
          ]}>
          <Image
            source={ICONO_CENTRO}
            style={{ width: '100%', height: '100%', transform: [{ rotate: '8deg' }] }}
            resizeMode="contain"
          />
        </View>
      ))}
    </>
  );
}

// Relieve: bordes grises que se van aclarando hacia adentro (sombra interior).
const ANILLOS_RELIEVE = [0.09, 0.07, 0.05, 0.035, 0.02, 0.01];

function ReliveVidrio() {
  return (
    <>
      {ANILLOS_RELIEVE.map((alpha, i) => (
        <View
          key={`r${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: i * 2,
            left: i * 2,
            right: i * 2,
            bottom: i * 2,
            borderRadius: Math.max(40 - i * 2, 0),
            borderWidth: 2,
            borderColor: `rgba(0, 0, 0, ${alpha})`,
          }}
        />
      ))}
    </>
  );
}

/**
 * Tarjeta del login: el mes y el año salen del calendario del dispositivo.
 * Todo va en porcentajes, así que escala con el ancho (maxWidth).
 *
 * FIX Android/Fabric: en el primer render `ancho` vale 0, lo que producía
 * fontSize = 0 y tumbaba la app ("FontSize should be a positive value").
 * Ahora los textos solo se renderizan cuando ya hay un ancho medido, y
 * además el tamaño tiene un mínimo de 1.
 */
export function TarjetaFecha() {
  const [fecha, setFecha] = useState(fechaActual);
  const [ancho, setAncho] = useState(0);

  // Si la app queda abierta al cambiar de mes, se actualiza sola.
  useEffect(() => {
    const id = setInterval(() => setFecha(fechaActual()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.card} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      <View style={styles.circulo} />

      {/* V grande: la mitad izquierda queda tapada por el vidrio */}
      <View style={styles.iconoWrap} pointerEvents="none">
        <Image source={ICONO_CENTRO} style={styles.icono} resizeMode="contain" />
      </View>

      {/* Columna de vidrio esmerilado */}
      <View style={styles.panel}>
        <HaloVidrio />
        <VDesenfocada ancho={ancho} />
        <ReliveVidrio />

        {ancho > 0 && (
          <>
            <Text
              style={[
                styles.mes,
                {
                  fontSize: Math.max(1, ancho * 0.17),
                  lineHeight: Math.max(1, ancho * 0.19),
                },
              ]}>
              {fecha.mes}
            </Text>
            <Text
              style={[
                styles.anio,
                {
                  fontSize: Math.max(1, ancho * 0.155),
                  lineHeight: Math.max(1, ancho * 0.17),
                },
              ]}>
              {fecha.anio}
            </Text>
          </>
        )}

        <Image source={LOGO_SENA} style={styles.logoSena} resizeMode="contain" />
      </View>
    </View>
  );
}