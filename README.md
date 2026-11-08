# 🏥 SysFarm — Sistema de Gestión Farmacéutica y Trazabilidad Clínica

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5.20-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js" alt="Node Express" />
  <img src="https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma_ORM-5.22.0-2D3748?style=for-the-badge&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Google_Gemini-2.0-8E75C2?style=for-the-badge&logo=google" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind" />
</p>

---

## 📋 Tabla de Contenidos

1. [Visión General](#-visión-general)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
   - [Diagrama 1: Arquitectura de Componentes y Límites de Red](#diagrama-1-arquitectura-de-componentes-y-límites-de-red)
   - [Diagrama 2: Flujo Operativo de Requerimientos y Dispensación](#diagrama-2-flujo-operativo-de-requerimientos-y-dispensación)
   - [Diagrama 3: Flujo de Datos de Inventario, Lotes y Principio FEFO](#diagrama-3-flujo-de-datos-de-inventario-lotes-y-principio-fefo)
   - [Diagrama 4: Pipeline del Asistente IA Farmacéutico (Gemini)](#diagrama-4-pipeline-del-asistente-ia-farmacéutico-gemini)
3. [Módulos Principales](#-módulos-principales)
4. [Control de Acceso Basado en Roles (RBAC)](#-control-de-acceso-basado-en-roles-rbac)
5. [Estructura del Proyecto](#-estructura-del-proyecto)
6. [Instalación y Configuración](#-instalación-y-configuración)
   - [Prerrequisitos](#prerrequisitos)
   - [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
   - [Base de Datos y Prisma ORM](#base-de-datos-y-prisma-orm)
   - [Puesta en Marcha en Desarrollo](#puesta-en-marcha-en-desarrollo)
7. [Referencia de Endpoints API](#-referencia-de-endpoints-api)
8. [Auditoría, Cumplimiento Sanitario y Seguridad](#-auditoría-cumplimiento-sanitario-y-seguridad)
9. [Skill de Arquitectura (Archify)](#-skill-de-arquitectura-archify)

---

## 🌟 Visión General

**SysFarm** es una plataforma integral de gestión logística, farmacéutica y clínica diseñada para optimizar y asegurar la cadena de suministro hospitalaria en la **Clínica San Clemente**. 

El sistema responde a los rigurosos estándares sanitarios y regulatorios de DIGEMID y el sector salud, garantizando:
- **Trazabilidad Absoluta por Lote y Caducidad**: Despacho automatizado mediante el principio **FEFO (First Expired, First Out)**.
- **Cadena de Custodia Médica**: Control de estupefacientes y anestésicos con emisión de **Guías de Salida (GS)** con registro de CMP del médico tratante, paciente y número de receta médica.
- **Requerimientos por Áreas Hospitalarias**: Solicitudes centralizadas mediante plantillas parametrizables por servicio (Emergencia, Hospitalización, UCI, Quirófano).
- **Kardex Permanente Físico y Valorado**: Registro inmutable de transacciones con cálculo de costos y precios en tiempo real.
- **Asistente Inteligente Asistido por IA**: Motor impulsado por **Google Gemini 2.0** con *Function Calling* y ejecución segura en modo lectura de consultas analíticas sobre inventario y vencimientos.

---

## 🏛 Arquitectura del Sistema

La solución implementa una arquitectura desacoplada y escalable basada en micro-capas: un cliente SPA con Server Components en Next.js 15, un gateway de servicios REST en Express con TypeScript, una capa ORM con Prisma v5 sobre PostgreSQL (Supabase), y un orquestador de Inteligencia Artificial conectado a Google Gemini.

> 💡 **Diagramas Interactivos HTML**: SysFarm incluye artefactos interactivos de alta fidelidad compilados con la skill de **Archify** en la carpeta [`docs/architecture/`](./docs/architecture/).

---

### Diagrama 1: Arquitectura de Componentes y Límites de Red

Este diagrama ilustra la división de responsabilidades, seguridad perimetral, capas de persistencia y servicios externos.

* **Artefacto Interactivo HTML:** [01-system-architecture.html](./docs/architecture/01-system-architecture.html)

<p align="center">
  <a href="./docs/architecture/01-system-architecture.html">
    <img src="./docs/architecture/01-system-architecture.png" alt="Arquitectura General de Componentes SysFarm" width="100%" />
  </a>
</p>


```mermaid
graph TB
    subgraph Clientes ["Clientes y Usuarios"]
        U["Personal Clínico & Farmacia<br/>(Médicos, Farmacéuticos, Auditores, Admin)"]
    end

    subgraph AuthLayer ["Seguridad y Autenticación"]
        AUTH["Supabase Auth<br/>(JWT, PKCE, RBAC Claims)"]
    end

    subgraph FrontendApp ["Capa de Presentación (Frontend)"]
        NEXT["Next.js 15 App Router<br/>(React 19, Tailwind CSS, TanStack Query)"]
        PDF["Motor de Reportes<br/>(jsPDF + AutoTable)"]
    end

    subgraph BackendAPI ["Capa de Lógica de Negocio (Backend :3001)"]
        SEC["Security Layer<br/>(Helmet, CORS, Rate Limiters)"]
        GW["Express REST API Controllers<br/>(Products, Inventory, Batches, Requerimientos, Guías, IA)"]
        PRISMA["Prisma ORM Client v5<br/>(Transacciones Atómicas)"]
    end

    subgraph ExternalCloud ["Servicios en la Nube"]
        GEMINI["Google Gemini 2.0 AI<br/>(@google/genai Function Calling)"]
    end

    subgraph DataTier ["Capa de Datos y Persistencia (Supabase Cloud)"]
        PG[("PostgreSQL Database<br/>(Tablas Normalizadas & Pooling)")]
        AUDIT[("Ledger de Auditoría<br/>(ProductAudit & Movements)")]
    end

    U -->|Credenciales| AUTH
    U -->|HTTPS Web| NEXT
    NEXT -->|Genera reportes locales| PDF
    NEXT -->|REST API / Bearer Token| SEC
    SEC --> GW
    GW -->|Inferencia / SQL Tool| GEMINI
    GW -->|Consultas Tipadas| PRISMA
    PRISMA -->|TCP Connection Pool| PG
    PRISMA -->|Log Inmutable| AUDIT
```

---

### Diagrama 2: Flujo Operativo de Requerimientos y Dispensación

Modela el ciclo de vida de una solicitud médica desde su origen en el servicio clínico hasta su entrega y descargo en el Kardex.

* **Artefacto Interactivo HTML:** [02-workflow-requerimientos.html](./docs/architecture/02-workflow-requerimientos.html)

<p align="center">
  <a href="./docs/architecture/02-workflow-requerimientos.html">
    <img src="./docs/architecture/02-workflow-requerimientos.png" alt="Flujo Operativo de Requerimientos y Dispensación" width="100%" />
  </a>
</p>


```mermaid
sequenceDiagram
    autonumber
    actor Clinico as Personal Clínico (Solicitante)
    participant UI as SysFarm Web UI
    participant Backend as Express API (Requerimientos)
    participant Farmacia as Farmacéutico / Lotes FEFO
    participant Kardex as Kardex & Movimientos
    participant Guia as Guías Especiales GS

    Clinico->>UI: Selecciona plantilla de su Área y completa cantidades
    UI->>Backend: POST /api/requerimientos (Estado: PENDIENTE)
    Backend-->>Farmacia: Notificación en Bandeja de Despacho
    Farmacia->>Farmacia: Inspección técnica y verificación de stock FEFO
    alt Stock Insuficiente o Rechazo
        Farmacia->>Backend: PUT /api/requerimientos/:id/estado (RECHAZADO + Motivo)
        Backend-->>UI: Notifica rechazo clínico al solicitante
    else Aprobado
        Farmacia->>Farmacia: Asigna lotes físicos con fecha más próxima (FEFO)
        Farmacia->>Backend: PUT /api/requerimientos/:id/despachar (Cantidades + Lotes)
        Backend->>Kardex: Registra Movement (Salida atómica por lote)
        opt Fármaco de Anestesiología / Control Especial
            Backend->>Guia: Genera Guía de Salida (GS-X, CMP Médico, Paciente, Receta)
        end
        Backend-->>UI: Estado actualizado a DESPACHADO + Comprobante PDF
    end
```

---

### Diagrama 3: Flujo de Datos de Inventario, Lotes y Principio FEFO

Muestra la transición y validación de los datos a lo largo de las 5 etapas operativas del inventario farmacológico.

* **Artefacto Interactivo HTML:** [03-dataflow-inventario-fefo.html](./docs/architecture/03-dataflow-inventario-fefo.html)

<p align="center">
  <a href="./docs/architecture/03-dataflow-inventario-fefo.html">
    <img src="./docs/architecture/03-dataflow-inventario-fefo.png" alt="Flujo de Datos de Inventario, Lotes y Principio FEFO" width="100%" />
  </a>
</p>


```mermaid
flowchart LR
    subgraph E1 ["1. Ingesta"]
        PROV["Proveedores / Facturas"]
        EXCEL["Carga Masiva Excel<br/>(Artículos.xlsx)"]
    end

    subgraph E2 ["2. Catálogo & Reglas"]
        INSPEC["Inspección DIGEMID<br/>(Reg. Sanitario)"]
        CATALOG["Catálogo Maestro<br/>(Product, GTIN, Tipo)"]
    end

    subgraph E3 ["3. Gestión FEFO"]
        BATCH["Control de Lotes<br/>(Batch, Caducidad, Costos)"]
        SEMAFORO["Semáforo de Vencimiento<br/>(&lt;90, 60, 30 días)"]
    end

    subgraph E4 ["4. Operación"]
        REQ["Requerimientos por Áreas"]
        MOV["Motor de Movimientos<br/>(Ingreso / Salida / Ajuste)"]
        GS["Guías GS Controladas<br/>(CMP, Paciente, Receta)"]
    end

    subgraph E5 ["5. Auditoría & Analítica"]
        KARDEX["Kardex Físico-Valorado<br/>(Saldo Inmutable)"]
        KPI["Dashboard & Métricas<br/>(Rotación, Quiebres)"]
        AUDIT["ProductAudit Log<br/>(Trazabilidad de Precios)"]
    end

    PROV --> INSPEC
    EXCEL --> CATALOG
    INSPEC --> CATALOG
    CATALOG --> BATCH
    BATCH --> SEMAFORO
    BATCH --> REQ
    REQ --> MOV
    MOV --> GS
    MOV --> KARDEX
    MOV --> KPI
    MOV --> AUDIT
```

---

### Diagrama 4: Pipeline del Asistente IA Farmacéutico (Gemini)

Describe el mecanismo de interacción en lenguaje natural mediante Function Calling seguro de solo lectura contra la base de datos.

* **Artefacto Interactivo HTML:** [04-sequence-asistente-ia.html](./docs/architecture/04-sequence-asistente-ia.html)

<p align="center">
  <a href="./docs/architecture/04-sequence-asistente-ia.html">
    <img src="./docs/architecture/04-sequence-asistente-ia.png" alt="Pipeline del Asistente IA Farmacéutico Gemini" width="100%" />
  </a>
</p>


```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Farmacéutico / Médico
    participant UI as Chat UI (/asistente)
    participant RateLimiter as Rate Limiter IA (15 req/min)
    participant Controller as IA Controller (Express)
    participant Gemini as Google Gemini 2.0
    participant DB as PostgreSQL (Supabase)

    Usuario->>UI: "¿Qué lotes de Paracetamol vencen este mes y cuánto stock queda?"
    UI->>RateLimiter: POST /api/ia/chat { mensaje }
    RateLimiter->>Controller: Petición autorizada dentro de cuota
    Controller->>Gemini: Generación con system prompt, DB_SCHEMA y tool "execute_sql"
    Gemini-->>Controller: Tool Call: execute_sql("SELECT ... FROM Batch WHERE ...")
    Controller->>Controller: Valida sanitización SQL (estrictamente SELECT de solo lectura)
    Controller->>DB: Prisma.$queryRawUnsafe(query)
    DB-->>Controller: Filas retornadas con códigos de lote, stock y fechas
    Controller->>Gemini: Tool Result: { resultado: dataset }
    Gemini-->>Controller: Respuesta contextualizada con recomendaciones sanitarias
    Controller-->>UI: 200 OK: { respuesta, sqlEjecutado }
    UI-->>Usuario: Renderiza respuesta conversacional con badges y SQL auditable
```

---

## 🧩 Módulos Principales

### 1. Catálogo Maestro de Productos (`Product`)
- Soporte para **Medicamentos** y **Dispositivos Médicos**.
- Código de barras / GTIN único, registro sanitario, laboratorio fabricante.
- Presentación comercial vs. unidad base (factor de conversión de cajas a ampollas/tabletas).
- Control de stock mínimo con alertas preventivas de quiebre.

### 2. Gestión de Lotes y Principio FEFO (`Batch`)
- Cada producto puede contar con múltiples lotes físicos simultáneos.
- Control de fechas de expiración con semáforo preventivo.
- Costo y precio de venta configurables por lote y por presentación.
- Eliminación lógica (*soft deletes*) preservando histórico de compras.

### 3. Requerimientos Hospitalarios por Áreas (`Requerimiento`)
- Registro de solicitudes de piso clínico con código correlativo (`REQ-XXXX`).
- Integración de **Plantillas de Requerimiento** por área médica (UCI, Emergencia, etc.).
- Flujo de estados: `PENDIENTE` ➔ `DESPACHADO` / `RECHAZADO` / `CANCELADO`.
- Aprobación cuantitativa parcial o total según existencia física en farmacia.

### 4. Guías de Salida Médicas (`GuiaSalida`)
- Generación de guías oficiales con numeración correlativa atómica (`GS-1`, `GS-2`, ...).
- Requisito indispensable para estupefacientes y medicamentos de anestesia.
- Almacena nombre del anestesiólogo, CMP, paciente, DNI, dirección y número de receta médica.

### 5. Kardex Físico y Valorado (`Movement`)
- Trazabilidad atómica de movimientos: Ingresos, Salidas y Ajustes.
- Vínculo directo entre cada movimiento, su producto, lote específico y usuario responsable.
- Generación y exportación de reportes oficiales en formato PDF y Excel.

### 6. Asistente Clínico Inteligente con Gemini 2.0 (`ia`)
- Módulo conversacional capaz de interpretar preguntas en lenguaje natural sobre existencias, costos y caducidades.
- Genera y ejecuta consultas SQL de sólo lectura automáticamente en tiempo real.
- Protegido por rate-limiting especializado para evitar costos imprevistos y agotamiento de tokens.

---

## 🔐 Control de Acceso Basado en Roles (RBAC)

El sistema implementa 5 roles claramente delimitados para asegurar la segregación de funciones:

| Rol | Alcance y Permisos | Rutas Principales Permitidas |
|---|---|---|
| **ADMIN** | Acceso total al sistema, gestión de usuarios, roles, catálogo, movimientos y métricas. | `/dashboard`, `/inventario`, `/lotes`, `/kardex`, `/ingresos`, `/salidas`, `/requerimientos`, `/usuarios`, `/asistente` |
| **FARMACEUTICO** | Control operativo de farmacia, recepción, aprobación y despacho de requerimientos, emisión de guías. | `/dashboard`, `/inventario`, `/lotes`, `/kardex`, `/ingresos`, `/salidas`, `/requerimientos`, `/asistente` |
| **VENDEDOR** | Registro de ventas y consultas de stock disponible en punto de atención. | `/inventario`, `/lotes`, `/salidas` |
| **SOLICITANTE** | Médicos y enfermeros de áreas clínicas; exclusivo para emitir y consultar sus requerimientos. | `/requerimientos` *(Redirección obligatoria)* |
| **AUDITOR** | Acceso de solo lectura para fiscalización de existencias, auditoría de precios y movimientos. | `/inventario`, `/lotes`, `/kardex` *(Redirección obligatoria)* |

---

## 📂 Estructura del Proyecto

```text
sysfarm/
├── .agents/                        # Customizaciones y Skills de Antigravity
│   └── skills/
│       └── archify/                # Skill Archify para diagramas de arquitectura
├── backend/                        # API REST en Node.js, Express y TypeScript
│   ├── prisma/
│   │   ├── schema.prisma           # Esquema relacional y modelos de base de datos
│   │   └── migrations/             # Historial de migraciones SQL
│   ├── scripts/                    # Scripts de mantenimiento y limpieza
│   ├── src/
│   │   ├── controllers/            # Controladores REST por dominio de negocio
│   │   ├── middlewares/            # Control de acceso y validadores
│   │   ├── routes/                 # Definición de rutas Express
│   │   ├── app.ts                  # Configuración de Express, CORS, Helmet y Rate Limiting
│   │   ├── prisma.ts               # Instancia singleton de PrismaClient
│   │   └── server.ts               # Punto de entrada del servidor (:3001)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                       # Interfaz de Usuario en Next.js 15 (App Router)
│   ├── app/
│   │   ├── (auth)/                 # Flujo de autenticación (Login)
│   │   ├── (dashboard)/            # Vistas protegidas por RBAC
│   │   │   ├── asistente/          # Chat con Asistente Gemini IA
│   │   │   ├── dashboard/          # Métricas analíticas y KPIs
│   │   │   ├── ingresos/           # Registro de ingresos y compras
│   │   │   ├── inventario/         # Catálogo de productos y stock
│   │   │   ├── kardex/             # Libro de movimientos y saldos
│   │   │   ├── lotes/              # Semáforo de lotes y vencimientos
│   │   │   ├── requerimientos/     # Bandeja y creación de pedidos por área
│   │   │   ├── salidas/            # Emisión de salidas y guías especiales
│   │   │   └── usuarios/           # Administración de cuentas y roles
│   ├── components/                 # Componentes reutilizables (UI, Tablas, Modales)
│   ├── hooks/                      # Custom hooks (useUserRole, etc.)
│   ├── lib/                        # Clientes de API, Supabase, utilidades
│   ├── package.json
│   └── tsconfig.json
├── docs/                           # Documentación técnica, manuales y arquitectura
│   ├── architecture/               # Diagramas interactivos HTML y candidatos Archify
│   │   ├── 01-system-architecture.html
│   │   ├── 02-workflow-requerimientos.html
│   │   ├── 03-dataflow-inventario-fefo.html
│   │   └── 04-sequence-asistente-ia.html
│   └── manual-solicitante.html     # Manual de usuario para el rol Solicitante
└── README.md                       # Documentación principal del repositorio
```

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- **Node.js**: versión `>= 20.9.0` (recomendado v22 LTS).
- **pnpm** o **npm** para la gestión de dependencias.
- Cuenta y proyecto en **Supabase** (PostgreSQL).
- API Key de **Google Gemini** (a través de Google AI Studio).

---

### Configuración de Variables de Entorno

Copie las plantillas `.env.example` en ambos entornos y configure sus valores:

#### 1. Backend (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

Contenido de referencia:
```env
PORT=3001

# Conexión a Base de Datos (Supabase)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-1-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-1-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Auth
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="tu_supabase_anon_publishable_key"
SUPABASE_SERVICE_ROLE_KEY="tu_supabase_service_role_key_secreta"

# Inteligencia Artificial (Google Gemini 2.0)
GEMINI_API_KEY="tu_google_gemini_api_key"
```

#### 2. Frontend (`frontend/.env.local`)

```bash
cd frontend
cp .env.example .env.local
```

Contenido de referencia:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_publishable_key
```

---

### Base de Datos y Prisma ORM

En el directorio `backend`:

```bash
# 1. Instalar dependencias del backend
cd backend
pnpm install

# 2. Generar cliente tipado de Prisma
pnpm prisma generate

# 3. Aplicar migraciones pendientes
pnpm prisma migrate dev
```

---

### Puesta en Marcha en Desarrollo

Para ejecutar ambos entornos de forma concurrente:

#### Servidor Backend (Puerto 3001)
```bash
cd backend
pnpm dev
```
*El API iniciará en `http://localhost:3001`.*

#### Servidor Frontend (Puerto 3000)
```bash
cd frontend
pnpm install
pnpm dev
```
*La aplicación web estará disponible en `http://localhost:3000`.*

---

## 📡 Referencia de Endpoints API

Todas las rutas están bajo el prefijo `/api` y cuentan con control de tasa general (500 solicitudes por 15 minutos).

| Módulo | Método | Endpoint | Descripción |
|---|---|---|---|
| **Productos** | `GET` | `/api/products` | Listado paginado con filtros de búsqueda y stock |
| | `POST` | `/api/products` | Creación de nuevo producto en catálogo |
| | `PUT` | `/api/products/:id` | Actualización con registro en `ProductAudit` |
| | `DELETE` | `/api/products/:id` | Eliminación lógica (*soft delete*) |
| **Lotes** | `GET` | `/api/batches` | Listado de lotes con estados de expiración y stock |
| | `POST` | `/api/batches` | Alta de nuevo lote físico asociado a un producto |
| | `PUT` | `/api/batches/:id` | Modificación de costos, precios o caducidad |
| **Inventario** | `GET` | `/api/inventory/kardex` | Reporte completo de Kardex físico-valorado |
| | `POST` | `/api/inventory/movement` | Registro atómico de entrada, salida o ajuste |
| | `POST` | `/api/inventory/import-excel` | Carga masiva de catálogo vía Excel |
| **Requerimientos**| `GET` | `/api/requerimientos` | Listado de requerimientos con filtros por estado |
| | `POST` | `/api/requerimientos` | Creación de solicitud por área clínica |
| | `PUT` | `/api/requerimientos/:id/despachar` | Despacho formal con asignación de lotes FEFO |
| | `PUT` | `/api/requerimientos/:id/estado` | Cambio de estado (Rechazado / Cancelado) |
| **Guías de Salida**| `GET` | `/api/guias` | Listado de guías de salida emitidas |
| | `POST` | `/api/guias` | Emisión de guía correlativa GS para anestésicos |
| **Plantillas** | `GET` | `/api/plantillas` | Listado de plantillas de pedido por área médica |
| | `POST` | `/api/plantillas` | Creación de plantilla con ítems preconfigurados |
| **Áreas** | `GET` | `/api/areas` | Áreas clínicas activas de la institución |
| **Dashboard** | `GET` | `/api/dashboard/metrics` | Métricas de rotación, productos críticos y valorizado |
| **Asistente IA** | `POST` | `/api/ia/chat` | Consulta conversacional protegida (15 req/min) |

---

## 🛡 Auditoría, Cumplimiento Sanitario y Seguridad

1. **Inmutabilidad de Movimientos**: Los registros en la tabla `Movement` y `GuiaSalida` mantienen consistencia transaccional mediante Prisma `$transaction`, previniendo inconsistencias de saldos en situaciones de concurrencia.
2. **Blindaje de Cabeceras y Ataques**: Implementación de `helmet()` para cabeceras HTTP seguras, compresión `gzip/brotli` mediante `compression()`, y políticas estrictas de CORS.
3. **Sandbox de Consultas IA**: El controlador `/api/ia` analiza los comandos emitidos por Gemini, asegurando que únicamente se ejecuten sentencias `SELECT` de sólo lectura, bloqueando cualquier sentencia destructiva (`DROP`, `DELETE`, `UPDATE`, `ALTER`).
4. **Trazabilidad de Precios (`ProductAudit`)**: Toda alteración en el valor de costo o venta almacena un registro histórico con el valor previo, el nuevo valor, el usuario responsable y la marca de tiempo.

---

## 📐 Skill de Arquitectura (Archify)

El repositorio cuenta con la skill de **Archify** instalada en `.agents/skills/archify/`, la cual permite generar, validar y compilar diagramas técnicos en HTML autocontenido con SVG en línea y verificación de calidad.

Para regenerar o validar cualquiera de los diagramas:

```bash
# Diagnóstico de la herramienta
node .agents/skills/archify/bin/archify.mjs doctor

# Compilar y validar el diagrama de arquitectura
node .agents/skills/archify/bin/archify.mjs finalize architecture docs/architecture/01-system-architecture.candidate.json docs/architecture/01-system-architecture.html --quality showcase --json

# Compilar y validar el diagrama de workflow
node .agents/skills/archify/bin/archify.mjs finalize workflow docs/architecture/02-workflow-requerimientos.candidate.json docs/architecture/02-workflow-requerimientos.html --quality showcase --json

# Compilar y validar el diagrama de flujo de datos
node .agents/skills/archify/bin/archify.mjs finalize dataflow docs/architecture/03-dataflow-inventario-fefo.candidate.json docs/architecture/03-dataflow-inventario-fefo.html --quality showcase --json

# Compilar y validar el diagrama de secuencia de IA
node .agents/skills/archify/bin/archify.mjs finalize sequence docs/architecture/04-sequence-asistente-ia.candidate.json docs/architecture/04-sequence-asistente-ia.html --quality showcase --json
```

---

<p align="center">
  <b>Clínica San Clemente — SysFarm</b><br/>
  <i>Sistema de Gestión Farmacéutica Hospitalaria y Trazabilidad de Medicamentos</i>
</p>
