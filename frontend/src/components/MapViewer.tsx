import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { ParcelFeatureCollection, recalculateFeatureMetrics } from '../utils/geoCalculations';

interface MapViewerProps {
  geojson: ParcelFeatureCollection;
  overlayImageBase64: string;
  confidenceMapBase64?: string;
  selectedParcelId: number | null;
  onSelectParcel: (parcelId: number | null) => void;
  onUpdateGeojson: (updated: ParcelFeatureCollection) => void;
}

const PALETTE = [
  '#22c55e', '#38bdf8', '#eab308', '#f97316', '#a855f7',
  '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#06b6d4',
];

export const MapViewer: React.FC<MapViewerProps> = ({
  geojson,
  overlayImageBase64,
  confidenceMapBase64,
  selectedParcelId,
  onSelectParcel,
  onUpdateGeojson,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<{ [id: number]: L.Polygon }>({});
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);

  const [activeLayer, setActiveLayer] = useState<'vector' | 'overlay' | 'confidence'>('vector');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on GeoJSON bbox or center
    let bbox = geojson.bbox;
    if (!bbox && geojson.features && geojson.features.length > 0) {
      bbox = turf.bbox(geojson as any) as [number, number, number, number];
    }
    if (!bbox) {
      bbox = [75.7139, 19.7515, 75.7239, 19.7615];
    }
    const centerLat = (bbox[1] + bbox[3]) / 2;
    const centerLon = (bbox[0] + bbox[2]) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Dark Satellite / Carto basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 22,
      subdomains: 'abcd',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update bounds & image overlay
  useEffect(() => {
    const map = mapInstanceRef.current;
    let bbox = geojson.bbox;
    if (!bbox && geojson.features && geojson.features.length > 0) {
      bbox = turf.bbox(geojson as any) as [number, number, number, number];
    }
    if (!map || !bbox) return;

    const [minLon, minLat, maxLon, maxLat] = bbox;
    const imageBounds: L.LatLngBoundsExpression = [
      [minLat, minLon],
      [maxLat, maxLon],
    ];

    if (imageOverlayRef.current) {
      map.removeLayer(imageOverlayRef.current);
    }

    if (overlayImageBase64) {
      let imgSrc = overlayImageBase64;
      if (activeLayer === 'confidence' && confidenceMapBase64) {
        imgSrc = confidenceMapBase64;
      }

      const overlay = L.imageOverlay(imgSrc, imageBounds, {
        opacity: activeLayer === 'vector' ? 0.65 : 0.95,
        interactive: true,
      }).addTo(map);

      imageOverlayRef.current = overlay;
    }
    map.fitBounds(imageBounds, { padding: [30, 30] });
  }, [geojson.bbox, overlayImageBase64, confidenceMapBase64, activeLayer]);

  // Render polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old polygon layers
    Object.values(polygonLayersRef.current).forEach((layer) => map.removeLayer(layer));
    polygonLayersRef.current = {};

    geojson.features.forEach((feat, index) => {
      const pid = feat.properties.parcel_id;
      const color = PALETTE[index % PALETTE.length];
      const isSelected = pid === selectedParcelId;

      // Leaflet expects [lat, lon], GeoJSON is [lon, lat]
      const latLngs: L.LatLngExpression[] = feat.geometry.coordinates[0].map(([lon, lat]) => [
        lat,
        lon,
      ]);

      const polygon = L.polygon(latLngs, {
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3.5 : 2,
        fillColor: color,
        fillOpacity: isSelected ? 0.5 : activeLayer === 'vector' ? 0.35 : 0.1,
        className: 'animated-parcel-path',
      }).addTo(map);

      // Tooltip label
      polygon.bindTooltip(
        `<div class="text-xs font-bold text-slate-900 px-1 py-0.5">Plot #${pid} (${feat.properties.area_acres} ac)</div>`,
        { permanent: false, direction: 'center', className: 'glass-tooltip' }
      );

      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectParcel(pid);
      });

      polygonLayersRef.current[pid] = polygon;
    });
  }, [geojson, selectedParcelId, activeLayer]);

  // Handle Vertex Editing for selected parcel
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing vertex markers
    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];

    if (!selectedParcelId || !isEditing) return;

    const feature = geojson.features.find((f) => f.properties.parcel_id === selectedParcelId);
    if (!feature) return;

    const ring = feature.geometry.coordinates[0];
    const initialCoords = ring.map(([lon, lat]) => [lon, lat]);

    // Create custom draggable handle icon
    const vertexIcon = L.divIcon({
      className: 'vertex-marker',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const markers: L.Marker[] = [];

    // Create a marker for each coordinate (excluding duplicate last point)
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon, lat] = ring[i];
      const marker = L.marker([lat, lon], {
        icon: vertexIcon,
        draggable: true,
      }).addTo(map);

      marker.on('drag', (e: any) => {
        const newLatLng = e.target.getLatLng();
        // Update editing coordinates in real-time
        const updated = [...initialCoords];
        updated[i] = [newLatLng.lng, newLatLng.lat];
        // Ensure closed ring
        if (i === 0) {
          updated[updated.length - 1] = [newLatLng.lng, newLatLng.lat];
        }

        // Live update the polygon layer geometry
        const leafLatLngs = updated.map(([ln, lt]) => [lt, ln] as [number, number]);
        polygonLayersRef.current[selectedParcelId]?.setLatLngs(leafLatLngs);

        // Recalculate metrics client-side with Turf.js
        const newProps = recalculateFeatureMetrics([updated], feature.properties);

        // Update GeoJSON state
        const updatedFeatures = geojson.features.map((f) => {
          if (f.properties.parcel_id === selectedParcelId) {
            return {
              ...f,
              properties: newProps,
              geometry: {
                ...f.geometry,
                coordinates: [updated],
              },
            };
          }
          return f;
        });

        onUpdateGeojson({
          ...geojson,
          features: updatedFeatures,
        });
      });

      markers.push(marker);
    }

    vertexMarkersRef.current = markers;

    return () => {
      markers.forEach((m) => map.removeLayer(m));
    };
  }, [selectedParcelId, isEditing]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Floating Layer Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col space-y-2">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-lg p-1 border border-slate-800 flex items-center space-x-1 shadow-lg font-mono text-xs">
          <button
            onClick={() => setActiveLayer('vector')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeLayer === 'vector'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Polygons
          </button>
          <button
            onClick={() => setActiveLayer('overlay')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeLayer === 'overlay'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bund Edges
          </button>
          <button
            onClick={() => setActiveLayer('confidence')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeLayer === 'confidence'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Heatmap
          </button>
        </div>

        {/* Edit Mode Toggle for Selected Parcel */}
        {selectedParcelId && (
          <div className="bg-slate-900/90 backdrop-blur-md rounded-lg p-2 border border-slate-800 flex items-center space-x-3 shadow-lg font-mono text-xs">
            <span className="text-slate-300">Plot #{selectedParcelId}</span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                isEditing
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isEditing ? 'Finish Edit' : 'Edit Vertices'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
