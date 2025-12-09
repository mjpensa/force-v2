/**
 * Gantt Chart Modules
 *
 * This directory contains all Gantt chart related components:
 *
 * Core Rendering:
 * - renderer.js: Grid rendering, rows, bars, and virtualization
 * - components.js: UI components (header, title, logo, footer, legend)
 * - analysis.js: Research analysis display
 *
 * Interaction Handlers:
 * - InteractiveGanttHandler.js: Base class for interactive behaviors
 * - DraggableGantt.js: Drag-to-move functionality
 * - ResizableGantt.js: Resize functionality
 * - ContextMenu.js: Right-click context menu
 *
 * Features:
 * - GanttEditor.js: Edit mode and inline editing
 * - GanttExporter.js: PNG/SVG export functionality
 */

// Core rendering modules
export { GanttRenderer } from './renderer.js';
export { GanttComponents } from './components.js';
export { GanttAnalysis } from './analysis.js';

// Interaction handlers
export { InteractiveGanttHandler } from './InteractiveGanttHandler.js';
export { DraggableGantt } from './DraggableGantt.js';
export { ResizableGantt } from './ResizableGantt.js';
export { ContextMenu } from './ContextMenu.js';

// Features
export { GanttEditor } from './GanttEditor.js';
export { GanttExporter } from './GanttExporter.js';
