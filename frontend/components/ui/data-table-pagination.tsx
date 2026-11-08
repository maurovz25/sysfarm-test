"use client"

import {
  CaretDoubleLeft as ChevronsLeft,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CaretDoubleRight as ChevronsRight,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (itemsPerPage: number) => void
  pageSizeOptions?: number[]
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [15, 30, 50],
}: DataTablePaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2">
      {/* Texto de información de registros */}
      <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        Mostrando <span className="font-semibold text-foreground">{startItem}</span> a{" "}
        <span className="font-semibold text-foreground">{endItem}</span> de{" "}
        <span className="font-semibold text-foreground">{totalItems}</span> registros
      </div>

      {/* Controles de paginación */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-6">
        {/* Selector de filas por página */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap text-muted-foreground">
            Filas por página:
          </span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(val) => onItemsPerPageChange(Number(val))}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()} className="text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Indicador de página */}
        <div className="text-xs sm:text-sm font-medium whitespace-nowrap">
          Página <span className="font-bold text-foreground">{currentPage}</span> de{" "}
          <span className="font-bold text-foreground">{Math.max(1, totalPages)}</span>
        </div>

        {/* Botones de navegación */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-xs p-0"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-xs p-0"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-xs p-0"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || totalPages === 0}
            title="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-xs p-0"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || totalPages === 0}
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
