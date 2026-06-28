# Task 6: Create PhotoCarousel Component

**Objective:** Create a reusable carousel component for displaying product photo galleries with navigation controls.

## Component: PhotoCarousel

**Location:** `src/components/affiliate/PhotoCarousel.tsx`

**Props:**
```typescript
interface PhotoCarouselProps {
  photos: ProductPhoto[];
  productName: string;
}
```

## Features

1. **Main Image Display**
   - Show current photo large
   - Image error fallback to placeholder
   - Responsive sizing

2. **Navigation**
   - Previous/Next buttons (arrows)
   - Click to advance carousel
   - Keyboard support optional
   - Disable if only 1 photo

3. **Thumbnails**
   - Show all photos as small thumbnails at bottom
   - Click thumbnail to jump to photo
   - Highlight current thumbnail with cyan border
   - Horizontally scrollable if many photos

4. **Counter**
   - Show "X / Y" (current / total) in bottom left
   - Only show if multiple photos

5. **Styling**
   - Use project's Tailwind classes (slate-*, cyan-*, glass-panel)
   - Smooth transitions on image change
   - Hover effects on buttons
   - Mobile-responsive

## States

- Multiple photos: Show all controls
- Single photo: Hide arrows/counter/thumbnails (just show image)
- No photos: Show placeholder message

## Success Criteria

✅ Component renders photos correctly
✅ Navigation works (prev/next/thumbnails)
✅ Error fallback works
✅ Responsive design (mobile/desktop)
✅ Follows project conventions (Tailwind, no external UI libs)
✅ TypeScript with ProductPhoto type

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 6)
