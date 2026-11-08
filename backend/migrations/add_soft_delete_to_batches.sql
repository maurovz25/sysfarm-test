-- Migración: Agregar soft delete a tabla de lotes
-- Fecha: 2026-02-17
-- Descripción: Agrega campo deletedAt para permitir eliminación lógica de lotes

-- IMPORTANTE: Primero verificar el nombre real de la tabla
-- Si la tabla se llama "Batch" (con mayúscula), usar comillas dobles

-- Opción 1: Si la tabla se llama "Batch"
ALTER TABLE "Batch" 
ADD COLUMN "deletedAt" TIMESTAMP;

CREATE INDEX idx_batch_deleted_at ON "Batch"("deletedAt");

-- Opción 2: Si la tabla se llama "batches" (minúscula)
-- ALTER TABLE batches 
-- ADD COLUMN "deletedAt" TIMESTAMP;
-- CREATE INDEX idx_batches_deleted_at ON batches("deletedAt");

-- Verificación (ajustar table_name según corresponda)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'Batch' 
  AND column_name = 'deletedAt';
