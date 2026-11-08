import { TableRow, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  columns: number
  rows?: number
  columnWidths?: (string | undefined)[]
  cellHeight?: string
}

export function TableSkeleton({
  columns,
  rows = 5,
  columnWidths,
  cellHeight = "h-4",
}: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent border-b border-border/40">
          {Array.from({ length: columns }).map((_, colIndex) => {
            const widthClass = columnWidths?.[colIndex] || "w-full"
            return (
              <TableCell key={colIndex} className="py-3.5">
                <Skeleton className={`${cellHeight} ${widthClass} bg-muted/70 rounded`} />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
