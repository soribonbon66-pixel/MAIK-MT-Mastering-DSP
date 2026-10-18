import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStoredPresets,
  savePreset,
  deletePreset,
  exportPresetsJson,
  importPresetsFromJson,
  FACTORY_PRESETS
} from './presetStorage.ts';
import type { MasteringPreset } from './presetStorage.ts';

class MemoryStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

test('getStoredPresets returns factory presets when storage is empty', () => {
  const storage = new MemoryStorage();
  const presets = getStoredPresets(storage as unknown as Storage);
  assert.equal(presets.length, FACTORY_PRESETS.length);
  assert.equal(presets[0].id, 'factory_reggaeton_signature');
});

test('savePreset persists custom user preset alongside factory presets', () => {
  const storage = new MemoryStorage();
  const customPreset: MasteringPreset = {
    id: 'user_signature_1',
    name: 'My Special Dembow Curve',
    genreKey: 'reggaeton',
    createdAt: Date.now(),
    eqGains: { sub: 3.0, bass: 2.0, mud: -5.0, mid: 1.0, harsh: -2.0, air: 3.5 },
    enableNotches: true,
    dynamics: {
      mbLowThr: -19,
      mbMidThr: -16,
      mbHighThr: -18,
      mbLowRat: 3.2,
      mbMidRat: 2.2,
      mbHighRat: 2.5,
      targetLufs: -8.5,
      msWidth: 115,
      msMonoFreq: 120,
      satDrive: 15,
      ceilingDb: -1.0
    }
  };

  const updated = savePreset(customPreset, storage as unknown as Storage);
  assert.equal(updated.length, FACTORY_PRESETS.length + 1);

  const loaded = getStoredPresets(storage as unknown as Storage);
  assert.equal(loaded.length, FACTORY_PRESETS.length + 1);
  const found = loaded.find(p => p.id === 'user_signature_1');
  assert.ok(found, 'Saved preset must be present');
  assert.equal(found.name, 'My Special Dembow Curve');
  assert.equal(found.eqGains.mud, -5.0);
});

test('deletePreset removes user preset but protects factory presets', () => {
  const storage = new MemoryStorage();
  const customPreset: MasteringPreset = {
    id: 'user_to_delete',
    name: 'Temporary Preset',
    genreKey: 'techhouse',
    createdAt: Date.now(),
    eqGains: { sub: 1, bass: 1, mud: -3, mid: 0, harsh: -1, air: 2 },
    enableNotches: true,
    dynamics: {
      mbLowThr: -18,
      mbMidThr: -16,
      mbHighThr: -18,
      mbLowRat: 3,
      mbMidRat: 2,
      mbHighRat: 2,
      targetLufs: -8.0,
      msWidth: 120,
      msMonoFreq: 130,
      satDrive: 10,
      ceilingDb: -1.0
    }
  };

  savePreset(customPreset, storage as unknown as Storage);
  const beforeDelete = getStoredPresets(storage as unknown as Storage);
  assert.equal(beforeDelete.length, FACTORY_PRESETS.length + 1);

  const afterDelete = deletePreset('user_to_delete', storage as unknown as Storage);
  assert.equal(afterDelete.length, FACTORY_PRESETS.length);
  assert.ok(!afterDelete.some(p => p.id === 'user_to_delete'));

  const attemptFactoryDelete = deletePreset('factory_reggaeton_signature', storage as unknown as Storage);
  assert.equal(attemptFactoryDelete.length, FACTORY_PRESETS.length);
});

test('exportPresetsJson and importPresetsFromJson serialize and restore presets correctly', () => {
  const storage = new MemoryStorage();
  const customPreset: MasteringPreset = {
    id: 'user_exported',
    name: 'Exportable Sound Signature',
    genreKey: 'streaming',
    createdAt: 1715000000000,
    eqGains: { sub: 2.0, bass: 1.0, mud: -3.5, mid: 1.5, harsh: -1.5, air: 2.0 },
    enableNotches: true,
    dynamics: {
      mbLowThr: -17,
      mbMidThr: -15,
      mbHighThr: -17,
      mbLowRat: 2.5,
      mbMidRat: 2.0,
      mbHighRat: 2.2,
      targetLufs: -10.5,
      msWidth: 112,
      msMonoFreq: 110,
      satDrive: 9,
      ceilingDb: -1.0
    }
  };

  savePreset(customPreset, storage as unknown as Storage);
  const currentPresets = getStoredPresets(storage as unknown as Storage);
  const jsonOutput = exportPresetsJson(currentPresets);

  const targetStorage = new MemoryStorage();
  const importResult = importPresetsFromJson(jsonOutput, targetStorage as unknown as Storage);
  assert.equal(importResult.success, true);
  assert.equal(importResult.count, 1);

  const importedList = getStoredPresets(targetStorage as unknown as Storage);
  assert.equal(importedList.length, FACTORY_PRESETS.length + 1);
  const importedPreset = importedList.find(p => p.name === 'Exportable Sound Signature');
  assert.ok(importedPreset, 'Imported preset must exist');
  assert.equal(importedPreset.dynamics.targetLufs, -10.5);
});
