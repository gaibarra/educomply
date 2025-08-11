# Flujo: Reporte semanal de cumplimiento
1. Programar en Supabase (cron) un POST semanal a `/functions/v1/generate-report` con cuerpo `{"type":"predefined","reportType":"resumen_semanal"}`.
2. La función `generate-report` genera el Markdown/HTML y lo guarda en Storage (bucket `reports/` con nombre `reporte_{YYYY-MM-DD}.md`).
3. Enviar notificación (correo o WhatsApp via webhook) con el enlace del reporte.
4. (Opcional) Crear un `view` en el frontend para consultar historial desde Storage.
