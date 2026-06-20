'use client'

interface LeaderboardUser {
  rank: number
  userId: string
  name: string
  xp: number
  badge: string
  streak: number
  gamesPlayed: number
}

interface LeaderboardTableProps {
  rankings: LeaderboardUser[]
  isLoading?: boolean
  period: 'week' | 'alltime'
}

export function LeaderboardTable({
  rankings,
  isLoading = false,
  period,
}: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-muted/20 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (rankings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">
          Nenhum resultado para{' '}
          {period === 'week' ? 'essa semana' : 'todos os tempos'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/40">
            <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
              Pos
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
              Nome
            </th>
            <th className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
              XP
            </th>
            <th className="px-4 py-3 text-center font-semibold text-foreground whitespace-nowrap">
              Badge
            </th>
            <th className="px-4 py-3 text-center font-semibold text-foreground whitespace-nowrap">
              Streak
            </th>
            <th className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
              Games
            </th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((user, idx) => (
            <tr
              key={user.userId}
              className={`border-b border-border/30 transition-colors ${
                idx % 2 === 0 ? 'bg-muted/10' : 'hover:bg-muted/20'
              }`}
            >
              <td className="px-4 py-3">
                <span className="font-bold text-primary">#{user.rank}</span>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {user.name}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-warning">
                {user.xp.toLocaleString('pt-BR')}
              </td>
              <td className="px-4 py-3 text-center text-lg">{user.badge}</td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium">
                  🔥 {user.streak}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {user.gamesPlayed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
