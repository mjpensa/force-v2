import { FILE_TYPES } from './config/shared.js';

export const CONFIG = {
  COLORS: {
    GRID_BORDER: '#0D0D0D',
    PRIMARY: '#BA3930'
  },
  SIZES: {
    LOGO_HEIGHT: 28
  },
  EXPORT: {
    ASPECT_RATIO: { width: 16, height: 9 },
    SCALE: 2,
    BACKGROUND_COLOR: '#0c2340'
  }
};

Object.freeze(CONFIG);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.SIZES);
Object.freeze(CONFIG.EXPORT);
Object.freeze(CONFIG.EXPORT.ASPECT_RATIO);

export { FILE_TYPES };
