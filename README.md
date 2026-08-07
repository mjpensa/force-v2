# Force - AI Research Platform

A comprehensive three-screen research platform that transforms research documents into interactive roadmaps, presentations, and reports using AI.

## Features

### Three Complementary Views

1. **📊 Roadmap View** - Interactive Gantt chart timeline
2. **📽️ Slides View** - Professional presentation mode
3. **📄 Document View** - Long-form report reader

### Phase 6 Enhancements (Latest)

#### Performance Optimizations
- ⚡ **Lazy Loading**: Automatic image lazy loading with Intersection Observer API
- 📊 **Performance Monitoring**: Real-time performance metrics tracking
- 🎯 **Web Vitals**: LCP, FID, and CLS monitoring
- ⏱️ **Optimized Bundle**: Minimal initial load with deferred non-critical resources

#### Accessibility

No blanket WCAG 2.1 AA conformance claim is made here — the app has never been audited
against the full criteria set. What is implemented and verified:

- ♿ **Keyboard Navigation**: Arrow keys (←→) and number keys (1, 2, 3) move between views
- ⌨️ **Keyboard Shortcuts**: Press `?` for help
- 🔊 **Screen Reader Support**: An `aria-live` region announces view changes
- 📋 **Skip Links**: Skip-to-main-content link, revealed on focus
- 🎯 **Focus Management**: Modals carry `role="dialog"` / `aria-modal` and trap Tab focus
- 🎨 **Color Contrast**: The glass text tokens are held to AA's 4.5:1 for normal text by
  `tests/public/contrast.test.js`, which composites them over each navy gradient stop.
  Worst case is `--glass-text-muted` at 5.14:1.

Everything else — form labelling, reduced-motion, the Gantt drag/resize handlers, colour as
the sole carrier of meaning in the heat map and status pills — is unaudited.

#### Error Handling
- 🔄 **Automatic Retry**: Exponential backoff for failed API calls
- 📝 **Error Logging**: Comprehensive error tracking and logging
- 💬 **User-Friendly Messages**: Clear error messages with actionable steps
- 🎯 **Error Recovery**: Retry buttons and graceful degradation

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/force.git
cd force

# Install dependencies
npm install

# Start the server
npm start
```

## Usage

### Basic Workflow

1. **Upload Research Documents**
   ```
   Navigate to http://localhost:3000
   Upload your research files (PDF, TXT, etc.)
   Enter a research prompt
   ```

2. **Wait for Generation**
   ```
   AI generates three views simultaneously:
   - Roadmap (Gantt chart)
   - Slides (Presentation)
   - Document (Report)
   ```

3. **View and Navigate**
   ```
   Use the tabs to switch between views
   Or use keyboard shortcuts: 1, 2, 3
   Or arrow keys: ← →
   ```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Navigate to Roadmap view |
| `2` | Navigate to Slides view |
| `3` | Navigate to Document view |
| `←` | Previous view |
| `→` | Next view |
| `?` | Show keyboard shortcuts help |
| `Esc` | Close dialog or clear focus |

### API Endpoints

#### Generate Content
```http
POST /api/content/generate
Content-Type: multipart/form-data

