import { Request, Response } from 'express';
import { GoogleGenAI, Type, Content, Part } from '@google/genai';
import prisma from '../prisma';
import { extractPlan, findDisallowedAccess, SqlGuardError } from '../utils/sql-guard';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

/**
 * Ejecuta una llamada a Gemini con reintento automático en modelos de respaldo
 * en caso de recibir 503 (alta demanda) o 429 de Google.
 */
async function callGeminiWithFallback<T>(fn: (model: string) => Promise<T>): Promise<{ result: T; usedModel: string }> {
    const preferred = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const modelsToTry = [preferred, ...FALLBACK_MODELS.filter(m => m !== preferred)];
    let lastError: any;

    for (const model of modelsToTry) {
        try {
            const result = await fn(model);
            return { result, usedModel: model };
        } catch (err: any) {
            lastError = err;
            const isUnavailable = err.status === 503 || 
                                 err.status === 429 || 
                                 err.message?.includes('503') || 
                                 err.message?.includes('UNAVAILABLE') || 
                                 err.message?.includes('high demand') ||
                                 err.message?.includes('quota');
            if (isUnavailable && model !== modelsToTry[modelsToTry.length - 1]) {
                console.warn(`[IA] Modelo ${model} temporalmente no disponible (${err.status || 503}). Reintentando automáticamente con modelo de respaldo...`);
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

// Schema real de la base de datos para que Gemini conozca la estructura exacta
const DB_SCHEMA = `
Base de datos PostgreSQL de SysFarm (Sistema de Gestión Farmacéutica):

TABLA "Product" (Catálogo de Productos y Medicamentos):
- id: UUID (PK)
- nombre: TEXT (nombre del producto/medicamento)
- "codigoBarras": TEXT UNIQUE (código de barras o GTIN, puede ser NULL)
- descripcion: TEXT
- tipo: TEXT ("MEDICAMENTO" o "DISPOSITIVO_MEDICO")
- "registroSanitario": TEXT
- presentacion: TEXT (ej: "Caja x 100 tabletas", "Frasco 120ml", "Ampolla 2ml")
- "unidadBase": TEXT (ej: "Tableta", "Frasco", "Ampolla", "Cápsula")
- "stockMinimo": INT (umbral mínimo de stock antes de alerta)
- "deletedAt": TIMESTAMP (NULL = producto activo, con fecha = eliminado)
- "createdAt": TIMESTAMP
- "updatedAt": TIMESTAMP

TABLA "Batch" (Lotes físicos en almacén con existencias y precios):
- id: UUID (PK)
- codigo: TEXT (código o número de lote del fabricante)
- "fechaExpiracion": TIMESTAMP (fecha de vencimiento)
- "stockActual": INT (existencias disponibles en unidades base)
- "cantidadPorPresentacion": INT (unidades base contenidas en una presentación/caja, ej: 10, 20, 100)
- "precioCostoPresentacion": FLOAT (precio de costo por caja/presentación completa en S/)
- "precioVentaPresentacion": FLOAT (precio de venta por caja/presentación completa en S/)
- laboratorio: TEXT (laboratorio fabricante)
- "deletedAt": TIMESTAMP (NULL = lote activo, con fecha = lote eliminado)
- "productId": UUID (FK → Product.id)
- "createdAt": TIMESTAMP
- "updatedAt": TIMESTAMP

TABLA "Movement" (Kardex / Movimientos de inventario):
- id: UUID (PK)
- tipo: TEXT ("Ingreso" o "Salida")
- cantidad: INT (cantidad en unidades base)
- fecha: TIMESTAMP
- motivo: TEXT (ej: "Compra a proveedor", "Dispensación médica", "Ajuste")
- usuario: TEXT (nombre o email del operador)
- departamento: TEXT (departamento o servicio hospitalario destino)
- proveedor: TEXT (proveedor en ingresos)
- "productId": UUID (FK → Product.id)
- "batchId": UUID (FK → Batch.id, puede ser NULL)

TABLA "Requerimiento" (Solicitudes internas de medicamentos por servicios):
- id: UUID (PK)
- codigo: TEXT (código secuencial ej: "REQ-00001")
- solicitante: TEXT
- departamento: TEXT
- estado: TEXT ("PENDIENTE", "DESPACHADO", "RECHAZADO", "CANCELADO")
- observaciones: TEXT
- "createdAt": TIMESTAMP

TABLA "GuiaSalida" (Guías de salida de medicamentos y estupefacientes):
- id: UUID (PK)
- codigo: TEXT (ej: "GS-1")
- "medicoAnestesiologo": TEXT
- "cmpMedico": TEXT
- paciente: TEXT
- "dniPaciente": TEXT
- "numeroReceta": TEXT
- "medicamentoNombre": TEXT
- "loteCodigo": TEXT
- cantidad: INT
- "fechaSalida": TIMESTAMP

TABLA "User" (Usuarios del sistema):
- id: UUID (PK)
- email: TEXT UNIQUE
- nombre: TEXT
- role: TEXT ("admin", "farmaceutico", "vendedor", "solicitante", "auditor")

TABLA "ProductAudit" (Historial de ediciones a productos):
- id: UUID (PK)
- "productId": UUID (FK → Product.id)
- "productName": TEXT
- "campoEditado": TEXT
- "valorAnterior": TEXT
- "valorNuevo": TEXT
- usuario: TEXT
- fecha: TIMESTAMP

REGLAS CRÍTICAS DE VALORIZACIÓN Y CONSULTAS SQL:
1. NO EXISTEN las columnas "precioCostoUnidad" ni "precioVentaUnidad" en ninguna tabla.
2. El costo unitario por unidad base de un lote se calcula:
   ("precioCostoPresentacion" / NULLIF("cantidadPorPresentacion", 0))
3. El precio de venta unitario de un lote se calcula:
   ("precioVentaPresentacion" / NULLIF("cantidadPorPresentacion", 0))
4. Para calcular el VALOR TOTAL DEL INVENTARIO (a costo):
   SELECT ROUND(CAST(SUM("stockActual" * ("precioCostoPresentacion" / NULLIF("cantidadPorPresentacion", 0))) AS numeric), 2) AS "totalCostoInventario"
   FROM "Batch"
   WHERE "deletedAt" IS NULL AND "stockActual" > 0;
5. Para calcular el stock total de un producto:
   SELECT p.nombre, COALESCE(SUM(b."stockActual"), 0) AS "stockTotal"
   FROM "Product" p
   LEFT JOIN "Batch" b ON b."productId" = p.id AND b."deletedAt" IS NULL
   WHERE p."deletedAt" IS NULL
   GROUP BY p.id, p.nombre;
6. Todos los nombres de tablas deben ir entre comillas dobles: "Product", "Batch", "Movement", "User", "ProductAudit", "Requerimiento", "GuiaSalida".
7. Todas las columnas camelCase deben ir entre comillas dobles: "stockActual", "cantidadPorPresentacion", "precioCostoPresentacion", "precioVentaPresentacion", "fechaExpiracion", "deletedAt", "productId", "batchId".
8. La moneda es Soles (S/).
`;

const SYSTEM_PROMPT = `Eres "SysFarm IA", asistente de un sistema de gestión farmacéutica. Responde en español, de forma concisa y directa. Usa la herramienta ejecutar_sql cuando necesites datos. Solo genera SELECT. Precios en S/. Si la pregunta no es sobre el sistema, indícalo amablemente.

${DB_SCHEMA}`;

// Definición de la herramienta para Gemini
const sqlTool = {
    functionDeclarations: [
        {
            name: 'ejecutar_sql',
            description: 'Ejecuta una consulta SQL SELECT en la base de datos PostgreSQL de SysFarm para obtener información sobre productos, lotes, movimientos, usuarios y auditorías. Solo se permiten consultas SELECT.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    query: {
                        type: Type.STRING,
                        description: 'La consulta SQL SELECT a ejecutar. DEBE ser una consulta SELECT válida de PostgreSQL. Los nombres de tablas y columnas con mayúsculas deben ir entre comillas dobles.'
                    }
                },
                required: ['query']
            }
        }
    ]
};

// Palabras clave prohibidas en SQL
const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER',
    'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC',
    'EXECUTE', 'CALL', 'COPY', 'VACUUM', 'MERGE',
    'REPLACE', 'INTO', 'VALUES'
];

