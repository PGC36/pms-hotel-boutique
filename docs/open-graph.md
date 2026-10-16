# Vista previa de enlaces (Open Graph)

Cuando alguien comparte el sitio por WhatsApp, Facebook, Instagram o Messenger, Meta
lee las etiquetas `og:*` de `index.html` y arma la tarjeta con título, descripción y
miniatura.

- **Imagen:** `public/og-image.png`, de 1200×630 px y menos de 300 KB. Vite la copia
  a la raíz del build.
- **Textos:** `og:title` y `og:description` en `index.html`.
- **Dominio:** Meta exige URLs absolutas. `vite.config.ts` reemplaza `%SITE_URL%`
  por `VITE_PUBLIC_SITE_URL`; si está vacía, usa `https://aurora.codisea.tech`.
  En producción no hace falta definirla.

El sitio es una SPA y el lector de Meta (`facebookexternalhit`) no ejecuta
JavaScript, así que todas las rutas comparten la misma tarjeta.

## Probar sin desplegar

Meta tiene que poder descargar la página y la imagen desde internet, así que se
expone el build local con un túnel temporal de Cloudflare. No hace falta cuenta.

1. Instalar `cloudflared` una vez: `winget install Cloudflare.cloudflared`.
2. En una terminal, abrir el túnel: `cloudflared tunnel --url http://localhost:4173`.
   Imprime una URL del tipo `https://<algo>.trycloudflare.com`.
3. En otra terminal, compilar con esa URL y servir el build:

   ```powershell
   $env:VITE_PUBLIC_SITE_URL = "https://<algo>.trycloudflare.com"
   npm run build
   npm run preview -- --port 4173 --strictPort
   ```

4. Pegar la URL del túnel en https://developers.facebook.com/tools/debug/
   (pide iniciar sesión en Facebook) y pulsar **Depurar** o **Volver a extraer**.
   Muestra la tarjeta tal como la verán WhatsApp y Facebook, y avisa si falta algo.
   También se puede mandar el enlace por WhatsApp a uno mismo.
5. Cerrar el túnel (Ctrl+C) y borrar la variable con
   `Remove-Item Env:VITE_PUBLIC_SITE_URL` antes de cualquier otro build.

Para revisar solo las etiquetas, sin la tarjeta: `npm run build && npm run preview`
y ver el código fuente de http://localhost:4173 y la imagen en
http://localhost:4173/og-image.png.

## Después de cambiar la imagen en producción

Meta y WhatsApp guardan la tarjeta en caché. Pasar la URL por el depurador de Meta
y pulsar **Volver a extraer**. WhatsApp puede tardar más; para comprobarlo al
momento, compartir la URL con un parámetro (`https://aurora.codisea.tech/?v=2`).
