"use client"

import { formatDistanceToNow, format, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface StatusCellProps {
    isOnline: boolean
    lastSignInAt: string | null
}

export function StatusCell({ isOnline, lastSignInAt }: StatusCellProps) {
    const lastSignIn = lastSignInAt ? new Date(lastSignInAt) : null
    const hasDate = !!lastSignIn && isValid(lastSignIn)

    const relative = hasDate ? formatDistanceToNow(lastSignIn, { addSuffix: true, locale: es }) : null
    const exact = hasDate ? format(lastSignIn, "dd/MM/yyyy HH:mm", { locale: es }) : null

    const detail = isOnline
        ? relative && `Inició sesión ${relative}`
        : relative
            ? `Último acceso ${relative}`
            : "Nunca ha ingresado"

    return (
        <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                {isOnline && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                )}
                <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                />
            </span>
            <div className="min-w-0 leading-tight">
                <p
                    className={`text-sm font-medium ${isOnline ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
                >
                    {isOnline ? "Conectado" : "Desconectado"}
                </p>
                {detail &&
                    (exact ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p className="cursor-default text-xs text-muted-foreground">{detail}</p>
                            </TooltipTrigger>
                            <TooltipContent>Último inicio de sesión: {exact}</TooltipContent>
                        </Tooltip>
                    ) : (
                        <p className="text-xs text-muted-foreground">{detail}</p>
                    ))}
            </div>
        </div>
    )
}
