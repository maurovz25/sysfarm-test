# Historial de commits del repositorio de desarrollo de SysFarm

Este repositorio (`sysfarm-test`) se creó exclusivamente para hacer visible la investigación y la implementación del proyecto de tesis. El repositorio de desarrollo original (`maurovz25/SysFarm`) es privado, está en producción en la Clínica San Clemente y contiene elementos ajenos a la investigación (documentación interna y scripts de mantenimiento), por lo que su historial no se publica como tal. Este archivo es la evidencia de ese historial: lista todos los commits hasta la versión evaluada, con su hash, fecha, autor visible y mensaje. Los correos de los autores no se incluyen.

Antes de publicar esta lista se revisó el historial completo (222 commits) en busca de claves, tokens, cadenas de conexión y datos personales: no hay coincidencias. Las únicas coincidencias del patrón de tokens JWT fueron las sumas de integridad de `frontend/pnpm-lock.yaml`. El único archivo de hoja de cálculo versionado alguna vez (`PRUEBA.xlsx`) contenía una fila con un producto de ejemplo.

## Resumen

- Versión evaluada: `4f9a46a` (26-10-2026), commit número 222 del repositorio de desarrollo.
- Periodo: 27-02-2026 a 26-10-2026. Hasta el 13-10-2026 hay 206 commits, que es la cifra que cita la sección 3.4 del documento.
- Mensajes con formato semántico (`feat:`, `fix:`, `docs:`, `chore:`, `style:`, `refactor:`, `test:`, `perf:`): 211 de 222.
- Un commit posterior (`3612ca5`, 02-11-2026) versiona las suites de pruebas; en este repositorio las pruebas ya están incluidas.

| Mes | Commits |
|---|---:|
| febrero de 2026 | 1 |
| abril de 2026 | 34 |
| mayo de 2026 | 8 |
| junio de 2026 | 14 |
| julio de 2026 | 18 |
| agosto de 2026 | 56 |
| septiembre de 2026 | 68 |
| octubre de 2026 | 23 |

| Tipo | Commits |
|---|---:|
| feat | 102 |
| fix | 47 |
| chore | 18 |
| refactor | 18 |
| perf | 15 |
| otros | 10 |
| style | 9 |
| docs | 2 |
| test | 1 |

| Autor visible | Commits |
|---|---:|
| maurovz25 | 155 |
| Antigravity AI | 66 |
| Mauro | 1 |

## Lista completa

