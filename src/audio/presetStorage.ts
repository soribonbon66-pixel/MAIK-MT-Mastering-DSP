/**
 * MAIK MT Studio DSP - Preset Management & LocalStorage Engine
 * Enables producers to store, load, import, and export signature mastering curves.
 */

export interface DynamicsPresetParams {
  mbLowThr: number;
  mbMidThr: number;
  mbHighThr: number;
  mbLowRat: number;
  mbMidRat: number;
  mbHighRat: number;
  targetLufs: number;
  msWidth: number;
  msMonoFreq: number;
  satDrive: number;
  ceilingDb: number;
}

export interface MasteringPreset {
  id: string;
  name: string;
  genreKey: string;
  description?: string;
  isFactory?: boolean;
  createdAt: number;
  eqGains: Record<string, number>;
  enableNotches: boolean;
  notchCuts?: number[];
  dynamics: DynamicsPresetParams;
}

export const STORAGE_KEY = 'maik_mt_mastering_presets_v1';

export const FACTORY_PRESETS: MasteringPreset[] = [
  {
    id: 'factory_reggaeton_signature',
    name: 'MAIK MT Dembow Signature',
    genreKey: 'reggaeton',
    description: 'Bajo sub profundo, golpe contundente en 100Hz y de-mud quirúrgico en 310Hz (-8.5 LUFS).',
    isFactory: true,
    createdAt: 1710000000000,
    eqGains: {
      sub: 2.5,
      bass: 3.8,
      mud: -4.5,
      mid: 1.2,
      harsh: -2.0,
      air: 2.4,
    },
    enableNotches: true,
    notchCuts: [-4.0, -3.5, -4.0],
    dynamics: {
      mbLowThr: -19.5,
      mbMidThr: -17.0,
      mbHighThr: -19.0,
      mbLowRat: 3.4,
      mbMidRat: 2.3,
      mbHighRat: 2.5,
      targetLufs: -8.5,
      msWidth: 114,
      msMonoFreq: 120,
      satDrive: 14,
      ceilingDb: -1.0,
    },
  },
  {
    id: 'factory_club_bumping',
    name: 'Tech House Club Bumper',
    genreKey: 'techhouse',
    description: 'Sub mono sellado en 130Hz, pegada rítmica y brillo abierto sin fatiga auditiva (-8.0 LUFS).',
    isFactory: true,
    createdAt: 1710000000001,
    eqGains: {
      sub: 1.8,
      bass: 4.2,
      mud: -5.0,
      mid: -0.5,
      harsh: -1.8,
      air: 3.2,
    },
    enableNotches: true,
    notchCuts: [-3.5, -3.0, -3.8],
    dynamics: {
      mbLowThr: -20.0,
      mbMidThr: -17.5,
      mbHighThr: -18.5,
      mbLowRat: 3.6,
      mbMidRat: 2.2,
      mbHighRat: 2.6,
      targetLufs: -8.0,
      msWidth: 122,
      msMonoFreq: 130,
      satDrive: 12,
      ceilingDb: -1.0,
    },
  },
  {
    id: 'factory_streaming_pristine',
    name: 'Modern Streaming High-Dynamic',
    genreKey: 'streaming',
    description: 'Curva equilibrada transparente, preservando transitorios y factor de cresta (-10.5 LUFS).',
    isFactory: true,
    createdAt: 1710000000002,
    eqGains: {
      sub: 0.8,
      bass: 1.5,
      mud: -2.5,
      mid: 0.6,
      harsh: -1.2,
      air: 1.8,
    },
    enableNotches: true,
    notchCuts: [-2.5, -2.0, -2.5],
    dynamics: {
      mbLowThr: -17.0,
      mbMidThr: -15.5,
      mbHighThr: -17.5,
      mbLowRat: 2.5,
      mbMidRat: 2.0,
      mbHighRat: 2.2,
      targetLufs: -10.5,
      msWidth: 110,
      msMonoFreq: 110,
      satDrive: 8,
      ceilingDb: -1.0,
    },
  },
  {
    id: 'factory_trap_heavy_808',
    name: 'Urban Trap 808 Sub Heavy',
    genreKey: 'trap',
    description: 'Graves 808 masivos, aire nítido en charles y control de asperezas sintéticas (-8.5 LUFS).',
    isFactory: true,
    createdAt: 1710000000003,
    eqGains: {
      sub: 3.2,
      bass: 2.2,
      mud: -4.2,
      mid: 0.8,
      harsh: -1.8,
      air: 3.0,
    },
    enableNotches: true,
    notchCuts: [-4.0, -3.2, -3.8],
    dynamics: {
      mbLowThr: -20.5,
      mbMidThr: -17.5,
      mbHighThr: -18.5,
      mbLowRat: 3.6,
      mbMidRat: 2.3,
      mbHighRat: 2.7,
      targetLufs: -8.5,
      msWidth: 118,
      msMonoFreq: 125,
      satDrive: 15,
      ceilingDb: -1.0,
    },
  },
];

