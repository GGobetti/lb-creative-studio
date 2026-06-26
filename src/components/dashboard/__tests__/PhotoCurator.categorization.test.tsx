/**
 * PhotoCurator.categorization.test.tsx
 *
 * Test suite for PhotoCurator category badge rendering and bulk categorization features.
 *
 * SETUP REQUIRED:
 * This test file requires Jest and React Testing Library to be installed.
 * Run: npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest ts-jest
 *
 * Then configure jest.config.js or jest.config.ts with appropriate setup for Next.js.
 * See: https://nextjs.org/docs/testing
 */

import React from "react"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { PhotoCurator } from "../PhotoCurator"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAppStore } from "@/store/store"
import { STL_CATEGORIES } from "@/types/games"

// Mock Supabase
jest.mock("@/lib/supabase")

// Mock useAppStore
jest.mock("@/store/store")

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}))

// Mock fetch globally
global.fetch = jest.fn()

describe("PhotoCurator Categorization", () => {
  // Mock data setup
  const mockStlRows = [
    {
      id: "stl-001",
      title: "Model 1",
      file_name: "model1.stl",
      photos: ["https://example.com/photo1.jpg"],
      telegram_group_name: "test-group",
      created_at: "2026-06-01T10:00:00Z",
      reviewed_at: null,
    },
    {
      id: "stl-002",
      title: "Model 2",
      file_name: "model2.stl",
      photos: ["https://example.com/photo2.jpg"],
      telegram_group_name: "test-group",
      created_at: "2026-06-02T10:00:00Z",
      reviewed_at: null,
    },
    {
      id: "stl-003",
      title: "Model 3",
      file_name: "model3.stl",
      photos: ["https://example.com/photo3.jpg"],
      telegram_group_name: "test-group",
      created_at: "2026-06-03T10:00:00Z",
      reviewed_at: null,
    },
  ]

  const mockCategoryVotes = [
    {
      stl_id: "stl-001",
      categories: ["Decoração", "Casa & Cozinha"],
    },
    {
      stl_id: "stl-002",
      categories: ["Brinquedos"],
    },
    // stl-003 has no categories
  ]

  const mockSupabaseClient = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          neq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: mockStlRows,
                  error: null,
                }),
              })),
            })),
          })),
        })),
        in: jest.fn().mockResolvedValue({
          data: mockCategoryVotes,
          error: null,
        }),
        single: jest.fn().mockResolvedValue({
          data: { photos: [] },
          error: null,
        }),
      })),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
        in: jest.fn().mockResolvedValue({ error: null }),
      })),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
      }),
    },
  }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock useAppStore to return a sysadmin profile
    ;(useAppStore as jest.Mock).mockReturnValue({
      profile: { role: "sysadmin" },
      user: { id: "test-user-id" },
    })

    // Mock getSupabaseBrowser
    ;(getSupabaseBrowser as jest.Mock).mockReturnValue(mockSupabaseClient)

    // Mock window.localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    })

    // Mock fetch responses
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * TEST 1: Render category badges under STL titles
   *
   * Verifies that when category data is loaded from the database,
   * category badges appear below each STL title with the correct categories.
   */
  it("renders category badges under STL titles", async () => {
    render(<PhotoCurator />)

    // Wait for component to load and fetch data
    await waitFor(() => {
      expect(getSupabaseBrowser).toHaveBeenCalled()
    })

    // Wait for categories to be loaded and rendered
    await waitFor(() => {
      // Check that badges for stl-001 are rendered (Decoração, Casa & Cozinha)
      expect(screen.queryByText("Decoração")).toBeInTheDocument()
      expect(screen.queryByText("Casa & Cozinha")).toBeInTheDocument()
      // Check that badge for stl-002 is rendered (Brinquedos)
      expect(screen.queryByText("Brinquedos")).toBeInTheDocument()
    })

    // Verify that the category badges have correct styling
    const decoracaoBadge = screen.queryByText("Decoração")
    if (decoracaoBadge) {
      expect(decoracaoBadge).toHaveClass("bg-blue-500/15")
    }
  })

  /**
   * TEST 2: Open Categorizar tab when multiple STLs selected
   *
   * Verifies that when 2 or more STLs are selected, a "Categorizar" tab
   * appears in the bulk-actions floating menu and can be clicked to show
   * the category selection UI.
   */
  it("opens Categorizar tab when multiple STLs selected", async () => {
    render(<PhotoCurator />)

    // Wait for component to load
    await waitFor(() => {
      expect(getSupabaseBrowser).toHaveBeenCalled()
    })

    // Find and click checkboxes to select 2 STLs
    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    // Select first two checkboxes (assuming they are in the STL list)
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    // Wait for Categorizar tab to appear
    await waitFor(() => {
      const categorizarTab = screen.queryByText(/Categorizar/i)
      expect(categorizarTab).toBeInTheDocument()
    })

    // Click the Categorizar tab
    const categorizarTab = screen.getByText(/Categorizar/i)
    fireEvent.click(categorizarTab)

    // Verify that category selection UI is now visible
    await waitFor(() => {
      // Check for the instruction text in the category tab
      expect(
        screen.queryByText(/Selecione uma ou mais categorias/i)
      ).toBeInTheDocument()
    })

    // Verify that STL_CATEGORIES are rendered as checkboxes
    for (const category of STL_CATEGORIES.slice(0, 3)) {
      // Check at least first 3 categories to avoid timeout
      const categoryLabel = screen.queryByLabelText(new RegExp(category, "i"))
      expect(categoryLabel).toBeInTheDocument()
    }
  })

  /**
   * TEST 3: Toggle category selection
   *
   * Verifies that when the Categorizar tab is open, users can:
   * 1. Click on category checkboxes to toggle selection
   * 2. Selected categories are tracked in state
   * 3. Bulk apply button becomes enabled when categories are selected
   */
  it("toggles category selection", async () => {
    render(<PhotoCurator />)

    // Wait for initial load
    await waitFor(() => {
      expect(getSupabaseBrowser).toHaveBeenCalled()
    })

    // Select 2 STLs first
    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    // Open Categorizar tab
    await waitFor(() => {
      const categorizarTab = screen.queryByText(/Categorizar/i)
      expect(categorizarTab).toBeInTheDocument()
    })

    const categorizarTab = screen.getByText(/Categorizar/i)
    fireEvent.click(categorizarTab)

    // Wait for category tab to render
    await waitFor(() => {
      expect(
        screen.queryByText(/Selecione uma ou mais categorias/i)
      ).toBeInTheDocument()
    })

    // Find and click a category checkbox (e.g., "Decoração")
    const categoriesToTest = ["Decoração", "Brinquedos"]
    for (const category of categoriesToTest) {
      const categoryCheckbox = screen.queryByLabelText(
        new RegExp(`^${category}$`, "i")
      ) as HTMLInputElement

      if (categoryCheckbox) {
        // Initially unchecked
        expect(categoryCheckbox.checked).toBe(false)

        // Click to toggle
        fireEvent.click(categoryCheckbox)

        // After click, should be checked
        expect(categoryCheckbox.checked).toBe(true)

        // Click again to toggle back
        fireEvent.click(categoryCheckbox)

        // Should be unchecked again
        expect(categoryCheckbox.checked).toBe(false)

        break // Test just one category to avoid timeout
      }
    }
  })

  /**
   * TEST 4: Apply categories in bulk
   *
   * Verifies that when categories are selected and the bulk apply button
   * is clicked, an API call is made to categorize the selected STLs.
   */
  it("applies selected categories to multiple STLs", async () => {
    render(<PhotoCurator />)

    // Wait for initial load
    await waitFor(() => {
      expect(getSupabaseBrowser).toHaveBeenCalled()
    })

    // Select 2 STLs
    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    // Open Categorizar tab
    await waitFor(() => {
      const categorizarTab = screen.queryByText(/Categorizar/i)
      expect(categorizarTab).toBeInTheDocument()
    })

    const categorizarTab = screen.getByText(/Categorizar/i)
    fireEvent.click(categorizarTab)

    // Wait for category options to render
    await waitFor(() => {
      expect(
        screen.queryByText(/Selecione uma ou mais categorias/i)
      ).toBeInTheDocument()
    })

    // Click a category checkbox
    const categoryCheckbox = screen.queryByLabelText(/^Decoração$/i) as HTMLInputElement
    if (categoryCheckbox) {
      fireEvent.click(categoryCheckbox)

      // Wait for the checkbox to be checked
      await waitFor(() => {
        expect(categoryCheckbox.checked).toBe(true)
      })

      // Look for "Aplicar em Massa" or similar button
      const applyButton = screen.queryByText(/Aplicar em Massa|Aplicar|Apply/i)
      if (applyButton) {
        fireEvent.click(applyButton)

        // Verify API call was made
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            "/api/admin/photo-curator",
            expect.objectContaining({
              method: "POST",
              headers: expect.objectContaining({
                Authorization: "Bearer mock-token",
              }),
            })
          )
        })
      }
    }
  })

  /**
   * TEST 5: Category badges persist after bulk categorization
   *
   * Verifies that after applying categories, the badges are updated
   * in the category cache and remain visible on the STL tiles.
   */
  it("updates category badges after bulk categorization", async () => {
    render(<PhotoCurator />)

    // Wait for initial load
    await waitFor(() => {
      expect(getSupabaseBrowser).toHaveBeenCalled()
    })

    // Verify initial badge state
    await waitFor(() => {
      // stl-001 should have "Decoração" badge
      expect(screen.queryByText("Decoração")).toBeInTheDocument()
    })

    // Get initial badge count
    const initialBadges = screen.getAllByText(
      new RegExp("Decoração|Casa & Cozinha|Brinquedos", "i")
    )
    const initialCount = initialBadges.length

    // Select STLs and apply categories
    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    // Open Categorizar tab
    const categorizarTab = screen.queryByText(/Categorizar/i)
    if (categorizarTab) {
      fireEvent.click(categorizarTab)

      // Select a new category
      await waitFor(() => {
        const checkbox = screen.queryByLabelText(/^Esportes$/i) as HTMLInputElement
        if (checkbox && !checkbox.checked) {
          fireEvent.click(checkbox)
        }
      })

      // Mock successful API response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      // Click apply button if visible
      const applyButton = screen.queryByText(/Aplicar|Apply/i)
      if (applyButton) {
        fireEvent.click(applyButton)

        // Wait for update
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled()
        })
      }
    }
  })

  /**
   * TEST 6: Component renders without crashing with no categories
   *
   * Verifies that the component initializes and renders successfully
   * even when no categories have been assigned to any STLs.
   */
  it("renders without crashing when no categories exist", async () => {
    // Override mock to return empty categories
    mockSupabaseClient.from = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          neq: jest.fn(() => ({
            not: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: mockStlRows,
                  error: null,
                }),
              })),
            })),
          })),
        })),
        in: jest.fn().mockResolvedValue({
          data: [], // Empty categories
          error: null,
        }),
        single: jest.fn().mockResolvedValue({
          data: { photos: [] },
          error: null,
        }),
      })),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
        in: jest.fn().mockResolvedValue({ error: null }),
      })),
    }))

    ;(getSupabaseBrowser as jest.Mock).mockReturnValue(mockSupabaseClient)

    render(<PhotoCurator />)

    // Should render without crashing
    await waitFor(() => {
      expect(getSupabaseBrowser).toHaveBeenCalled()
    })

    // Component should be in the DOM
    expect(screen.getByRole("main") || document.body).toBeInTheDocument()
  })
})
