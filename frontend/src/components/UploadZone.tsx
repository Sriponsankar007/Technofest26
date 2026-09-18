import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  Settings2,
  Image as ImageIcon,
  Map,
  Compass,
} from 'lucide-react';

interface SampleItem {
  id: string;
  name: string;
  category: string;
  description: string;
  plots: number;
  acres: number;
  default_gsd_cm: number;
  filename: string;
}

const BUILTIN_SAMPLES: SampleItem[] = [
  {
    id: 'sector_1_central',
    name: 'Central Basin (Sector 1)',
    category: 'SF5 Drone Survey',
    description: 'High-density irrigated agricultural plots with prominent earthen bunds.',
    plots: 16,
    acres: 107.6,
    default_gsd_cm: 42.2,
    filename: 'sector_1_central.png',
  },
  {
    id: 'sector_4_east',
    name: 'East Canal Basin (Sector 4)',
    category: 'SF5 Drone Survey',
    description: 'Rectilinear irrigation canal plots with sharp field boundary ridges.',
    plots: 14,
    acres: 98.2,
    default_gsd_cm: 42.2,
    filename: 'sector_4_east.png',
  },
  {
    id: 'sector_2_north',
    name: 'North Terraces (Sector 2)',
    category: 'SF5 Drone Survey',
    description: 'Contour-bunded dryland parcels and sloped terrain plots.',
    plots: 12,
    acres: 129.7,
    default_gsd_cm: 42.2,
    filename: 'sector_2_north.png',
  },
  {
    id: 'sector_5_west',
    name: 'West Foothill Plots (Sector 5)',
    category: 'SF5 Drone Survey',
    description: 'Foothill agricultural parcels bordering scrub terrain with curved bunds.',
    plots: 11,
    acres: 84.5,
    default_gsd_cm: 42.2,
    filename: 'sector_5_west.png',
  },
  {
    id: 'sector_3_south',
    name: 'South Riverbed (Sector 3)',
    category: 'SF5 Drone Survey',
    description: 'Alluvial riverbank agricultural parcels along meandering waterway.',
    plots: 7,
    acres: 25.4,
    default_gsd_cm: 42.2,
    filename: 'sector_3_south.png',
  },
  {
    id: 'maharashtra_paddy_bunds',
    name: 'Terraced Paddy Bunds',
    category: 'Regional Benchmark',
    description: 'Traditional water-retaining stepped paddy bunds with narrow ridge walls.',
    plots: 8,
    acres: 18.2,
    default_gsd_cm: 25.0,
    filename: 'maharashtra_paddy_bunds.png',
  },
  {
    id: 'synthetic_farm_grid',
    name: 'Ground-Truth Cadastral Grid',
    category: 'Validation Grid',
    description: '6 mathematically defined parcels with regular bund lines for accuracy calibration.',
    plots: 6,
    acres: 3.7,
    default_gsd_cm: 10.0,
    filename: 'synthetic_farm_grid.png',
  },
];