// Funciones o patrones peligrosos en PostgreSQL
const FORBIDDEN_PATTERNS = [
    'PG_SLEEP', 'PG_READ_FILE', 'PG_LS_DIR', 'PG_READ_BINARY_FILE',
    'PG_WRITE_FILE', 'PG_EXECUTE', 'TO PROGRAM', 'DBLINK',
    'PG_SHADOW', 'PG_AUTHID', 'PG_USER', 'PG_DATABASE',
    'INFORMATION_SCHEMA', 'PG_CLASS', 'PG_PROC', 'PG_NAMESPACE',
    // Ejecutan SQL arbitrario desde un texto, cambian el rol de la sesión o tocan el servidor
    'QUERY_TO_XML', 'QUERY_TO_XMLSCHEMA', 'QUERY_TO_XML_AND_XMLSCHEMA', 'TABLE_TO_XML',
    'SET_CONFIG', 'PG_TERMINATE_BACKEND', 'PG_CANCEL_BACKEND', 'LO_IMPORT', 'LO_EXPORT',
    // Esquemas internos de Supabase (credenciales, tokens, archivos)
    'AUTH', 'STORAGE', 'VAULT', 'REALTIME', 'PG_CATALOG', 'PG_STAT_ACTIVITY'
];

// Las consultas generadas por el modelo se ejecutan así:
//  1. En una transacción de SOLO LECTURA (ninguna escritura es posible, ni escondida en una función).
//  2. Con límite de tiempo, para que una consulta pesada no tumbe la base.
//  3. Solo si el plan de ejecución (EXPLAIN) muestra que únicamente toca las tablas de la aplicación
//     (ver utils/sql-guard.ts): sin esquemas auth/storage/pg_catalog, aunque estén dentro de un CTE o subconsulta.
const IA_QUERY_TIMEOUT_MS = 5000;

