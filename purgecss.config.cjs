module.exports = {
  // Files to scan for CSS class usage
  content: [
    'Public/**/*.html',
    'Public/**/*.js',
    'server/templates/**/*.js'
  ],

  // CSS files to analyze
  css: [
    'Public/styles/**/*.css'
  ],

  // Output directory for rejected selectors report
  output: 'reports/purgecss',

  // Output rejected (unused) selectors for analysis
  rejected: true,
  rejectedCss: true,

  // Safelist - classes that should never be removed
  safelist: {
    // Standard patterns - exact class names
    standard: [
      'active',
      'visible',
      'hidden',
      'loading',
      'error',
      'success',
      'disabled',
      'selected',
      'collapsed',
      'expanded',
      'open',
      'closed'
    ],

    // Deep patterns - classes and their children
    deep: [
      /^gantt-/,
      /^slide-/,
      /^modal-/,
      /^toast-/,
      /^chart-/,
      /^task-/,
      /^phase-/,
      /^milestone-/,
      /^dependency-/,
      /^view-/,
      /^nav-/,
      /^btn-/,
      /^icon-/,
      /^form-/,
      /^input-/,
      /^label-/,
      /^card-/,
      /^panel-/,
      /^header-/,
      /^footer-/,
      /^sidebar-/,
      /^menu-/,
      /^dropdown-/,
      /^tooltip-/,
      /^progress-/,
      /^badge-/,
      /^alert-/,
      /^tab-/,
      /^accordion-/
    ],

    // Greedy patterns - partial matches
    greedy: [
      /data-/,
      /aria-/,
      /:hover$/,
      /:focus$/,
      /:active$/,
      /:disabled$/,
      /:checked$/,
      /:first-child$/,
      /:last-child$/,
      /::before$/,
      /::after$/
    ]
  },

  // Variables to keep (CSS custom properties)
  variables: true,

  // Keyframes to keep
  keyframes: true,

  // Font faces to keep
  fontFace: true,

  // Default extractor for JS/HTML
  defaultExtractor: content => {
    // Match class names, including those with special characters
    const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];

    // Match classes in template literals
    const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];

    // Match classList.add/remove/toggle patterns
    const classListMatches = content.match(/classList\.(add|remove|toggle)\(['"]([^'"]+)['"]\)/g) || [];
    const classListClasses = classListMatches.flatMap(match => {
      const classMatch = match.match(/['"]([^'"]+)['"]/);
      return classMatch ? classMatch[1].split(/\s+/) : [];
    });

    // Match className assignments
    const classNameMatches = content.match(/className\s*[=:]\s*['"`]([^'"`]+)['"`]/g) || [];
    const classNameClasses = classNameMatches.flatMap(match => {
      const classMatch = match.match(/['"`]([^'"`]+)['"`]/);
      return classMatch ? classMatch[1].split(/\s+/) : [];
    });

    return [...broadMatches, ...innerMatches, ...classListClasses, ...classNameClasses];
  }
};
