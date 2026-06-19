"use client"

import { PlayCircle, Download, Users } from "lucide-react"

export default function HubPage() {
  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Hub Maker</h1>
        <p className="text-muted-foreground mt-1">
          Recursos, tutoriais e arquivos úteis para você melhorar suas impressões.
        </p>
      </div>

      {/* Community CTA */}
      <section className="bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Users className="text-primary" /> Comunidade Maker VIP
          </h2>
          <p className="text-muted-foreground">
            Junte-se a outros criadores no nosso grupo exclusivo. Tire dúvidas, compartilhe configurações de fatiador e tenha acesso a novidades em primeira mão.
          </p>
        </div>
        <a href="#" className="whitespace-nowrap px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity">
          Entrar no Telegram
        </a>
      </section>

      {/* Videos Section */}
      <section>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <PlayCircle className="text-primary" /> Tutoriais
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-4 aspect-video flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <PlayCircle className="mx-auto text-primary/50" size={48} />
              <p>Em breve: Como precificar corretamente</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 aspect-video flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <PlayCircle className="mx-auto text-primary/50" size={48} />
              <p>Em breve: Dicas de calibração no Bambu Studio</p>
            </div>
          </div>
        </div>
      </section>

      {/* Calibration STLs */}
      <section>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <Download className="text-primary" /> Calibração (MakerWorld)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {["Flow Rate Test", "Temperature Tower", "Retraction Test"].map((item) => (
            <a key={item} href="#" className="block p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors group">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item}</h3>
              <p className="text-sm text-muted-foreground mt-1">Baixar no MakerWorld</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
