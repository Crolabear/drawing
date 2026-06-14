import { Point, Layer, BoundingBox, ExportMetadata, CanvasSettings } from "./types";

export function getBoundingBox(points: Point[]): BoundingBox | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return { minX, minY, maxX, maxY, width, height, centerX, centerY };
}

export function getTransformedPoint(
  p: Point,
  center: Point,
  translation: Point,
  rotation: number,
  scale: number
): Point {
  // Translate relative to center
  const rx = p.x - center.x;
  const ry = p.y - center.y;

  // Scale
  const sx = rx * scale;
  const sy = ry * scale;

  // Rotate
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotX = sx * cos - sy * sin;
  const rotY = sx * sin + sy * cos;

  // Translate back to center and add layer level translation offset
  return {
    x: rotX + center.x + translation.x,
    y: rotY + center.y + translation.y,
  };
}

export function getTransformedBoundingBox(layer: Layer): BoundingBox | null {
  if (layer.points.length === 0) return null;
  const origBox = getBoundingBox(layer.points);
  if (!origBox) return null;

  const center = { x: origBox.centerX, y: origBox.centerY };
  const transformedPoints = layer.points.map((p) =>
    getTransformedPoint(p, center, layer.translation, layer.rotation, layer.scale)
  );

  return getBoundingBox(transformedPoints);
}

function getDistanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

export function hitTestLayer(
  clickPoint: Point,
  layer: Layer,
  tolerance: number = 15
): boolean {
  if (!layer.visible || layer.points.length === 0) return false;
  
  const origBox = getBoundingBox(layer.points);
  if (!origBox) return false;
  
  const center = { x: origBox.centerX, y: origBox.centerY };
  
  // Transform all points to screen space
  const screenPoints = layer.points.map((p) =>
    getTransformedPoint(p, center, layer.translation, layer.rotation, layer.scale)
  );

  // Check proximity to bounding box first as a quick filter
  const transBox = getBoundingBox(screenPoints);
  if (!transBox) return false;

  // Expand bounding box check slightly by the tolerance limit
  if (
    clickPoint.x < transBox.minX - tolerance ||
    clickPoint.x > transBox.maxX + tolerance ||
    clickPoint.y < transBox.minY - tolerance ||
    clickPoint.y > transBox.maxY + tolerance
  ) {
    return false;
  }

  // Exact point-to-segment distance check
  const actualTolerance = Math.max(tolerance, layer.thickness / 2 + 5);
  for (let i = 0; i < screenPoints.length - 1; i++) {
    const d = getDistanceToSegment(clickPoint, screenPoints[i], screenPoints[i + 1]);
    if (d <= actualTolerance) {
      return true;
    }
  }

  // Single-point edge case
  if (screenPoints.length === 1) {
    const d = Math.sqrt(
      (clickPoint.x - screenPoints[0].x) ** 2 + (clickPoint.y - screenPoints[0].y) ** 2
    );
    if (d <= actualTolerance) return true;
  }

  return false;
}

export function getSVGPathString(points: Point[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

export function generateMetadata(
  layers: Layer[],
  settings: CanvasSettings
): ExportMetadata {
  return {
    canvas: {
      width: settings.width,
      height: settings.height,
      backgroundColor: settings.backgroundColor,
      exportedAt: new Date().toISOString(),
    },
    layersCount: layers.length,
    layers: layers.map((layer) => {
      const originalBounds = getBoundingBox(layer.points);
      const transformedBounds = getTransformedBoundingBox(layer);

      return {
        id: layer.id,
        name: layer.name,
        color: layer.color,
        thickness: layer.thickness,
        opacity: layer.opacity,
        visible: layer.visible,
        locked: layer.locked,
        pointsCount: layer.points.length,
        originalBounds,
        transform: {
          translation: layer.translation,
          rotation: layer.rotation,
          scale: layer.scale,
        },
        transformedBounds,
        points: layer.points,
        svgPath: getSVGPathString(layer.points),
      };
    }),
  };
}
