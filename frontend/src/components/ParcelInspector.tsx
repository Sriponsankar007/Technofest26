import React from 'react';
import { X, ChevronRight, ChevronLeft, MapPin } from 'lucide-react';
import { ParcelFeature } from '../utils/geoCalculations';

interface ParcelInspectorProps {
  parcel: ParcelFeature | null;
  totalParcels: number;
  onClose: () => void;
  onSelectParcel: (id: number) => void;
}

export const ParcelInspector: React.FC<ParcelInspectorProps> = ({
  parcel,
  totalParcels,
  onClose,
  onSelectParcel,
}) => {
  if (!parcel) return null;

  const { parcel_id, area_acres, area_sqm, area_ha, perimeter_m, confidence, centroid } = parcel.properties;

  const handlePrev = () => {
    const prevId = parcel_id > 1 ? parcel_id - 1 : totalParcels;
    onSelectParcel(prevId);
  };

  const handleNext = () => {
    const nextId = parcel_id < totalParcels ? parcel_id + 1 : 1;
    onSelectParcel(nextId);
  };

  return (
    <div className="absolute top-4 right-4 z-20 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Cadastral Record</span>
          <h3 className="text-sm font-bold text-white font-mono">Plot #{parcel_id}</h3>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handlePrev}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Previous Plot"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Next Plot"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Structured Metrics */}
      <div className="p-4 space-y-3 font-mono text-xs">
        {/* Measured Area */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400 block mb-1">Measured Surface Area</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-white tracking-tight font-mono">
              {area_acres.toFixed(3)}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Acres</span>
          </div>
          <div className="flex items-center space-x-2 mt-1.5 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
            <span>{area_sqm.toLocaleString()} m²</span>
            <span>•</span>
            <span>{(area_ha || area_sqm / 10000).toFixed(3)} ha</span>
          </div>
        </div>

        {/* Perimeter & Confidence */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Bund Perimeter</span>
            <span className="text-sm font-semibold text-slate-100 block mt-0.5">
              {perimeter_m.toFixed(1)} <span className="text-[10px] text-slate-400">m</span>
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Certainty</span>
            <span className="text-sm font-semibold text-slate-100 block mt-0.5">
              {(confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Centroid Coordinates (if available) */}
        {centroid && (
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center">
              <MapPin className="w-3 h-3 mr-1 text-slate-400" />
              Centroid:
            </span>
            <span className="text-slate-300">{centroid[1].toFixed(5)}°, {centroid[0].toFixed(5)}°</span>
          </div>
        )}
      </div>
    </div>
  );
};
