"use client"

import { useMemo } from "react"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Coins,
  WarningCircle,
  HourglassMedium,
  ArrowsLeftRight,
  Warning as AlertTriangle,
  ArrowUpRight,
  CalendarBlank as Calendar,
} from "@phosphor-icons/react"
import { useDashboardSummary } from "@/hooks/use-queries"
import { formatCurrency, formatQuantity } from "@/lib/number-utils"

export default function DashboardPage() {
  const { data: summaryData, isLoading } = useDashboardSummary()

  const stats = summaryData?.stats || {
    totalValue: 0,
    lowStock: 0,
    proximosAVencer: 0,
    vencidos: 0,
    movimientosHoy: 0,
  }

  const topProducts = summaryData?.topProducts || []
  const expiryAlerts = summaryData?.expiryAlerts || []
  const stockAlerts = summaryData?.stockAlerts || []

  const recentMovements = useMemo(() => {
    return (summaryData?.recentMovements || []).map((m: any) => ({
      ...m,
      dateFormatted: m.date ? new Date(m.date).toLocaleDateString("es-PE") : "N/A",
    }))
  }, [summaryData?.recentMovements])

  // Skeleton UI elegante que calca la anatomía exacta del Dashboard
  if (isLoading && !summaryData) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Farmacia</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen general del inventario de medicamentos e insumos</p>
        </div>

        {/* 4 StatCards Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm h-[106px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-24 my-1" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>

        {/* 2 Alert Cards Skeleton */}
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-[300px] flex flex-col">
              <CardHeader className="p-4 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-3 w-56 mt-1" />
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3 flex-1">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 2 Bottom Cards Skeleton */}
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-[280px]">
              <CardHeader className="p-4 pb-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-64 mt-1" />
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard de Farmacia</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Resumen general del inventario de medicamentos e insumos</p>
      </div>

      {/* 4 Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Valor Total Inventario"
          value={formatCurrency(stats.totalValue)}
          change="Capital invertido"
          changeType="neutral"
          icon={Coins}
          iconWeight="duotone"
          iconColor="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50"
        />
        <StatCard
          title="Riesgo de Quiebre"
          value={formatQuantity(stats.lowStock)}
          change="Productos con stock útil bajo"
          changeType={stats.lowStock > 0 ? "negative" : "positive"}
          icon={WarningCircle}
          iconWeight="duotone"
          iconColor={stats.lowStock > 0
            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50"
            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50"}
        />
        <StatCard
          title="Lotes en Riesgo (Venc/Próx)"
          value={formatQuantity(stats.vencidos + stats.proximosAVencer)}
          change="Requieren revisión"
          changeType={(stats.vencidos + stats.proximosAVencer) > 0 ? "negative" : "neutral"}
          icon={HourglassMedium}
          iconWeight="duotone"
          iconColor={(stats.vencidos + stats.proximosAVencer) > 0
            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50"
            : "bg-muted text-muted-foreground border border-border"}
        />
        <StatCard
          title="Movimientos Hoy"
          value={formatQuantity(stats.movimientosHoy)}
          change="Actividad diaria"
          changeType="positive"
          icon={ArrowsLeftRight}
          iconWeight="bold"
          iconColor="bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/50"
        />
      </div>

      {/* Advanced Alerts Panels */}
      {(expiryAlerts.length > 0 || stockAlerts.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Expiry Alerts */}
          <Card className="border-orange-500/50 flex flex-col h-[340px]">
            <CardHeader className="shrink-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-orange-500" />
                Alertas de Vencimiento ({expiryAlerts.length})
              </CardTitle>
              <CardDescription className="text-xs">Lotes vencidos o por vencer en 90 días</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto flex-1 p-0">
              {expiryAlerts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">No hay alertas de vencimiento.</div>
              ) : (
                <div className="w-full">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-muted-foreground bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="px-3.5 py-2 font-medium">Lote / Producto</th>
                        <th className="px-3.5 py-2 font-medium text-right w-16 whitespace-nowrap">Stock</th>
                        <th className="px-3.5 py-2 font-medium text-right w-24 whitespace-nowrap">Vence en</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expiryAlerts.map((alert: any) => {
                        const fullName = `${alert.name} (${alert.laboratorio || 'N/A'})`;
                        return (
                          <tr key={alert.id} className="hover:bg-muted/30">
                            <td className="px-3.5 py-2 max-w-[280px] lg:max-w-[240px] xl:max-w-[340px]">
                              <div className="font-medium text-foreground">{alert.lote}</div>
                              <div
                                className="text-[11px] text-muted-foreground truncate cursor-help"
                                title={fullName}
                              >
                                {fullName}
                              </div>
                            </td>
                            <td className="px-3.5 py-2 text-right font-medium whitespace-nowrap">{formatQuantity(alert.stock)}</td>
                            <td className="px-3.5 py-2 text-right whitespace-nowrap">
                              <Badge variant={alert.status === "vencido" ? "destructive" : "secondary"} className={alert.status === "proximo" ? "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 shadow-none border-orange-500/20 text-[10px] px-1.5 py-0.5" : "text-[10px] px-1.5 py-0.5"}>
                                {alert.status === "vencido" ? "VENCIDO" : `${formatQuantity(alert.dias)} días`}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card className="border-red-500/50 flex flex-col h-[340px]">
            <CardHeader className="shrink-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de Stock ({stockAlerts.length})
              </CardTitle>
              <CardDescription className="text-xs">Productos agotados o por debajo del mínimo</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto flex-1 p-0">
              {stockAlerts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">No hay alertas de stock.</div>
              ) : (
                <div className="w-full">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-muted-foreground bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2 font-medium">Producto</th>
                        <th className="px-3.5 py-2 font-medium text-right w-16 whitespace-nowrap">Total</th>
                        <th className="px-3.5 py-2 font-medium text-right w-16 whitespace-nowrap">Mínimo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stockAlerts.map((alert: any) => (
                        <tr key={alert.id} className="hover:bg-muted/30">
                          <td className="px-3.5 py-2 max-w-[280px] lg:max-w-[240px] xl:max-w-[340px]">
                            <div
                              className="font-medium text-foreground truncate cursor-help"
                              title={alert.name}
                            >
                              {alert.name}
                            </div>
                            <div
                              className="text-[11px] text-muted-foreground truncate cursor-help"
                              title={alert.laboratorio || ""}
                            >
                              {alert.laboratorio}
                            </div>
                          </td>
                          <td className="px-3.5 py-2 text-right whitespace-nowrap">
                            <Badge variant={alert.status === "agotado" ? "destructive" : "secondary"} className={alert.status === "bajo" ? "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 shadow-none border-orange-500/20 text-[10px] px-1.5 py-0.5" : "text-[10px] px-1.5 py-0.5"}>
                              {formatQuantity(alert.stock)}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{formatQuantity(alert.stockMinimo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Productos Más Solicitados</CardTitle>
            <CardDescription className="text-xs">Top 5 productos (por unidades acumuladas en salidas)</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="space-y-2.5">
              {topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No hay movimientos registrados</p>
              ) : (
                topProducts.map((product: any, index: number) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate cursor-help" title={product.name}>{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatQuantity(product.sales)} unidades solicitadas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={product.stock <= product.stockMinimo ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0.5">
                        Stock: {formatQuantity(product.stock)}
                      </Badge>
                      {product.trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-accent" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Movimientos Recientes</CardTitle>
            <CardDescription className="text-xs">Últimas transacciones registradas</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="space-y-2.5">
              {recentMovements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No hay movimientos registrados</p>
              ) : (
                recentMovements.map((movement: any) => {
                  return (
                    <div
                      key={movement.id}
                      className="flex items-start justify-between border-b border-border pb-2 last:border-0 last:pb-0 gap-2"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant={movement.type === "Ingreso" ? "default" : (movement.type === "Salida" ? "secondary" : "outline")} className="text-[10px] px-1.5 py-0.5 shrink-0">
                            {movement.type}
                          </Badge>
                          <p className="text-xs font-medium text-foreground truncate cursor-help" title={movement.product}>{movement.product}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {movement.user} • {movement.dateFormatted} • Lote: {movement.batchCodigo}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        {movement.type === "Ingreso" ? "+" : (movement.type === "Salida" ? "-" : "")}
                        {formatQuantity(movement.quantity)} {movement.unidadBase?.toLowerCase()}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
