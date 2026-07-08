"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { api } from "@/lib/api"
import { WebTerminal, type WebTerminalHandle } from "@/components/terminal/web-terminal"
import { QuickSetup } from "@/components/terminal/quick-setup"
import { AssistantPanel } from "@/components/ai/assistant-panel"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Bot, PanelRightClose, PanelRightOpen, Wrench } from "lucide-react"

export default function ConsolePage() {
  const params = useParams()
  const router = useRouter()
  const terminalRef = useRef<WebTerminalHandle>(null)
  const [connected, setConnected] = useState(false)
  const [instanceName, setInstanceName] = useState("")
  const [showAi, setShowAi] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [mobileAi, setMobileAi] = useState(false)

  useEffect(() => {
    api
      .get<{ name: string }>(`/instances/${params.id}`)
      .then((data) => setInstanceName(data.name))
      .catch(() => router.push("/dashboard/instances"))
  }, [params.id, router])

  return (
    <>
      <Header
        title="Console"
        breadcrumbs={[
          { label: "Compute", href: "/dashboard/instances" },
          { label: "Instances", href: "/dashboard/instances" },
          { label: instanceName || "...", href: `/dashboard/instances/${params.id}` },
        ]}
      />
      <div className="px-3 py-4 sm:px-4 h-[calc(100vh-3.5rem)] flex flex-col gap-2">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowSetup(true)}
          >
            <Wrench className="w-3.5 h-3.5" />
            Setup
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileAi(true)}
          >
            <Bot className="w-3.5 h-3.5" />
            Asistente
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => setShowAi((v) => !v)}
          >
            {showAi ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <Bot className="w-3.5 h-3.5" />
            Asistente
          </Button>
        </div>
        <div className="rounded-lg border flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-3 sm:px-4 py-2 border-b bg-muted/30 flex items-center gap-2 shrink-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
            />
            <span className="text-xs text-muted-foreground">
              {connected ? "Conectado" : "Conectando..."}
            </span>
            <span className="text-xs text-muted-foreground ml-auto font-mono truncate max-w-[50%]">
              {instanceName}
            </span>
          </div>
          <div className="flex flex-1 min-h-0">
            <QuickSetup
              terminalRef={terminalRef}
              disabled={!connected}
              className="hidden lg:flex"
            />
            <div className="flex-1 min-w-0 min-h-0">
              <WebTerminal
                ref={terminalRef}
                instanceId={params.id as string}
                onConnected={() => setConnected(true)}
              />
            </div>
            {showAi && (
              <AssistantPanel
                instanceId={params.id as string}
                instanceName={instanceName}
                className="hidden lg:flex"
              />
            )}
          </div>
        </div>
      </div>

      <Sheet open={showSetup} onOpenChange={setShowSetup}>
        <SheetContent side="left" className="w-full sm:max-w-sm p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Setup rápido</SheetTitle>
          </SheetHeader>
          <QuickSetup
            terminalRef={terminalRef}
            disabled={!connected}
            className="border-l-0 h-full"
          />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileAi} onOpenChange={setMobileAi}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Asistente IA</SheetTitle>
          </SheetHeader>
          <AssistantPanel
            instanceId={params.id as string}
            instanceName={instanceName}
            onClose={() => setMobileAi(false)}
            className="border-l-0 h-full"
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
