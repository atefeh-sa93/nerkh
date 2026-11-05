// ESLint preset for packages that must stay framework-agnostic
// (packages/data, packages/ws-client): no apps/* and no React.
import base from '../eslint.config.js';
import { frameworkAgnosticBoundaries } from './boundaries.js';

export default [...base, frameworkAgnosticBoundaries];
