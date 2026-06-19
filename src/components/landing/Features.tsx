"use client";

import { motion } from "framer-motion";
import { BentoGrid, BentoCard } from "@/components/ui/BentoGrid";
import {
  Boxes,
  Calculator,
  PlayCircle,
  ShieldCheck,
  CreditCard,
  CloudDownload,
  Send
} from "lucide-react";

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/20 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] -z-10" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-5xl font-black text-foreground mb-6">
              Tudo em um lugar para <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">
                Crescer Seu Negócio 3D
              </span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Nossa plataforma foi construída por makers, para makers. Cada ferramenta foi pensada para economizar seu tempo e dinheiro.
            </p>
          </motion.div>
        </div>

        <BentoGrid>
          {/* Busca de STL no Telegram - col-span-2 */}
          <BentoCard
            name="Marketplace STL"
            description="Busque em tempo real em diversos canais e grupos de Telegram agregados. Moderado, curado e pronto para baixar e imprimir."
            Icon={Send}
            className="md:col-span-2"
            href="/login"
            cta="Explorar biblioteca"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 opacity-60">
                <div className="absolute bottom-6 right-6 w-72 h-24 border border-cyan-500/10 rounded-2xl bg-cyan-950/5 dark:bg-cyan-950/20 p-4 overflow-hidden backdrop-blur-xs">
                  <div className="w-1/2 h-2 bg-cyan-500/20 rounded mb-2 animate-pulse" />
                  <div className="w-3/4 h-2 bg-cyan-500/10 rounded mb-2 animate-pulse" />
                  <div className="w-1/3 h-2 bg-cyan-500/10 rounded animate-pulse" />
                </div>
              </div>
            }
          />

          {/* Hub Maker */}
          <BentoCard
            name="Hub Maker"
            description="Arquivos de calibração, tutoriais passo a passo e conteúdo prático para dominar sua impressora."
            Icon={PlayCircle}
            className="md:col-span-1"
            href="/login"
            cta="Acessar Hub"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-purple-500/10 opacity-60" />
            }
          />

          {/* Cotações em PDF */}
          <BentoCard
            name="Cotações & Propostas"
            description="Gere cotações profissionais em PDF com marca personalizada, prazos e termos comerciais."
            Icon={CreditCard}
            className="md:col-span-1"
            href="/login"
            cta="Criar cotação"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 opacity-60" />
            }
          />

          {/* Calculadora de Custos */}
          <BentoCard
            name="Calculadora de Custos"
            description="Descubra o custo real de cada impressão: filamento, eletricidade, desgaste de equipamento e margem."
            Icon={Calculator}
            className="md:col-span-1"
            href="/login"
            cta="Calcular"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-60">
                <div className="absolute bottom-[-20px] right-[-20px] w-32 h-32 rounded-3xl bg-emerald-500/5 rotate-12 transition-transform duration-300 group-hover:scale-110" />
              </div>
            }
          />

          {/* Importador MakerWorld */}
          <BentoCard
            name="Importador de Modelos"
            description="Cole um link e importe fotos, peso, tempo de impressão e detalhes do modelo em segundos."
            Icon={CloudDownload}
            className="md:col-span-1"
            href="/login"
            cta="Importar"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 opacity-60">
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-orange-500/5 rounded-full blur-2xl" />
              </div>
            }
          />

          {/* Portfólio 3D */}
          <BentoCard
            name="Portfólio & Catálogo"
            description="Organize seus projetos, crie um catálogo visual e compartilhe com clientes. Precificação integrada."
            Icon={Boxes}
            className="md:col-span-1"
            href="/login"
            cta="Acessar portfólio"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-rose-500/10 opacity-60" />
            }
          />

          {/* CRM Clientes */}
          <BentoCard
            name="CRM & Clientes"
            description="Gerencie seus clientes, histórico de pedidos, pagamentos e comunicações em um único lugar."
            Icon={ShieldCheck}
            className="md:col-span-1"
            href="/login"
            cta="Gerenciar clientes"
            background={
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-60" />
            }
          />

          {/* Sistema de Créditos - col-span-3 */}
          <BentoCard
            name="Sistema de Créditos Flexível"
            description="Nossa plataforma funciona por consumo de créditos por ação. Você ganha créditos mensais baseados no seu plano (Free, Basic, Pro) ou pode comprar pacotes adicionais avulsos para utilizar o gerador 3D ou o importador sempre que precisar."
            Icon={CreditCard}
            className="md:col-span-3 h-auto min-h-[16rem]"
            href="/login"
            cta="Conhecer planos"
            background={
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 opacity-60">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent" />
              </div>
            }
          />
        </BentoGrid>
      </div>
    </section>
  );
}
