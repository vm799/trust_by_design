# JobProof Branding Integration - Complete Setup

## Overview
Production-ready logo system integrated across all application surfaces with full favicon/PWA support.

## File Structure
```
components/branding/
└── jobproof-logo.tsx          # Main logo component with variants

public/
├── favicon.svg                # SVG favicon (vector)
├── favicon-32x32.png         # [GENERATE] Browser tabs/bookmarks
├── apple-touch-icon.png      # [GENERATE] iOS homescreen (180x180)
├── icon-192.png              # [GENERATE] Android/PWA (192x192)
├── icon-512.png              # [GENERATE] Android/PWA high-DPI (512x512)
└── site.webmanifest          # PWA configuration

lib/
└── utils.ts                  # Utility functions (cn classname helper)
```

## Logo Component Usage

### Available Components
```tsx
import { JobProofLogo, JobProofMark } from '@/components/branding/jobproof-logo';

// Full logo with wordmark
<JobProofLogo variant="full" size="md" showTagline />

// Icon mark only
<JobProofMark size="sm" />
```

### Props API
```typescript
interface JobProofLogoProps {
  variant?: 'full' | 'mark';          // Full logo or icon only
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';  // Size preset
  showTagline?: boolean;               // Show "Trust by design" tagline
  className?: string;                  // Additional Tailwind classes
  'aria-hidden'?: boolean;            // Accessibility control
}
```

### Size Reference
- **xs**: 24px height - Small buttons, mobile nav
- **sm**: 32px height - Headers, compact layouts
- **md**: 48px height - Main navigation, auth pages
- **lg**: 64px height - Landing pages, hero sections
- **xl**: 80px height - Marketing materials

### Integration Points
✅ **Already integrated:**
- `components/Layout.tsx` - Admin sidebar and mobile header
- `views/EmailFirstAuth.tsx` - Authentication page
- `index.html` - Favicon links in `<head>`

### Dark Mode Support
Logo automatically adapts to light/dark themes:
- Shield: `fill-blue-600 dark:fill-blue-500`
- Accent: `fill-orange-500 dark:fill-orange-400`
- Text: `text-slate-900 dark:text-slate-50`

## Favicon Generation (Required Manual Step)

### Why Manual?
PNG favicons must be generated from the SVG source at exact pixel sizes for optimal quality across all devices and platforms.

### Steps to Generate PNGs

#### Option 1: Online Tool (Fastest)
1. Open `public/favicon.svg` in any browser
2. Visit https://realfavicongenerator.net/
3. Upload the SVG
4. Download the generated favicon package
5. Copy these files to `public/`:
   - `favicon-32x32.png` → `public/favicon-32x32.png`
   - `apple-touch-icon.png` → `public/apple-touch-icon.png`
   - `android-chrome-192x192.png` → `public/icon-192.png`
   - `android-chrome-512x512.png` → `public/icon-512.png`

#### Option 2: ImageMagick (CLI)
```bash
# Install ImageMagick if needed
brew install imagemagick  # macOS
sudo apt install imagemagick  # Ubuntu/Debian

# Generate all sizes
cd public
convert favicon.svg -resize 32x32 favicon-32x32.png
convert favicon.svg -resize 180x180 apple-touch-icon.png
convert favicon.svg -resize 192x192 icon-192.png
convert favicon.svg -resize 512x512 icon-512.png
```

#### Option 3: Figma/Sketch (Designers)
1. Import `public/favicon.svg`
2. Export at exact sizes: 32×32, 180×180, 192×192, 512×512
3. Format: PNG, no transparency optimization
4. Place in `public/` with correct names

### Verification Checklist
After generating PNGs, verify:
- [ ] Browser tab shows logo (32x32)
- [ ] Bookmark icon appears (32x32)
- [ ] iOS "Add to Home Screen" shows logo (180x180)
- [ ] Android "Add to home screen" shows logo (512x512)
- [ ] PWA install prompt displays logo
- [ ] No console errors for missing icons

## PWA Configuration

