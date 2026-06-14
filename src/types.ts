export interface Point {
  x: number;
  y: number;
}

export interface Layer {
  id: string;
  name: string;
  points: Point[];
  color: string;
  thickness: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  translation: Point;
  rotation: number; // in degrees
  scale: number; // multiplier (default 1)
}

export interface CanvasSettings {
  width: number; // default 800
  height: number; // default 600
  backgroundColor: string; // default transparent/white
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ExportMetadata {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    exportedAt: string;
  };
  layersCount: number;
  layers: {
    id: string;
    name: string;
    color: string;
    thickness: number;
    opacity: number;
    visible: boolean;
    locked: boolean;
    pointsCount: number;
    // Bounding box of original points (unshifted)
    originalBounds: BoundingBox | null;
    // Layer transform
    transform: {
      translation: Point;
      rotation: number;
      scale: number;
    };
    // Resulting localized positions and bounding boxes
    transformedBounds: BoundingBox | null;
    // Raw points coordinates as drawn
    points: Point[];
    // SVG path string representation for easy vector reproduction
    svgPath: string;
  }[];
}
