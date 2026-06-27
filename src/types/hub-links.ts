import { z } from "zod"

export type HubTheme = "tutoriais" | "ia" | "calibracao" | "comunidade"

export interface HubLink {
  id: string
  theme: HubTheme
  title: string
  description: string
  url: string
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const CreateHubLinkSchema = z.object({
  theme: z.enum(["tutoriais", "ia", "calibracao", "comunidade"]),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  url: z.string().url("Invalid URL format"),
})

export type CreateHubLinkInput = z.infer<typeof CreateHubLinkSchema>

export const UpdateHubLinkSchema = CreateHubLinkSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export type UpdateHubLinkInput = z.infer<typeof UpdateHubLinkSchema>

export const ReorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ),
})

export type ReorderInput = z.infer<typeof ReorderSchema>
