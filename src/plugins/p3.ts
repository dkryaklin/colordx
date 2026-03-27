import { parseP3String } from '../colorModels/p3.js';
import type { Plugin } from '../colordx.js';

const p3: Plugin = (_ColordxClass, parsers, formatParsers) => {
  parsers.push(parseP3String);
  formatParsers.push([parseP3String, 'p3']);
};

export default p3;
