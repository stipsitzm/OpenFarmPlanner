## Sidebar Navigation Styling Refactor

### Overview

The sidebar navigation styling has been refactored to use a centralized, neutral color scheme for inactive navigation items while reserving green as an accent color exclusively for active/important states.

### Goals Achieved

✅ **Reduced visual noise** - Neutral grays for inactive items instead of green
✅ **Clear active state** - Dark green text, icon, and light green background distinguish active items
✅ **Professional appearance** - Calmer, more sophisticated color palette
✅ **Consistent styling** - Unified approach across desktop, mobile, expanded, and collapsed modes
✅ **Centralized colors** - Single source of truth for all navigation colors
✅ **Accessibility** - Maintained good contrast ratios (all text meets WCAG AA standards)

### Color Palette

#### Inactive Navigation Items
- **Text:** `#2f3a33` - Neutral dark gray
- **Icon:** `#475652` - Slightly lighter neutral gray
- **Background:** Transparent
- **Hover Background:** `rgba(79, 89, 86, 0.06)` - Very subtle neutral hover (only ~6% opacity)
- **Hover Icon:** `#394145` - Slightly darker on hover

#### Active Navigation Items
- **Text:** `#2d5a3d` - Dark green
- **Icon:** `#2d5a3d` - Dark green
- **Background:** `rgba(76, 135, 86, 0.12)` - Light green background
- **Left Accent Bar:** `rgba(59, 116, 72, 0.52)` - Dark green bar
- **Hover Background:** `rgba(76, 135, 86, 0.16)` - Slightly darker on hover

#### Sidebar Container
- **Background:** `#f5f2eb` - Warm neutral
- **Border:** `#e1dbd0` - Subtle border
- **Logo & Toggle Colors:** Neutral grays matching the active/inactive theme

### Implementation

The refactoring centralizes all navigation styling in a single location:

**File:** `frontend/src/navigation/navigationStyles.ts`

This file exports:
1. **`NAVIGATION_COLORS`** - Complete color palette organized by state (inactive, active, sidebar, drawer)
2. **`getNavigationItemSx()`** - Desktop sidebar item styling utility
3. **`getNavigationIconSx()`** - Desktop sidebar icon styling utility
4. **`getMobileNavigationItemSx()`** - Mobile drawer item styling utility
5. **`getMobileNavigationIconSx()`** - Mobile drawer icon styling utility

### Usage in App.tsx

**Desktop Sidebar:**
```typescript
<ListItemButton
  sx={getNavigationItemSx(isActive, sidebarCollapsed)}
>
  <ListItemIcon sx={getNavigationIconSx(isActive, sidebarCollapsed)}>
    {item.icon}
  </ListItemIcon>
  <ListItemText primary={item.label} />
</ListItemButton>
```

**Mobile Drawer:**
```typescript
<ListItemButton sx={getMobileNavigationItemSx(isActive)}>
  <ListItemIcon sx={getMobileNavigationIconSx(isActive)}>
    {item.icon}
  </ListItemIcon>
  <ListItemText primary={item.label} />
</ListItemButton>
```

### Visual Behavior

#### Inactive Item (Default)
- Neutral dark gray text and icons
- Transparent background
- No accent bar

#### Inactive Item (Hover)
- Same text color (no change)
- Very subtle light background (~6% opacity)
- Slightly darker icon color

#### Active Item
- Dark green text and icons
- Light green background (subtle, ~12% opacity)
- Dark green left accent bar (3px)
- Slightly increased font weight (600 vs 500)

#### Active Item (Hover)
- Same dark green colors
- Slightly darker green background (~16% opacity)

### Consistency Across Modes

✅ **Desktop Expanded Sidebar** - Full navigation with labels and icons
✅ **Desktop Collapsed Sidebar** - Icons only, centered, with tooltips
✅ **Mobile Navigation Drawer** - Full-width drawer from the left
✅ **Logo and Toggle Areas** - Consistent neutral styling

### Accessibility

- **Contrast Ratios:** All text meets WCAG AA minimum (4.5:1)
- **Color Not Sole Indicator:** Active state indicated by both color AND left accent bar
- **Focus States:** Maintain existing focus outlines
- **Keyboard Navigation:** Fully supported via NavLink and ListItemButton MUI components

### Future Enhancements

Potential improvements for future iterations:
1. Add CSS variables for theme switching support
2. Support dark mode variant colors
3. Add animation transitions for state changes (currently static)
4. Consider additional nested item styling for expandable categories

### Files Modified

1. **Created:** `frontend/src/navigation/navigationStyles.ts` - Centralized styling configuration
2. **Updated:** `frontend/src/App.tsx` - Uses new styling utilities instead of hardcoded colors

### Migration Notes

All hardcoded color values in the sidebar navigation have been replaced with:
- Centralized constants from `NAVIGATION_COLORS`
- Utility functions that generate complete `sx` objects
- This makes future color adjustments simple and ensures consistency across all variants
