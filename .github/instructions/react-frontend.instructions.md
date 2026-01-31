---
applyTo: "frontend/**/*.ts,frontend/**/*.tsx"
---

# React Frontend Instructions

Language: TypeScript. Do not introduce plain JavaScript where TypeScript is possible.

Follow the Airbnb JavaScript + React Style Guide for styling and structure.

## Comments & TSDoc


For React components, hooks, utility functions, and services:
- Use TSDoc comments above the declaration.
- Include tags like `@param`, `@returns`, `@remarks`.
- Briefly describe what it does and how it is used.
- **Do not add trivial comments (wie z.B. "Handle X"), wenn der Funktionsname bereits selbsterklärend ist.**

Example component:

```tsx
/**
 * Displays a list of crops with optional filtering.
 *
 * @remarks
 * Used in the OpenFarmPlanner frontend to present aggregated crop data.
 *
 * @param props - Component properties.
 * @param props.items - Array of crop objects.
 * @param props.onSelect - Callback invoked when a crop is selected.
 * @returns JSX element rendering the crop list.
 */
export function CropList({ items, onSelect }: CropListProps) {
  return (
    <ul>
      {items.map((c) => (
        <li key={c.id} onClick={() => onSelect(c)}>
          {c.name}
        </li>
      ))}
    </ul>
  );
}
```

## Additional Frontend Rules

- Component names in PascalCase; hooks as `useSomething`.
- Prefer strongly typed props (interfaces/types) over `any`.
- Keep comments minimal and focus on explaining "why", not trivial "how".
