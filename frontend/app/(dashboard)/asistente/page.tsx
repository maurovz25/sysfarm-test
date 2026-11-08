"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Robot as Bot,
    PaperPlaneRight as Send,
    CircleNotch as Loader2,
    Trash as Trash2,
    User,
    Sparkle as Sparkles,
    Package,
    TrendUp as TrendingUp,
    CalendarBlank as Calendar,
    Question as HelpCircle,
} from "@phosphor-icons/react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import DOMPurify from "dompurify"

interface Message {
    id: string
    role: "user" | "assistant"
    text: string
    timestamp: Date
}

const SUGGESTED_QUESTIONS = [
    { icon: Package, text: "¿Cuántos productos hay registrados?", color: "text-blue-500" },
    { icon: TrendingUp, text: "¿Cuál es el producto más vendido?", color: "text-emerald-500" },
    { icon: Calendar, text: "¿Qué lotes vencen en los próximos 30 días?", color: "text-amber-500" },
    { icon: HelpCircle, text: "¿Cuál es el valor total del inventario?", color: "text-teal-500" },
]

export default function AsistentePage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessage = async (text?: string) => {
        const messageText = text || input.trim()
        if (!messageText || isLoading) return

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            text: messageText,
            timestamp: new Date(),
        }

        const assistantId = crypto.randomUUID()

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        try {
            // Construir historial para el backend
            const historial = messages.map(msg => ({
                role: msg.role === "user" ? "user" : "model",
                text: msg.text,
            }))

            let accumulatedText = ""

            try {
                // Streaming en tiempo real vía SSE (Opción A)
                await api.stream(
                    "/ia/chat",
                    { mensaje: messageText, historial },
                    (chunk) => {
                        accumulatedText += chunk
                        setMessages(prev => {
                            const index = prev.findIndex(m => m.id === assistantId)
                            if (index === -1) {
                                return [...prev, {
                                    id: assistantId,
                                    role: "assistant",
                                    text: accumulatedText,
                                    timestamp: new Date(),
                                }]
                            }
                            const updated = [...prev]
                            updated[index] = { ...updated[index], text: accumulatedText }
                            return updated
                        })
                    }
                )
            } catch (streamError) {
                // Fallback a petición JSON normal si el stream no inició
                if (!accumulatedText) {
                    const data = await api.post("/ia/chat", {
                        mensaje: messageText,
                        historial,
                    })
                    accumulatedText = data.respuesta || "No pude procesar tu consulta."
                    setMessages(prev => {
                        const index = prev.findIndex(m => m.id === assistantId)
                        if (index === -1) {
                            return [...prev, {
                                id: assistantId,
                                role: "assistant",
                                text: accumulatedText,
                                timestamp: new Date(),
                            }]
                        }
                        const updated = [...prev]
                        updated[index] = { ...updated[index], text: accumulatedText }
                        return updated
                    })
                } else {
                    throw streamError
                }
            }

            if (!accumulatedText) {
                const data = await api.post("/ia/chat", {
                    mensaje: messageText,
                    historial,
                })
                setMessages(prev => [...prev.filter(m => m.id !== assistantId), {
                    id: assistantId,
                    role: "assistant",
                    text: data.respuesta || "No pude procesar tu consulta.",
                    timestamp: new Date(),
                }])
            }
        } catch (error: any) {
            const errorText = error.message?.includes("quota") || error.message?.includes("límite")
                ? "⏳ Se ha superado el límite de consultas por minuto. Espera un momento e intenta de nuevo."
                : error.message || "⚠️ Hubo un error al conectar con el asistente. Verifica que el servidor esté en ejecución."
            
            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== assistantId)
                return [...filtered, {
                    id: assistantId,
                    role: "assistant",
                    text: errorText,
                    timestamp: new Date(),
                }]
            })
            console.error("Error al enviar mensaje:", error)
        } finally {
            setIsLoading(false)
            inputRef.current?.focus()
        }
    }

    const clearChat = () => {
        setMessages([])
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const formatMessageText = (text: string) => {
        // Convertir markdown básico a HTML simple
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
            .replace(/\n/g, '<br/>')
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Header */}
            <div className="shrink-0 mb-4">
                <div className="flex items-center justify-end">
                    {messages.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearChat}
                            className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            Limpiar chat
                        </Button>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <Card className="flex-1 flex flex-col min-h-0 border-border/50">
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    {/* Estado vacío */}
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 shadow-xs">
                                <Bot className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                ¡Hola! Soy ClementIA, el asistente inteligente de SysFarm
                            </h3>
                            <p className="text-sm text-muted-foreground mb-8 max-w-md">
                                Puedo responder cualquier pregunta sobre tu inventario, productos, lotes, movimientos y más. Solo pregúntame.
                            </p>

                            {/* Sugerencias */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                                {SUGGESTED_QUESTIONS.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(q.text)}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-emerald-500/30 transition-all text-left group"
                                    >
                                        <q.icon className={cn("h-4 w-4 shrink-0", q.color)} />
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                            {q.text}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mensajes */}
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-3",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "assistant" && (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs">
                                    <Bot className="h-4 w-4" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-muted/60 text-foreground border border-border/50 rounded-bl-md"
                                )}
                            >
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: isMounted ? DOMPurify.sanitize(formatMessageText(msg.text)) : "",
                                    }}
                                />
                                <div
                                    className={cn(
                                        "text-[10px] mt-2 opacity-50",
                                        msg.role === "user" ? "text-right" : "text-left"
                                    )}
                                >
                                    {msg.timestamp.toLocaleTimeString("es-PE", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </div>
                            </div>
                            {msg.role === "user" && (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                                    <User className="h-4 w-4 text-primary" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Indicador de carga */}
                    {isLoading && messages[messages.length - 1]?.role === "user" && (
                        <div className="flex gap-3 justify-start">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs">
                                <Bot className="h-4 w-4" />
                            </div>
                            <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm text-muted-foreground">
                                        Consultando inventario...
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </CardContent>

                {/* Input */}
                <div className="shrink-0 border-t border-border/50 p-4">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu pregunta sobre el inventario..."
                            disabled={isLoading}
                            className="flex-1 bg-muted/30 border-border/50 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                        />
                        <Button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                            size="icon"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 mt-2 text-center">
                        SysFarm IA puede cometer errores. Verifica la información importante.
                    </p>
                </div>
            </Card>
        </div>
    )
}