interface UploadZoneProps {
  onDetect: (file: File | Blob, gsdCm: number, useMl: boolean) => void;
  isLoading: boolean;
  onLoadPrecomputed?: (geojson: any, overlayImageBase64: string, stats: any) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onDetect, isLoading, onLoadPrecomputed }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<SampleItem | null>(BUILTIN_SAMPLES[0]);
  const [gsdCm, setGsdCm] = useState<number>(42.2);
  const [useMl, setUseMl] = useState<boolean>(true);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load Sector 1 into the active upload area on mount
  useEffect(() => {
    transferSampleToActive(BUILTIN_SAMPLES[0]);
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
      handleUserFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleUserFile(e.target.files[0]);
    }
  };

  const handleUserFile = (file: File) => {
    setSelectedFile(file);
    setActiveSample(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const transferSampleToActive = async (sample: SampleItem) => {
    try {
      setActiveSample(sample);
      setGsdCm(sample.default_gsd_cm);

      let blob: Blob;
      try {
        const res = await fetch(`/api/samples/${sample.filename}`);
        if (!res.ok) throw new Error('Proxy fail');
        blob = await res.blob();
      } catch {
        const res = await fetch(`http://127.0.0.1:8000/api/samples/${sample.filename}`);
        if (!res.ok) throw new Error(`Direct fail: ${res.status}`);
        blob = await res.blob();
      }

      const file = new File([blob], sample.filename, { type: 'image/png' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Error transferring sample:', err);
    }
  };

  const handleLoadMasterSurvey = async () => {
    if (!onLoadPrecomputed) return;
    setLoadingMaster(true);
    try {
      let geojson: any;
      try {
        const geoRes = await fetch('/api/samples/master_cadastral_survey.geojson');
        if (!geoRes.ok) throw new Error(`HTTP ${geoRes.status}`);
        geojson = await geoRes.json();
      } catch {
        const geoRes = await fetch('http://127.0.0.1:8000/api/samples/master_cadastral_survey.geojson');
        if (!geoRes.ok) throw new Error(`HTTP ${geoRes.status}`);
        geojson = await geoRes.json();
      }

      let imgUrl = '/api/samples/sector_1_central.png';
      try {
        const imgRes = await fetch('/api/samples/sector_1_central.png');
        if (imgRes.ok) {
          const blob = await imgRes.blob();
          imgUrl = URL.createObjectURL(blob);
        }
      } catch {
        imgUrl = 'http://127.0.0.1:8000/api/samples/sector_1_central.png';
      }

      const totalAcres = geojson.properties?.total_area_acres || 262.7;
      const totalSqm = geojson.properties?.total_area_sqm || 1063109;
      const parcelCount = geojson.features ? geojson.features.length : 35;

      const stats = {
        parcel_count: parcelCount,
        total_area_acres: totalAcres,
        total_area_sqm: totalSqm,
        average_parcel_acres: totalAcres / Math.max(1, parcelCount),
        engine_mode: 'Master Cadastral Survey (35 Parcels, 262.7 Acres)',
      };

      onLoadPrecomputed(geojson, imgUrl, stats);
    } catch (err: any) {
      console.error('Failed to load master survey:', err);
      alert(`Unable to load master cadastral survey: ${err?.message || err}`);
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
    <div className="w-full h-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="text-xs uppercase font-mono tracking-widest text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
              Cadastral Workstation
            </span>
            <span className="text-xs text-slate-500 font-mono">• 14 GB Orthomosaic Compatible</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1.5">
            Agricultural Parcel & Bund Boundary Detection
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Select a survey sector from the catalog on the left to transfer it to the active inspection canvas,
            or drop your own aerial GeoTIFF / drone photo.
          </p>
        </div>

        {onLoadPrecomputed && (
          <button
            type="button"
            onClick={handleLoadMasterSurvey}
            disabled={loadingMaster}
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-500/70 text-slate-200 text-xs font-semibold flex items-center space-x-2.5 transition-all shadow-md group"
          >
            <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Map className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <span className="block text-white leading-tight">
                {loadingMaster ? 'Loading Full Map...' : 'Master Survey Overview'}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono leading-tight">
                35 Parcels • 262.7 Acres
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Main Two-Column Workstation Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* LEFT COLUMN: Sample Dataset Catalog (Side Panel) */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200 uppercase tracking-wider">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Survey Catalog</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
              {BUILTIN_SAMPLES.length} Datasets
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            Click any sector below to immediately transfer it to the active upload canvas:
          </p>

          {/* Scrollable Sample List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
            {BUILTIN_SAMPLES.map((sample) => {
              const isSelected = activeSample?.id === sample.id && !selectedFile?.name.includes('blob') && selectedFile?.name === sample.filename;

              return (
                <div
                  key={sample.id}
                  onClick={() => transferSampleToActive(sample)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center space-x-3 group relative ${
                    isSelected
                      ? 'border-emerald-500/80 bg-emerald-950/20 shadow-sm'
                      : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-800 bg-slate-900 relative">
                    <img
                      src={`http://127.0.0.1:8000/api/samples/${sample.filename}`}
                      alt={sample.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 drop-shadow" />
                      </div>
                    )}
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'
                        }`}
                      >
                        {sample.name}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-1">
                      <span className="text-slate-300 font-semibold">{sample.plots} plots</span>
                      <span>•</span>
                      <span className="text-emerald-400/90">{sample.acres} ac</span>
                      <span>•</span>
                      <span>{sample.default_gsd_cm} cm/px</span>
                    </div>

                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {sample.category}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Upload & Inspection Canvas */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col space-y-4">
          {/* Main Inspection Canvas */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`flex-1 min-h-[340px] rounded-2xl border p-5 flex flex-col justify-between transition-all relative overflow-hidden ${
              dragActive
                ? 'border-emerald-500 bg-emerald-950/20'
                : previewUrl
                ? 'border-slate-800 bg-slate-900/80 shadow-lg'
                : 'border-slate-800 border-dashed bg-slate-900/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.tif,.tiff"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Canvas Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    {activeSample ? activeSample.name : selectedFile?.name || 'Active Inspection Stage'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeSample
                      ? `Transferred from ${activeSample.category}`
                      : selectedFile
                      ? `Custom file loaded (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`
                      : 'Drop image or select from catalog'}
                  </span>
                </div>
              </div>

              {/* Upload Custom File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
                <span>Browse Custom File</span>
              </button>
            </div>

            {/* Image Preview / Center Area */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
              {previewUrl ? (
                <div className="relative max-h-72 w-full flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Active Orthomosaic"
                    className="max-h-72 max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
                  />
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300">
                    Target GSD: {gsdCm} cm/px
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer flex flex-col items-center justify-center text-center p-6"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-slate-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Drag & Drop Drone Orthomosaic</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Drop any GeoTIFF (.tif), PNG, or JPG orthophoto here, or pick a sample from the catalog.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Upload Strip at Canvas Bottom */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ready for boundary extraction</span>
              </div>
              <span className="hidden sm:inline text-slate-500">Supports GeoTIFF • PNG • JPG (up to 100MB per tile)</span>
            </div>
          </div>

          {/* Survey Parameter Controls & Action Button */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Resolution GSD Slider */}
            <div className="flex-1 max-w-md">
              <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                <span className="text-slate-400 flex items-center">
                  <Settings2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Ground Sample Distance (GSD)
                </span>
                <span className="text-white font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                  {gsdCm} cm/px
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="100"
                step="0.5"
                value={gsdCm}
                onChange={(e) => setGsdCm(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>5 cm (UAV flight)</span>
                <span>42 cm (Level 3 Ortho)</span>
                <span>100 cm (Satellite)</span>
              </div>
            </div>

            {/* ML Ridge Enhancement Toggle */}
            <label className="flex items-center space-x-2.5 cursor-pointer px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
              <input
                type="checkbox"
                checked={useMl}
                onChange={(e) => setUseMl(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200 block leading-tight">Structure Tensor</span>
                <span className="text-[10px] text-slate-400 font-mono block leading-tight">Ridge coherence</span>
              </div>
            </label>

            {/* Run Extraction Button */}
            <button
              disabled={!selectedFile || isLoading}
              onClick={handleSubmit}
              className={`py-3 px-6 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition-all shrink-0 ${
                selectedFile && !isLoading
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-98 shadow-emerald-950/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                  <span>Segmenting Parcels...</span>
                </>
              ) : (
                <>
                  <span>Run Boundary Extraction</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
