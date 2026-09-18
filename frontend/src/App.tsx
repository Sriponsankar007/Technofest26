import { useState } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { MapViewer } from './components/MapViewer';
import { ParcelInspector } from './components/ParcelInspector';
import { AiAssistantModal } from './components/AiAssistantModal';
import { ExportModal } from './components/ExportModal';
import {
  ParcelFeatureCollection,
  calculateCollectionStats,
} from './utils/geoCalculations';

export function App() {
  const [geojson, setGeojson] = useState<ParcelFeatureCollection | null>(null);
  const [overlayImageBase64, setOverlayImageBase64] = useState<string | null>(null);
  const [confidenceMapBase64, setConfidenceMapBase64] = useState<string | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const handleDetect = async (file: File | Blob, gsdCm: number, useMl: boolean) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gsd_cm', gsdCm.toString());
      formData.append('use_ml', useMl ? 'true' : 'false');

      const res = await fetch('http://127.0.0.1:8000/api/detect', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Detection failed with status: ${res.status}`);
      }

      const data = await res.json();
      setGeojson(data.parcels);
      setOverlayImageBase64(data.overlay_image_base64);
      setConfidenceMapBase64(data.confidence_map_base64);
      setStats(data.stats);
      setSelectedParcelId(1); // Select first parcel by default
    } catch (err) {
      console.error('Detection error:', err);
      alert('Failed to detect parcels. Ensure the backend server is running on port 8000.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGeojson = (updated: ParcelFeatureCollection) => {
    setGeojson(updated);
    // Recalculate summary stats live
    const newStats = calculateCollectionStats(updated.features);
    setStats((prev: any) => ({
      ...prev,
      ...newStats,
    }));
  };

  const handleReset = () => {
    setGeojson(null);
    setOverlayImageBase64(null);
    setConfidenceMapBase64(null);
    setStats(null);
    setSelectedParcelId(null);
  };

  const selectedParcel =
    geojson?.features.find((f) => f.properties.parcel_id === selectedParcelId) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <Header
        stats={stats}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onReset={handleReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {geojson && overlayImageBase64 ? (
          <div className="w-full h-full relative">
            <MapViewer
              geojson={geojson}
              overlayImageBase64={overlayImageBase64}
              confidenceMapBase64={confidenceMapBase64 || undefined}
              selectedParcelId={selectedParcelId}
              onSelectParcel={setSelectedParcelId}
              onUpdateGeojson={handleUpdateGeojson}
            />

            {/* Floating Parcel Details Card */}
            <ParcelInspector
              parcel={selectedParcel}
              totalParcels={geojson.features.length}
              onClose={() => setSelectedParcelId(null)}
              onSelectParcel={setSelectedParcelId}
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto flex items-center justify-center">
            <UploadZone
              onDetect={handleDetect}
              isLoading={isLoading}
              onLoadPrecomputed={(loadedGeojson, overlayImg, loadedStats) => {
                setGeojson(loadedGeojson);
                setOverlayImageBase64(overlayImg);
                setConfidenceMapBase64(null);
                setStats(loadedStats);
                setSelectedParcelId(1);
              }}
            />
          </div>
        )}
      </main>

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        geojson={geojson}
        onHighlightParcel={(id) => setSelectedParcelId(id)}
      />

      {/* Export GIS Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        geojson={geojson}
      />
    </div>
  );
}

export default App;
