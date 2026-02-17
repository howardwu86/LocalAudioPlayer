export type BackgroundId = 'sea_glass' | 'mist_mint' | 'sunrise_frost' | 'aqua_dusk';

type BackgroundTone = {
  pageBg: string;
  blobTop: string;
  blobBottom: string;
  blobAccent: string;
};

type BackgroundPreset = {
  id: BackgroundId;
  name: string;
  light: BackgroundTone;
  dark: BackgroundTone;
};

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'sea_glass',
    name: 'Sea Glass',
    light: {
      pageBg: '#e9f0f2',
      blobTop: 'rgba(204,233,240,0.66)',
      blobBottom: 'rgba(205,244,235,0.68)',
      blobAccent: 'rgba(191,229,255,0.42)',
    },
    dark: {
      pageBg: '#0b1114',
      blobTop: 'rgba(77,143,158,0.2)',
      blobBottom: 'rgba(52,111,123,0.22)',
      blobAccent: 'rgba(43,98,117,0.22)',
    },
  },
  {
    id: 'mist_mint',
    name: 'Mist Mint',
    light: {
      pageBg: '#ecf6f3',
      blobTop: 'rgba(198,241,226,0.66)',
      blobBottom: 'rgba(212,248,237,0.72)',
      blobAccent: 'rgba(195,232,219,0.44)',
    },
    dark: {
      pageBg: '#0c1311',
      blobTop: 'rgba(77,151,130,0.2)',
      blobBottom: 'rgba(46,114,90,0.24)',
      blobAccent: 'rgba(58,130,111,0.2)',
    },
  },
  {
    id: 'sunrise_frost',
    name: 'Sunrise Frost',
    light: {
      pageBg: '#f5f0ed',
      blobTop: 'rgba(249,212,190,0.54)',
      blobBottom: 'rgba(243,228,205,0.66)',
      blobAccent: 'rgba(215,223,246,0.42)',
    },
    dark: {
      pageBg: '#171112',
      blobTop: 'rgba(148,94,76,0.22)',
      blobBottom: 'rgba(113,89,73,0.22)',
      blobAccent: 'rgba(80,102,142,0.2)',
    },
  },
  {
    id: 'aqua_dusk',
    name: 'Aqua Dusk',
    light: {
      pageBg: '#edf2f8',
      blobTop: 'rgba(194,222,255,0.6)',
      blobBottom: 'rgba(197,238,245,0.68)',
      blobAccent: 'rgba(211,219,255,0.42)',
    },
    dark: {
      pageBg: '#0d1020',
      blobTop: 'rgba(81,105,170,0.24)',
      blobBottom: 'rgba(64,122,146,0.24)',
      blobAccent: 'rgba(98,92,165,0.2)',
    },
  },
];

export const DEFAULT_BACKGROUND_ID: BackgroundId = 'sea_glass';

export function getBackgroundTone(backgroundId: BackgroundId, isDark: boolean): BackgroundTone {
  const found = BACKGROUND_PRESETS.find((preset) => preset.id === backgroundId);
  const preset = found ?? BACKGROUND_PRESETS[0];
  return isDark ? preset.dark : preset.light;
}

