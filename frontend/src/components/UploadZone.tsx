import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle, ArrowRight, Settings2, Image as ImageIcon, Map } from 'lucide-react';

interface UploadZoneProps {
  onDetect: (file: File | Blob, gsdCm: number, useMl: boolean) => void;
  isLoading: boolean;
  onLoadPrecomputed?: (geojson: any, overlayImageBase64: string, stats: any) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onDetect, isLoading, onLoadPrecomputed }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gsdCm, setGsdCm] = useState<number>(42.2);
  const [useMl, setUseMl] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string>('sector_1_central.png');
  const [loadingMaster, setLoadingMaster] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load Sector 1 on initial component mount
  useEffect(() => {
    loadSample('sector_1_central.png', 42.2);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setActivePreset('');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const loadSample = async (filename: string, defaultGsd: number) => {
    try {
      setActivePreset(filename);
      const res = await fetch(`http://127.0.0.1:8000/api/samples/${filename}`);
      if (!res.ok) {
        filename = 'sector_1_central.png';
      }
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'image/png' });
      setSelectedFile(file);
      setGsdCm(defaultGsd);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Failed to load sample image:', err);
    }
  };

  const handleLoadMasterSurvey = async () => {
    if (!onLoadPrecomputed) return;
    setLoadingMaster(true);
    try {
      const geoRes = await fetch('http://127.0.0.1:8000/api/samples/master_cadastral_survey.geojson');
      const geojson = await geoRes.json();

      const imgRes = await fetch('http://127.0.0.1:8000/api/samples/sector_1_central.png');
      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const stats = {
          parcel_count: geojson.features.length,
          total_area_acres: geojson.properties?.total_area_acres || 262.7,
          total_area_sqm: geojson.properties?.total_area_sqm || 1063109,
          average_parcel_acres: (geojson.properties?.total_area_acres || 262.7) / geojson.features.length,
          engine_mode: 'Master Cadastral Survey (3 Sectors, 35 Parcels)',
        };
        onLoadPrecomputed(geojson, base64data, stats);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load master survey:', err);
      alert('Unable to load master cadastral survey.');
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onDetect(selectedFile, gsdCm, useMl);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {/* Title & Introduction */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Agricultural Parcel & Bund Boundary Detection
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Extract cadastral land boundaries and earthen bund ridges from drone orthomosaics.
            Compute precise surface areas, inspect perimeters, and export GIS-compliant shapefiles.
          </p>
        </div>

        {onLoadPrecomputed && (
          <button
            type="button"
            onClick={handleLoadMasterSurvey}
            disabled={loadingMaster}
            className="shrink-0 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 text-slate-200 text-xs font-medium flex items-center space-x-2 transition-all shadow-sm"
          >
            <Map className="w-3.5 h-3.5 text-emerald-400" />
            <span>{loadingMaster ? 'Loading Survey...' : 'Load Master Survey (35 Parcels)'}</span>
          </button>
        )}
      </div>

      {/* Preset Sector Selectors */}
      <div className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
          <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
          <span>Survey Dataset Sectors (SF5, SF6 Orthomosaic)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => loadSample('sector_1_central.png', 42.2)}
            className={`p-3 rounded-lg border text-left transition-all ${
              activePreset === 'sector_1_central.png' || activePreset === 'real_farmland_dense_plots.png'
                ? 'border-emerald-500/70 bg-emerald-950/20 text-white shadow-sm'
                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className="text-xs font-semibold block mb-0.5 text-white">Central Basin (Sector 1)</span>
            <span className="text-[11px] text-slate-400 font-mono block">Dense irrigated farm plots • 42 cm/px</span>
          </button>

          <button
            type="button"
            onClick={() => loadSample('sector_2_north.png', 42.2)}
            className={`p-3 rounded-lg border text-left transition-all ${
              activePreset === 'sector_2_north.png'
                ? 'border-emerald-500/70 bg-emerald-950/20 text-white shadow-sm'
                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className="text-xs font-semibold block mb-0.5 text-white">North Terraces (Sector 2)</span>
            <span className="text-[11px] text-slate-400 font-mono block">Contour bunds & dryland • 42 cm/px</span>
          </button>

          <button
            type="button"
            onClick={() => loadSample('sector_3_south.png', 42.2)}
            className={`p-3 rounded-lg border text-left transition-all ${
              activePreset === 'sector_3_south.png'
                ? 'border-emerald-500/70 bg-emerald-950/20 text-white shadow-sm'
                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className="text-xs font-semibold block mb-0.5 text-white">South Riverbank (Sector 3)</span>
            <span className="text-[11px] text-slate-400 font-mono block">Alluvial riverbed plots • 42 cm/px</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Dropzone */}
        <div className="md:col-span-2">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`h-72 rounded-xl border border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors relative overflow-hidden ${
              dragActive
                ? 'border-emerald-500 bg-emerald-950/10'
                : previewUrl
                ? 'border-slate-700 bg-slate-900'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.tif,.tiff"
              onChange={handleChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Orthomosaic Preview"
                  className="max-h-52 max-w-full rounded-lg object-contain border border-slate-800"
                />
                <div className="mt-2.5 flex items-center space-x-1.5 text-xs text-slate-300 font-mono">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedFile?.name || 'Raster loaded'}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center mb-3 text-slate-300">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Upload Aerial Orthomosaic
                </h3>
                <p className="text-xs text-slate-400 mb-3 max-w-xs">
                  Drag and drop a GeoTIFF tile, PNG, or JPG orthophoto, or browse files.
                </p>
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                  <span>GeoTIFF / PNG / JPG</span>
                  <span>•</span>
                  <span>Max 100MB per tile</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Survey Settings Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-300 font-semibold text-xs uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Survey Configuration</span>
            </div>

            {/* GSD Setting */}
            <div className="mb-5">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400">Ground Resolution (GSD)</span>
                <span className="text-white font-bold">{gsdCm} cm/px</span>
              </div>
              <input
                type="range"
                min="2"
                max="100"
                step="0.5"
                value={gsdCm}
                onChange={(e) => setGsdCm(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>5 cm (Drone)</span>
                <span>42 cm (Level 3)</span>
                <span>100 cm</span>
              </div>
            </div>

            {/* ML Coherence Mode */}
            <div className="mb-5">
              <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">Ridge Enhancement</span>
                  <span className="text-[10px] text-slate-400 block font-mono">Structure tensor filter</span>
                </div>
                <input
                  type="checkbox"
                  checked={useMl}
                  onChange={(e) => setUseMl(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 bg-slate-800 border-slate-700"
                />
              </label>
            </div>
          </div>

          <button
            disabled={!selectedFile || isLoading}
            onClick={handleSubmit}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 transition-all ${
              selectedFile && !isLoading
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-98 shadow-sm'
                : 'bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                <span>Extracting Boundaries...</span>
              </>
            ) : (
              <>
                <span>Run Boundary Extraction</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
