import { Card, CardContent } from "@/components/ui/card"
import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: PhosphorIcon
  iconColor?: string
  iconWeight?: IconWeight
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor,
  iconWeight = "duotone",
}: StatCardProps) {
  return (
    <Card className="py-3 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
            {change && (
              <p
                className={cn(
                  "text-[11px] font-medium leading-tight truncate",
                  changeType === "positive" && "text-accent",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground",
                )}
              >
                {change}
              </p>
            )}
          </div>
          <div
            className={cn(
              "p-2.5 rounded-xl shrink-0 flex items-center justify-center transition-transform hover:scale-105",
              iconColor || "bg-accent/10 text-accent"
            )}
          >
            <Icon weight={iconWeight} className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
