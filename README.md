# Spin · Mini Wallet

Una simulación de wallet construida con Next.js y TypeScript. Permite iniciar una sesión demo, consultar saldo y movimientos, guardar contactos, revisar un envío y obtener su comprobante. Conserva borradores entre pantallas, recupera operaciones inciertas y ofrece escenarios reproducibles y diagnóstico por solicitud.

**No mueve dinero real ni autentica identidades.** Está diseñada para ejecutarse como un único proceso local de Node.js.

## Vista previa

![Home de la wallet](docs/screenshots/home.png)

[Login](docs/screenshots/login.png) · [Home móvil](docs/screenshots/home-mobile.png) · [Envío móvil](docs/screenshots/transfer-mobile.png) · [Revisión del envío](docs/screenshots/review.png) · [Comprobante](docs/screenshots/receipt.png)

## Ejecutar

Node compatible: `^20.19.0 || ^22.13.0 || >=24.0.0`. `.nvmrc` selecciona Node 24; la verificación local se realizó con Node 20.20.1 y npm 10.8.2.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abre [localhost:3000](http://localhost:3000). Pulsa **Usar cuenta de prueba** y después **Entrar a mi wallet**. También acepta un correo válido o un teléfono de 10 dígitos. No se requiere contraseña.

Para usar otro puerto:

```bash
npm run dev -- --port 3100
```

### Compilación de producción local

```bash
npm run build
npm start
```

Los datos se reinician al cambiar de proceso. Si tenías una sesión anterior, vuelve a iniciar sesión. No ejecutes varias réplicas de esta demo: cada proceso tendría su propia memoria.

## Recorrido de evaluación

1. **Login:** usa `alex@demo.mx` o `5512345678`. `error@demo.mx` produce un error simulado recuperable.
2. **Inicio:** saldo inicial **$24,500.00 MXN**, usuario ficticio y movimientos recientes. El icono del ojo oculta el saldo.
3. **Contactos:** crea una persona por nombre y teléfono/correo; permanece en la sesión del servidor y está disponible en transferencias.
4. **Enviar dinero:** elige contacto, ingresa monto y concepto opcional. Los atajos de monto son editables. No se cobra comisión en esta simulación.
5. **Revisar envío:** verifica destinatario, monto y total antes de confirmar. Editar conserva los datos del formulario.
6. **Comprobante:** referencia, importe, contacto, concepto y fecha en Ciudad de México. Se puede recargar y abrir desde los movimientos. **Guardar comprobante** abre la impresión del navegador; selecciona Guardar como PDF.
7. **Continuidad:** escribe un borrador, visita Contactos y vuelve. Durante un envío puedes ir a Inicio: el aviso indica su estado sin sacarte de la pantalla. «Hacer otro envío» inicia una intención nueva.

### Laboratorio de la demo

Con `NEXT_PUBLIC_DEMO_CONTROLS=true`, aparece un panel desplegable al final del Home y de Transferencias:

| Pantalla      | Control                                      | Qué permite comprobar                                                                                               |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Home          | Normal / Sin movimientos / Error de servicio | Carga, lista, vacío, error y recuperación sin borrar datos                                                          |
| Transferencia | Aleatorio                                    | 60% éxito; 10% cada uno: red, fondos insuficientes, timeout y desconocido                                           |
| Transferencia | Éxito                                        | Saldo actualizado y comprobante                                                                                     |
| Transferencia | Error de red                                 | Fallo 503 simulado; verificar resultado y, si es desconocido, seleccionar Éxito y reintentar el mismo envío         |
| Transferencia | Fondos insuficientes                         | Rechazo 422 y actualización de saldo; también ocurre realmente al exceder el disponible                             |
| Transferencia | Timeout                                      | Simula un cargo confirmado cuya respuesta se perdió; **Verificar resultado** recupera el comprobante sin otro cargo |
| Transferencia | Error desconocido                            | Fallback 500; consultar resultado y, si sigue desconocido, reintentar la misma intención                            |

El escenario forzado se mantiene seleccionado hasta cambiarlo; un reintento de un fallo de red forzado vuelve a fallar mientras siga seleccionado. Un pago ya confirmado devuelve siempre su comprobante, independientemente del escenario posterior.

La UI trata los errores ambiguos como operaciones pendientes: conserva la misma clave. **Verificar resultado** hace un GET sin efectos. `unknown` no demuestra que el primer intento haya fallado; se permite consultar de nuevo o reintentar expresamente el mismo envío. La intención enviada se recupera en esa pestaña mediante `sessionStorage`; un borrador todavía no enviado vive solo en memoria entre rutas. El cliente cancela solicitudes que superen **8 segundos**; cancelar el fetch no revierte un pago. El timeout demostrativo del servidor responde 504 tras 1.8 segundos para no hacer lenta la evaluación.

Si desactivas los controles y reinicias/recompilas, los headers de simulación se ignoran; las transferencias siguen siendo aleatorias. `NEXT_PUBLIC_` es configuración pública de build, nunca un secreto.

## Verificación

Antes de ejecutar E2E en desarrollo, detén con `Ctrl+C` cualquier `npm run dev` de este mismo proyecto y deja libre el puerto 3100. Next.js bloquea un segundo servidor de desarrollo que utilice el mismo directorio de compilación, aunque escuche en otro puerto. Playwright inicia y detiene su propio servidor.

```bash
npm run check           # formato, lint, tipos, unitarias y build
# Equivalente:
make ci

npx playwright install chromium
npm run test:e2e        # inicia servidor de prueba en 3100 si está libre
npm run test:e2e:ui     # exploración interactiva de pruebas
npm run test:watch      # pruebas unitarias durante cambios
npm run format         # aplicar formato
```

La suite cubre reglas de negocio, estados compartidos, sesiones, idempotencia, recuperación, diagnóstico y accesibilidad.

Playwright ejecuta Chromium en escritorio y viewport móvil. La emulación móvil no sustituye pruebas en Safari/iOS reales. Usa contextos de sesión independientes y datos mock locales; no llama servicios financieros externos. Las pruebas incluyen axe sobre login, Home, resumen y comprobante.

Para verificar el build de producción, deja libre el puerto 3100:

```bash
NEXT_PUBLIC_DEMO_CONTROLS=true npm run build
E2E_PRODUCTION=true npm run test:e2e
```

Para comprobar el build con laboratorio deshabilitado:

```bash
NEXT_PUBLIC_DEMO_CONTROLS=false npm run build
NEXT_PUBLIC_DEMO_CONTROLS=false E2E_PRODUCTION=true E2E_DEMO_DISABLED=true npm run test:e2e -- --project=desktop
```

Después recompila con `NEXT_PUBLIC_DEMO_CONTROLS=true` para volver a demostrar escenarios deterministas. Las operaciones normales siguen siendo aleatorias cuando el laboratorio está apagado.

En PowerShell configura las variables con `$env:NEXT_PUBLIC_DEMO_CONTROLS="true"` y `$env:E2E_PRODUCTION="true"` antes del comando correspondiente.

Última verificación local, **19 de noviembre de 2026**:

- `npm run check`: formato, lint, tipos, **116 pruebas unitarias/de componentes** y build correctos.
- Build de producción con laboratorio: **48 pruebas E2E** correctas, entre escritorio y viewport móvil.
- Build de producción sin laboratorio: **1 smoke test** correcto.
- `npm audit --omit=dev`: **0 vulnerabilidades** reportadas. La alerta de herramientas de desarrollo se detalla en límites conocidos.
- Build final recompilado con laboratorio habilitado para facilitar la evaluación.

## Estructura

```text
src/
  app/                     Rutas, layouts, errores globales y API
    (wallet)/              Rutas con comprobación de sesión en servidor
    api/                   Session, wallet, contacts, transfers y operations
  features/
    auth/                  Formulario de acceso y frontera de sesión
    contacts/              Alta y búsqueda de contactos
    wallet/                Home y consulta de saldo/movimientos
    transfers/             Store Zustand, provider, formulario, revisión, aviso y comprobante
  components/              Shell, proveedores y UI compartida
  lib/                     Contratos Zod, dinero, HTTP, errores y eventos de sesión
  server/                  Servicio mock, fixtures, simulación, configuración y diagnóstico HTTP
tests/e2e/                 Flujos reales contra API y navegador
tests/smoke/               Build sin laboratorio
```

Los archivos `.test.ts(x)` están junto a las unidades que prueban. `next-env.d.ts` se genera automáticamente y no se versiona. `AGENTS.md` contiene las indicaciones que genera Next.js para sus herramientas.

## Librerías y propósito

| Herramienta                       | Uso                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Next.js 16 + React 19             | App Router, server layout, UI interactiva y Route Handlers                      |
| TypeScript                        | Contratos y estados discriminados, configuración estricta                       |
| Zod                               | Validación de entradas y respuestas; tipos inferidos de un contrato compartido  |
| TanStack Query                    | Caché de datos remotos, carga, error e invalidación                             |
| Zustand                           | Borrador e intención activa compartidos entre rutas, con instancia por wallet   |
| Lucide React                      | Iconos SVG                                                                      |
| Fontsource Montserrat / Open Sans | Fuentes locales sin solicitudes a Google en ejecución                           |
| Vitest + Testing Library          | Reglas monetarias, servicio, HTTP, formulario y hook de envío                   |
| Playwright + axe                  | API, navegación, escritorio/móvil y comprobaciones automáticas de accesibilidad |
| ESLint + Prettier                 | Análisis estático y formato consistente                                         |

Versiones exactas en `package.json` y resoluciones reproducibles en `package-lock.json`.

## Contrato HTTP

Todos los endpoints responden JSON y `Cache-Control: private, no-store`. Incluyen `X-Request-ID`. Los errores tienen `{ "error": { "code": "…", "message": "…", "requestId": "…" } }`.

| Método y ruta                                    | Uso                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `POST /api/session`                              | `{ identity }`; crea cookie HttpOnly y una sesión nueva                     |
| `DELETE /api/session`                            | Revoca sesión y elimina cookie                                              |
| `GET /api/wallet`                                | Usuario, `id` público de wallet, saldo en centavos, contactos y movimientos |
| `POST /api/contacts`                             | `{ walletId, name, identity }`; valida sesión y duplicados                  |
| `POST /api/transfers`                            | `{ walletId, recipientId, amountCents, concept, idempotencyKey }`           |
| `GET /api/transfers/:id`                         | Comprobante de una transferencia perteneciente a la sesión                  |
| `GET /api/operations/:idempotencyKey?walletId=…` | Resultado confirmado con comprobante o `unknown`; consulta sin débito       |

`walletId` identifica la generación de la wallet; no concede acceso. La cookie sigue siendo necesaria. Vincular las escrituras a esa generación evita confirmar un envío revisado bajo otra sesión. Los cambios de sesión invalidan las vistas de otras pestañas mediante `BroadcastChannel`; el servidor vuelve a comprobar la generación aunque el evento no llegue.

## Diagnóstico local

El servidor escribe eventos JSON en la terminal. Cada intento tiene un `requestId`; la intención conserva el mismo `operationId` (el UUID idempotente en esta demo). Busca la referencia que aparece en el error o en `X-Request-ID` de la pestaña Network del navegador.

Un timeout simulado produce `transfer.committed` seguido de `request.finished` con HTTP 504. Eso significa que el débito ocurrió aunque la respuesta indicara un timeout. El GET de operaciones permite recuperar su comprobante. Un POST repetido con los mismos datos genera `transfer.replayed`, sin otro débito.

Los eventos incluyen duración, ruta normalizada, código HTTP/error, entorno, versión y `simulation: true`; excluyen cuerpos, cookies, correos, teléfonos, conceptos e importes. Son diagnóstico local, no un servicio de alertas ni un registro contable durable.

| Variable                    | Uso                                                                   |
| --------------------------- | --------------------------------------------------------------------- |
| `APP_ENV`                   | `local` (default), `uat`, `production` o `test`; etiqueta del entorno |
| `APP_VERSION`               | Versión visible en logs; default `1.0.0`                              |
| `NEXT_PUBLIC_DEMO_CONTROLS` | `true`/`false`, incorporada al build del navegador                    |
| `DEMO_CONTROLS`             | Override opcional del servidor; debe coincidir con el flag público    |

La configuración se valida antes de ejecutar cada operación del API. Si es inválida se responde con error y referencia. Para comparar UAT/producción, comprueba versión, configuración efectiva y evento de commit antes de asumir que un error HTTP significa rechazo financiero. No uses `APP_ENV` para sustituir el `NODE_ENV` que administra Next.js.

## Cobertura del challenge

| Requisito                                            | Implementación y evidencia                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Next.js + TypeScript, API mock                       | App Router, contratos Zod, `app/api` y servicio en memoria                            |
| Login y sesión persistente                           | Formulario validado, carga/error, cookie mock y pruebas de sesión                     |
| Home: saldo, usuario, movimientos, carga/vacío/error | `features/wallet`, controles de demo y recorrido E2E                                  |
| Contactos favoritos y alta                           | Validación, guardado en sesión y selección en envío                                   |
| Monto positivo, saldo suficiente y destinatario      | Validación de UI y del servicio, unitarias y solicitudes HTTP no confiables           |
| Resumen, confirmación y comprobante                  | Componentes separados, payload revisado e historial de comprobantes                   |
| Cinco resultados aleatorios y recuperación           | Simulador 60/10/10/10/10, consulta y reintento idempotente                            |
| Estado y rendering justificados                      | `DECISIONS.md`, Zustand por sesión y Query para servidor                              |
| Pruebas unitarias y E2E                              | `src/**/*.test.*`, `tests/e2e` y smoke de configuración                               |
| Escalabilidad y mantenibilidad                       | Límites explícitos, concurrencia local, separación de reglas, contratos y diagnóstico |
| Documentación y uso de IA                            | README, DECISIONS y AI_USAGE; revisión humana final por completar por el candidato    |

## Límites conocidos

- **Mock de un proceso:** memoria volátil, sin base de datos, ledger contable, colas ni proveedor de pagos. Reiniciar el proceso borra sesiones, contactos y transferencias.
- **Sesión ficticia:** cualquier identidad válida abre una wallet nueva con el mismo usuario y saldo inicial. No hay verificación de identidad, contraseña ni autorización de operaciones reales. Duración máxima: 24 horas.
- **Idempotencia local:** se conserva durante la vida de la sesión/proceso; no es una garantía distribuida ni durable ante reinicios. `sessionStorage` solo recupera pendientes en la misma pestaña/wallet y si el navegador lo permite. Si está bloqueado, el reintento funciona mientras siga montado el provider autenticado, pero no se garantiza la recuperación tras recargar. No hay continuidad entre dispositivos ni después de cerrar sesión.
- **Datos demostrativos:** los movimientos iniciales son una muestra reciente, no el historial completo que explica el saldo. Home muestra hasta 8 movimientos recientes.
- **Límites de memoria:** hasta 500 sesiones activas, 50 contactos por sesión y 500 transferencias confirmadas por sesión. No sustituyen rate limiting ni medidas contra abuso.
- **Sin internacionalización:** textos en español, moneda MXN, fechas visibles en Ciudad de México.
- **Comprobante:** impresión del navegador, sin PDF firmado ni validez bancaria.
- **Accesibilidad:** hay pruebas automáticas, foco visible, semántica y movimiento reducido; no constituyen una certificación ni sustituyen la revisión con lectores de pantalla.
- **Dependencias de desarrollo:** al verificar el 17 de noviembre de 2026, `npm audit` reportó una alerta de ReDoS en `picomatch <=4.0.7`, propagada a herramientas de lint/tests. No había una versión corregida publicada en el registro consultado. `npm audit --omit=dev` reportó **0 vulnerabilidades**. No se forzaron downgrades incompatibles; conviene volver a auditar antes de integrar o publicar.

## Decisiones y uso de IA

- [DECISIONS.md](DECISIONS.md): arquitectura, alternativas, edge cases y evolución a producción.
- [AI_USAGE.md](AI_USAGE.md): herramientas utilizadas, revisión, correcciones y responsabilidad de validación humana.

## Dedicación y alcance de entrega

La dedicación total se estima en aproximadamente **6 horas**, incluyendo análisis, implementación asistida, revisión, pruebas y documentación.
