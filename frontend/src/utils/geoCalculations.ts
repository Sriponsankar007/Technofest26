import * as turf from '@turf/turf';

export interface ParcelProperties {
  parcel_id: number;
  area_sqm: number;
  area_acres: number;
  area_ha?: number;
  perimeter_m: number;
  confidence: number;
  centroid?: [number, number];
  [key: string]: any;
}

export interface ParcelFeature {
  type: 'Feature';
  id?: number | string;
  properties: ParcelProperties;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface ParcelFeatureCollection {
  type: 'FeatureCollection';
  bbox?: [number, number, number, number];
  properties?: {
    gsd_cm?: number;
    parcel_count?: number;
    total_area_sqm?: number;
    total_area_acres?: number;
    crs?: string;
    image_width_px?: number;
    image_height_px?: number;
    [key: string]: any;
  };
  features: ParcelFeature[];
}

const SQM_PER_ACRE = 4046.8564224;

/**
 * Recalculates real-world area and perimeter for a polygon feature using Turf.js.
 * Runs instantly on the client whenever a vertex is dragged.
 */
export function recalculateFeatureMetrics(
  coordinates: number[][][],
  currentProps: ParcelProperties
): ParcelProperties {
  try {
    const poly = turf.polygon(coordinates);
    
    // Turf area returns square meters
    const areaSqm = turf.area(poly);
    const areaAcres = areaSqm / SQM_PER_ACRE;
    const areaHa = areaSqm / 10000.0;

    // Turf length returns kilometers, convert to meters
    const perimeterKm = turf.length(poly, { units: 'kilometers' });
    const perimeterM = perimeterKm * 1000.0;

    // Calculate centroid
    const center = turf.centroid(poly);
    const centroidCoords: [number, number] = [
      center.geometry.coordinates[0],
      center.geometry.coordinates[1],
    ];

    return {
      ...currentProps,
      area_sqm: Math.round(areaSqm * 100) / 100,
      area_acres: Math.round(areaAcres * 10000) / 10000,
      area_ha: Math.round(areaHa * 10000) / 10000,
      perimeter_m: Math.round(perimeterM * 100) / 100,
      centroid: centroidCoords,
    };
  } catch (err) {
    console.error('Error recalculating parcel metrics:', err);
    return currentProps;
  }
}

/**
 * Calculates aggregate statistics over a collection of parcel features.
 */
export function calculateCollectionStats(features: ParcelFeature[]) {
  const count = features.length;
  const totalSqm = features.reduce((acc, f) => acc + (f.properties.area_sqm || 0), 0);
  const totalAcres = features.reduce((acc, f) => acc + (f.properties.area_acres || 0), 0);
  const totalPerimeter = features.reduce((acc, f) => acc + (f.properties.perimeter_m || 0), 0);
  const avgAcres = count > 0 ? totalAcres / count : 0;
  const avgConfidence = count > 0
    ? features.reduce((acc, f) => acc + (f.properties.confidence || 0), 0) / count
    : 0;

  return {
    parcel_count: count,
    total_area_sqm: Math.round(totalSqm * 100) / 100,
    total_area_acres: Math.round(totalAcres * 1000) / 1000,
    total_perimeter_m: Math.round(totalPerimeter * 100) / 100,
    average_parcel_acres: Math.round(avgAcres * 1000) / 1000,
    average_confidence: Math.round(avgConfidence * 1000) / 10, // as percentage
  };
}
