# Decisiones de diseño

## 1. Alcance y organización

El flujo pedido es una wallet mock: acceso, Home, contactos, envío, revisión y comprobante. Se implementó como un solo proyecto Next.js organizado por funcionalidades. `app/` adapta navegación y HTTP; `features/` compone la experiencia; `lib/` define contratos y utilidades; `server/` ejecuta las reglas y administra los datos mock.

**Alternativa:** backend separado o microservicios. Facilitarían despliegues independientes y límites organizacionales, pero agregarían infraestructura, autenticación entre servicios y duplicación de contratos sin un requisito que lo demande aquí. La separación actual permite extraer el servicio cuando exista esa necesidad.

## 2. App Router y rendering híbrido

Los layouts y páginas de entrada son Server Components. El layout protegido consulta la cookie y valida la sesión antes de mostrar el shell. Los formularios y datos interactivos son Client Components. Login puede prerenderizarse; la wallet usa un shell dinámico y obtiene sus datos por Route Handlers.

**Alternativas:** SSR completo de los datos iniciales reduciría la espera de la primera consulta, con hidratación del caché adicional; CSR de toda la aplicación haría depender incluso la redirección inicial del navegador. Se eligió un punto intermedio con carga explícita y una API comprobable. No se afirma que CSR mejore por sí solo la escalabilidad del backend.

## 3. Route Handlers en lugar de Server Actions

Los Route Handlers son el equivalente de API Routes en App Router. Mantienen explícitos el contrato JSON, los códigos HTTP y las pruebas de integración. Server Actions serían apropiadas para formularios internos estrechamente ligados a Next, pero ocultarían parte del contrato HTTP que este ejercicio busca demostrar. No se mezclaron dos mecanismos para la misma mutación.

## 4. Estado local y datos remotos

`useState` y un hook de estados discriminados controlan el formulario y su ciclo: `editing → review → submitting → success/error`. TanStack Query administra los datos remotos, caché, errores y revalidación. Se desactivan reintentos automáticos; la persona confirma los reintentos de pagos.

**Alternativas:** Context sin biblioteca requeriría implementar carga, caché e invalidación; Redux o Zustand serían útiles para estado global de cliente más extenso, pero no reemplazan automáticamente la gestión de datos remotos. No hay un store global duplicando el saldo del servidor.

## 5. Contratos y validación

Zod define las formas de login, contactos, wallet, transferencia, comprobante y errores. TypeScript infiere los tipos. La UI valida para dar feedback rápido; la API y el servicio validan nuevamente porque un cliente no es confiable. El cliente también valida las respuestas HTTP en ejecución.

**Alternativa:** OpenAPI y generación de clientes. Es preferible si hay consumidores o repositorios independientes. En este proyecto full stack, compartir esquemas evita mantener dos contratos equivalentes. El tipado no sustituye la validación de datos JSON externos.

## 6. Dinero en centavos enteros

La API y el servicio usan `amountCents` y `balanceCents`, ambos enteros seguros. El parser acepta punto o coma decimal, máximo dos decimales, y rechaza exponentes, importes negativos, agrupadores ambiguos y valores fuera de rango. `Intl.NumberFormat` se usa únicamente para presentación.

**Alternativas:** `number` en pesos y redondeos dispersos producirían errores de precisión; una librería decimal sería razonable con cálculos complejos o múltiples monedas. Para sumar/restar MXN con un rango acotado, centavos enteros son suficientes. En producción se debe revisar el rango y usar enteros de base de datos o `NUMERIC` según el dominio.

## 7. Idempotencia y concurrencia

Cada intención revisada recibe un UUID. Al confirmar, el servidor guarda la relación clave → huella de payload → comprobante. Repetir la clave y el mismo payload devuelve el mismo comprobante; cambiar los datos con esa clave produce 409. La verificación del saldo, el débito y el registro ocurren sin `await` entre ellos.