files: [File]
prompt: string
```

Response:
```json
{
  "jobId": "uuid",
  "sessionId": "uuid"
}
```

#### Get Content by View
```http
GET /api/content/:sessionId/:viewType
```

Response:
```json
{
  "status": "completed",
  "data": {...},
  "generatedAt": "2025-11-24T00:00:00.000Z"
}
```

## Architecture

### Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6 modules)
- Custom Design System (Google Docs-inspired)
- StateManager for reactive state management
- Hash-based routing

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- Google Gemini AI
- Zod for validation

**Phase 6 Utilities:**
- LazyLoader.js - Lazy loading with Intersection Observer
- Performance.js - Performance monitoring and optimization
- Accessibility.js - skip link, aria-live announcements, and the modal focus trap
- ErrorHandler.js - Comprehensive error handling

### Project Structure

```
force/
├── Public/
│   ├── components/
│   │   ├── shared/
│   │   │   ├── StateManager.js          # State management
│   │   │   ├── LazyLoader.js            # Lazy loading (Phase 6)
│   │   │   ├── Performance.js           # Performance monitoring (Phase 6)
│   │   │   ├── Accessibility.js         # Accessibility utilities (Phase 6)
│   │   │   └── ErrorHandler.js          # Error handling (Phase 6)
│   │   └── views/
│   │       ├── SlidesView.js            # Slides component
│   │       └── DocumentView.js          # Document component
│   ├── styles/
│   │   ├── design-system.css            # Design tokens
│   │   ├── app-shell.css                # App layout
│   │   ├── roadmap-view.css             # Roadmap styles
│   │   ├── slides-view.css              # Slides styles
│   │   └── document-view.css            # Document styles
│   ├── viewer.html                      # Main viewer page
│   ├── viewer.js                        # Viewer orchestrator
│   └── index.html                       # Upload page
├── server/
│   ├── db.js                            # SQLite database
│   ├── generators.js                    # Content generation
│   ├── prompts/
│   │   ├── roadmap.js                   # Roadmap prompt
│   │   ├── slides.js                    # Slides prompt
│   │   └── document.js                  # Document prompt
│   └── routes/
│       └── content.js                   # API routes
└── server.js                            # Express server
```

## Development

### Running in Development Mode

```bash
# Start with auto-reload
npm run dev

# Run with debug logging
DEBUG=true npm start

# Enable performance monitoring
npm start -- --debug=true
```

### Performance Monitoring

Access viewer with `?debug=true` to enable Web Vitals monitoring:

```
http://localhost:3000/viewer.html?sessionId=xxx&debug=true
```

Console output will show:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- API call timings
- Render timings

### Accessibility Testing

1. **Keyboard Navigation Testing**
   ```
   - Tab through all interactive elements
   - Test all keyboard shortcuts (1, 2, 3, ←, →, ?)
   - Verify focus visibility
   ```

2. **Screen Reader Testing**
   ```
   # macOS
   VoiceOver: Cmd+F5

   # Windows
   NVDA: https://www.nvaccess.org/download/
   ```

3. **Color Contrast Testing**
   ```bash
   npx jest tests/public/contrast.test.js
   ```
   Parses the glass text tokens out of `design-system.css`, composites them over each navy
   gradient stop the way the browser paints them, and fails below 4.5:1. It also asserts the
   `tailwind.config.js` `text-glass-*` utilities still match the CSS custom properties —
   they are two independent declarations of the same colour, and fixing only one leaves half
   the UI failing.

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

## Error Handling

The application includes comprehensive error handling with automatic retry logic:

### Error Types

- **NetworkError**: Connection issues
- **APIError**: Server errors
- **ValidationError**: Invalid input
- **PermissionError**: Access denied
- **NotFoundError**: Resource not found
- **TimeoutError**: Request timeout

### Retry Logic

API calls automatically retry with exponential backoff:
- Initial delay: 1 second
- Max retries: 3
- Backoff factor: 2x

### Error Logging

Errors are logged with severity levels:
- **Low**: Informational (e.g., content still processing)
- **Medium**: Recoverable errors
- **High**: Serious errors requiring attention
- **Critical**: System-level failures

View error logs:
```javascript
import { getErrorLog } from './Public/components/shared/ErrorHandler.js';

const errors = getErrorLog(50); // Last 50 errors
console.log(errors);
```

## Performance Best Practices

### Image Optimization

Use lazy loading for images:

```html
<!-- Instead of: -->
<img src="image.jpg" alt="Description">

<!-- Use: -->
<img data-src="image.jpg" alt="Description">
```

The LazyLoader will automatically load images when they enter the viewport.

### Code Splitting

Large components can be lazy loaded:

```javascript
import { lazyLoadComponent } from './Public/components/shared/LazyLoader.js';

