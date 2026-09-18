import React, { useState } from 'react';
import { Download, X, FileJson, Archive, Table } from 'lucide-react';
import { ParcelFeatureCollection } from '../utils/geoCalculations';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  geojson: ParcelFeatureCollection | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, geojson }) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!isOpen || !geojson) return null;

  const downloadFile = async (format: 'geojson' | 'shapefile') => {
    setDownloading(format);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geojson),
      });

      if (!res.ok) throw new Error('Export request failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'geojson'
          ? 'agricultural_parcels.geojson'
          : 'agricultural_parcels_shapefile.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setDownloading(null);
    }
  };

  const downloadCsv = () => {
    const headers = ['Parcel_ID', 'Area_Acres', 'Area_SQM', 'Area_Hectares', 'Perimeter_Meters', 'Confidence_Score'];
    const rows = geojson.features.map((f) => [
      f.properties.parcel_id,
      f.properties.area_acres,
      f.properties.area_sqm,
      f.properties.area_ha || (f.properties.area_sqm / 10000).toFixed(4),
      f.properties.perimeter_m,
      f.properties.confidence,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'agricultural_parcels_summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">GIS Deliverables Export</h3>
              <span className="text-[11px] text-slate-400">Directly Importable into QGIS, ArcGIS & Cadastral Platforms</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formats Grid */}
        <div className="p-6 space-y-3.5">
          {/* GeoJSON Option */}
          <div
            onClick={() => downloadFile('geojson')}
            className="p-4 rounded-xl bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                  OGC GeoJSON (.geojson)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Standard GeoJSON FeatureCollection with polygon coordinates and calculated metric attributes.
                </p>
              </div>
            </div>
            <button
              disabled={downloading === 'geojson'}
              className="px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white text-xs font-semibold transition-colors flex items-center space-x-1"
            >
              {downloading === 'geojson' ? <span>Exporting...</span> : <span>Download</span>}
            </button>
          </div>

          {/* Shapefile Option */}
          <div
            onClick={() => downloadFile('shapefile')}
            className="p-4 rounded-xl bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                  ESRI Shapefile (.zip)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Includes .shp, .shx, .dbf attribute table, and .prj WGS84 projection for legacy GIS workflows.
                </p>
              </div>
            </div>
            <button
              disabled={downloading === 'shapefile'}
              className="px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-blue-600 text-slate-300 group-hover:text-white text-xs font-semibold transition-colors flex items-center space-x-1"
            >
              {downloading === 'shapefile' ? <span>Exporting...</span> : <span>Download</span>}
            </button>
          </div>

          {/* CSV Summary Option */}
          <div
            onClick={downloadCsv}
            className="p-4 rounded-xl bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Table className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                  Survey Table (.csv)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Tabular survey report with plot IDs, acreages, and bund perimeters for spreadsheets.
                </p>
              </div>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-amber-600 text-slate-300 group-hover:text-white text-xs font-semibold transition-colors">
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>CRS: EPSG:4326 (WGS84 Lat/Lon)</span>
          <span className="text-emerald-400 font-medium">✓ Real-time user edits included</span>
        </div>
      </div>
    </div>
  );
};