| N.° | Hash | Fecha | Autor | Mensaje |
|---:|---|---|---|---|
| 1 | `57c8f6b` | 2026-02-27 | maurovz25 | Commit inicial |
| 2 | `50b04ed` | 2026-04-24 | Antigravity AI | feat: implementar lógica de carga masiva de productos y validación de Excel |
| 3 | `4e66c6b` | 2026-04-24 | Antigravity AI | fix: resolver deprecación de middleware en Next.js migrando a la convención de proxy |
| 4 | `20467b1` | 2026-04-24 | Antigravity AI | feat(backend): ampliar límites de API y controladores para carga masiva de productos |
| 5 | `5f309b7` | 2026-04-24 | Antigravity AI | chore: actualizar .gitignore y remover archivos de compilación del índice |
| 6 | `27bb4cd` | 2026-04-24 | Antigravity AI | chore: actualizar dependencias de UI y componentes básicos (Chart, Resizable) |
| 7 | `ef105e8` | 2026-04-24 | Antigravity AI | feat: mejoras en la visualización de Inventario y Kardex |
| 8 | `ab97363` | 2026-04-27 | Antigravity AI | fix(backend): corregir selección de id en validación masiva y robustecer actualización de lotes |
| 9 | `72becf4` | 2026-04-27 | Antigravity AI | fix(frontend): forzar versión de Node.js >=20.9.0 para compatibilidad con Next.js |
| 10 | `f873f89` | 2026-04-27 | maurovz25 | fix(backend): habilitar generacion de Prisma y corregir errores de compilacion |
| 11 | `3d0408a` | 2026-04-27 | maurovz25 | fix(frontend): normalizar construccion de URLs para la API |
| 12 | `7b05a79` | 2026-04-27 | maurovz25 | delete(seed) |
| 13 | `0fe722d` | 2026-04-27 | maurovz25 | fix(backend): escuchar en 0.0.0.0 para permitir acceso desde el proxy de Dokploy |
| 14 | `9ba57d9` | 2026-04-27 | maurovz25 | fix(backend): convertir PORT a numero para cumplir con los tipos de TypeScript |
| 15 | `4c03a10` | 2026-04-27 | maurovz25 | chore: eliminar dist del seguimiento de git |
| 16 | `74d4610` | 2026-04-27 | maurovz25 | fix(backend): cambiar puerto por defecto a 3000 y mejorar logs de inicio |
| 17 | `b5fa208` | 2026-04-27 | maurovz25 | fix(backend): restaurar puerto 3001 y simplificar logs de inicio |
| 18 | `af3b720` | 2026-04-27 | maurovz25 | fix(backend): cambiar puerto a 3000 y añadir logger de peticiones |
| 19 | `d88a271` | 2026-04-27 | maurovz25 | fix(backend): asegurar host 0.0.0.0 y puerto 3001 para Dokploy |
| 20 | `293e101` | 2026-04-27 | maurovz25 | feat(app): limpiear logg |
| 21 | `254a172` | 2026-04-27 | maurovz25 | chore: limpieza de archivos temporales y basura |
| 22 | `fab4e95` | 2026-04-27 | maurovz25 | chore: reorganizar scripts de desarrollo a carpeta scripts |
| 23 | `14a9ab2` | 2026-04-27 | maurovz25 | fix(backend): restringir CORS al dominio del frontend |
| 24 | `beaf715` | 2026-04-27 | maurovz25 | perf(db): añadir indices de rendimiento al esquema de Prisma |
| 25 | `9558cf9` | 2026-04-27 | maurovz25 | chore: restaurar cleanup.ts en la carpeta scripts |
| 26 | `b0edf3c` | 2026-04-27 | maurovz25 | chore: eliminar duplicado de cleanup.ts en src |
| 27 | `104438c` | 2026-04-27 | maurovz25 | delete(clenup): remove script |
| 28 | `444f418` | 2026-04-27 | maurovz25 | feat(auth): eliminar rol viewer y establecer vendedor como predeterminado |
| 29 | `e1c97b9` | 2026-04-28 | maurovz25 | feat(frontend): eliminar rol viewer y actualizar logica de roles |
| 30 | `0940b95` | 2026-04-28 | maurovz25 | fix(frontend): usar utilidad de api en modulo de usuarios y eliminar urls locales |
| 31 | `81cf78f` | 2026-04-28 | maurovz25 | feat(frontend): añadir paginación al módulo de inventario |
| 32 | `f051cb5` | 2026-04-28 | maurovz25 | fix: eliminar rastros restantes del rol viewer en frontend y backend |
| 33 | `aef92db` | 2026-04-28 | Antigravity AI | fix: eliminar Vercel Analytics y mejorar el manejo de errores en el módulo de inventario |
| 34 | `34e14a9` | 2026-04-28 | Antigravity AI | fix: importar componentes de Select faltantes en inventario |
| 35 | `b47d02c` | 2026-04-28 | Antigravity AI | feat: agregar funcionalidad de cambio de contraseña en el módulo de usuarios |
| 36 | `e720a7c` | 2026-05-06 | Antigravity AI | refactor(backend): unificar mensajes de respuesta de API a español |
| 37 | `f11c4d1` | 2026-05-13 | Antigravity AI | refactor(backend): simplificar mensaje de error en middleware de roles |
| 38 | `03f378e` | 2026-05-13 | Antigravity AI | feat(inventario/lotes): agregar paginacin a auditora y habilitar permisos de edicin para farmacuticos |
| 39 | `6f90448` | 2026-05-22 | Antigravity AI | chore(backend): actualizar configuración CORS para incluir localhost en desarrollo |
| 40 | `fb1dcb3` | 2026-05-22 | Antigravity AI | feat(frontend): integrar búsqueda por GTIN y creación rápida de lotes en ingresos |
| 41 | `20fc49e` | 2026-05-22 | Antigravity AI | fix(frontend): corregir visualización de stock desglosado para unidades sueltas |
| 42 | `5b36a54` | 2026-05-26 | Antigravity AI | feat(ui): implementar selector de productos con busqueda en ingresos, salidas y kardex |
| 43 | `607b872` | 2026-05-26 | Antigravity AI | feat(ia): integrar modulo de Asistente IA con Google Gemini y Text-to-SQL |
| 44 | `f6fcb83` | 2026-06-18 | Antigravity AI | db: refactorizar modelos Product y Batch en Prisma e introducir TipoProducto enum |
| 45 | `76b0637` | 2026-06-18 | Antigravity AI | feat(backend): adaptar controladores de productos al nuevo esquema de base de datos e ignorar dist |
| 46 | `41617b1` | 2026-06-18 | Antigravity AI | feat(frontend): reemplazar tipo Insumo por Dispositivo Médico y ajustar cálculos de stock a nivel lote |
| 47 | `8edc694` | 2026-06-18 | Antigravity AI | feat: hacer interactivas las tarjetas de validación masiva con detalles de duplicados y colisiones |
| 48 | `160264c` | 2026-06-18 | Antigravity AI | fix(frontend): corregir error de sintaxis y parseo de llaves JSX en el diálogo de carga masiva |
| 49 | `4e9c0c6` | 2026-06-18 | Antigravity AI | fix(backend): resolver error de tipo de TypeScript para cantidadPorPresentacion en productos |
| 50 | `addb4ee` | 2026-06-18 | Antigravity AI | feat(frontend): mostrar error de validación en la UI en lugar de fallar silenciosamente |
| 51 | `d0d8385` | 2026-06-19 | Antigravity AI | opt(backend): optimizar rendimiento de carga masiva de productos y lotes |
| 52 | `47fb9b6` | 2026-06-19 | Antigravity AI | refactor(frontend): limpieza de código y mejoras visuales en diálogos de productos |
| 53 | `d7bacec` | 2026-06-19 | Antigravity AI | feat(frontend): mostrar precios de costo en inventario y columnas de costo/venta en lotes |
| 54 | `37bc5d1` | 2026-06-19 | Antigravity AI | feat(frontend): integrar nombre de usuario real en creación de lotes y definir tipo de movimiento de ajuste |
| 55 | `bf16a0d` | 2026-06-19 | Antigravity AI | feat(backend): registrar movimiento de carga inicial de lote y capturar usuario creador |
| 56 | `c9f6752` | 2026-06-19 | Antigravity AI | refactor(frontend): corregir cálculo de saldos del Kardex, agregar columna Stock Anterior y ajustar visualización de tabla |
| 57 | `ef0ea9b` | 2026-06-22 | Antigravity AI | feat(frontend): permitir registrar ingresos por presentacion o unidad base |
| 58 | `89aa204` | 2026-07-20 | maurovz25 | seguridad(backend): implementar rate limiting e impedir inyecciones SQL en endpoint de IA |
| 59 | `2935b32` | 2026-07-20 | maurovz25 | seguridad(frontend): resolver RCE de Next.js, dependencias e implementar sanitizado XSS |
| 60 | `9d49cb1` | 2026-07-21 | Antigravity AI | fix(backend): flexibilizar validación de tipo de producto y corregir trazabilidad de auditoría |
| 61 | `fdaf58c` | 2026-07-21 | Antigravity AI | feat(frontend): implementar paginación unificada de 15, 30 y 50 filas en las tablas del sistema |
| 62 | `6e2b9be` | 2026-07-21 | Antigravity AI | feat(frontend): añadir lector de código de barras en salidas y corregir cálculo de stock valorizado |
| 63 | `81286c1` | 2026-07-21 | Antigravity AI | fix(frontend): registrar nombre completo del usuario activo y optimizar renderizado en sidebar |
| 64 | `74c9e38` | 2026-07-21 | Antigravity AI | chore(frontend): actualizar configuraciones de TypeScript y ajustar assets estáticos |
| 65 | `f49f0b3` | 2026-07-21 | maurovz25 | feat(inventory): añadir selector de fecha opcional en registro de ingresos y salidas |
| 66 | `a83b6c5` | 2026-07-21 | maurovz25 | fix(timezone): corregir desfase de 5 horas en historiales y exportaciones de inventario |
| 67 | `fe94c3b` | 2026-07-21 | maurovz25 | refactor(dashboard): eliminar archivos loading.tsx redundantes en subcarpetas |
| 68 | `b9b4c08` | 2026-07-22 | Antigravity AI | fix(controller) |
| 69 | `da4fdb6` | 2026-07-29 | Antigravity AI | feat(db): agregar modelos de Requerimiento y RequerimientoItem al esquema de base de datos |
| 70 | `fe94f81` | 2026-07-29 | Antigravity AI | feat(backend): implementar rutas y controladores para la gestion de requerimientos |
| 71 | `41de8bf` | 2026-07-29 | Antigravity AI | feat(frontend): definir tipos TypeScript y configuracion de permisos para el rol solicitante |
| 72 | `8585373` | 2026-07-29 | Antigravity AI | feat(frontend): adaptar flujos de login, control de rutas y sidebar para el nuevo rol de solicitante |
| 73 | `016d047` | 2026-07-29 | Antigravity AI | feat(frontend): crear interfaces de gestion de requerimientos y formulario de creacion de pedidos |
| 74 | `62d5149` | 2026-07-30 | Antigravity AI | feat(backend): agregar endpoint para edicion de requerimientos y soporte de productos adicionales al atender |
| 75 | `82aafc8` | 2026-07-30 | Antigravity AI | feat(frontend): agregar edicion de requerimientos pendientes y adicion de productos en modal atender |
| 76 | `200c077` | 2026-08-12 | maurovz25 | feat(backend): agregar carga masiva atómica con rollback y endpoint para reiniciar inventario |
| 77 | `efea128` | 2026-08-12 | Antigravity AI | refactor(inventario): eliminar campos de precio unitario almacenados y calcular dinámicamente |
| 78 | `586538f` | 2026-08-12 | Antigravity AI | feat(auth): agregar rol de Auditor con acceso exclusivo de lectura a inventario y kardex |
| 79 | `16ae97d` | 2026-08-12 | Antigravity AI | feat(kardex): formatear fecha/hora local y ajustar calculo de valorización por lote |
| 80 | `3c474fa` | 2026-08-12 | Antigravity AI | chore(frontend): actualizar tsconfig, tipos de Next.js y dependencias del proyecto |
| 81 | `27ffc9b` | 2026-08-13 | Antigravity AI | style(dashboard): reducir espaciados, paddings y compacidad de tarjetas y paneles |
| 82 | `570c4d1` | 2026-08-13 | Antigravity AI | feat(backend): agregar campo deletedAt a Product y endpoint DELETE /products/:id con soft delete |
| 83 | `cf1f7e6` | 2026-08-13 | Antigravity AI | refactor(components): reemplazar alert nativos por toasts de sonner en dialogos de componentes |
| 84 | `50ced1a` | 2026-08-13 | Antigravity AI | refactor(views): reemplazar alertas nativas por toasts en formularios de ingresos, salidas y requerimientos |
| 85 | `1edc2d0` | 2026-08-13 | Antigravity AI | feat(ux): eliminar parpadeos de tablas con refresco silencioso en segundo plano y modales AlertDialog |
| 86 | `71123a3` | 2026-08-14 | Antigravity AI | feat(backend): agregar validaciones estrictas y rollback total en carga masiva |
| 87 | `8c166e2` | 2026-08-14 | Antigravity AI | feat(frontend): mostrar desglose de errores por fila y bloquear confirmacion de carga |
| 88 | `c16117b` | 2026-08-14 | Antigravity AI | refactor(frontend): corregir tipado estricto de cliente supabase usando asercion de no nulidad |
| 89 | `890023e` | 2026-08-14 | Antigravity AI | style(frontend): reemplazar iconos genericos por el logo oficial en login y sidebar |
| 90 | `1593047` | 2026-08-14 | Antigravity AI | fix(backend): corregir esquemas Zod y saneamiento al actualizar productos y lotes |
| 91 | `e428978` | 2026-08-14 | Antigravity AI | fix(frontend): sanear datos y mejorar mensajes de error en edicion de productos y lotes |
| 92 | `2dbbeb3` | 2026-08-14 | Antigravity AI | style(sidebar): centrar e invertir color del icono del logo al colapsar |
| 93 | `e8915b5` | 2026-08-14 | Antigravity AI | feat(products): unificar gestion de producto y lote en modal de 2 columnas |
| 94 | `724d55d` | 2026-08-14 | Antigravity AI | feat(inventory): integrar modal unificado, formato de stock desglosado y menu de acciones en lotes |
| 95 | `4c61862` | 2026-08-14 | Antigravity AI | feat(products): agregar selector dinamico de lotes y registro de nuevo lote en modal unificado |
| 96 | `9dfd636` | 2026-08-14 | Antigravity AI | feat(inventory): integrar selector dinamico de lotes en paginas de inventario y lotes |
| 97 | `c452d0e` | 2026-08-15 | maurovz25 | feat(frontend): agregar utilidades de formateo numérico y comas de miles |
| 98 | `a660bef` | 2026-08-15 | maurovz25 | style(frontend): ampliar duración de notificaciones Toast y añadir botón de cierre |
| 99 | `8213d94` | 2026-08-15 | maurovz25 | feat(inventario): agregar ordenamiento interactivo por fecha de expiración y columnas |
| 100 | `ee23100` | 2026-08-15 | maurovz25 | feat(lotes): integrar botones de ordenamiento de columnas en tabla de lotes |
| 101 | `b54ede8` | 2026-08-15 | maurovz25 | refactor(frontend): aplicar formateo estandarizado de miles en tablas y tarjetas |
| 102 | `ab87ac1` | 2026-08-15 | maurovz25 | chore(backend): actualizar configuración de dependencias en package.json |
| 103 | `19f948f` | 2026-08-24 | maurovz25 | feat(backend): agregar enum Role, rol solicitante en middleware e indices de optimizacion en Prisma |
| 104 | `6259cb2` | 2026-08-24 | maurovz25 | feat(auth): optimizar cliente supabase con singleton, cache en memoria de token y escucha en tiempo real de sesion |
| 105 | `853daa8` | 2026-08-24 | maurovz25 | feat(roles): agregar permiso canDeleteBatches e integrar rol farmaceutico y validaciones en requerimientos |
| 106 | `6e8e788` | 2026-08-24 | maurovz25 | feat(components): optimizar modales de producto y lote con soporte controlado y saneamiento de inputs numericos |
| 107 | `768bc67` | 2026-08-24 | maurovz25 | style(assets): agregar logo institucional en public |
| 108 | `7a6e7f9` | 2026-08-24 | maurovz25 | feat(inventory): estandarizar codigo cromatico de stock/estado y habilitar eliminacion de lotes para farmaceuticos |
| 109 | `09231c5` | 2026-08-25 | maurovz25 | feat(db): agregar modelos PlantillaRequerimiento y PlantillaRequerimientoItem |
| 110 | `1ab2ec3` | 2026-08-25 | maurovz25 | feat(api): implementar controller y rutas REST para gestion de plantillas |
| 111 | `d568cc3` | 2026-08-25 | maurovz25 | feat(frontend): agregar vista CRUD de plantillas y navegacion en sidebar |
| 112 | `6a9f726` | 2026-08-25 | maurovz25 | feat(frontend): implementar carga de plantilla, vista en 2 columnas y navegacion por teclado estilo Excel |
| 113 | `72ee172` | 2026-08-26 | maurovz25 | fix(frontend): ampliar ancho del buscador y desplegable de productos individuales |
| 114 | `dce930f` | 2026-08-26 | maurovz25 | feat(api): agregar modelo Area en Prisma, controlador REST y corregir contraste de desplegable |
| 115 | `138b2f2` | 2026-08-26 | maurovz25 | feat(frontend): cargar areas dinamicamente desde API en Requerimientos y Salidas |
| 116 | `78cdc34` | 2026-08-27 | maurovz25 | feat(inventario): alinear formato de exportacion a Excel con la plantilla de carga masiva |
| 117 | `14c96a8` | 2026-08-27 | maurovz25 | feat(backend): agregar soporte Upsert de lotes existentes y desglose de cambios en validacion |
| 118 | `3df1810` | 2026-08-27 | maurovz25 | feat(carga-masiva): incorporar modal de previsualizacion detallada e interactiva de cambios |
| 119 | `0eacbda` | 2026-08-28 | maurovz25 | feat(backend): agregar endpoints transaccionales en lote y soporte de UUIDs para salidas e ingresos |
| 120 | `aa08826` | 2026-08-28 | maurovz25 | feat(types): agregar productId y batchId opcionales a la interfaz InventoryMovement |
| 121 | `3b4c87f` | 2026-08-28 | maurovz25 | feat(salidas): optimizar registro de salidas con validación de lotes y guardado atómico en lote |
| 122 | `b3341ac` | 2026-08-28 | maurovz25 | feat(ingresos): optimizar registro de ingresos con soporte de UUIDs y guardado atómico en lote |
| 123 | `641fde3` | 2026-08-28 | maurovz25 | feat(database): agregar modelo GuiaSalida y relacion en Movement para medicamentos controlados |
| 124 | `3e6fe16` | 2026-08-28 | maurovz25 | feat(api): implementar endpoints de creacion, consulta y correlativos GS-X para guias de salida |
| 125 | `3b0ac1b` | 2026-08-28 | maurovz25 | feat(frontend): agregar tipos, modal de emision y plantilla de impresion formal para guias de salida de medicamentos controlados |
| 126 | `5a00d20` | 2026-08-28 | maurovz25 | feat(kardex): integrar emision y reimpresion de guias de salida por movimiento en la tabla de Kardex |
| 127 | `4c89452` | 2026-08-29 | maurovz25 | fix(backend): resolver error 500 en movimientos, extender timeouts de transaccion y validar stock acumulado por lote |
| 128 | `61afb21` | 2026-08-29 | maurovz25 | feat(frontend): agregar asignacion automatica FEFO multilote y combinacion de items en registro de salidas |
| 129 | `c9203dd` | 2026-08-31 | maurovz25 | feat(componentes): implementar cierre instantaneo 0ms y desacople de guardado en modales de producto y lote |
| 130 | `3598553` | 2026-08-31 | maurovz25 | feat(inventario): integrar actualizacion granular in-place, sincronizacion en segundo plano y rollback en inventario |
| 131 | `7b3265f` | 2026-08-31 | maurovz25 | feat(lotes): implementar actualizacion quirurgica en memoria y persistencia paralela en gestion de lotes |
| 132 | `2f807f1` | 2026-09-01 | maurovz25 | feat(backend): agregar relacion 1 a N en guias de salida, endpoint privado DNI y desglose multi-paciente |
| 133 | `276e8b8` | 2026-09-01 | maurovz25 | feat(frontend): integrar generacion PDF vectorial html2pdf.js, selector de medicos y badges de guias en kardex |
| 134 | `4f94087` | 2026-09-01 | maurovz25 | chore(config): actualizar exclusiones de gitignore en backend, frontend y raiz |
| 135 | `5fd8a33` | 2026-09-01 | maurovz25 | feat(frontend): agregar declaraciones de tipos typescript para html2pdf.js |
| 136 | `1e57edf` | 2026-09-01 | maurovz25 | fix(frontend): corregir renderizado condicional y estados de resumen en dialogo de carga masiva |
| 137 | `83784cf` | 2026-09-01 | maurovz25 | fix(frontend): normalizar valores opcionales al guardar y editar productos |
| 138 | `bb8e124` | 2026-09-01 | maurovz25 | fix(inventario): mejorar limpieza y sincronizacion in-place de campos opcionales en inventario |
| 139 | `c972120` | 2026-09-01 | maurovz25 | fix(lotes): calcular precios unitarios y sincronizar datos de producto en edicion de lotes |
| 140 | `3ea6ea6` | 2026-09-01 | maurovz25 | fix(requerimientos): permitir estado 'ask' en modo de combinacion de plantillas |
| 141 | `86aed89` | 2026-09-01 | maurovz25 | fix(kardex): corregir congelamiento de UI al cerrar modal de guia controlada |
| 142 | `34b7262` | 2026-09-01 | maurovz25 | chore(deps): eliminar libreria html2pdf.js y sus declaraciones de tipo |
| 143 | `dcb3d69` | 2026-09-01 | maurovz25 | feat(pdf): migrar generacion de guia controlada a jspdf con diseno institucional |
| 144 | `a142167` | 2026-09-04 | maurovz25 | feat(database): agregar campos direccionPaciente y distritoPaciente al modelo GuiaSalida |
| 145 | `ce6aef2` | 2026-09-04 | maurovz25 | feat(consultas): retornar direccion, distrito y ubigeo en consulta de DNI |
| 146 | `50c7931` | 2026-09-04 | maurovz25 | feat(guias): persistir direccion y distrito del paciente en creacion y edicion de guias |
| 147 | `f54b07c` | 2026-09-04 | maurovz25 | feat(frontend): integrar inputs de direccion y distrito en emision de guias controladas |
| 148 | `01b2e93` | 2026-09-04 | maurovz25 | feat(pdf): incluir direccion y distrito en documento PDF e impresion de guia controlada |
| 149 | `2a8e104` | 2026-09-09 | maurovz25 | perf(inventory): optimizar transacciones de ingresos y salidas en lote evitando timeouts |
| 150 | `2246a88` | 2026-09-09 | maurovz25 | fix(fechas): corregir desfase de zona horaria en formato de fechas de vencimiento |
| 151 | `115afa7` | 2026-09-09 | maurovz25 | feat(auth): mejorar retroalimentacion de errores y agregar visibilidad de contrasena en login |
| 152 | `be2558c` | 2026-09-09 | maurovz25 | feat(plantillas): vincular plantillas de requerimiento a un area o departamento opcional |
| 153 | `d27b50f` | 2026-09-09 | maurovz25 | feat(salidas): permitir cargar plantillas en nueva salida con edicion directa en tabla |
| 154 | `4acf830` | 2026-09-10 | maurovz25 | feat(seo): configurar favicon e iconos de pestana con nuevo logo institucional |
| 155 | `e4a1cae` | 2026-09-10 | maurovz25 | style(frontend): mejorar responsividad del logo y texto en login y sidebar |
| 156 | `e62af48` | 2026-09-15 | maurovz25 | feat(backend): persistir solicitante en modelo Movement y controladores de inventario |
| 157 | `2c95d08` | 2026-09-15 | maurovz25 | feat(frontend): permitir configurar fecha y solicitante iniciales en modal de plantillas |
| 158 | `f14f80a` | 2026-09-15 | maurovz25 | feat(frontend): carga automatica de area y edicion de fecha y solicitante por producto en salidas |
| 159 | `c8118cf` | 2026-09-15 | maurovz25 | refactor(frontend): remover campos redundantes del formulario izquierdo y optimizar distribucion de columnas |
| 160 | `426a386` | 2026-09-15 | maurovz25 | ui(salidas): ampliar 2px el ancho de la seccion Detalles de la Salida |
| 161 | `be49f9d` | 2026-09-16 | maurovz25 | feat(salidas): reintegrar fecha, area y solicitante en panel izquierdo y creacion rapida de areas |
| 162 | `1aa86c3` | 2026-09-16 | maurovz25 | feat(areas): modulo de gestion de areas solicitantes con filtros por estado y buscador |
| 163 | `fc3e429` | 2026-09-16 | maurovz25 | ui(areas): optimizar tarjetas de metricas a diseno compacto interactivo y restringir visibilidad por rol |
| 164 | `19b2884` | 2026-09-16 | maurovz25 | chore(deps): instalar @phosphor-icons/react y optimizar imports en next.config |
| 165 | `afb7f09` | 2026-09-16 | maurovz25 | refactor(ui): migrar componentes primitivos shadcn a phosphor icons |
| 166 | `6a25c10` | 2026-09-16 | maurovz25 | refactor(sidebar): migrar iconografia de navegacion a phosphor icons |
| 167 | `9d7a2f0` | 2026-09-16 | maurovz25 | refactor(requerimientos): migrar iconos a phosphor icons en areas y requerimientos |
| 168 | `5de7b1c` | 2026-09-16 | maurovz25 | refactor(inventario): migrar iconos a phosphor icons en inventario, lotes, kardex y dialogos |
| 169 | `b818c2b` | 2026-09-16 | maurovz25 | refactor(movimientos): migrar iconos a phosphor icons en ingresos, salidas y guias |
| 170 | `16d790c` | 2026-09-16 | maurovz25 | refactor(views): migrar iconos a phosphor icons en dashboard, asistente, usuarios y login |
| 171 | `4196a0a` | 2026-09-16 | maurovz25 | chore: remover paquete lucide-react tras migracion completa a phosphor icons |
| 172 | `5a1c328` | 2026-09-16 | maurovz25 | style(dashboard): mejorar iconografia y contraste semantico de las tarjetas de estadisticas |
| 173 | `25a6cb6` | 2026-09-17 | maurovz25 | perf(backend): agregar índices en PostgreSQL, logger de consultas y límites de consulta |
| 174 | `01b0736` | 2026-09-17 | maurovz25 | feat(frontend): integrar TanStack Query v5 para caché de datos y hooks centralizados |
| 175 | `a42bce2` | 2026-09-17 | maurovz25 | refactor(frontend): migrar todos los módulos principales a TanStack Query v5 |
| 176 | `05dafb9` | 2026-09-17 | maurovz25 | Merge remote-tracking branch 'origin/main' |
| 177 | `c2bedc5` | 2026-09-17 | maurovz25 | fix(frontend): eliminar ignoreBuildErrors para habilitar validacion estricta de TypeScript |
| 178 | `8d1a781` | 2026-09-17 | maurovz25 | fix(inventario): restaurar permisos, funciones de edicion y useMemo en inventario y lotes |
| 179 | `62c0101` | 2026-09-17 | maurovz25 | fix(movimientos): importar useMemo y limpiar imports duplicados en ingresos y salidas |
| 180 | `5ee73d9` | 2026-09-17 | maurovz25 | fix(requerimientos): restaurar estados locales de filtros, modales y creacion de requerimientos |
| 181 | `29cb12b` | 2026-09-17 | maurovz25 | fix(usuarios,dashboard): restaurar estado del formulario de usuarios y tipado estricto en dashboard |
| 182 | `31dd1cd` | 2026-09-17 | maurovz25 | perf(backend): desactivar logger de consultas lentas en Prisma para mantener limpia la consola |
| 183 | `cfcf239` | 2026-09-17 | maurovz25 | fix(backend): eliminar limites restrictivos en movimientos y ajustes para evitar truncar el historial |
| 184 | `358a3ca` | 2026-09-17 | maurovz25 | perf(backend): consultar requerimientos y conteo de pendientes en paralelo con Promise.all |
| 185 | `ee09650` | 2026-09-17 | maurovz25 | perf(backend): habilitar compresion gzip con middleware compression en Express |
| 186 | `ad733b3` | 2026-09-17 | maurovz25 | perf(frontend): optimizar calculo de kardex global pre-agrupando lotes y movimientos con Map |
| 187 | `6a9469d` | 2026-09-19 | maurovz25 | fix(auth): remover llamada redundante a router.refresh tras inicio de sesion |
| 188 | `ce78b8c` | 2026-09-19 | maurovz25 | perf(auth): implementar cache en memoria para tokens validados en middleware de autenticacion |
| 189 | `c67618b` | 2026-09-19 | maurovz25 | style(ui): ajustar contraste de fondo en componente Skeleton para estados de carga |
| 190 | `89ebbda` | 2026-09-19 | maurovz25 | perf(movimientos,kardex): condicionar inclusion de guias de salida solo cuando sea requerido |
| 191 | `55b94ef` | 2026-09-19 | maurovz25 | feat(backend): agregar endpoint de resumen de dashboard con consultas optimizadas y cache |
| 192 | `e714d1e` | 2026-09-19 | maurovz25 | perf(dashboard): migrar calculo client-side a endpoint de resumen e incorporar skeletons |
| 193 | `311c27a` | 2026-09-20 | maurovz25 | feat(ui): crear componente TableSkeleton para transiciones de carga fluidas |
| 194 | `1a563db` | 2026-09-20 | maurovz25 | feat(queries): extender hooks con soporte para conteos, estadisticas mensuales y paginacion |
| 195 | `8a949a6` | 2026-09-20 | maurovz25 | perf(sidebar,requerimientos): implementar endpoint liviano de conteo de pendientes y optimizar listado |
| 196 | `7a8b591` | 2026-09-20 | maurovz25 | perf(inventario,lotes): optimizar consulta consolidada con JSON_AGG y select podado |
| 197 | `dc82c21` | 2026-09-20 | maurovz25 | perf(salidas,ingresos,kardex): agregar endpoint de metricas mensuales y optimizar balance de kardex |
| 198 | `0af986f` | 2026-09-20 | maurovz25 | perf(usuarios): integrar TableSkeleton tematico reemplazando spinner centrado |
| 199 | `4ee0a54` | 2026-09-20 | maurovz25 | perf(dashboard): unificar metricas en consulta CTE, desplegar todas las alertas y habilitar cache SWR reactiva |
| 200 | `f986864` | 2026-10-13 | maurovz25 | fix(inventario): persistir lote inicial y stock en creacion atomica de producto |
| 201 | `a0cc8e4` | 2026-10-13 | maurovz25 | docs: agregar documentacion del proyecto y actualizar reglas de exclusion |
| 202 | `bd08ed3` | 2026-10-13 | maurovz25 | docs: agregar plantillas .env.example y sanitizar README |
| 203 | `39f875d` | 2026-10-13 | maurovz25 | feat(requerimientos): implementar asignacion FEFO determinista, correlativo seguro y autenticacion |
| 204 | `3c5d7a4` | 2026-10-13 | maurovz25 | test(backend): registrar script de ejecucion de pruebas unitarias fefo |
| 205 | `87c43af` | 2026-10-13 | maurovz25 | fix(backend): resolver error 503 en ia con fallback a gemini-2.5-flash, corregir calculo de inventario y habilitar streaming |
| 206 | `cb16281` | 2026-10-13 | maurovz25 | feat(frontend): rediseñar ui de asistente con paleta esmeralda e integrar streaming sse |
| 207 | `1c72b4b` | 2026-10-24 | Mauro | feat: initialize backend project with package.json and gitignore configuration |
| 208 | `5723df9` | 2026-10-26 | maurovz25 | chore(backend): configurar generadores de diagrama ERD y dependencias |
| 209 | `e1758bf` | 2026-10-26 | maurovz25 | fix(backend): remover generadores de diagramas ERD para despliegue en produccion |
| 210 | `d0a9362` | 2026-10-26 | maurovz25 | fix(backend): eliminar endpoint reset-inventory |
| 211 | `be3dd55` | 2026-10-26 | maurovz25 | feat(backend): agregar presencia de usuarios en memoria |
| 212 | `50970ab` | 2026-10-26 | maurovz25 | feat(backend): leer el rol solo desde app_metadata |
| 213 | `4d8fd38` | 2026-10-26 | maurovz25 | feat(backend): aplicar permisos por rol y exigir sesion en todas las rutas |
| 214 | `bd0c536` | 2026-10-26 | maurovz25 | fix(backend): tomar el usuario de auditoria desde la sesion verificada |
| 215 | `b300dc9` | 2026-10-26 | maurovz25 | feat(backend): edicion de usuarios con validaciones y protecciones |
| 216 | `4ae1f93` | 2026-10-26 | maurovz25 | fix(backend): restringir el sql generado por el asistente de ia |
| 217 | `ca4c905` | 2026-10-26 | maurovz25 | feat(frontend): leer el rol desde app_metadata y exigir rol asignado |
| 218 | `385131c` | 2026-10-26 | maurovz25 | chore(frontend): eliminar helper signUp sin uso |
| 219 | `c83502d` | 2026-10-26 | maurovz25 | feat(frontend): enviar heartbeat de presencia |
| 220 | `2e3cb11` | 2026-10-26 | maurovz25 | feat(frontend): redisenar la gestion de usuarios |
| 221 | `8877990` | 2026-10-26 | maurovz25 | style(frontend): cursor pointer en botones y elementos interactivos |
| 222 | `4f9a46a` | 2026-10-26 | maurovz25 | chore(backend): eliminar .env.example |
| 223 | `3612ca5` | 2026-11-02 | Mauro | test: versionar suites de pruebas del backend |
