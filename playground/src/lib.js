import { Colordx, colordx, extend, inGamutSrgb, oklchToLinear } from '@colordx/core';
import a11y from '@colordx/core/plugins/a11y';
import cvd from '@colordx/core/plugins/cvd';
import harmonies from '@colordx/core/plugins/harmonies';
import hsv from '@colordx/core/plugins/hsv';
import hwb from '@colordx/core/plugins/hwb';
import lab from '@colordx/core/plugins/lab';
import lch from '@colordx/core/plugins/lch';
import minify from '@colordx/core/plugins/minify';
import mix from '@colordx/core/plugins/mix';
import names from '@colordx/core/plugins/names';
import p3, { oklchToP3Channels } from '@colordx/core/plugins/p3';
import rec2020, { oklchToRec2020Channels } from '@colordx/core/plugins/rec2020';

extend([a11y, cvd, harmonies, hsv, hwb, lab, lch, minify, mix, names, p3, rec2020]);

// handy in the devtools console
globalThis.Colordx = Colordx;
globalThis.colordx = colordx;

export { Colordx, colordx, inGamutSrgb, oklchToLinear, oklchToP3Channels, oklchToRec2020Channels };