const container = document.getElementById('chart');
lazyLoadComponent(container, async () => {
  const { GanttChart } = await import('./GanttChart.js');
  new GanttChart(container).render();
});
```

### Performance Monitoring

Track custom metrics:

```javascript
import { markPerformance, measurePerformance } from './Public/components/shared/Performance.js';

markPerformance('operation-start');
// ... perform operation ...
markPerformance('operation-end');

const duration = measurePerformance('operation', 'operation-start', 'operation-end');
console.log(`Operation took ${duration}ms`);
```

## Accessibility Guidelines

### For Developers

1. **Always provide alt text for images**
   ```html
   <img src="chart.png" alt="Gantt chart showing project timeline">
   ```

2. **Use semantic HTML**
   ```html
   <main>, <nav>, <article>, <section>, <header>, <footer>
   ```

3. **Add ARIA labels to interactive elements**
   ```html
   <button aria-label="Close dialog">×</button>
   ```

4. **Ensure keyboard accessibility**
   ```javascript
   element.addEventListener('click', handleClick);
   element.addEventListener('keydown', (e) => {
     if (e.key === 'Enter' || e.key === ' ') {
       handleClick();
     }
   });
   ```

5. **Test with reduced motion**
   ```javascript
   import { prefersReducedMotion } from './Public/components/shared/Performance.js';

   if (!prefersReducedMotion()) {
     element.classList.add('animated');
   }
   ```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add JSDoc comments to all public functions
- Write tests for new features
- Ensure accessibility compliance
- Update documentation

## License

MIT License - see LICENSE file for details

## Changelog

### Phase 7 (Current) - Full Three-View Generation ✅

**New Features:**
- ✅ Unified upload endpoint generates all three views (roadmap, slides, document)
- ✅ Parallel content generation in background
- ✅ Seamless integration with three-view viewer
- ✅ Full backward compatibility with legacy charts

**Implementation:**
- Updated `/api/content/generate` to accept file uploads via multipart/form-data
- Added file processing for DOCX, TXT, and other formats
- Frontend now uses Phase 2 API for new uploads
- Legacy `/generate-chart` endpoint maintained for compatibility

### Phase 6 - Polish & Optimization

**Performance:**
- ✅ Lazy loading for images and components
- ✅ Performance monitoring with Web Vitals
- ✅ Optimized bundle size
- ✅ Debounce and throttle utilities

**Accessibility:** (see the Accessibility section above for what is and isn't audited)
- ✅ Keyboard navigation between views
- ✅ `aria-live` announcements for view changes
- ✅ Color contrast verified by test for the glass text tokens
- ✅ Focus trap in modals

**Error Handling:**
- ✅ Automatic retry with exponential backoff
- ✅ User-friendly error messages
- ✅ Error logging and tracking
- ✅ Graceful error recovery

**Documentation:**
- ✅ Complete README
- ✅ JSDoc comments
- ✅ API documentation
- ✅ Accessibility guidelines

### Phase 5 - Integration & Multi-View System
- ✅ Unified viewer with three-view navigation
- ✅ Hash-based routing
- ✅ View-specific state management
- ✅ Seamless view switching

### Phase 4 - Document View Implementation
- ✅ DocumentView component
- ✅ Table of contents with scroll spy
- ✅ Multiple content block types
- ✅ Print-optimized layout

### Phase 3 - Slides View Implementation
- ✅ SlidesView component
- ✅ Slide navigation
- ✅ Fullscreen mode
- ✅ 5+ slide templates

### Phase 2 - Unified Content Generation
- ✅ AI-powered content generation
- ✅ Parallel generation for all views
- ✅ API endpoints
- ✅ Job status tracking

### Phase 1 - Design System
- ✅ Google Docs-inspired design
- ✅ CSS design tokens
- ✅ App shell layout
- ✅ Responsive design

### Phase 0 - Foundation
- ✅ SQLite database
- ✅ StateManager
- ✅ Project structure

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/force/issues
- Email: support@example.com

## Acknowledgments

- Google Gemini AI for content generation
- The open-source community for libraries and inspiration
- WCAG guidelines for accessibility standards
