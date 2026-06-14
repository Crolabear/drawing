import React, { useState } from "react";
import { ExportMetadata } from "../types";
import { Code, Copy, Download, Check, HelpCircle, FileJson, Sparkles } from "lucide-react";

interface MetadataInspectorProps {
  metadata: ExportMetadata;
}

export default function MetadataInspector({ metadata }: MetadataInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"json" | "guide">("json");

  const jsonString = JSON.stringify(metadata, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metadata.layers[0]?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "canvas"}-metadata.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-100 rounded-xl border border-neutral-800 overflow-hidden shadow-lg">
      {/* Sidebar Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-emerald-400" />
          <h3 className="font-display font-medium text-sm text-neutral-200">Animation Metadata</h3>
        </div>
        <div className="flex bg-neutral-800 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setActiveTab("json")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === "json"
                ? "bg-neutral-900 text-neutral-100 shadow-xs"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Live JSON
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === "guide"
                ? "bg-neutral-900 text-neutral-100 shadow-xs"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Animation Guide
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-sans text-xs flex flex-col justify-between">
        {activeTab === "json" ? (
          <div className="flex flex-col h-full gap-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Includes bounding boxes, SVG paths, & layer offsets.</span>
              <div className="flex gap-1.5">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-200 transition-colors cursor-pointer"
                  title="Copy JSON representation"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-neutral-200 transition-colors cursor-pointer"
                  title="Download metadata file"
                >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Field */}
            <div className="relative flex-1 bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono text-[11px] overflow-auto max-h-[300px] sm:max-h-[420px] text-emerald-400 leading-relaxed scrollbar-thin">
              <pre>{jsonString}</pre>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-neutral-300 leading-relaxed max-h-[300px] sm:max-h-[420px] overflow-y-auto pr-1">
            <div className="flex items-start gap-2 bg-neutral-800/50 p-3 rounded-lg border border-neutral-800">
              <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-neutral-100 mb-1">How to use for animations?</h4>
                <p className="text-[11px] text-neutral-400">
                  This exported metadata matches our canvas layers exactly. GreenSock (GSAP), Anime.js, or HTML5 Canvas draw loops can pull each layer's path and coordinate state to build native vector animations!
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-semibold text-xs text-neutral-200 border-b border-neutral-800 pb-1">1. Animating via CSS / SVG Paths</h5>
              <p className="text-[11px] text-neutral-400">
                You can import your downloaded SVG file into HTML directly, grab each path element using the matching layer <code className="text-emerald-400 font-mono">id</code>, and animate translations / scales around its designated <code className="text-emerald-400 font-mono">originalBounds.centerX</code> structure:
              </p>
              <pre className="p-2 bg-neutral-950 text-neutral-400 rounded text-[10px] font-mono leading-tight border border-neutral-800">
{`/* CSS Keyframe Animation Example */
#layer-id {
  transform-origin: 247px 185px; /* CenterX CenterY */
  animation: bounce 2s infinite alternate;
}

@keyframes bounce {
  0% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}`}
              </pre>

              <h5 className="font-semibold text-xs text-neutral-200 border-b border-neutral-800 pb-1 mt-4">2. Interactive JS Loops (CSS Prefers)</h5>
              <p className="text-[11px] text-neutral-400">
                With libraries like **GSAP**, you can target the SVG elements or run a canvas loop translating the coordinate arrays directly:
              </p>
              <pre className="p-2 bg-neutral-950 text-neutral-400 rounded text-[10px] font-mono leading-tight border border-neutral-800">
{`// GSAP rotation around calculated coordinates
gsap.to("#layer-id", {
  rotation: 360,
  x: "+=150", 
  duration: 4,
  ease: "power2.inOut"
});`}
              </pre>

              <h5 className="font-semibold text-xs text-neutral-200 border-b border-neutral-800 pb-1 mt-4">3. Bounding Boxes Info</h5>
              <p className="text-[11px] text-neutral-400">
                The <code className="text-emerald-400 font-mono">transformedBounds</code> attribute represents the current on-canvas layout boundary box. This allows physics engines or hit collision tools to calculate accurate physical bounds on the screen!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info tag */}
      <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-[10px] text-neutral-500 flex items-center justify-between">
        <span>Coordinate System: Top-Left (0,0)</span>
        <span>Grid Snap: Off</span>
      </div>
    </div>
  );
}
