import React, { useState, useRef, useEffect, useMemo } from "react";
import { Point, Layer, CanvasSettings, ExportMetadata, BoundingBox } from "./types";
import {
  getBoundingBox,
  getTransformedBoundingBox,
  hitTestLayer,
  generateMetadata,
  getSVGPathString,
} from "./canvasHelpers";
import LayerItem from "./components/LayerItem";
import MetadataInspector from "./components/MetadataInspector";
import {
  Brush,
  MousePointer,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Download,
  FileJson,
  Layers,
  Settings,
  Sparkles,
  Info,
  Sliders,
  Palette,
  Eye,
  Lock,
  Compass,
  ArrowRight,
  Move,
  RotateCw,
  Maximize,
  Grid,
  FileImage,
  Image,
} from "lucide-react";

// Curated designer color palettes for intuitive choices
const COLOR_PALETTES = [
  {
    name: "Ocean Breeze",
    colors: ["#2563eb", "#3b82f6", "#60a5fa", "#06b6d4", "#22d3ee", "#e0f2fe"],
  },
  {
    name: "Warm Sunset",
    colors: ["#e11d48", "#f43f5e", "#fb7185", "#f97316", "#facc15", "#fef9c3"],
  },
  {
    name: "Classic Slate",
    colors: ["#0f172a", "#334155", "#475569", "#64748b", "#cbd5e1", "#f1f5f9"],
  },
  {
    name: "Forest Peak",
    colors: ["#14532d", "#15803d", "#22c55e", "#86efac", "#0f766e", "#30a46c"],
  },
  {
    name: "Ethereal Cyber",
    colors: ["#d946ef", "#a855f7", "#6366f1", "#06b6d4", "#f43f5e", "#10b981"],
  },
];

const CANVAS_PRESETS = [
  { name: 'Landscape Desktop (800x600)', width: 800, height: 600 },
  { name: 'Classic Retro (640x480)', width: 640, height: 480 },
  { name: 'Square Portrait (800x800)', width: 800, height: 800 },
  { name: 'Wide HD Aspect (1000x562)', width: 1000, height: 562 },
];

const BRUSH_THICKNESS_PRESETS = [2, 4, 8, 12, 16, 24, 32];

// Initial preloaded vector artwork layers to avoid landing on an empty sandbox
const INITIAL_DEMO_LAYERS: Layer[] = [
  {
    id: "layer-demonsun",
    name: "Sunset Sun",
    points: Array.from({ length: 37 }, (_, i) => {
      const angle = (i * 10 * Math.PI) / 180;
      // Circle radius 60 centered at 400, 220
      return { x: 400 + Math.cos(angle) * 70, y: 220 + Math.sin(angle) * 70 };
    }),
    color: "#f97316",
    thickness: 14,
    opacity: 0.95,
    visible: true,
    locked: false,
    translation: { x: 0, y: 0 },
    rotation: 0,
    scale: 1.0,
  },
  {
    id: "layer-demonmount1",
    name: "Main Mountain Range",
    points: [
      { x: 80, y: 480 },
      { x: 260, y: 190 },
      { x: 380, y: 350 },
      { x: 500, y: 150 },
      { x: 620, y: 310 },
      { x: 740, y: 480 },
    ],
    color: "#334155",
    thickness: 10,
    opacity: 1.0,
    visible: true,
    locked: false,
    translation: { x: 0, y: 0 },
    rotation: 0,
    scale: 1.0,
  },
  {
    id: "layer-birds",
    name: "Flying Birds Sketch",
    points: [
      // Bird 1
      { x: 260, y: 90 },
      { x: 275, y: 100 },
      { x: 290, y: 90 },
      { x: 295, y: 90 }, // Gap separator (our lines renderer skips on canvas beautifully)
      { x: 460, y: 70 },
      { x: 475, y: 80 },
      { x: 490, y: 70 },
    ],
    color: "#0f172a",
    thickness: 4,
    opacity: 0.85,
    visible: true,
    locked: false,
    translation: { x: 10, y: 15 },
    rotation: 6,
    scale: 1.1,
  },
];