Eso evita sobregiros **solo en el proceso de Node que contiene la memoria**. No equivale a una transacción distribuida. Para múltiples instancias se requiere una transacción en base de datos, restricción única de idempotencia y actualización condicional o bloqueo de fila. El fallo de unicidad debe revertir el débito dentro de la misma transacción.

**Alternativa:** deshabilitar el botón únicamente. Mejora la UX pero no protege frente a dos solicitudes, reintentos de red o dos pestañas. Se mantiene como primera barrera, no como garantía principal.

## 8. Timeout y resultado incierto

Un timeout no prueba que el pago haya fallado. El escenario mock confirma el débito y luego devuelve 504, simulando una respuesta perdida. La UI conserva la clave y ofrece verificar el resultado. Antes del POST persiste el payload en `sessionStorage`, por generación de wallet, para restaurarlo al volver a esa pantalla. No permite editar una operación cuyo resultado sea ambiguo.

Un 503 o error desconocido se trata conservadoramente como incierto en el cliente, aunque el escenario mock particular no haya debitado. La recuperación siempre reutiliza la clave. El cliente además implementa `AbortController` con un límite de 8 segundos; cancelar el fetch no revierte una operación del servidor.

**Alternativas:** emitir una clave nueva en cada reintento podría duplicar cargos; reintentar automáticamente podría ocultar estados importantes. Para producción sería mejor un recurso de operación con consulta de estado, conciliación y notificación cuando el proveedor determine el resultado.

## 9. Sesiones y pestañas

La cookie HttpOnly contiene una sesión opaca con duración de 24 horas y `SameSite=Lax`; `Secure` se activa sobre HTTPS. El servidor conserva la wallet de cada sesión, evitando compartir un saldo global entre visitantes. Cada login crea una simulación nueva.

Las escrituras incluyen un `walletId` público distinto del token de sesión. El servidor compara esa generación con la cookie vigente. Esto evita que un formulario revisado en una sesión termine modificando otra al cambiar el login en otra pestaña. `BroadcastChannel` invalida las vistas y cachés en las otras pestañas; la validación del servidor funciona aunque ese mecanismo no esté disponible.

**Alternativa:** localStorage para la sesión permitiría al navegador leer el token y no resolvería la autorización del API. Una cookie por sí sola tampoco vincula una intención revisada con la sesión original. Esta simulación no implementa autenticación real ni debe presentarse como un sistema bancario seguro.

## 10. Destinatario y resumen inmutables

El resumen muestra los datos asociados al payload revisado, no una selección mutable que pueda cambiar por un callback asíncrono. La revisión queda bloqueada mientras se agrega un contacto. El servidor exige que el destinatario pertenezca a la wallet actual. El comprobante conserva una copia del destinatario en el momento del envío.

**Alternativa:** leer siempre el contacto actual permitiría que un cambio posterior alterara el significado de un comprobante histórico. Una aplicación real debería conservar los datos necesarios de la operación de acuerdo con sus reglas de privacidad y retención.

## 11. Mocks y errores reproducibles

El comportamiento normal selecciona aleatoriamente los cinco escenarios requeridos: 60% éxito y 10% cada error. Los controles deterministas se habilitan por una variable explícita, con la misma validación en el servidor. Permiten demostrar y probar cada camino sin depender del azar.

**Alternativas:** solo aleatoriedad haría las pruebas intermitentes; solo resultados forzados no cumpliría el comportamiento aleatorio. Las pruebas unitarias inyectan el generador de números aleatorios; E2E utiliza los controles de demo.

La API normaliza errores por código y no filtra mensajes internos desconocidos. La normalización admite errores conocidos que crucen una recarga de módulos. En desarrollo se conserva la memoria, pero se recrea el servicio para que una edición del código no deje métodos antiguos activos.

## 12. Diseño visual y accesibilidad

