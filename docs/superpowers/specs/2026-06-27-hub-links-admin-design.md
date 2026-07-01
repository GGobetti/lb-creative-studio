# Hub Links Admin Configuration

**Date:** 2026-06-27  
**Status:** Approved  
**Feature:** Admin panel for managing theme links displayed in Hub Maker

---

## Overview

Add a dedicated admin page (`/dashboard/admin/hub-links`) that allows sysadmins to manage URLs for four Hub Maker themes: Tutoriais, Ferramentas IA, Calibração, and Comunidade. The page features an interactive editor with drag-and-drop reordering and a real-time preview of the Hub Maker displaying the configured links.

---

## User Stories

- **As a** sysadmin, **I want to** manage Hub theme links from a centralized admin panel, **so that** I can update content without touching code
- **As a** sysadmin, **I want to** see a preview of the Hub Maker in real-time while editing links, **so that** I can verify changes before saving
- **As a** sysadmin, **I want to** reorder links by dragging them, **so that** I can control the display order
- **As a** sysadmin, **I want to** toggle links on/off, **so that** I can disable content without deleting it

---

## Data Model

### `hub_theme_links` Table

```sql
CREATE TABLE hub_theme_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL CHECK (theme IN ('tutoriais', 'ia', 'calibracao', 'comunidade')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_hub_theme_links_theme ON hub_theme_links(theme);
CREATE INDEX idx_hub_theme_links_position ON hub_theme_links(position, theme);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `theme` | ENUM | One of: `tutoriais`, `ia`, `calibracao`, `comunidade` |
| `title` | Text | Display name of the link (e.g., "Como precificar corretamente") |
| `description` | Text | Short description for context |
| `url` | Text | Full URL (validated format) |
| `position` | Integer | Sort order within the theme (0-indexed) |
| `is_active` | Boolean | Whether the link appears in the Hub (soft delete) |
| `created_at` | Timestamp | Created timestamp |
| `updated_at` | Timestamp | Last modified timestamp |

---

## Architecture

### Frontend Components

#### `HubLinksAdminPage` (Main Page)
- Route: `/dashboard/admin/hub-links`
- Layout: Two-column (desktop) / stacked (mobile)
- State: links list, active theme, editing mode, form data
- Responsibilities:
  - Fetch all links on mount
  - Coordinate between editor and preview
  - Handle real-time updates

#### `HubLinksEditor` (Left Column)
- Tabs for each theme (Tutoriais, IA, Calibração, Comunidade)
- Displays cards in drag-and-drop container (`react-beautiful-dnd`)
- Each card shows: title, description snippet, action buttons
- Action buttons: Edit, Delete, Toggle (on/off)
- Form above or below card list to create/edit links

#### `HubLinkForm` (Input Form)
- Fields:
  - `title` (text input, required)
  - `description` (textarea, required)
  - `url` (text input, required, validated)
  - `position` (auto-managed by drag-and-drop, read-only in form)
- Validation: URL format, required fields
- Submit button: "Adicionar Link" (create) or "Salvar Alterações" (edit)
- Cancel button to exit edit mode

#### `HubPreview` (Right Column)
- Renders `/dashboard/hub` content with live data
- Fetches links from current component state (not from API)
- Filters to show only `is_active: true` links
- Updates instantly as user edits/reorders
- Mobile: hidden by default, toggleable with button

### Backend APIs

#### `GET /api/admin/hub-links`
Returns all hub theme links (no filtering).

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "theme": "tutoriais",
      "title": "Como precificar corretamente",
      "description": "Tutorial completo sobre estratégias de precificação",
      "url": "https://youtube.com/...",
      "position": 0,
      "is_active": true,
      "created_at": "2026-06-27T10:00:00Z",
      "updated_at": "2026-06-27T10:00:00Z"
    }
  ]
}
```

#### `POST /api/admin/hub-links`
Create a new link.

**Request:**
```json
{
  "theme": "tutoriais",
  "title": "...",
  "description": "...",
  "url": "..."
}
```

**Response:** 201 Created, returns the created link with auto-assigned position and id.

#### `PUT /api/admin/hub-links/:id`
Update an existing link.

**Request:**
```json
{
  "title": "...",
  "description": "...",
  "url": "...",
  "is_active": true
}
```

**Response:** 200 OK, returns updated link.

#### `DELETE /api/admin/hub-links/:id`
Soft delete (sets `is_active: false`) or hard delete.

**Response:** 204 No Content or confirmation object.