async function runReadOnlyQuery(query: string) {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${IA_QUERY_TIMEOUT_MS}`);

        const plan = extractPlan(await tx.$queryRawUnsafe(`EXPLAIN (FORMAT JSON, VERBOSE) ${query}`));
        const violations = findDisallowedAccess(plan);
        if (violations.length > 0) {
            throw new SqlGuardError(violations);
        }

        return tx.$queryRawUnsafe(query);
    }, { maxWait: 5000, timeout: 10000 });
}

function validateSQL(query: string): { valid: boolean; error?: string } {
    // Limpiar comentarios para evitar bypasses tipo: SE/*...*/LECT o -- comment
    const cleanQuery = query.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*/g, '');
    const upperQuery = cleanQuery.toUpperCase().trim();

    // Debe empezar obligatoriamente con SELECT o WITH tras limpiar espacios/paréntesis
    const normalizedQuery = upperQuery.replace(/^\s*\(\s*/, ''); // Quitar paréntesis iniciales si los hay
    if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('WITH')) {
        return { valid: false, error: 'Solo se permiten consultas SELECT.' };
    }

    // Bloquear consultas múltiples (queries apiladas) usando punto y coma intermedio
    const queryWithoutTrailingSemicolon = cleanQuery.trim().replace(/;$/, '');
    if (queryWithoutTrailingSemicolon.includes(';')) {
        return { valid: false, error: 'No se permiten múltiples consultas (queries apiladas).' };
    }

    // Verificar palabras clave prohibidas
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            return { valid: false, error: `Operación no permitida: ${keyword}` };
        }
    }

    // Verificar funciones o patrones peligrosos
    for (const pattern of FORBIDDEN_PATTERNS) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        if (regex.test(cleanQuery)) {
            return { valid: false, error: `Función o recurso del sistema no permitido: ${pattern}` };
        }
    }

    return { valid: true };
}

function ensureLimit(query: string): string {
    const upperQuery = query.toUpperCase().trim();
    if (!upperQuery.includes('LIMIT')) {
        const cleanQuery = query.trim().replace(/;$/, '');
        return `${cleanQuery} LIMIT 50`;
    }
    return query;
}

// Corregir nombres de tablas y columnas sin comillas dobles
// PostgreSQL trata los identificadores sin comillas como minúsculas,
// pero nuestras tablas usan PascalCase y las columnas camelCase
function fixTableAndColumnNames(query: string): string {
    // Tablas PascalCase
    const tables = [
        'Product', 'Batch', 'Movement', 'User', 'ProductAudit',
        'Requerimiento', 'RequerimientoItem', 'GuiaSalida', 'Area', 'PlantillaRequerimiento'
    ];
    // Columnas camelCase y PascalCase
    const columns = [
        'codigoBarras', 'registroSanitario', 'unidadBase', 'cantidadPorPresentacion',
        'stockMinimo', 'precioCostoPresentacion', 'precioVentaPresentacion',
        'createdAt', 'updatedAt', 'fechaExpiracion', 'stockActual', 'deletedAt',
        'productId', 'batchId', 'campoEditado', 'valorAnterior', 'valorNuevo',
        'productName', 'requerimientoId', 'cantidadSolicitada', 'cantidadAprobada',
        'tipoUnidad', 'atendidoPor', 'motivoRechazo', 'fechaAtencion',
        'medicoAnestesiologo', 'cmpMedico', 'dniPaciente', 'direccionPaciente',
        'distritoPaciente', 'numeroReceta', 'fechaSalida', 'fechaEmision',
        'medicamentoNombre', 'loteCodigo', 'unidadMedida', 'usuarioEmisor', 'movementId'
    ];

    let fixed = query;

    // Corrección defensiva: si el modelo intenta usar precioCostoUnidad o precioVentaUnidad que no existen físicamente en la BD
    fixed = fixed.replace(/"?precioCostoUnidad"?/gi, '("precioCostoPresentacion" / NULLIF("cantidadPorPresentacion", 0))');
    fixed = fixed.replace(/"?precioVentaUnidad"?/gi, '("precioVentaPresentacion" / NULLIF("cantidadPorPresentacion", 0))');

    // Corregir tablas: reemplazar Product (sin comillas) por "Product"
    for (const table of tables) {
        const regex = new RegExp(`(?<!")\\b${table}\\b(?!")`, 'g');
        fixed = fixed.replace(regex, `"${table}"`);
    }

    // Corregir columnas: reemplazar col (sin comillas) por "col"
    for (const col of columns) {
        const regex = new RegExp(`(?<!")\\b${col}\\b(?!")`, 'g');
        fixed = fixed.replace(regex, `"${col}"`);
    }

    return fixed;
}

// Serializer para BigInt (Prisma devuelve BigInt en COUNT, SUM, etc.)
function serializeResults(data: any): any {
    return JSON.parse(JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? Number(value) : value
    ));
}

export const chat = async (req: Request, res: Response) => {
    try {
        const { mensaje, historial } = req.body;

        if (!mensaje || typeof mensaje !== 'string') {
            return res.status(400).json({ error: 'El campo "mensaje" es requerido.' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'La API Key de Gemini no está configurada.' });
        }

        // Construir el historial de conversación para Gemini
        const contents: Content[] = [];

        // Agregar historial previo si existe
        if (historial && Array.isArray(historial)) {
            for (const msg of historial) {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                });
            }
        }

        // Agregar el mensaje actual del usuario
        contents.push({
            role: 'user',
            parts: [{ text: mensaje }]
        });

        const shouldStream = req.body.stream === true || req.headers.accept === 'text/event-stream';

        // Primera llamada a Gemini con fallback automático
        let activeModel = DEFAULT_MODEL;
        const initialCall = await callGeminiWithFallback(async (model) => {
            return ai.models.generateContent({
                model,
                contents,
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    tools: [sqlTool],
                    thinkingConfig: { thinkingBudget: 0 },
                }
            });
        });
        let response = initialCall.result;
        activeModel = initialCall.usedModel;

        // Procesar tool calls en un bucle (la IA puede necesitar múltiples consultas)
        let maxIterations = 3;
        let iteration = 0;

        while (iteration < maxIterations) {
            // Verificar si hay function calls usando el atajo del SDK
            const functionCalls = response.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
                // No hay function calls, tenemos la respuesta final
                break;
            }

            // Agregar la respuesta del modelo (con function call) al historial
            if (response.candidates?.[0]?.content) {
                contents.push(response.candidates[0].content);
            }

            // Procesar cada function call
            const functionResponseParts: Part[] = [];

            for (const fc of functionCalls) {
                if (fc.name === 'ejecutar_sql' && fc.args?.query) {
                    const sqlQuery = fc.args.query as string;
                    // Limpiar comentarios antes de validar y ejecutar para evitar discrepancias
                    const cleanSQL = sqlQuery.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*/g, '');
                    const validation = validateSQL(cleanSQL);
                    let result: any;

                    if (!validation.valid) {
                        result = { error: validation.error };
                    } else {
                        try {
                            const fixedQuery = fixTableAndColumnNames(cleanSQL);
                            const safeQuery = ensureLimit(fixedQuery);
                            console.log(`[IA] Ejecutando SQL: ${safeQuery}`);
                            const rawResults = await runReadOnlyQuery(safeQuery);
                            const results = serializeResults(rawResults);
                            result = {
                                success: true,
                                data: results,
                                rowCount: Array.isArray(results) ? results.length : 0
                            };
                        } catch (dbError: any) {
                            console.error('[IA] Error SQL:', dbError.message);
                            result = { error: `Error en la consulta SQL: ${dbError.message}` };
                        }
                    }

                    functionResponseParts.push({
                        functionResponse: {
                            name: 'ejecutar_sql',
                            response: result,
                        }
                    });
                }
            }

            // Agregar las respuestas de las funciones al historial
            contents.push({
                role: 'user',
                parts: functionResponseParts,
            });

            // Llamar a Gemini de nuevo con los resultados (usando fallback)
            const loopCall = await callGeminiWithFallback(async (model) => {
                return ai.models.generateContent({
                    model,
                    contents,
                    config: {
                        systemInstruction: SYSTEM_PROMPT,
                        tools: [sqlTool],
                        thinkingConfig: { thinkingBudget: 0 },
                    }
                });
            });
            response = loopCall.result;
            activeModel = loopCall.usedModel;

            iteration++;
        }

        // Si el cliente solicitó streaming SSE
        if (shouldStream) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();

            try {
                // Verificar si ya tenemos texto en candidates
                let directText = '';
                const parts = response.candidates?.[0]?.content?.parts;
                if (parts) {
                    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
                    if (textParts.length > 0) {
                        directText = textParts.join('\n');
                    }
                }

                if (directText) {
                    res.write(`data: ${JSON.stringify({ text: directText })}\n\n`);
                } else {
                    const streamResponse = await ai.models.generateContentStream({
                        model: activeModel,
                        contents,
                        config: {
                            systemInstruction: SYSTEM_PROMPT,
                            thinkingConfig: { thinkingBudget: 0 },
                        }
                    });

                    for await (const chunk of streamResponse) {
                        const text = chunk.text || '';
                        if (text) {
                            res.write(`data: ${JSON.stringify({ text })}\n\n`);
                        }
                    }
                }

                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
                return;
            } catch (streamErr: any) {
                console.error('[IA] Error en streaming:', streamErr);
                res.write(`data: ${JSON.stringify({ error: 'Error durante la transmisión de la respuesta' })}\n\n`);
                res.end();
                return;
            }
        }

        // Modo JSON estándar
        let finalText = 'No pude generar una respuesta. Intenta reformular tu pregunta.';
        try {
            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
                if (textParts.length > 0) {
                    finalText = textParts.join('\n');
                }
            }
        } catch (textError) {
            console.error('[IA] Error extrayendo texto:', textError);
        }

        return res.json({
            respuesta: finalText,
        });

    } catch (error: any) {
        console.error('[IA] Error general:', error);

        // Manejo específico de errores de Gemini
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
            return res.status(429).json({
                error: 'Se ha superado el límite de consultas por minuto. Por favor, espera un momento e intenta de nuevo.',
            });
        }

        if (error.status === 403 || error.message?.includes('403')) {
            return res.status(403).json({
                error: 'La API Key de Gemini no tiene permisos suficientes. Verifica tu configuración.',
            });
        }

        if (error.status === 503 || error.message?.includes('503') || error.message?.includes('UNAVAILABLE')) {
            return res.status(503).json({
                error: 'El modelo de IA está experimentando alta demanda. Intenta de nuevo en unos segundos.',
            });
        }

        return res.status(500).json({
            error: 'Error al procesar tu consulta con el asistente IA.',
            detalle: error.message
        });
    }
};