Se implementó una interfaz propia inspirada en los estilos públicos del [sitio de Spin](https://spinbyoxxo.com.mx): morado `#531BC8`, naranja `#FF6600` y fuentes Montserrat/Open Sans. No se encontró una biblioteca pública verificable de su sistema de diseño; estos componentes no se presentan como oficiales.

Los colores y medidas reutilizables se centralizan en CSS. El shell, botones, avatares, carga, errores y encabezados son componentes compartidos. Se usan inputs nativos, labels, radios, foco visible, regiones de estado y preferencia de movimiento reducido. En móvil, la navegación principal pasa a una barra inferior.

**Alternativas:** una biblioteca visual completa ahorraría trabajo en componentes complejos, pero aquí son principalmente formularios y tarjetas. CSS nativo permite controlar una interfaz pequeña sin añadir Tailwind/Radix como dependencias que el flujo no requiere. Si creciera la biblioteca, convendría separar estilos por componente y formalizar más tokens.

Las fuentes se empaquetan localmente. No se carga contenido visual remoto para que el login y el build no dependan de una CDN tipográfica. Las ilustraciones del login son CSS y SVG.

## 13. Pruebas

Vitest cubre parser monetario, contratos, servicio, concurrencia local, idempotencia, errores HTTP y estados del hook; Testing Library observa interacción y resultados visibles. Playwright ejecuta flujos reales y solicitudes directas al API, en escritorio y viewport móvil. axe comprueba problemas automáticos de accesibilidad.

**Alternativas:** Jest ofrece un ecosistema amplio; Vitest encaja con TypeScript y pruebas rápidas con menos configuración aquí. Cypress también serviría para E2E; Playwright facilita contextos separados, múltiples pestañas, API y emulación. Las pruebas no dependen de servicios financieros reales.

Las regresiones cubren timeout tras débito, recarga, cambio de sesión entre pestañas, contacto que termina de guardarse durante la edición, sesión expirada y saldo consumido por otra operación. No se confunde una emulación de viewport con una prueba en un dispositivo real.

## 14. Edge cases atendidos

- Cero, negativos, fracciones menores a un centavo, exponentes, cantidades enormes y saldo exacto.
- Destinatario ausente, inexistente o perteneciente a otra sesión.
- JSON inválido, respuesta con forma inesperada y errores no reconocidos.
- Contactos repetidos después de normalizar teléfono o correo.
- Dos confirmaciones inmediatas y solicitudes concurrentes con saldo limitado.
- Clave reutilizada con otro payload.
- Pérdida de respuesta después de confirmar el débito.
- Recuperación de pendiente al volver a la pantalla en la misma pestaña.
- Sesión vencida o reemplazada después de revisar el pago.
- Saldo desactualizado: rechazo real del servidor, reconsulta y edición con el saldo vigente.
- Comprobante inexistente o de otra sesión.
- Estado vacío y error del Home, además de carga y éxito.

## 15. Qué cambiaría con más tiempo y requisitos reales

1. Repositorio persistente con transacciones, ledger de doble partida, idempotencia durable y restricciones de integridad.
2. Autenticación real, autorización por operación, verificación del beneficiario, límites y prevención de abuso según el producto.
3. API de estado de operación y conciliación con el proveedor para resultados inciertos; outbox para eventos y notificaciones.
4. Sesiones compartidas entre instancias, estrategia de despliegue y observabilidad: métricas, trazas, logs sin datos sensibles y alertas.
5. Paginación server-side e índices para movimientos/contactos. Presupuestos de rendimiento y pruebas de carga realistas.
6. Pruebas en WebKit/Safari y dispositivos reales, auditoría manual con teclado/lector de pantalla y refinamiento de tamaños tipográficos.
7. Separación de hojas CSS por funcionalidad, componentes de formulario adicionales e internacionalización si el producto requiere más idiomas.
8. Dependencias actualizadas con revisión de compatibilidad y resolución de la alerta de desarrollo reportada en README.

No se agregaron Kubernetes, microservicios, event sourcing o Redux solo por el volumen mencionado en el contexto. El camino a escala depende de garantías de datos, operación y mediciones; la UI por sí sola no demuestra capacidad para millones de usuarios.