/**
 * Retrieve user presets from storage, combined with factory presets.
 */
export function getStoredPresets(storage: Storage | null = (typeof window !== 'undefined' ? window.localStorage : null)): MasteringPreset[] {
  if (!storage) return [...FACTORY_PRESETS];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [...FACTORY_PRESETS];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const userPresets = parsed.filter(isValidPreset);
      return [...FACTORY_PRESETS, ...userPresets];
    }
  } catch (err) {
    console.warn('Failed to parse stored presets:', err);
  }

  return [...FACTORY_PRESETS];
}

/**
 * Validate that an object has the essential structure of a MasteringPreset.
 */
export function isValidPreset(item: unknown): item is MasteringPreset {
  if (!item || typeof item !== 'object') return false;
  const p = item as Partial<MasteringPreset>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.genreKey === 'string' &&
    typeof p.createdAt === 'number' &&
    typeof p.eqGains === 'object' &&
    p.eqGains !== null &&
    typeof p.dynamics === 'object' &&
    p.dynamics !== null &&
    typeof p.dynamics.targetLufs === 'number' &&
    typeof p.dynamics.ceilingDb === 'number'
  );
}

/**
 * Save or update a custom preset into LocalStorage.
 */
export function savePreset(
  preset: MasteringPreset,
  storage: Storage | null = (typeof window !== 'undefined' ? window.localStorage : null)
): MasteringPreset[] {
  const current = getStoredPresets(storage);
  const userOnly = current.filter(p => !p.isFactory);

  const existingIdx = userOnly.findIndex(p => p.id === preset.id);
  const updatedUser = [...userOnly];

  if (existingIdx >= 0) {
    updatedUser[existingIdx] = { ...preset, isFactory: false };
  } else {
    updatedUser.push({ ...preset, isFactory: false });
  }

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Failed to write preset to storage:', err);
    }
  }

  return [...FACTORY_PRESETS, ...updatedUser];
}

/**
 * Delete a user preset by ID (Factory presets cannot be deleted).
 */
export function deletePreset(
  id: string,
  storage: Storage | null = (typeof window !== 'undefined' ? window.localStorage : null)
): MasteringPreset[] {
  const current = getStoredPresets(storage);
  const userOnly = current.filter(p => !p.isFactory && p.id !== id);

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
    } catch (err) {
      console.error('Failed to delete preset from storage:', err);
    }
  }

  return [...FACTORY_PRESETS, ...userOnly];
}

/**
 * Export presets to JSON string for backup or sharing.
 */
export function exportPresetsJson(presets: MasteringPreset[]): string {
  const userPresets = presets.filter(p => !p.isFactory);
  const payload = {
    app: 'MAIK MT Studio DSP',
    version: '1.0',
    exportedAt: Date.now(),
    presets: userPresets.length > 0 ? userPresets : presets,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Import presets from JSON string.
 */
export function importPresetsFromJson(
  jsonStr: string,
  storage: Storage | null = (typeof window !== 'undefined' ? window.localStorage : null)
): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    const candidateList = Array.isArray(data) ? data : (Array.isArray(data.presets) ? data.presets : null);

    if (!candidateList || candidateList.length === 0) {
      return { success: false, count: 0, error: 'No se encontraron presets válidos en el archivo JSON.' };
    }

    const validNewPresets: MasteringPreset[] = [];
    for (const item of candidateList) {
      if (isValidPreset(item)) {
        validNewPresets.push({
          ...item,
          id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          isFactory: false,
          createdAt: Date.now(),
        });
      }
    }

    if (validNewPresets.length === 0) {
      return { success: false, count: 0, error: 'Los datos del archivo no coinciden con la estructura de presets de MAIK MT.' };
    }

    const current = getStoredPresets(storage);
    const userOnly = current.filter(p => !p.isFactory);
    const merged = [...userOnly, ...validNewPresets];

    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }

    return { success: true, count: validNewPresets.length };
  } catch (err) {
    return { success: false, count: 0, error: `Error de formato JSON: ${(err as Error).message}` };
  }
}
