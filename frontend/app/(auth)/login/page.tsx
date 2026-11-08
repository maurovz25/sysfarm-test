"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CircleNotch as Loader2, WarningCircle as AlertCircle, Eye, EyeSlash as EyeOff } from "@phosphor-icons/react"
import { auth } from "@/lib/supabase"
import { getUserRole } from "@/lib/roles"
import { getAuthErrorMessage, type AuthErrorFeedback } from "@/lib/auth-errors"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorFeedback, setErrorFeedback] = useState<AuthErrorFeedback | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorFeedback(null)

    const cleanEmail = email.trim()

    try {
      const { data, error } = await auth.signIn(cleanEmail, password)

      if (error) {
        setErrorFeedback(getAuthErrorMessage(error))
      } else if (data.session) {
        const userRole = getUserRole(data.session.user)
        if (!userRole) {
          // Cuenta sin rol en app_metadata: no tiene acceso al sistema
          await auth.signOut()
          setErrorFeedback({
            title: "Cuenta sin rol asignado",
            description: "Tu cuenta todavía no tiene un rol asignado. Contacta al administrador.",
          })
        } else if (userRole === 'solicitante') {
          router.push("/requerimientos")
        } else {
          router.push("/dashboard")
        }
      }
    } catch (err) {
      setErrorFeedback(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-3 sm:gap-4 max-w-full">
            <img
              src="/icon.png"
              alt="Logo SysFarm"
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">SysFarm</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Sistema de Gestión Farmacéutica</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
            <CardDescription className="text-center">Ingresa tus credenciales para acceder al sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorFeedback) setErrorFeedback(null)
                  }}
                  required
                  disabled={loading}
                  className={errorFeedback ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errorFeedback) setErrorFeedback(null)
                    }}
                    required
                    disabled={loading}
                    className={`pr-10 ${errorFeedback ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    tabIndex={-1}
                    title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    </span>
                  </Button>
                </div>
              </div>

              {errorFeedback && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive animate-in fade-in duration-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="font-semibold">{errorFeedback.title}</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed mt-1">
                    {errorFeedback.description}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Desarrollado y Diseñado por Mauro Valverde © 2025
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

