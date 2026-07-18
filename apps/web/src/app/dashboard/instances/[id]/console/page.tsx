"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Bot, Wrench } from "lucide-react"
import { Header } from "@/components/layout/header"
import { AssistantPanel } from "@/components/ai/assistant-panel"
import { QuickSetup } from "@/components/terminal/quick-setup"
import { WebTerminal, type WebTerminalHandle } from "@/components/terminal/web-terminal"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function ConsolePage() {
  const params = useParams()
  const router = useRouter()
  const terminalRef = useRef<WebTerminalHandle>(null)
  const [connected, setConnected] = useState(false)
  const [instanceName, setInstanceName] = useState("")
  const [showSetup, setShowSetup] = useState(false)
  const [showAi, setShowAi] = useState(false)

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
          { label: "Instances", href: "/dashboard/instances" },
          { label: instanceName || "…", href: `/dashboard/instances/${params.id}` },
          { label: "Console" },
        ]}
      />

      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              connected ? "bg-emerald-500" : "animate-pulse bg-muted-foreground",
            )}
            aria-hidden
          />
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {instanceName || "Instance"}
            </span>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            {connected ? "Connected" : "Connecting…"}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowSetup(true)}
            >
              <Wrench className="h-3.5 w-3.5" />
              Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowAi(true)}
            >
              <Bot className="h-3.5 w-3.5" />
              Assistant
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[#0c0c0c]">
          <WebTerminal
            ref={terminalRef}
            instanceId={params.id as string}
            onConnected={() => setConnected(true)}
          />
        </div>
      </div>

      <Sheet open={showSetup} onOpenChange={setShowSetup}>
        <SheetContent side="left" className="w-full p-0 sm:max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>Quick setup</SheetTitle>
          </SheetHeader>
          <QuickSetup
            terminalRef={terminalRef}
            disabled={!connected}
            onRun={() => setShowSetup(false)}
            className="h-full border-0"
          />
        </SheetContent>
      </Sheet>

      <Sheet open={showAi} onOpenChange={setShowAi}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Assistant</SheetTitle>
          </SheetHeader>
          <AssistantPanel
            instanceId={params.id as string}
            instanceName={instanceName}
            onClose={() => setShowAi(false)}
            className="h-full border-0"
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
