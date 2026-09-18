import React from 'react';
import { Layers, Download, Search, RefreshCw } from 'lucide-react';

interface HeaderProps {
  stats: {
    parcel_count: number;
    total_area_acres: number;
    average_parcel_acres?: number;
    engine_mode?: string;
  } | null;
  onOpenAssistant: () => void;
  onOpenExport: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onOpenAssistant,
  onOpenExport,
  onReset,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & System Title */}
      <div className="flex items-center space-x-4">
        <div 
          onClick={onReset}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-slate-950 font-bold">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-semibold tracking-tight text-white">
                AgriBund
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                GIS v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Cadastral Parcel & Bund Boundary Engine
            </p>
          </div>
        </div>

        {stats && (
          <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-slate-800 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
            <span className="font-mono text-[11px] text-slate-300">
              {stats.engine_mode ? stats.engine_mode.split(' ')[0].toUpperCase() : 'CV ENGINE'}
            </span>
          </div>
        )}
      </div>

      {/* Summary KPI Bar (Clean & Professional) */}
      {stats && stats.parcel_count > 0 && (
        <div className="hidden md:flex items-center space-x-5 bg-slate-900 px-4 py-1 rounded-lg border border-slate-800 font-mono text-xs">
          <div>
            <span className="text-slate-400 mr-1.5">PARCELS:</span>
            <span className="text-white font-bold">{stats.parcel_count}</span>
          </div>
          <div className="h-3.5 w-px bg-slate-800" />
          <div>
            <span className="text-slate-400 mr-1.5">TOTAL ARABLE:</span>
            <span className="text-emerald-400 font-bold">{stats.total_area_acres.toFixed(2)} ac</span>
          </div>
          <div className="h-3.5 w-px bg-slate-800" />
          <div>
            <span className="text-slate-400 mr-1.5">MEAN PLOT:</span>
            <span className="text-slate-200">
              {stats.average_parcel_acres 
                ? stats.average_parcel_acres.toFixed(2) 
                : (stats.total_area_acres / stats.parcel_count).toFixed(2)} ac
            </span>
          </div>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex items-center space-x-2">
        {stats && stats.parcel_count > 0 && (
          <>
            <button
              onClick={onOpenAssistant}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Query Data</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors active:scale-98"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export GIS</span>
            </button>

            <button
              onClick={onReset}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Upload New Orthomosaic"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
