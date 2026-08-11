# ssave - Convertidor y Descargador de Redes Sociales

**ssave** es una aplicación web moderna, rápida y limpia diseñada para descargar y convertir multimedia de redes sociales (YouTube y X/Twitter) a formatos MP4 y MP3 con selección de múltiples resoluciones.

## 🚀 Características

- 🎥 **Soporte para YouTube y X (Twitter)**: Descarga videos y audios directamente desde enlaces de estas plataformas.
- 📐 **Selección Múltiple de Resoluciones (MP4)**: Detecta automáticamente las calidades disponibles (1080p, 720p, 480p, etc.) y las fusiona en tiempo real con el mejor audio.
- 🎵 **Extracción de Audio (MP3)**: Transcodificación en tiempo real usando FFmpeg a códec MP3 de alta fidelidad.
- 🌓 **Modo Oscuro / Claro**: Interfaz basada en glassmorphism inspirada en *Calnotas*, optimizada para tema oscuro por defecto.
- 🌐 **Soporte Multilingüe (EN/ES)**: Selector desplegable para cambiar entre Inglés y Español fácilmente.
- ⚡ **Construido con Next.js 14 App Router & Tailwind CSS**.

## 🛠️ Tecnologías Utilizadas

- **Framework**: [Next.js 14](https://nextjs.org/) (React, App Router, TypeScript)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Componentes UI**: [Shadcn UI](https://ui.shadcn.com/) & [Lucide Icons](https://lucide.dev/)
- **Procesamiento de Video**: `yt-dlp` (`youtube-dl-exec`)
- **Procesamiento de Audio**: `fluent-ffmpeg` & `@ffmpeg-installer`
- **Gestión de Tema**: `next-themes`

## 📦 Instalación y Configuración Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Jonathan-DLC/ssave.git
   cd ssave
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación en funcionamiento.

## 📜 Licencia

Este proyecto está bajo la licencia MIT.

