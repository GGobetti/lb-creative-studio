import { SettingsManager } from "@/components/dashboard/SettingsManager"

export const metadata = {
  title: "Setup & Custos | LB Creative Studio",
  description: "Gerencie suas impressoras, filamentos e taxas de marketplace.",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-3xl font-black text-foreground">Setup Geral</h1>
        <p className="text-muted-foreground mt-1">
          Configure suas impressoras, gerencie seus materiais e estabeleça suas margens base para a calculadora.
        </p>
      </div>

      <SettingsManager />
    </div>
  )
}