### manifest (site.webmanifest)
```json
{
  "name": "JobProof - Prove Your Work",
  "short_name": "JobProof",
  "theme_color": "#2563EB",  // Brand blue
  "background_color": "#ffffff",
  "display": "standalone",
  "icons": [...]
}
```

### Testing PWA
1. Build: `npm run build`
2. Serve: `npm run preview`
3. Open in mobile browser (iOS Safari / Chrome)
4. Tap Share → "Add to Home Screen"
5. Verify logo appears on homescreen
6. Launch app → should open fullscreen without browser chrome

## Customization Guide

### Changing Logo Colors
Edit `components/branding/jobproof-logo.tsx`:
```tsx
// Primary shield color
className="fill-blue-600 dark:fill-blue-500"
// Change to: className="fill-purple-600 dark:fill-purple-500"

// Accent dot
className="fill-orange-500 dark:fill-orange-400"
// Change to: className="fill-green-500 dark:fill-green-400"
```

### Adjusting Logo Mark Shape
The shield is defined by SVG path `d=` attributes in the `JobProofMark` component. Modify paths to change the icon shape while keeping the same viewBox (40×40).

### Adding New Size Preset
```typescript
const sizeMap = {
  xs: { container: 'h-6', icon: 'w-6 h-6', text: 'text-sm', tagline: 'text-[10px]' },
  // Add new size:
  xxl: { container: 'h-32', icon: 'w-32 h-32', text: 'text-5xl', tagline: 'text-2xl' },
};
```

## Brand Guidelines

### Logo Usage Rules
✅ **DO:**
- Use on dark backgrounds (slate-900/950)
- Use on light backgrounds (white/slate-50)
- Maintain minimum size: 24px height (xs size)
- Allow clear spacing around logo (at least 8px)

❌ **DON'T:**
- Rotate or skew the logo
- Change color relationships (keep shield darker than outer)
- Place on busy photographic backgrounds
- Use outdated versions or create variations

### Typography
- **Font**: Inter (sans-serif)
- **Weights**: 700 (Bold) for wordmark, 500 (Medium) for tagline
- **Fallback**: System sans-serif

### Color Palette
```css
Primary Blue:   #2563EB  (blue-600)
Dark Blue:      #1D4ED8  (blue-700)
Accent Orange:  #F97316  (orange-500)
Dark BG:        #020617  (slate-950)
Light BG:       #F8FAFC  (slate-50)
```

## Deployment Checklist

Before going live, confirm:
- [ ] All PNG favicons generated and placed in `public/`
- [ ] `index.html` includes all favicon `<link>` tags
- [ ] `site.webmanifest` URLs match actual file names
- [ ] Logo displays correctly on all pages
- [ ] Dark mode toggle works (logo adapts)
- [ ] Mobile homescreen install tested (iOS + Android)
- [ ] No console errors for missing assets
- [ ] Build succeeds: `npm run build`
- [ ] Production deployment tested on real devices

## Troubleshooting

### Logo not showing
- Check import path: `@/components/branding/jobproof-logo`
- Verify file exists: `components/branding/jobproof-logo.tsx`
- Check for TypeScript errors: `npm run build`

### Favicon not loading
- Hard refresh browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Check file exists: `ls public/favicon-32x32.png`
- Verify `<link>` tags in `index.html`
- Clear browser cache

### Dark mode not working
- Ensure parent has `dark:` variant classes
- Check Tailwind config includes `darkMode: 'class'`
- Verify `html` tag has `class="dark"` when in dark mode

### PWA not installing
- Must use HTTPS in production
- Check `site.webmanifest` is accessible: `/site.webmanifest`
- Verify all icon sizes exist (192px and 512px required)
- Test on real mobile device (not desktop DevTools)

## Support

For questions or issues:
1. Check this README first
2. Verify all files exist in correct locations
3. Check browser console for errors
4. Test in incognito/private mode (clears cache)

---

**Version**: 1.0
**Last Updated**: January 2026
**Maintained by**: JobProof Engineering Team
