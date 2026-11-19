# Uso de inteligencia artificial

## Herramientas y alcance

Se utilizó **OpenAI Codex** como asistente para analizar requisitos, proponer la arquitectura, generar la implementación inicial, redactar pruebas y documentación, ejecutar verificaciones y revisar resultados visuales. También se realizó una revisión de código con un agente independiente de Codex, enfocada en errores de concurrencia, sesión y recuperación.

La asistencia abarcó contratos TypeScript/Zod, Route Handlers, servicio mock, componentes React, CSS, tests unitarios/E2E y documentación técnica. Se consultaron documentación de Next.js y los estilos públicos de Spin como referencias. Las herramientas de pruebas y análisis verificaron el código ejecutándolo; sus resultados no se sustituyeron por afirmaciones del asistente.

## Propuestas aceptadas

- Separación entre rutas, funcionalidades, contratos y servicio mock.
- Centavos enteros para dinero y validación compartida con comprobación del servidor.
- Estado local de interacción, Zustand para conservar borrador/intención entre rutas y TanStack Query para datos remotos, sin duplicar saldo ni comprobantes.
- Idempotencia para reintentos, escenarios aleatorios con controles reproducibles y pruebas automatizadas.

## Qué se corrigió o descartó

- Se descartó una recomendación visual genérica de la herramienta de UI porque no correspondía a esta wallet. Se construyó una interfaz específica a partir de referencias públicas y criterios de accesibilidad.
- Se corrigió la normalización de errores durante hot reload: un error conocido no debía convertirse en un 500 genérico por proceder de otra instancia del módulo.
- Se corrigió un contraste de texto detectado por axe y selectores E2E que confundían anuncios de rutas del framework con mensajes de la aplicación.
- La revisión independiente identificó la pérdida de claves de idempotencia al desmontar una pantalla; se agregó recuperación de pendientes por wallet en `sessionStorage`.
- Se vinculó cada escritura a una generación pública de wallet y se sincronizaron cambios de sesión entre pestañas, para evitar confirmar una intención bajo otra sesión.
- Se fijó el destinatario del resumen al payload revisado y se bloqueó la revisión durante el alta de un contacto.
- Se endureció la validación de email, se agregó recuperación ante sesión vencida y se actualiza el saldo después de un rechazo por fondos insuficientes.
- Se descartó forzar una versión inexistente de una dependencia transitiva; la limitación de la auditoría quedó documentada en README.
- Se corrigió la caché de una sesión anterior al volver a entrar en la misma pestaña y se aisló por wallet. Una revisión posterior reprodujo una respuesta tardía que repoblaba la caché antes del desmontaje de React; se añadió invalidación síncrona del flujo y una prueba de regresión.
- Se separó la consulta del resultado (GET sin efectos) del reenvío idempotente (POST). La recuperación se probó también cortando la respuesta HTTP después del débito.
- Se conservaron formulario y datos ante un fallo de actualización en segundo plano, se restauró foco al editar/guardar contactos y se aumentó la legibilidad de destinatarios en móvil.
- Se añadieron referencias de solicitud y logs con campos permitidos; se descartó registrar cuerpos completos o afirmar que esos logs constituyen monitoreo distribuido.
- Se sustituyeron nombres escritos en componentes por datos de sesión/comprobante, y se unificó la zona horaria.

## Decisiones humanas y revisión final

Las decisiones técnicas documentadas fueron propuestas y desarrolladas con asistencia de IA. **No se atribuyen al candidato decisiones técnicas exclusivamente humanas que todavía no se hayan registrado.** Esta sección debe completarse después de que el candidato revise el código: qué decisiones mantiene por criterio propio, cuáles modifica y qué implementa o verifica personalmente.

La validación automatizada no acredita por sí sola comprensión del código. Antes de entregar, corresponde al candidato ejecutar los flujos, revisar las limitaciones, declarar su tiempo real y confirmar que puede explicar y modificar la solución. No debe presentar generación asistida como implementación manual ni pruebas locales como certificación de producción.