#### `PUT /api/admin/hub-links/reorder`
Bulk update positions after drag-and-drop.

**Request:**
```json
{
  "updates": [
    { "id": "uuid1", "position": 0 },
    { "id": "uuid2", "position": 1 }
  ]
}
```

**Response:** 200 OK, returns updated links.

### Hub Maker Integration

The existing Hub Maker page (`/dashboard/hub`) will:
- Fetch links from `/api/admin/hub-links`
- Filter by `theme` and `is_active: true`
- Sort by `position`
- Render each link as a card (keep existing UI)

No structural changes to `/dashboard/hub` page; it simply populates from the database instead of hardcoded arrays.

---

## UI/UX Details

### Sidebar Navigation
- New entry under **Admin** section (sysadmin only)
- Label: "Configuração do Hub"
- Icon: `Settings` (lucide-react)
- Route: `/dashboard/admin/hub-links`

### Page Layout
**Desktop (1200px+):**
- Editor column (60%, left): Theme tabs + form + cards
- Preview column (40%, right): Live Hub Maker preview
- Horizontal scroll/resize handle between columns (optional)

**Mobile (<1200px):**
- Stacked layout: Editor above, Preview below
- Preview toggled with button (hidden by default to save space)

### Color & Styling
- Use existing design tokens (primary, muted-foreground, card, border)
- Cards: `bg-card border border-border rounded-xl p-4`
- Active state on tabs: underline or background highlight
- Drag preview: slight opacity + shadow during drag
- Toast notifications: success (green), error (red), loading (spinner)

### Drag & Drop UX
- Drag handle icon (`GripVertical`) on each card
- Visual feedback: card scales up slightly during drag
- Drop zone highlights as user hovers
- Position updates automatically after drop
- Undo/Redo (optional, can be added later)

---

## Validation & Error Handling

### Input Validation
- **Title:** required, 1-255 chars
- **Description:** required, 1-1000 chars
- **URL:** required, valid HTTP(S) URL format
- **Position:** auto-managed, no user input

### API Error Handling
- 400: Invalid input (validation failed)
- 401: Unauthorized (not a sysadmin)
- 404: Link not found
- 500: Server error

### User Feedback
- Toast for successful actions (create, update, delete, reorder)
- Toast with error message on failure
- Loading spinner during API calls
- Confirmation dialog before deletion

---

## Accessibility

- Semantic HTML: `<section>`, `<form>`, `<button>`
- ARIA labels on drag-and-drop containers
- Keyboard navigation: Tab through fields, Enter to submit, Escape to cancel
- Focus management: focus form after create/edit
- Color contrast: meet WCAG AA standards
- Drag-and-drop alternative: buttons for manual reordering (if using `react-beautiful-dnd`)

---

## Performance

- Lazy load preview (render only if visible)
- Debounce drag-and-drop position updates (optional)
- Cache links in local state while editing, batch API calls
- Images in preview: lazy load or placeholder

---

## Testing Strategy

### Unit Tests
- Form validation (each field)
- URL format validation
- Card render with correct data

### Integration Tests
- Create link → appears in list → appears in preview
- Edit link → updates in list and preview
- Reorder links → positions saved to database
- Delete link → removed from list and preview
- Toggle on/off → appears/disappears in preview

### E2E Tests
- Full workflow: create → edit → reorder → preview → delete
- Mobile responsive layout
- Error cases: invalid URL, network failure

---

## Migration & Rollout

1. **Phase 1:** Create table, write APIs, deploy backend
2. **Phase 2:** Build admin page, test locally
3. **Phase 3:** Update Hub Maker to fetch from DB (fallback to hardcoded if needed)
4. **Phase 4:** Go live, populate initial data from hardcoded arrays
5. **Phase 5:** Remove hardcoded arrays from code

---

## Future Enhancements

- Bulk import/export links (CSV/JSON)
- Link analytics (click tracking)
- Custom theme properties (e.g., icons, colors per theme)
- Link groups or categories within a theme
- Scheduled link visibility (start/end dates)
- Preview in different screen sizes/themes

---

## Success Criteria

✅ Sysadmin can create, read, update, delete hub theme links  
✅ Links are draggable and reorderable  
✅ Real-time preview shows changes instantly  
✅ Hub Maker displays configured links in correct order  
✅ Links can be toggled on/off without deletion  
✅ Mobile-responsive layout  
✅ All CRUD operations have clear user feedback  
✅ Data persists to database and survives page refresh  
