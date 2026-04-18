import { Colordx, colordx, extend, inGamutSrgb, oklchToLinear } from '@colordx/core';
import a11y from '@colordx/core/plugins/a11y';
import harmoniesPlugin from '@colordx/core/plugins/harmonies';
import hsvPlugin from '@colordx/core/plugins/hsv';
import hwbPlugin from '@colordx/core/plugins/hwb';
import labPlugin from '@colordx/core/plugins/lab';
import lchPlugin from '@colordx/core/plugins/lch';
import mixPlugin from '@colordx/core/plugins/mix';
import p3Plugin, { oklchToP3Channels } from '@colordx/core/plugins/p3';

extend([a11y, harmoniesPlugin, hsvPlugin, hwbPlugin, labPlugin, lchPlugin, mixPlugin, p3Plugin]);

export { Colordx, colordx, inGamutSrgb, oklchToLinear, oklchToP3Channels };
