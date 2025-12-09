# PPT Template Assets

This directory contains logo and pattern assets for the PowerPoint export service.

## Directory Structure

```
assets/
├── README.md           # This file
├── logo-red.png        # Red logo for light backgrounds
├── logo-white.png      # White logo for dark backgrounds (navy/red)
├── logo-navy.png       # Navy logo variant (optional)
└── patterns/
    ├── banner.png      # Geometric banner pattern for title slides
    └── accent.png      # Accent pattern for quote/section slides
```

## Logo Requirements

### Dimensions
- **Small**: 0.69" x 0.35" (recommended for page footers)
- **Medium**: 0.69" x 0.48" (default size)
- **Large**: 2.0" x 1.0" (for title/thank you slides)

### Format
- **PNG** with transparent background (recommended)
- **SVG** is NOT supported by pptxgenjs
- Resolution: At least 300 DPI for print quality

### Color Variants
| File | Usage | Background |
|------|-------|------------|
| `logo-red.png` | Light backgrounds | White, Light Gray |
| `logo-white.png` | Dark backgrounds | Navy, Red |
| `logo-navy.png` | Alternative (optional) | White |

## Pattern Requirements

### Banner Pattern (`patterns/banner.png`)
- Used on title slides
- Dimensions: Full slide width (13.33") x ~2.3" height
- Should tile or stretch gracefully

### Accent Pattern (`patterns/accent.png`)
- Used on quote and section divider slides
- Typically placed on left side
- Dimensions vary by slide type

## Fallback Behavior

If logo/pattern files are missing:
- **Logos**: Display "bip." text in appropriate color
- **Patterns**: Display solid gray (#4A5568) rectangle

## Adding Assets

1. Export logos from your brand guidelines in PNG format
2. Ensure transparent backgrounds
3. Name files exactly as shown above
4. Place in appropriate directory
5. Restart the server (if running)

The export service automatically detects and uses assets when available.
