export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="border-b border-slate-700/50 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Loja de Afiliados</h1>
          <p className="text-slate-400">
            Produtos recomendados de nossos parceiros. Clique e aproveite!
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
