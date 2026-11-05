// ESLint preset for packages/* (ui, persian-kit, config).
import base from '../eslint.config.js';
import { packageBoundaries } from './boundaries.js';

export default [...base, packageBoundaries];
