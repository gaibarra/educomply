# Fuentes self-hosted (Inter)

Este directorio alojará los archivos de fuente `Inter` en formato moderno (`woff2`).

## Descarga recomendada
Usa https://gwfh.mranftl.com/ (google-webfonts-helper) con:
- Fuente: Inter
- Estilos: normal
- Pesos: 400,500,600,700 (ajusta si necesitas menos o más)
- Subsets: latin y (si lo necesitas) latin-ext

Descarga el paquete y coloca los archivos `.woff2` aquí con nombres similares a:
```
inter-latin-400-normal.woff2
inter-latin-500-normal.woff2
inter-latin-600-normal.woff2
inter-latin-700-normal.woff2
# Si incluyes latin-ext añade también:
inter-latin-ext-400-normal.woff2
inter-latin-ext-500-normal.woff2
inter-latin-ext-600-normal.woff2
inter-latin-ext-700-normal.woff2
```

## CSS (@font-face)
El CSS para registrar las fuentes está en `fonts.css`. Si agregas o quitas pesos, o decides no usar latin-ext, actualiza ese archivo eliminando las reglas que no apliquen.

## Activación
En `index.tsx` (o un entry CSS global) importa `./public/fonts/fonts.css` (ajustar ruta según bundler) y quita el `<link>` a Google Fonts de `index.html` cuando estés listo para CSP estricta.

## CSP
Ejemplo de cabecera CSP mínima para fuentes self-hosted:
```
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; script-src 'self';
```

## Notas
- Mantén `font-display: swap` para buena performance.
- No incluyas formatos heredados (woff) salvo que necesites compatibilidad muy antigua.
