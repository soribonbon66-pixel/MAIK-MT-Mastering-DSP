import React, { useState, useRef } from 'react';
import {
  Bookmark,
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  Check,
  X,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import type { MasteringPreset, DynamicsPresetParams } from '../audio/presetStorage.ts';
import { exportPresetsJson, importPresetsFromJson } from '../audio/presetStorage.ts';

interface PresetManagerProps {
  presets: MasteringPreset[];
  activePresetId: string | null;
  currentEqGains: Record<string, number>;
  currentDynamics: DynamicsPresetParams;
  currentEnableNotches: boolean;
  currentNotchCuts: number[];
  selectedGenre: string;
  onApplyPreset: (preset: MasteringPreset) => void;
  onSavePreset: (name: string, description: string) => void;
  onDeletePreset: (presetId: string) => void;
  onRefreshPresets: () => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  activePresetId,
  currentEqGains,
  currentDynamics,
  currentEnableNotches,
  currentNotchCuts,
  selectedGenre,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onRefreshPresets,
}) => {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ text: string; isError: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePreset = presets.find((p) => p.id === activePresetId);

  const handleOpenSaveModal = () => {
    setNewPresetName(`Mi Firma ${selectedGenre.toUpperCase()} #${presets.filter((p) => !p.isFactory).length + 1}`);
    setNewPresetDesc('Ajustes personalizados de EQ 6 bandas, LR4 multibanda y matriz M/S');
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    onSavePreset(newPresetName.trim(), newPresetDesc.trim());
    setIsSaveModalOpen(false);
    setSaveSuccessMsg(`¡Preset "${newPresetName}" guardado en almacenamiento local!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleExportJson = () => {
    const jsonStr = exportPresetsJson(presets);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MAIK_MT_Mastering_Presets_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = importPresetsFromJson(text);
      if (res.success) {
        onRefreshPresets();
        setImportStatus({ text: `Se importaron ${res.count} presets exitosamente.`, isError: false });
      } else {
        setImportStatus({ text: res.error || 'Error al importar archivo.', isError: true });
      }
    } catch (err) {
      setImportStatus({ text: `Error: ${(err as Error).message}`, isError: true });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-3.5 space-y-2.5">
      {/* Top row: Active preset badge + Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Presets de Firma [Signature Sound]
              </span>
              {activePreset && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {activePreset.name}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Guarda y carga tus curvas tonales y parámetros multibanda en LocalStorage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Select Dropdown */}
          <select
            value={activePresetId || ''}
            onChange={(e) => {
              const p = presets.find((item) => item.id === e.target.value);
              if (p) onApplyPreset(p);
            }}
            className="bg-slate-950 border border-slate-700 hover:border-cyan-500/50 text-xs rounded-lg px-2.5 py-1.5 text-cyan-300 font-mono focus:outline-none cursor-pointer"
          >
            <option value="" disabled>-- Cargar Preset --</option>
            <optgroup label="Presets de Fábrica">
              {presets.filter((p) => p.isFactory).map((p) => (
                <option key={p.id} value={p.id}>
                  ⭐ {p.name} [{p.dynamics.targetLufs} LUFS]
                </option>
              ))}
            </optgroup>
            {presets.some((p) => !p.isFactory) && (
              <optgroup label="Mis Presets Guardados">
                {presets.filter((p) => !p.isFactory).map((p) => (
                  <option key={p.id} value={p.id}>
                    💾 {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleOpenSaveModal}
            className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 transition cursor-pointer"
            title="Guardar ajustes actuales como un nuevo preset de firma"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guardar Firma</span>
          </button>

          {/* Library / Manage Button */}
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Administrar biblioteca de presets, importar y exportar"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Biblioteca ({presets.filter((p) => !p.isFactory).length})</span>
          </button>
        </div>
      </div>

      {/* Success alert */}
      {saveSuccessMsg && (
        <div className="flex items-center gap-2 p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-mono">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="obsidian-card w-full max-w-md rounded-2xl p-5 border border-cyan-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Guardar Preset de Firma
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="space-y-3.5">
              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  Nombre del Preset:
                </label>
                <input
                  type="text"
                  required
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="ej. Mi Dembow Punch Signature"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  Descripción o Notas (opcional):
                </label>
                <textarea
                  rows={2}
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="ej. Curva con corte agresivo en 310Hz y submono a 120Hz"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none resize-none"
                />
              </div>

              {/* Summary of values that will be saved */}
              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1">
                <span className="text-cyan-400 font-bold block mb-1">Parámetros que se guardarán:</span>
                <div className="grid grid-cols-2 gap-1 text-slate-400">
                  <div>Target LUFS: <b className="text-white">{currentDynamics.targetLufs} LUFS</b></div>
                  <div>Ceiling TP: <b className="text-white">{currentDynamics.ceilingDb} dBTP</b></div>
                  <div>Stereo Width: <b className="text-white">{currentDynamics.msWidth}%</b></div>
                  <div>Sub Mono: <b className="text-white">{currentDynamics.msMonoFreq} Hz</b></div>
                  <div>Tape Warmth: <b className="text-white">{currentDynamics.satDrive}%</b></div>
                  <div>LR4 Low Thr: <b className="text-white">{currentDynamics.mbLowThr} dB</b></div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-extrabold uppercase tracking-wider transition shadow-md shadow-cyan-500/20"
                >
                  Guardar en Navegador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preset Library & Import/Export Modal */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="obsidian-card w-full max-w-2xl rounded-2xl p-5 border border-cyan-500/40 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Biblioteca de Presets de Masterización
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Import / Export Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
              <span className="text-[11px] font-mono text-slate-400">
                Copia de Seguridad y Transferencia entre Proyectos:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-mono transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-mono transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
              </div>
            </div>

            {importStatus && (
              <div
                className={`p-2 rounded-lg text-xs font-mono flex items-center gap-2 ${
                  importStatus.isError
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{importStatus.text}</span>
              </div>
            )}

            {/* Presets List */}
            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              {presets.map((preset) => {
                const isActive = preset.id === activePresetId;
                return (
                  <div
                    key={preset.id}
                    className={`p-3 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-cyan-950/20 border-cyan-500/50'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">
                          {preset.isFactory ? '⭐ ' : '💾 '}
                          {preset.name}
                        </span>
                        {preset.isFactory ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            FÁBRICA
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            USUARIO
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(preset.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {preset.description && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          {preset.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
                        <span>Target: <b className="text-slate-200">{preset.dynamics.targetLufs} LUFS</b></span>
                        <span>Width: <b className="text-slate-200">{preset.dynamics.msWidth}%</b></span>
                        <span>Mono Sub: <b className="text-slate-200">{preset.dynamics.msMonoFreq}Hz</b></span>
                        <span>Drive: <b className="text-slate-200">{preset.dynamics.satDrive}%</b></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyPreset(preset);
                          setIsLibraryOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {isActive ? '✓ Aplicado' : 'Cargar'}
                      </button>

                      {!preset.isFactory && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Seguro que deseas eliminar el preset "${preset.name}"?`)) {
                              onDeletePreset(preset.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer"
                          title="Eliminar preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
