"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/roles"
import { RoleBadge, normalizeRole } from "@/components/usuarios/role-badge"

interface RoleSelectProps {
    value: string | null
    onChange: (role: UserRole) => void
    disabled?: boolean
    disabledReason?: string
    ariaLabel?: string
}

// Selector controlado: no aplica el cambio por sí mismo, solo avisa con `onChange`
// para que la pantalla pida confirmación antes de llamar a la API.
export function RoleSelect({ value, onChange, disabled, disabledReason, ariaLabel }: RoleSelectProps) {
    const select = (
        <Select
            value={normalizeRole(value) ?? ""}
            onValueChange={(next) => onChange(next as UserRole)}
            disabled={disabled}
        >
            <SelectTrigger className="w-[220px] justify-between" aria-label={ariaLabel}>
                {/* Con valor vacío (cuenta sin rol) Radix muestra el placeholder en lugar de los hijos */}
                <SelectValue placeholder={<RoleBadge role={null} />}>
                    <RoleBadge role={value} />
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-w-[20rem]">
                {Object.values(UserRole).map((role) => (
                    <SelectItem key={role} value={role}>
                        <div className="flex flex-col">
                            <span>{ROLE_LABELS[role]}</span>
                            <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    if (disabled && disabledReason) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-block cursor-not-allowed">
                        {select}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
        )
    }

    return select
}