export default function App() {
  const [layers, setLayers] = useState<Layer[]>(INITIAL_DEMO_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("layer-demonsun");

  // Undo / Redo History States
  const [history, setHistory] = useState<Layer[][]>([INITIAL_DEMO_LAYERS]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Canvas View Settings
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>({
    width: 800,
    height: 600,
    backgroundColor: "transparent", // "transparent" | "white" | "dark"
  });

  // Current drawing configurations
  const [activeTool, setActiveTool] = useState<"brush" | "select">("brush");
  const [brushColor, setBrushColor] = useState<string>("#2563eb");
  const [brushThickness, setBrushThickness] = useState<number>(8);
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0);

  // Active drawing state variables
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // Drag-to-translate & Transform mode variables
  const [isDraggingLayer, setIsDraggingLayer] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState<Point>({ x: 0, y: 0 });
  const [layerInitialTranslation, setLayerInitialTranslation] = useState<Point>({ x: 0, y: 0 });

  // Floating user interface indicators
  const [exportScale, setExportScale] = useState<number>(2); // Multiplier: 1x, 2x, 4x
  const [hoverCoords, setHoverCoords] = useState<Point | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Save current layer layout structure onto historical timeline
  const pushStateToHistory = (nextLayers: Layer[]) => {
    const historicalSlice = history.slice(0, historyIndex + 1);
    setHistory([...historicalSlice, nextLayers]);
    setHistoryIndex(historicalSlice.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setLayers(history[prevIndex]);
      // Reset selected layer if it was purged
      const restored = history[prevIndex];
      if (selectedLayerId && !restored.some((l) => l.id === selectedLayerId)) {
        setSelectedLayerId(restored[restored.length - 1]?.id || null);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setLayers(history[nextIndex]);
    }
  };

  // Re-draw the Canvas element every time state variables shift
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset transformations
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 1. Fill canvas background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvasSettings.backgroundColor === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (canvasSettings.backgroundColor === "dark") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Render layer stack in bottom-to-top sequence
    layers.forEach((layer) => {
      if (!layer.visible || layer.points.length === 0) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      const origBox = getBoundingBox(layer.points);
      if (origBox) {
        const cx = origBox.centerX;
        const cy = origBox.centerY;

        // Apply transformations relative to the central point of raw coordinates
        ctx.translate(cx + layer.translation.x, cy + layer.translation.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.scale(layer.scale, layer.scale);
        ctx.translate(-cx, -cy);
      }

      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(layer.points[0].x, layer.points[0].y);
      for (let i = 1; i < layer.points.length; i++) {
        ctx.lineTo(layer.points[i].x, layer.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 3. Render active/in-progress drawing path
    if (currentStroke.length > 0) {
      ctx.save();
      ctx.globalAlpha = brushOpacity;
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushThickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render selection outline bounding box in select tool mode
    if (selectedLayerId && activeTool === "select") {
      const activeLayer = layers.find((l) => l.id === selectedLayerId);
      if (activeLayer && activeLayer.visible && activeLayer.points.length > 0) {
        const transBox = getTransformedBoundingBox(activeLayer);
        if (transBox) {
          ctx.save();
          // Emerald highlight container
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(
            transBox.minX - 5,
            transBox.minY - 5,
            transBox.width + 10,
            transBox.height + 10
          );

          // Draw small anchor nodes
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          const ns = 6; // node size
          const corners = [
            { x: transBox.minX - 5, y: transBox.minY - 5 }, // Top-Left
            { x: transBox.maxX + 5, y: transBox.minY - 5 }, // Top-Right
            { x: transBox.maxX + 5, y: transBox.maxY + 5 }, // Bottom-Right
            { x: transBox.minX - 5, y: transBox.maxY + 5 }, // Bottom-Left
          ];
          corners.forEach((corner) => {
            ctx.fillRect(corner.x - ns / 2, corner.y - ns / 2, ns, ns);
            ctx.strokeRect(corner.x - ns / 2, corner.y - ns / 2, ns, ns);
          });

          // Draw central alignment crosshair
          ctx.strokeStyle = "#10b981";
          ctx.fillStyle = "#10b981";
          ctx.beginPath();
          ctx.arc(transBox.centerX, transBox.centerY, 3, 0, 2 * Math.PI);
          ctx.fill();

          ctx.restore();
        }
      }
    }
  }, [
    layers,
    currentStroke,
    selectedLayerId,
    activeTool,
    canvasSettings,
    brushColor,
    brushThickness,
    brushOpacity,
  ]);

  // Translate client coordinates relative to scaled canvas context viewport
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    return {
      x: Math.round((clientX / rect.width) * canvas.width),
      y: Math.round((clientY / rect.height) * canvas.height),
    };
  };

  // Click & Touch Events mapping
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only process left click mouse down
    const coords = getCanvasCoordinates(e);

    if (activeTool === "brush") {
      setIsDrawing(true);
      setCurrentStroke([coords]);
    } else if (activeTool === "select") {
      // Find top-most layer that maps to this cursor coordinate
      let foundLayerId: string | null = null;

      // Iterating in reverse (top to down) so users select upper layers first
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (hitTestLayer(coords, layer)) {
          foundLayerId = layer.id;
          break; // Stop iteration at highest match
        }
      }

      if (foundLayerId) {
        setSelectedLayerId(foundLayerId);
        const selLayer = layers.find((l) => l.id === foundLayerId);
        if (selLayer) {
          setIsDraggingLayer(true);
          setDragStartMouse(coords);
          setLayerInitialTranslation({ ...selLayer.translation });
        }
      } else {
        // Clear selection if clicking on completely empty space
        setSelectedLayerId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setHoverCoords(coords);

    if (activeTool === "brush" && isDrawing) {
      setCurrentStroke((prev) => [...prev, coords]);
    } else if (activeTool === "select" && isDraggingLayer && selectedLayerId) {
      const deltaX = coords.x - dragStartMouse.x;
      const deltaY = coords.y - dragStartMouse.y;

      setLayers((prevLayers) =>
        prevLayers.map((l) =>
          l.id === selectedLayerId
            ? {
                ...l,
                translation: {
                  x: layerInitialTranslation.x + deltaX,
                  y: layerInitialTranslation.y + deltaY,
                },
              }
            : l
        )
      );
    }
  };

  const handleMouseUp = () => {
    if (activeTool === "brush" && isDrawing) {
      setIsDrawing(false);
      if (currentStroke.length > 1) {
        // Package the finished path stroke layout into a new autonomous drawing layer
        const newLayerId = `layer-${Date.now()}`;
        const newLayer: Layer = {
          id: newLayerId,
          name: `Layer Object ${layers.length + 1}`,
          points: currentStroke,
          color: brushColor,
          thickness: brushThickness,
          opacity: brushOpacity,
          visible: true,
          locked: false,
          translation: { x: 0, y: 0 },
          rotation: 0,
          scale: 1.0,
        };

        const updated = [...layers, newLayer];
        setLayers(updated);
        setSelectedLayerId(newLayerId);
        pushStateToHistory(updated);
      }
      setCurrentStroke([]);
    } else if (activeTool === "select" && isDraggingLayer) {
      setIsDraggingLayer(false);
      pushStateToHistory(layers); // Save displacement onto historical timeline
    }
  };

  const handleMouseLeave = () => {
    setHoverCoords(null);
    if (isDrawing) {
      handleMouseUp();
    } else if (isDraggingLayer) {
      setIsDraggingLayer(false);
    }
  };

  // Add a brand-new empty layer so users can programmatically edit or have workspace buffers
  const handleAddEmptyLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newId,
      name: `Empty Path ${layers.length + 1}`,
      points: [],
      color: brushColor,
      thickness: brushThickness,
      opacity: 1.0,
      visible: true,
      locked: false,
      translation: { x: 0, y: 0 },
      rotation: 0,
      scale: 1.0,
    };
    const updated = [...layers, newLayer];
    setLayers(updated);
    setSelectedLayerId(newId);
    pushStateToHistory(updated);
  };

  const handleClearAll = () => {
    setLayers([]);
    setSelectedLayerId(null);
    pushStateToHistory([]);
    setShowClearConfirm(false);
  };

  // Layer Item mutation methods
  const handleRenameLayer = (id: string, newName: string) => {
    const updated = layers.map((l) => (l.id === id ? { ...l, name: newName } : l));
    setLayers(updated);
    pushStateToHistory(updated);
  };

  const handleToggleVisible = (id: string) => {
    const updated = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
    setLayers(updated);
    pushStateToHistory(updated);
  };

  const handleToggleLock = (id: string) => {
    const updated = layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l));
    setLayers(updated);
    pushStateToHistory(updated);
  };

  const handleDeleteLayer = (id: string) => {
    const updated = layers.filter((l) => l.id !== id);
    setLayers(updated);
    if (selectedLayerId === id) {
      setSelectedLayerId(updated[updated.length - 1]?.id || null);
    }
    pushStateToHistory(updated);
  };

  const handleDuplicateLayer = (id: string) => {
    const source = layers.find((l) => l.id === id);
    if (!source) return;

    const dupId = `layer-dup-${Date.now()}`;
    const duplicate: Layer = {
      ...source,
      id: dupId,
      name: `${source.name} Copy`,
      translation: { x: source.translation.x + 20, y: source.translation.y + 20 }, // slight offset
    };

    const sourceIndex = layers.findIndex((l) => l.id === id);
    const updated = [...layers];
    updated.splice(sourceIndex + 1, 0, duplicate); // insert next to original

    setLayers(updated);
    setSelectedLayerId(dupId);
    pushStateToHistory(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === layers.length - 1) return;
    const updated = [...layers];
    const target = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = target;

    setLayers(updated);
    pushStateToHistory(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === 0) return;
    const updated = [...layers];
    const target = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = target;

    setLayers(updated);
    pushStateToHistory(updated);
  };

  // Modify individual parameters of the actively selected layer
  const handleUpdateSelectedProperty = (property: keyof Layer, value: any) => {
    if (!selectedLayerId) return;
    const updated = layers.map((l) => {
      if (l.id === selectedLayerId) {
        if (property === "translation") {
          return { ...l, translation: { ...l.translation, ...value } };
        }
        return { ...l, [property]: value };
      }
      return l;
    });
    setLayers(updated);
    // Don't flood history with continuous layout/slider moves on every drag tick,
    // but updates from side panels are recorded
  };

  const handleBlurSliderAction = () => {
    pushStateToHistory(layers); // Save finalized slider values onto the history stack
  };

  // Render SVG content string representation
  const liveMetadata = useMemo(() => {
    return generateMetadata(layers, canvasSettings);
  }, [layers, canvasSettings]);

  // Export functions
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create high-resolution offline renderer
    const offlineCanvas = document.createElement("canvas");
    offlineCanvas.width = canvasSettings.width * exportScale;
    offlineCanvas.height = canvasSettings.height * exportScale;

    const ctx = offlineCanvas.getContext("2d");
    if (!ctx) return;

    // Apply scale multiplier for ultra high-res output
    ctx.scale(exportScale, exportScale);

    // 1. Fill background if solid color selected
    if (canvasSettings.backgroundColor === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSettings.width, canvasSettings.height);
    } else if (canvasSettings.backgroundColor === "dark") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvasSettings.width, canvasSettings.height);
    }

    // 2. Render layer elements
    layers.forEach((layer) => {
      if (!layer.visible || layer.points.length === 0) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      const origBox = getBoundingBox(layer.points);
      if (origBox) {
        const cx = origBox.centerX;
        const cy = origBox.centerY;

        ctx.translate(cx + layer.translation.x, cy + layer.translation.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.scale(layer.scale, layer.scale);
        ctx.translate(-cx, -cy);
      }

      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(layer.points[0].x, layer.points[0].y);
      for (let i = 1; i < layer.points.length; i++) {
        ctx.lineTo(layer.points[i].x, layer.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 3. Initiate browser download file loop
    const uri = offlineCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = uri;
    a.download = `layered-canvas-${exportScale}x-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportSVG = () => {
    let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svgContent += `<svg width="${canvasSettings.width}" height="${canvasSettings.height}" viewBox="0 0 ${canvasSettings.width} ${canvasSettings.height}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${
      canvasSettings.backgroundColor === "white"
        ? "#ffffff"
        : canvasSettings.backgroundColor === "dark"
        ? "#0f172a"
        : "transparent"
    }">\n`;

    // Map through visible layers translating to vector paths
    layers.forEach((layer) => {
      if (!layer.visible || layer.points.length === 0) return;

      const origBox = getBoundingBox(layer.points);
      if (!origBox) return;

      const cx = origBox.centerX;
      const cy = origBox.centerY;
      const pathStr = getSVGPathString(layer.points);

      // Chained transform statement perfectly matching canvas calculations
      const transformAttr = `translate(${cx + layer.translation.x} ${cy + layer.translation.y}) rotate(${layer.rotation}) scale(${layer.scale}) translate(${-cx} ${-cy})`;

      svgContent += `  <path id="${layer.id}" d="${pathStr}" fill="none" stroke="${layer.color}" stroke-width="${layer.thickness}" stroke-linecap="round" stroke-linejoin="round" opacity="${layer.opacity}" transform="${transformAttr}" />\n`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `layered-canvas-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectPreloadedSample = () => {
    setLayers(INITIAL_DEMO_LAYERS);
    setSelectedLayerId("layer-demonsun");
    setHistory([INITIAL_DEMO_LAYERS]);
    setHistoryIndex(0);
  };

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-neutral-200">
      {/* 1. Header Toolbar Titleblock */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-neutral-950 flex items-center justify-center text-white shadow-xs">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight text-neutral-900">
              Layered Canvas Studio
            </h1>
            <p className="text-xs text-neutral-500 font-medium">Draw vector objects, displace layers, export motion metadata</p>
          </div>
        </div>

        {/* Global Action Handlers */}
        <div className="flex items-center gap-2">
          {/* Timeline Action Bundle */}
          <div className="flex border border-neutral-200 rounded-lg p-0.5 bg-neutral-50">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              className={`p-1.5 rounded-md transition-colors ${
                historyIndex === 0
                  ? "text-neutral-300 cursor-not-allowed"
                  : "text-neutral-700 hover:bg-white hover:shadow-xs"
              }`}
              title="Undo Stroke (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex === history.length - 1}
              className={`p-1.5 rounded-md transition-colors ${
                historyIndex === history.length - 1
                  ? "text-neutral-300 cursor-not-allowed"
                  : "text-neutral-700 hover:bg-white hover:shadow-xs"
              }`}
              title="Redo Stroke (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          <div className="h-6 w-[1px] bg-neutral-200 mx-1" />

          {/* Quick Sandbox Loader */}
          <button
            onClick={handleSelectPreloadedSample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer"
            title="Reload Sunset mountains demo layout illustration"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            <span>Reset Demo Artwork</span>
          </button>

          {/* Delete space bundle with inline confirmation */}
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-100 rounded-lg transition-colors cursor-pointer"
              title="Clear all layers on your canvas"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Canvas</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
              <span className="text-[11px] font-semibold text-red-800">Clear everything?</span>
              <button
                onClick={handleClearAll}
                className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 cursor-pointer"
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-1 bg-white border border-neutral-200 text-neutral-600 rounded text-[10px] font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Studio Workspace Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* PANEL A: Left-Hand Drawing controls (Col span 3) */}
        <section className="lg:col-span-3 flex flex-col gap-5">
          {/* Tool selectors and details */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="font-display font-semibold text-xs tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-neutral-500" />
              <span>Canvas Tools</span>
            </h2>

            {/* Main Interactive Tool selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTool("brush")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${
                  activeTool === "brush"
                    ? "border-neutral-950 bg-neutral-950 text-white shadow-md font-semibold"
                    : "border-neutral-200 text-neutral-600 bg-neutral-50 hover:bg-white"
                }`}
                id="tool-brush"
              >
                <Brush className="h-4.5 w-4.5" />
                <span className="text-[11px]">Brush Tool</span>
              </button>
              <button
                onClick={() => setActiveTool("select")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${
                  activeTool === "select"
                    ? "border-neutral-950 bg-neutral-950 text-white shadow-md font-semibold"
                    : "border-neutral-200 text-neutral-600 bg-neutral-50 hover:bg-white"
                }`}
                id="tool-select"
              >
                <MousePointer className="h-4.5 w-4.5" />
                <span className="text-[11px]">Select / Move</span>
              </button>
            </div>

            {/* Quick helper tip */}
            <p className="text-[10px] text-neutral-400 bg-neutral-50 p-2.5 rounded border border-neutral-100 flex items-start gap-1.5 leading-relaxed">
              <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0 mt-0.5" />
              <span>
                {activeTool === "brush"
                  ? "Drag on canvas to draw a new object. Each completed drawing automatically spins up its own layer!"
                  : "Click on any line on the canvas to select the layer. Drag the layer directly with your mouse to reposition it."}
              </span>
            </p>
          </div>

          {/* Color Palettes Selector */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="font-display font-semibold text-xs tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-neutral-500" />
              <span>Stroke Colors</span>
            </h2>

            {/* Native picker with Hex status display */}
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-neutral-300">
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => {
                    setBrushColor(e.target.value);
                    if (selectedLayerId && selectedLayer) {
                      handleUpdateSelectedProperty("color", e.target.value);
                    }
                  }}
                  className="absolute inset-[-4px] h-16 w-16 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={brushColor}
                onChange={(e) => {
                  if (e.target.value.startsWith('#') && e.target.value.length <= 7) {
                    setBrushColor(e.target.value);
                    if (selectedLayerId && selectedLayer) {
                      handleUpdateSelectedProperty("color", e.target.value);
                    }
                  }
                }}
                placeholder="#000000"
                className="flex-1 px-3 py-1.5 text-xs text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-lg focus:border-neutral-950 focus:outline-hidden font-mono"
              />
            </div>

            {/* Preset Color Swatches */}
            <div className="space-y-2.5 pt-1.5">
              {COLOR_PALETTES.map((palette) => (
                <div key={palette.name} className="space-y-1">
                  <span className="text-[9px] font-semibold text-neutral-400 block uppercase tracking-wider">
                    {palette.name}
                  </span>
                  <div className="flex gap-1">
                    {palette.colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          setBrushColor(color);
                          if (selectedLayerId && selectedLayer) {
                            handleUpdateSelectedProperty("color", color);
                            pushStateToHistory(
                              layers.map((l) => (l.id === selectedLayerId ? { ...l, color } : l))
                            );
                          }
                        }}
                        className={`h-5 w-5 rounded-md border transition-transform cursor-pointer ${
                          brushColor === color ? "scale-115 ring-2 ring-neutral-950 border-white" : "border-neutral-200 hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brush Thickness panel */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="font-display font-semibold text-xs tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-neutral-500" />
              <span>Brush Settings</span>
            </h2>

            {/* Custom slider weight */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-neutral-600">
                <span>Thickness</span>
                <span className="font-mono font-bold">{brushThickness}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="80"
                value={brushThickness}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBrushThickness(val);
                  if (selectedLayerId && selectedLayer) {
                    handleUpdateSelectedProperty("thickness", val);
                  }
                }}
                onMouseUp={handleBlurSliderAction}
                className="w-full accent-neutral-950 cursor-pointer"
              />
            </div>

            {/* Weight presets */}
            <div className="flex items-center gap-1 pb-1">
              {BRUSH_THICKNESS_PRESETS.map((sz) => (
                <button
                  key={sz}
                  onClick={() => {
                    setBrushThickness(sz);
                    if (selectedLayerId && selectedLayer) {
                      handleUpdateSelectedProperty("thickness", sz);
                      pushStateToHistory(
                        layers.map((l) => (l.id === selectedLayerId ? { ...l, thickness: sz } : l))
                      );
                    }
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-mono transition-all border cursor-pointer ${
                    brushThickness === sz
                      ? "bg-neutral-950 text-white border-neutral-950 font-bold"
                      : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  }`}
                  title={`${sz}px stroke weight`}
                >
                  {sz}p
                </button>
              ))}
            </div>

            {/* Custom slider opacity weight */}
            <div className="space-y-1.5 pt-2 border-t border-neutral-100">
              <div className="flex justify-between items-center text-xs text-neutral-600">
                <span>Opacity</span>
                <span className="font-mono font-bold">{Math.round(brushOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={brushOpacity * 100}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) / 100;
                  setBrushOpacity(val);
                  if (selectedLayerId && selectedLayer) {
                    handleUpdateSelectedProperty("opacity", val);
                  }
                }}
                onMouseUp={handleBlurSliderAction}
                className="w-full accent-neutral-950 cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* PANEL B: Middle Interactive Canvas (Col span 6) */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Canvas Preset Selector */}
              <select
                value={`${canvasSettings.width}x${canvasSettings.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split("x").map(Number);
                  setCanvasSettings((prev) => ({ ...prev, width: w, height: h }));
                }}
                className="px-3 py-1.5 text-xs text-neutral-700 bg-white border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-950"
              >
                {CANVAS_PRESETS.map((preset) => (
                  <option key={preset.name} value={`${preset.width}x${preset.height}`}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Background Checkerboard styling presets */}
            <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-500">
              <Grid className="h-3.5 w-3.5 text-neutral-400" />
              <span>Canvas Space:</span>
              <div className="flex border border-neutral-200 rounded-lg p-0.5 bg-white ml-1">
                <button
                  onClick={() =>
                    setCanvasSettings((prev) => ({ ...prev, backgroundColor: "transparent" }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                    canvasSettings.backgroundColor === "transparent"
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                  title="Grid checkerboard background (transparent export)"
                >
                  Grid
                </button>
                <button
                  onClick={() =>
                    setCanvasSettings((prev) => ({ ...prev, backgroundColor: "white" }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                    canvasSettings.backgroundColor === "white"
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                  title="Plain white solid background"
                >
                  Light
                </button>
                <button
                  onClick={() =>
                    setCanvasSettings((prev) => ({ ...prev, backgroundColor: "dark" }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                    canvasSettings.backgroundColor === "dark"
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                  title="Dark ocean blue solid background"
                >
                  Dark
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Core Canvas Container */}
          <div className="flex-1 bg-neutral-200 rounded-xl border border-neutral-300 flex items-center justify-center p-4 relative overflow-hidden min-h-[400px] shadow-inner">
            <div
              className={`relative shadow-2xl border border-neutral-400 transition-all ${
                canvasSettings.backgroundColor === "transparent"
                  ? "checkerboard-pattern"
                  : canvasSettings.backgroundColor === "dark"
                  ? "bg-slate-900"
                  : "bg-white"
              }`}
            >
              <canvas
                ref={canvasRef}
                width={canvasSettings.width}
                height={canvasSettings.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className={`block select-none cursor-crosshair max-w-full height-auto`}
                style={{
                  aspectRatio: `${canvasSettings.width}/${canvasSettings.height}`,
                  maxHeight: "520px",
                }}
              />
            </div>

            {/* Hover floating coordinates indicator */}
            {hoverCoords && (
              <div className="absolute bottom-3 left-3 bg-neutral-950/80 backdrop-blur-xs text-white font-mono text-[10px] px-2.5 py-1 rounded-md tracking-wider">
                X: {hoverCoords.x}px | Y: {hoverCoords.y}px
              </div>
            )}

            {/* Active editing mode banner */}
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-semibold text-neutral-700 tracking-wide border border-neutral-200">
              {activeTool === "brush" ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  Drawing Mode
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Select & Displace
                </span>
              )}
            </div>
          </div>

          {/* Bottom Guidelines Actions Tips Banner */}
          <div className="bg-neutral-100 p-3 rounded-lg border border-neutral-200 text-xs text-neutral-500 leading-normal flex items-start gap-2">
            <span className="p-1 rounded bg-neutral-200 text-neutral-700 font-bold text-[9px] uppercase tracking-wider">Note</span>
            <p>
              Draw continuous strokes, then switch to <strong>Select / Move</strong> tool and double click elements to reposition them. You can live-tweak selected object weights or colors from the panel controllers.
            </p>
          </div>
        </section>

        {/* PANEL C: Right-Hand Layers hierarchy & metadata (Col span 3) */}
        <section className="lg:col-span-3 flex flex-col gap-5">
          {/* Active Layer Details edit controller */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="font-display font-semibold text-xs tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-neutral-500" />
                <span>Object Properties</span>
              </h2>
              {selectedLayer && (
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-sm font-bold">
                  Active
                </span>
              )}
            </div>

            {selectedLayer ? (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-400 block mb-1">
                    Layer Name Label
                  </label>
                  <input
                    type="text"
                    value={selectedLayer.name}
                    onChange={(e) => handleRenameLayer(selectedLayerId!, e.target.value)}
                    className="w-full px-2.5 py-1 text-xs text-neutral-800 border border-neutral-200 rounded focus:border-neutral-950 focus:outline-hidden bg-neutral-50"
                  />
                </div>

                {/* Micro transformation offset coordinates */}
                <div>
                  <span className="text-[10px] font-semibold text-neutral-400 block mb-1.5">
                    Translation (Offset coordinates)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1 bg-neutral-50 p-1.5 rounded border border-neutral-200">
                      <span className="text-[9px] font-mono text-neutral-400 font-bold uppercase">dX:</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.translation.x)}
                        onChange={(e) =>
                          handleUpdateSelectedProperty("translation", {
                            x: parseFloat(e.target.value) || 0,
                          })
                        }
                        onBlur={handleBlurSliderAction}
                        className="w-full text-xs text-neutral-800 bg-transparent text-right font-mono focus:outline-hidden"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-neutral-50 p-1.5 rounded border border-neutral-200">
                      <span className="text-[9px] font-mono text-neutral-400 font-bold uppercase">dY:</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.translation.y)}
                        onChange={(e) =>
                          handleUpdateSelectedProperty("translation", {
                            y: parseFloat(e.target.value) || 0,
                          })
                        }
                        onBlur={handleBlurSliderAction}
                        className="w-full text-xs text-neutral-800 bg-transparent text-right font-mono focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Rotational controls */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400 font-semibold">
                    <span>Rotation Angle</span>
                    <span className="font-mono text-neutral-800 font-bold">{selectedLayer.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedLayer.rotation}
                    onChange={(e) =>
                      handleUpdateSelectedProperty("rotation", parseInt(e.target.value))
                    }
                    onMouseUp={handleBlurSliderAction}
                    className="w-full accent-neutral-950 cursor-pointer"
                  />
                </div>

                {/* Scale controls */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400 font-semibold">
                    <span>Scale multiplier</span>
                    <span className="font-mono text-neutral-800 font-bold">{selectedLayer.scale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.05"
                    value={selectedLayer.scale}
                    onChange={(e) =>
                      handleUpdateSelectedProperty("scale", parseFloat(e.target.value))
                    }
                    onMouseUp={handleBlurSliderAction}
                    className="w-full accent-neutral-950 cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-neutral-400 text-[11px] leading-relaxed border border-dashed border-neutral-200 rounded-lg p-2 bg-neutral-50">
                No layer selected. Pick a layer from the list below, or use the <strong>Select Tool</strong> to click on canvas lines directly!
              </div>
            )}
          </div>

          {/* Layer Hierarchy Stack */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4 flex flex-col max-h-[350px]">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="font-display font-semibold text-xs tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-neutral-500" />
                <span>Layers Stack</span>
              </h2>
              <button
                onClick={handleAddEmptyLayer}
                className="flex items-center gap-1 px-2 py-1 bg-neutral-950 hover:bg-neutral-800 text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                title="Create a new empty layer"
              >
                <Plus className="h-3 w-3" />
                <span>Add Layer</span>
              </button>
            </div>

            {/* Layer Stack scroll field */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {layers.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs">
                  Canvas is empty. Select brush and start drawing.
                </div>
              ) : (
                // Walk backwards from N-1 down to 0 so top layers show at the top of list
                layers
                  .slice()
                  .reverse()
                  .map((layer, reverseIndex) => {
                    const index = layers.length - 1 - reverseIndex;
                    return (
                      <LayerItem
                        key={layer.id}
                        layer={layer}
                        index={index}
                        totalLayers={layers.length}
                        isSelected={selectedLayerId === layer.id}
                        onSelect={() => {
                          setSelectedLayerId(layer.id);
                          // Switch to select tool automatically to let them know
                        }}
                        onToggleVisible={() => handleToggleVisible(layer.id)}
                        onToggleLock={() => handleToggleLock(layer.id)}
                        onRename={(name) => handleRenameLayer(layer.id, name)}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        onDelete={() => handleDeleteLayer(layer.id)}
                        onDuplicate={() => handleDuplicateLayer(layer.id)}
                      />
                    );
                  })
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 3. Export Section Live Metadata Row Container */}
      <section className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG/Bundle Export Formats Controllers (Col span 5) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-xs tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-neutral-500" />
              <span>Asset Compilation & Export</span>
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Compile your canvas bundle. Download the high-res raster transparent images, pristine mathematical vector SVGs or raw JSON animation vectors separately.
            </p>

            {/* Resolution scale multipliers */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-neutral-600 font-semibold">
                <span>Raster Export Resolution multiplier</span>
                <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded-sm font-bold text-neutral-800">
                  {exportScale === 1 ? "Standard (1x)" : exportScale === 2 ? "HD Retinal (2x)" : "Ultra-HD (4x)"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 4].map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setExportScale(sc)}
                    className={`py-1.5 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
                      exportScale === sc
                        ? "bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs"
                        : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {sc}x ({sc * canvasSettings.width}x{sc * canvasSettings.height})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-neutral-100">
            {/* Custom Download Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportPNG}
                disabled={layers.length === 0}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  layers.length === 0
                    ? "bg-neutral-100 border-neutral-200 text-neutral-300 cursor-not-allowed"
                    : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-800 shadow-xs"
                }`}
              >
                <FileImage className="h-4 w-4" />
                <span>Export PNG</span>
              </button>

              <button
                onClick={handleExportSVG}
                disabled={layers.length === 0}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  layers.length === 0
                    ? "bg-neutral-100 border-neutral-200 text-neutral-300 cursor-not-allowed"
                    : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-800 shadow-xs"
                }`}
              >
                <Sparkles className="h-4 w-4 text-orange-500" />
                <span>Export SVG</span>
              </button>
            </div>

            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(liveMetadata, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `layered-canvas-animation-metadata.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={layers.length === 0}
              className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer ${
                layers.length === 0
                  ? "bg-neutral-300 cursor-not-allowed"
                  : "bg-neutral-950 hover:bg-neutral-800 shadow-sm"
              }`}
            >
              <FileJson className="h-4 w-4" />
              <span>Download Layer Animation JSON</span>
            </button>
          </div>
        </div>

        {/* Live Animation Metadata JSON displaying Panel (Col span 7) */}
        <div className="lg:col-span-8">
          <MetadataInspector metadata={liveMetadata} />
        </div>
      </section>

      {/* 4. Footer Brand Section */}
      <footer className="mt-auto bg-white border-t border-neutral-200 py-4 px-6 text-center text-[11px] text-neutral-400">
        <p>
          Layered Canvas Drawer &copy; {new Date().getFullYear()} &bull; Framed by Space Grotesk, JetBrains & Inter Typography. All exports run completely client-side in crisp vector format.
        </p>
      </footer>
    </div>
  );
}
