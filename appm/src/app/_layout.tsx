import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { VictoriaToastProvider } from '@/components/victoria/toast';
import { haySesionActiva } from '@/lib/auth';


// Solo web: evita seleccionar texto/iconos, cursor de texto y barra de scroll delgada
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('victoria-global-web')) {
  const style = document.createElement('style');
  style.id = 'victoria-global-web';
  style.textContent = `
    body { cursor: default; }
    * { user-select: none !important; -webkit-user-select: none !important; }
    input, textarea, [contenteditable="true"] {
      user-select: text !important;
      -webkit-user-select: text !important;
      cursor: text;
    }

    *::-webkit-scrollbar { width: 8px; height: 8px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.85);
      border-radius: 999px;
    }
    *::-webkit-scrollbar-thumb:hover { background: #ffffff; }
    *::-webkit-scrollbar-button:single-button {
      display: block;
      height: 12px;
      width: 8px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 8px;
    }
    *::-webkit-scrollbar-button:single-button:vertical:decrement {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 2 L9 8 H1 Z' fill='white' fill-opacity='0.85'/></svg>");
    }
    *::-webkit-scrollbar-button:single-button:vertical:increment {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 8 L9 2 H1 Z' fill='white' fill-opacity='0.85'/></svg>");
    }

    @supports not selector(::-webkit-scrollbar) {
      * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.85) transparent; }
    }
  `;
  document.head.appendChild(style);
}
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Cada vez que el usuario usa Atrás/Adelante (popstate) y NO hay
    // sesión activa, en vez de solo "mandarlo" al login, volvemos a
    // empujar /login HACIA ADELANTE en el historial. Es una trampa: no
    // importa cuántas veces le dé a Atrás, cada intento choca con esta
    // nueva entrada y nunca llega a asentarse en una pantalla protegida.
    function protegerHistorial() {
      if (!haySesionActiva()) {
        window.history.pushState(null, '', '/login');
        router.replace('/login');
      }
    }

    window.addEventListener('popstate', protegerHistorial);
    return () => window.removeEventListener('popstate', protegerHistorial);
  }, []);

  return (
    <VictoriaToastProvider>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </VictoriaToastProvider>
  );
}
