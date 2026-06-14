import React, { useState, useRef, useEffect } from "react";
import { Layer } from "../types";
import { Eye, EyeOff, Lock, Unlock, ArrowDown, ArrowUp, Trash2, Edit2, Copy, Check } from "lucide-react";

interface LayerItemProps {
  key?: React.Key;
  layer: Layer;
  index: number;
  totalLayers: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onRename: (newName: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function LayerItem({
  layer,
  index,
  totalLayers,
  isSelected,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDuplicate,
}: LayerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (trimmed) {
      onRename(trimmed);
    } else {
      setEditName(layer.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      setEditName(layer.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between rounded-lg border p-2.5 transition-all cursor-pointer ${
        isSelected
          ? "border-neutral-950 bg-neutral-100 shadow-xs"
          : "border-neutral-200 bg-white hover:bg-neutral-50"
      }`}
      id={`layer-item-${layer.id}`}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        {/* Color Indicator Capsule */}
        <div
          className="h-4 w-4 shrink-0 rounded-full border border-neutral-300"
          style={{ backgroundColor: layer.color, opacity: layer.opacity }}
          title={`Brush color: ${layer.color}`}
        />

        {/* Layer Descriptor Name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-neutral-400 bg-white px-1 py-0.5 text-xs text-neutral-900 focus:border-neutral-950 focus:outline-hidden"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className={`truncate text-xs font-medium select-none ${
              layer.visible ? "text-neutral-800" : "text-neutral-400 line-through"
            }`}
          >
            {layer.name}
            <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
              ({layer.points.length} pts)
            </span>
          </span>
        )}
      </div>

      {/* Controller Buttons */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Toggle Vision Eye Button */}
        <button
          onClick={onToggleVisible}
          className={`rounded p-1 transition-colors ${
            layer.visible
              ? "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
              : "text-red-400 hover:bg-neutral-200 hover:text-red-600"
          }`}
          title={layer.visible ? "Hide Layer" : "Show Layer"}
          id={`layer-eye-${layer.id}`}
        >
          {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        {/* Lock Padlock Button */}
        <button
          onClick={onToggleLock}
          className={`rounded p-1 transition-colors ${
            layer.locked
              ? "text-amber-500 hover:bg-neutral-200 hover:text-amber-700"
              : "text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800"
          }`}
          title={layer.locked ? "Unlock Layer for edits" : "Lock Layer to prevent edits"}
          id={`layer-lock-${layer.id}`}
        >
          {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>

        {/* Edit label button */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 transition-colors opacity-0 group-hover:opacity-100"
            title="Rename Layer"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Move Up Layer hierarchy */}
        <button
          onClick={onMoveUp}
          disabled={index === totalLayers - 1}
          className={`rounded p-1 transition-colors ${
            index === totalLayers - 1
              ? "text-neutral-200 cursor-not-allowed"
              : "text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800"
          }`}
          title="Move Layer Up (Draws on top)"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>

        {/* Move Down Layer hierarchy */}
        <button
          onClick={onMoveDown}
          disabled={index === 0}
          className={`rounded p-1 transition-colors ${
            index === 0
              ? "text-neutral-200 cursor-not-allowed"
              : "text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800"
          }`}
          title="Move Layer Down (Draws underneath)"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>

        {/* Duplicate Layer */}
        <button
          onClick={onDuplicate}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 transition-colors opacity-0 group-hover:opacity-100"
          title="Duplicate Layer"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        {/* Delete Layer button */}
        <button
          onClick={onDelete}
          className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete Layer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
