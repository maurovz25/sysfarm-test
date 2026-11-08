// Control de acceso para el SQL que genera el asistente de IA.
// En vez de buscar palabras en el texto (fácil de esquivar), se le pide a PostgreSQL el plan de
// ejecución (EXPLAIN) y se verifica qué relaciones toca realmente: solo las tablas de la aplicación.
// El plan incluye lo que hay dentro de CTEs, subconsultas y vistas del sistema (p. ej. pg_roles).

export const ALLOWED_SCHEMA = 'public';

export const ALLOWED_TABLES: readonly string[] = [
    'Area',
    'Batch',
    'GuiaSalida',
    'Movement',
    'PlantillaRequerimiento',
    'PlantillaRequerimientoItem',
    'Product',
    'ProductAudit',
    'Requerimiento',
    'RequerimientoItem',
    'User',
];

// Funciones que producen filas (Function Scan) y son inofensivas
const ALLOWED_FUNCTION_SCANS: readonly string[] = [
    'generate_series',
    'generate_subscripts',
    'unnest',
    'json_array_elements',
    'jsonb_array_elements',
    'json_each',
    'jsonb_each',
    'regexp_split_to_table',
    'string_to_table',
];

// Funciones que ejecutan SQL arbitrario desde un texto, leen archivos, cambian la configuración
// de la sesión o actúan sobre el servidor. El plan imprime los nombres ya normalizados, así que
// no se pueden esconder con mayúsculas, comillas ni el prefijo del esquema.
const DANGEROUS_FUNCTIONS: readonly string[] = [
    'query_to_xml', 'query_to_xmlschema', 'query_to_xml_and_xmlschema',
    'table_to_xml', 'table_to_xmlschema', 'table_to_xml_and_xmlschema',
    'cursor_to_xml', 'cursor_to_xmlschema', 'schema_to_xml', 'database_to_xml',
    'set_config', 'pg_sleep', 'pg_sleep_for', 'pg_sleep_until',
    'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
    'pg_terminate_backend', 'pg_cancel_backend', 'pg_reload_conf', 'pg_advisory_lock',
    'lo_import', 'lo_export', 'lo_get', 'lo_put', 'dblink', 'dblink_exec',
    'current_setting', 'nextval', 'setval',
];

const DANGEROUS_FUNCTION_CALL = new RegExp(`\\b(${DANGEROUS_FUNCTIONS.join('|')})\\s*\\(`, 'i');

export class SqlGuardError extends Error {
    constructor(public violations: string[]) {
        super(
            `Consulta no permitida: solo se pueden consultar las tablas de la aplicación ` +
            `(${ALLOWED_TABLES.join(', ')}). Acceso rechazado a: ${violations.join(', ')}`
        );
        this.name = 'SqlGuardError';
    }
}

// EXPLAIN (FORMAT JSON) devuelve [{ "QUERY PLAN": [ { Plan: {...} } ] }]; según el driver
// la columna puede llegar ya parseada o como texto.
export function extractPlan(rows: unknown): unknown {
    const first = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    const value = first?.['QUERY PLAN'];
    return typeof value === 'string' ? JSON.parse(value) : value;
}

// Recorre todo el plan y devuelve las relaciones o funciones no permitidas (vacío = permitido)
export function findDisallowedAccess(plan: unknown): string[] {
    const violations = new Set<string>();

    const visit = (node: unknown) => {
        if (typeof node === 'string') {
            const call = DANGEROUS_FUNCTION_CALL.exec(node);
            if (call) violations.add(`función ${call[1].toLowerCase()}()`);
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (node === null || typeof node !== 'object') return;

        const record = node as Record<string, unknown>;
        const relation = record['Relation Name'];

        if (typeof relation === 'string') {
            const schema = typeof record['Schema'] === 'string' ? (record['Schema'] as string) : '?';
            if (schema !== ALLOWED_SCHEMA || !ALLOWED_TABLES.includes(relation)) {
                violations.add(`${schema}.${relation}`);
            }
        }

        if (record['Node Type'] === 'Function Scan') {
            const fn = record['Function Name'];
            if (typeof fn !== 'string' || !ALLOWED_FUNCTION_SCANS.includes(fn)) {
                violations.add(`función ${String(fn)}()`);
            }
        }

        Object.values(record).forEach(visit);
    };

    visit(plan);
    return [...violations];
}
