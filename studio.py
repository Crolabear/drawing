#!/usr/bin/env python3
import sys
import os
import json
import math
import tkinter as tk
from tkinter import ttk, colorchooser, messagebox

# ==========================================
# CURATED DESIGNER COLOR PALETTES
# ==========================================
COLOR_PALETTES = {
    "Ocean Breeze": ["#2563eb", "#3b82f6", "#60a5fa", "#06b6d4", "#22d3ee", "#e0f2fe"],
    "Warm Sunset": ["#e11d48", "#f43f5e", "#fb7185", "#f97316", "#facc15", "#fef9c3"],
    "Classic Slate": ["#0f172a", "#334155", "#475569", "#64748b", "#cbd5e1", "#f1f5f9"],
    "Forest Peak": ["#14532d", "#15803d", "#22c55e", "#86efac", "#0f766e", "#30a46c"],
    "Ethereal Cyber": ["#d946ef", "#a855f7", "#6366f1", "#06b6d4", "#f43f5e", "#10b981"]
}

# Pre-packaged demo vector objects for custom initialization
def get_initial_demo_layers():
    # Sunflower-like sunset sun
    sun_points = []
    cx, cy = 400.0, 220.0
    r = 70.0
    for i in range(37):
        angle = (i * 10 * math.pi) / 180.0
        sun_points.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))

    # Mountains peaks
    mountain_points = [
        (80.0, 480.0),
        (260.0, 190.0),
        (380.0, 350.0),
        (500.0, 150.0),
        (620.0, 310.0),
        (740.0, 480.0),
    ]

    # Flying birds
    birds_points = [
        (260.0, 90.0), (275.0, 100.0), (290.0, 90.0),
        (320.0, 85.0), (335.0, 95.0), (350.0, 85.0),  # bird 2 offset directly
    ]

    return [
        {
            "id": "layer_sun",
            "name": "Sunset Sun",
            "points": sun_points,
            "color": "#f97316",
            "thickness": 14,
            "opacity": 0.95,
            "visible": True,
            "translation": [0.0, 0.0],
            "rotation": 0.0,
            "scale": 1.0,
        },
        {
            "id": "layer_mountains",
            "name": "Main Mountain Range",
            "points": mountain_points,
            "color": "#334155",
            "thickness": 10,
            "opacity": 1.0,
            "visible": True,
            "translation": [0.0, 0.0],
            "rotation": 0.0,
            "scale": 1.0,
        },
        {
            "id": "layer_birds",
            "name": "Flying Birds Sketch",
            "points": birds_points,
            "color": "#0f172a",
            "thickness": 4,
            "opacity": 0.85,
            "visible": True,
            "translation": [10.0, 15.0],
            "rotation": 6.0,
            "scale": 1.1,
        }
    ]


# ==========================================
# VECTOR UTILITIES / TRANSFORMATION MATRIX
# ==========================================
def get_bounding_box(points):
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width = max_x - min_x
    height = max_y - min_y
    return {
        "minX": min_x, "minY": min_y,
        "maxX": max_x, "maxY": max_y,
        "width": width, "height": height,
        "centerX": min_x + width / 2.0,
        "centerY": min_y + height / 2.0
    }

def transform_point(p, center, translation, rotation_deg, scale):
    # Translate relative to bounds center
    rx = p[0] - center[0]
    ry = p[1] - center[1]

    # Apply Scale factor
    sx = rx * scale
    sy = ry * scale

    # Apply Rotation factor
    rad = (rotation_deg * math.pi) / 180.0
    cos_val = math.cos(rad)
    sin_val = math.sin(rad)

    rot_x = sx * cos_val - sy * sin_val
    rot_y = sx * sin_val + sy * cos_val

    # Translate back to center and append translation displacement offset
    return (
        rot_x + center[0] + translation[0],
        rot_y + center[1] + translation[1]
    )

def get_transformed_points(layer):
    points = layer["points"]
    if not points:
        return []
    box = get_bounding_box(points)
    if not box:
        return points
    center = (box["centerX"], box["centerY"])
    return [
        transform_point(p, center, layer["translation"], layer["rotation"], layer["scale"])
        for p in points
    ]

def get_distance_to_segment(p, v, w):
    l2 = (v[0] - w[0])**2 + (v[1] - w[1])**2
    if l2 == 0:
        return math.sqrt((p[0] - v[0])**2 + (p[1] - v[1])**2)
    t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2
    t = max(0.0, min(1.0, t))
    proj = (v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1]))
    return math.sqrt((p[0] - proj[0])**2 + (p[1] - proj[1])**2)

def hit_test_layer(click_p, layer, tolerance=15.0):
    if not layer["visible"] or not layer["points"]:
        return False
    scr_points = get_transformed_points(layer)
    if not scr_points:
        return False
    
    # Quick bounding box proximity pre-check
    box = get_bounding_box(scr_points)
    if not box:
        return False
    if (click_p[0] < box["minX"] - tolerance or click_p[0] > box["maxX"] + tolerance or
        click_p[1] < box["minY"] - tolerance or click_p[1] > box["maxY"] + tolerance):
        return False

    actual_tolerance = max(tolerance, layer["thickness"] / 2.0 + 5.0)
    for i in range(len(scr_points) - 1):
        if get_distance_to_segment(click_p, scr_points[i], scr_points[i+1]) <= actual_tolerance:
            return True

    if len(scr_points) == 1:
        d = math.sqrt((click_p[0] - scr_points[0][0])**2 + (click_p[1] - scr_points[0][1])**2)
        if d <= actual_tolerance:
            return True
            
    return False


# ==========================================
# TKINTER CORE APP SYSTEM
# ==========================================
class LayeredCanvasApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Local Layered Canvas Studio")
        self.geometry("1100x720")
        self.configure(bg="#1e1e24") # Premium modern charcoal backdrop

        # Apply dark aesthetic theme styles
        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.style.configure(".", background="#1e1e24", foreground="#ffffff")
        self.style.configure("TLabel", background="#1e1e24", foreground="#cbd5e1", font=("Inter", 9))
        self.style.configure("Header.TLabel", font=("Inter", 12, "bold"), foreground="#f8fafc")
        self.style.configure("TButton", background="#334155", foreground="#ffffff", borderwidth=0, focuscolor="none", font=("Inter", 9, "bold"))
        self.style.map("TButton", background=[("active", "#475569")])
        self.style.configure("Accent.TButton", background="#2563eb", foreground="#ffffff", borderwidth=0, font=("Inter", 9, "bold"))
        self.style.map("Accent.TButton", background=[("active", "#3b82f6")])

        # Active App States
        self.layers = get_initial_demo_layers()
        self.selected_layer_id = "layer_sun"
        self.active_tool = "brush" # "brush" | "select"
        self.brush_color = "#2563eb"
        self.brush_thickness = 8
        self.brush_opacity = 1.0
        self.canvas_bg_mode = "grid" # "grid" | "light" | "dark"

        # Interactive drawing buffer state
        self.current_stroke = []

        # Drag selection states
        self.is_dragging = False
        self.drag_start_coord = (0.0, 0.0)
        self.layer_initial_translation = [0.0, 0.0]

        self.setup_ui_layout()
        self.refresh_layer_listbox()
        self.draw_canvas_scene()

    def setup_ui_layout(self):
        # ---------------------------------------------
        # 1. Main Header Toolbar
        # ---------------------------------------------
        header_frame = tk.Frame(self, bg="#0f172a", height=60, bd=0, highlightthickness=0)
        header_frame.pack(side="top", fill="x")

        title_lbl = tk.Label(header_frame, text="🎨 Layered Canvas Desktop Studio", font=("Space Grotesk", 14, "bold"), bg="#0f172a", fg="#ffffff")
        title_lbl.pack(side="left", padx=20, pady=12)

        subtitle_lbl = tk.Label(header_frame, text="• Local Python Draftspace", font=("JetBrains Mono", 10), bg="#0f172a", fg="#10b981")
        subtitle_lbl.pack(side="left", pady=15)

        # High-level actions
        reset_demo_btn = tk.Button(header_frame, text="Reset Demo Artwork", bg="#0d9488", fg="white", font=("Inter", 8, "bold"), bd=0, padx=10, command=self.reset_to_demo_artwork, cursor="hand2")
        reset_demo_btn.pack(side="right", padx=10, pady=12)

        clear_btn = tk.Button(header_frame, text="Clear Canvas", bg="#e11d48", fg="white", font=("Inter", 8, "bold"), bd=0, padx=10, command=self.clear_all_layers, cursor="hand2")
        clear_btn.pack(side="right", padx=10, pady=12)

        # ---------------------------------------------
        # Grid Main Frame View (3 Main Columns)
        # ---------------------------------------------
        main_workspace = tk.Frame(self, bg="#1e1e24")
        main_workspace.pack(side="top", fill="both", expand=True, padx=15, pady=15)

        # COLUMN 1: LEFT PANEL controls (Width: ~280px)
        left_panel = tk.Frame(main_workspace, bg="#16161a", width=280)
        left_panel.pack(side="left", fill="both", padx=(0, 10))
        left_panel.pack_propagate(False)

        # Col 1 Header
        tk.Label(left_panel, text="TOOLBOX CONTROLS", font=("Inter", 10, "bold"), bg="#16161a", fg="#94a3b8").pack(anchor="w", padx=15, pady=(15, 10))

        # Tool selector Button Frame
        tool_frame = tk.Frame(left_panel, bg="#16161a")
        tool_frame.pack(fill="x", padx=15, pady=5)

        self.brush_tool_btn = tk.Button(tool_frame, text="🖌 Draw Brush", bg="#2563eb", fg="white", font=("Inter", 9, "bold"), bd=1, relief="ridge", command=lambda: self.switch_client_tool("brush"), cursor="hand2")
        self.brush_tool_btn.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=6)

        self.select_tool_btn = tk.Button(tool_frame, text="🖱 Select & Move", bg="#27272a", fg="#a1a1aa", font=("Inter", 9, "bold"), bd=1, relief="ridge", command=lambda: self.switch_client_tool("select"), cursor="hand2")
        self.select_tool_btn.pack(side="left", fill="x", expand=True, padx=(4, 0), ipady=6)

        # Quick descriptive label
        self.tool_hint_lbl = tk.Label(left_panel, text="Drag on canvas to sketch vector paths. Each stroke creates a distinct layer module automagically.", font=("Inter", 8), bg="#27272a", fg="#a1a1aa", wraplength=240, justify="left", bd=2, relief="flat", padx=8, pady=8)
        self.tool_hint_lbl.pack(fill="x", padx=15, pady=10)

        # Brush color selection
        tk.Label(left_panel, text="Stroke Palette Color", font=("Inter", 9, "bold"), bg="#16161a", fg="#cbd5e1").pack(anchor="w", padx=15, pady=(10, 2))
        color_btn_frame = tk.Frame(left_panel, bg="#16161a")
        color_btn_frame.pack(fill="x", padx=15, pady=2)
        
        custom_color_btn = tk.Button(color_btn_frame, text="🎨 Pick Color Picker", bg="#3f3f46", fg="white", font=("Inter", 8, "bold"), bd=0, command=self.open_custom_color_picker, cursor="hand2")
        custom_color_btn.pack(side="left", fill="x", expand=True, ipady=4)

        # Palette Preset grid
        swatches_frame = tk.Frame(left_panel, bg="#16161a")
        swatches_frame.pack(fill="x", padx=15, pady=5)
        for name, cols in COLOR_PALETTES.items():
            lbl = tk.Label(swatches_frame, text=name.upper(), font=("Inter", 7, "bold"), bg="#16161a", fg="#64748b")
            lbl.pack(anchor="w", pady=(4, 0))
            palette_bar = tk.Frame(swatches_frame, bg="#16161a")
            palette_bar.pack(fill="x", pady=2)
            for col in cols:
                btn = tk.Button(palette_bar, bg=col, width=2, height=1, bd=1, relief="solid", command=lambda c=col: self.set_active_color(c), cursor="hand2")
                btn.pack(side="left", padx=2)

        # Thickness slider
        tk.Label(left_panel, text="Brush Stroke Weight", font=("Inter", 9, "bold"), bg="#16161a", fg="#cbd5e1").pack(anchor="w", padx=15, pady=(15, 2))
        
        self.thick_val_lbl = tk.Label(left_panel, text=f"Value: {self.brush_thickness}px", font=("JetBrains Mono", 8), bg="#16161a", fg="#10b981")
        self.thick_val_lbl.pack(anchor="w", padx=15)

        self.thickness_slider = ttk.Scale(left_panel, from_=1, to=80, orient="horizontal", command=self.on_brush_thickness_internal_shift)
        self.thickness_slider.set(self.brush_thickness)
        self.thickness_slider.pack(fill="x", padx=15, pady=4)

        # Base active settings info pane
        status_box = tk.Frame(left_panel, bg="#0f172a", bd=1, relief="solid")
        status_box.pack(fill="x", padx=15, pady=15, side="bottom")
        tk.Label(status_box, text="ACTIVE BRUSH PRESETS", font=("Inter", 8, "bold"), bg="#0f172a", fg="#38bdf8").pack(anchor="w", padx=10, pady=(8, 2))
        self.brush_status_lbl = tk.Label(status_box, text=f"Brush Color: {self.brush_color}\nBrush size: {self.brush_thickness}px\nTotal layers: {len(self.layers)}", font=("JetBrains Mono", 8), bg="#0f172a", fg="#94a3b8", justify="left")
        self.brush_status_lbl.pack(anchor="w", padx=10, pady=(0, 8))


        # ---------------------------------------------
        # COLUMN 2: MIDDLE PANEL interactive Canvas (Width: expandable, core display)
        # ---------------------------------------------
        mid_panel = tk.Frame(main_workspace, bg="#1b1c21")
        mid_panel.pack(side="left", fill="both", expand=True)

        # Canvas toolbar
        canvas_bar = tk.Frame(mid_panel, bg="#1b1c21")
        canvas_bar.pack(side="top", fill="x", pady=(0, 6))

        tk.Label(canvas_bar, text="Interactive Canvas Workspace (800x600)", font=("Inter", 9, "bold"), bg="#1b1c21", fg="#cbd5e1").pack(side="left")

        # Background mode changer buttons
        bg_lbl = tk.Label(canvas_bar, text="Canvas Base:", bg="#1b1c21", fg="#64748b")
        bg_lbl.pack(side="right", padx=(10, 4))

        bg_grid_btn = tk.Button(canvas_bar, text="GRID", bg="#27272a", fg="white", font=("Inter", 7, "bold"), bd=1, command=lambda: self.adjust_canvas_bg("grid"), cursor="hand2")
        bg_grid_btn.pack(side="right", padx=2)
        
        bg_light_btn = tk.Button(canvas_bar, text="LIGHT", bg="#27272a", fg="white", font=("Inter", 7, "bold"), bd=1, command=lambda: self.adjust_canvas_bg("light"), cursor="hand2")
        bg_light_btn.pack(side="right", padx=2)
        
        bg_dark_btn = tk.Button(canvas_bar, text="DARK", bg="#27272a", fg="white", font=("Inter", 7, "bold"), bd=1, command=lambda: self.adjust_canvas_bg("dark"), cursor="hand2")
        bg_dark_btn.pack(side="right", padx=2)

        # Canvas Component container
        self.canvas_container = tk.Frame(mid_panel, bg="#16161a", bd=1, relief="sunken")
        self.canvas_container.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(self.canvas_container, bg="#0f172a", width=800, height=600, highlightthickness=0, selectbackground="#10b981", cursor="crosshair")
        self.canvas.pack(fill="both", expand=True)

        # Bind Core canvas mouse events
        self.canvas.bind("<Button-1>", self.on_canvas_mouse_down)
        self.canvas.bind("<B1-Motion>", self.on_canvas_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_mouse_release)
        self.canvas.bind("<Motion>", self.on_canvas_mouse_hover)


        # ---------------------------------------------
        # COLUMN 3: RIGHT PANEL layers and slider displacements
        # ---------------------------------------------
        right_panel = tk.Frame(main_workspace, bg="#16161a", width=300)
        right_panel.pack(side="right", fill="both", padx=(10, 0))
        right_panel.pack_propagate(False)

        # Title
        tk.Label(right_panel, text="LAYERS HIERARCHY", font=("Inter", 10, "bold"), bg="#16161a", fg="#94a3b8").pack(anchor="w", padx=15, pady=(15, 10))

        # Layers Listbox list
        self.layer_listbox = tk.Listbox(right_panel, bg="#1e1e24", fg="#ffffff", selectbackground="#10b981", selectforeground="#ffffff", font=("Inter", 9), bd=1, highlightcolor="#2563eb", selectmode="single")
        self.layer_listbox.pack(fill="x", padx=15, pady=5)
        self.layer_listbox.bind("<<ListboxSelect>>", self.on_layer_box_selection_shifted)

        # Layer controls buttons
        layer_control_btn_frame = tk.Frame(right_panel, bg="#16161a")
        layer_control_btn_frame.pack(fill="x", padx=15, pady=2)

        dup_btn = tk.Button(layer_control_btn_frame, text="Duplicate", bg="#27272a", fg="white", font=("Inter", 8), bd=0, chunk="dup", command=self.duplicate_selected_layer, cursor="hand2")
        dup_btn.pack(side="left", fill="x", expand=True, padx=(0, 2), ipady=3)

        del_btn = tk.Button(layer_control_btn_frame, text="Delete", bg="#7f1d1d", fg="white", font=("Inter", 8), bd=0, chunk="del", command=self.delete_selected_layer, cursor="hand2")
        del_btn.pack(side="left", fill="x", expand=True, padx=(2, 2), ipady=3)

        vis_btn = tk.Button(layer_control_btn_frame, text="Show/Hide", bg="#27272a", fg="white", font=("Inter", 8), bd=0, command=self.toggle_selected_layer_visibility, cursor="hand2")
        vis_btn.pack(side="left", fill="x", expand=True, padx=(2, 0), ipady=3)

        # Sibling Z-ordering
        z_index_frame = tk.Frame(right_panel, bg="#16161a")
        z_index_frame.pack(fill="x", padx=15, pady=2)
        
        move_up_btn = tk.Button(z_index_frame, text="▲ Bring Upwards", bg="#3f3f46", fg="white", font=("Inter", 8), bd=0, command=lambda: self.adjust_z_ordering(True), cursor="hand2")
        move_up_btn.pack(side="left", fill="x", expand=True, padx=(0, 2), ipady=3)

        move_down_btn = tk.Button(z_index_frame, text="▼ Push Downwards", bg="#3f3f46", fg="white", font=("Inter", 8), bd=0, command=lambda: self.adjust_z_ordering(False), cursor="hand2")
        move_down_btn.pack(side="left", fill="x", expand=True, padx=(2, 0), ipady=3)

        # Layer Rename parameters input
        rename_frame = tk.Frame(right_panel, bg="#16161a")
        rename_frame.pack(fill="x", padx=15, pady=5)
        tk.Label(rename_frame, text="Rename Selected Layer:", font=("Inter", 8, "bold"), bg="#16161a", fg="#94a3b8").pack(anchor="w")
        
        self.rename_entry_var = tk.StringVar()
        self.rename_entry = tk.Entry(rename_frame, textvariable=self.rename_entry_var, bg="#1e1e24", fg="white", insertbackground="white", bd=1, relief="groove")
        self.rename_entry.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=2)
        self.rename_entry.bind("<Return>", lambda e: self.rename_selected_layer())
        
        apply_rename_btn = tk.Button(rename_frame, text="Set", bg="#2563eb", fg="white", font=("Inter", 7, "bold"), bd=0, padx=6, command=self.rename_selected_layer, cursor="hand2")
        apply_rename_btn.pack(side="right", ipady=2)

        # Divider line
        div = tk.Frame(right_panel, bg="#2727aa", height=1)
        div.pack(fill="x", padx=15, pady=10)

        # Selected layer transformations properties and sliders
        tk.Label(right_panel, text="LAYER MATRICES & PROPERTIES", font=("Inter", 10, "bold"), bg="#16161a", fg="#94a3b8").pack(anchor="w", padx=15, pady=(5, 10))

        # Displacements Translation Sliders
        # Rotation Slider
        self.rot_label_var = tk.StringVar(value="Rotation: 0.0°")
        tk.Label(right_panel, textvariable=self.rot_label_var, font=("Inter", 8, "bold"), bg="#16161a", fg="#cbd5e1").pack(anchor="w", padx=15)
        self.rot_slider = ttk.Scale(right_panel, from_=-180, to=180, orient="horizontal", command=self.on_rotation_slider_moved)
        self.rot_slider.pack(fill="x", padx=15, pady=4)

        # Scale Slider
        self.scale_label_var = tk.StringVar(value="Scale Multiplier: 1.0x")
        tk.Label(right_panel, textvariable=self.scale_label_var, font=("Inter", 8, "bold"), bg="#16161a", fg="#cbd5e1").pack(anchor="w", padx=15)
        self.scale_slider = ttk.Scale(right_panel, from_=0.1, to=4.0, orient="horizontal", command=self.on_scale_slider_moved)
        self.scale_slider.set(1.0)
        self.scale_slider.pack(fill="x", padx=15, pady=4)

        # Export Options Actions Frame
        export_frame = tk.Frame(right_panel, bg="#16161a")
        export_frame.pack(fill="x", padx=15, pady=15, side="bottom")

        tk.Label(export_frame, text="Export Compilation Outputs", font=("Inter", 8, "bold"), bg="#16161a", fg="#64748b").pack(anchor="w", pady=(0, 4))
        
        export_svg_btn = tk.Button(export_frame, text="💾 Export SVG Vectors", bg="#0d9488", fg="white", font=("Inter", 9, "bold"), bd=0, command=self.export_canvas_composition_to_svg, cursor="hand2")
        export_svg_btn.pack(fill="x", pady=2, ipady=4)

        export_json_btn = tk.Button(export_frame, text="📋 Copy Vector Metadata JSON", bg="#4f46e5", fg="white", font=("Inter", 9, "bold"), bd=0, command=self.copy_json_metadata_to_clipboard, cursor="hand2")
        export_json_btn.pack(fill="x", pady=2, ipady=4)

    def switch_client_tool(self, tool_tag):
        if tool_tag == "brush":
            self.active_tool = "brush"
            self.brush_tool_btn.configure(bg="#2563eb", fg="white")
            self.select_tool_btn.configure(bg="#27272a", fg="#a1a1aa")
            self.tool_hint_lbl.configure(text="Drag on canvas to sketch vector paths. Each stroke creates a distinct layer module automagically.")
            self.canvas.configure(cursor="crosshair")
        else:
            self.active_tool = "select"
            self.brush_tool_btn.configure(bg="#27272a", fg="#a1a1aa")
            self.select_tool_btn.configure(bg="#2563eb", fg="white")
            self.tool_hint_lbl.configure(text="Hover on drawn strokes, click to select. Hold left mouse button down and drag back & forth to displace/move the selected layer.")
            self.canvas.configure(cursor="fleur")
        self.draw_canvas_scene()

    def set_active_color(self, hex_color):
        self.brush_color = hex_color
        sel_layer = self.get_selected_layer()
        if sel_layer:
            sel_layer["color"] = hex_color
        self.update_status_and_replacements()
        self.draw_canvas_scene()

    def open_custom_color_picker(self):
        rgb_color, hex_color = colorchooser.askcolor(color=self.brush_color, title="Select Stroke Color")
        if hex_color:
            self.set_active_color(hex_color)

    def on_brush_thickness_internal_shift(self, val):
        self.brush_thickness = int(float(val))
        self.thick_val_lbl.configure(text=f"Value: {self.brush_thickness}px")
        sel_layer = self.get_selected_layer()
        if sel_layer:
            sel_layer["thickness"] = self.brush_thickness
        self.update_status_and_replacements()
        self.draw_canvas_scene()

    def on_rotation_slider_moved(self, val):
        rot_deg = round(float(val), 1)
        self.rot_label_var.set(f"Rotation: {rot_deg}°")
        sel_layer = self.get_selected_layer()
        if sel_layer:
            sel_layer["rotation"] = rot_deg
            self.draw_canvas_scene()

    def on_scale_slider_moved(self, val):
        scale_fact = round(float(val), 2)
        self.scale_label_var.set(f"Scale Multiplier: {scale_fact}x")
        sel_layer = self.get_selected_layer()
        if sel_layer:
            sel_layer["scale"] = scale_fact
            self.draw_canvas_scene()

    def adjust_canvas_bg(self, mode):
        self.canvas_bg_mode = mode
        self.draw_canvas_scene()

    # ---------------------------------------------
    # Layer List / Hierarchy Mutators
    # ---------------------------------------------
    def get_selected_layer(self):
        if not self.selected_layer_id:
            return None
        for l in self.layers:
            if l["id"] == self.selected_layer_id:
                return l
        return None

    def refresh_layer_listbox(self):
        self.layer_listbox.delete(0, tk.END)
        for idx, layer in enumerate(self.layers):
            vis_tag = "[V]" if layer["visible"] else "[H]"
            desc = f"{idx+1}. {vis_tag} {layer['name']} ({layer['color']}, size {layer['thickness']}p)"
            self.layer_listbox.insert(tk.END, desc)

            # Highlight selected index
            if layer["id"] == self.selected_layer_id:
                self.layer_listbox.selection_clear(0, tk.END)
                self.layer_listbox.selection_set(idx)
                # Sync slider values to reflect selected layer transformation
                self.rot_slider.set(layer["rotation"])
                self.scale_slider.set(layer["scale"])
                self.rename_entry_var.set(layer["name"])

        self.update_status_and_replacements()

    def on_layer_box_selection_shifted(self, event):
        sel_idx = self.layer_listbox.curselection()
        if not sel_idx:
            return
        idx = int(sel_idx[0])
        if 0 <= idx < len(self.layers):
            self.selected_layer_id = self.layers[idx]["id"]
            layer = self.layers[idx]
            # Synchronize controller models
            self.rot_slider.set(layer["rotation"])
            self.scale_slider.set(layer["scale"])
            self.rename_entry_var.set(layer["name"])
            self.brush_color = layer["color"]
            self.brush_thickness = layer["thickness"]
            self.thickness_slider.set(layer["thickness"])
            self.draw_canvas_scene()

    def rename_selected_layer(self):
        sel_layer = self.get_selected_layer()
        if sel_layer:
            new_name = self.rename_entry_var.get().strip()
            if new_name:
                sel_layer["name"] = new_name
                self.refresh_layer_listbox()

    def toggle_selected_layer_visibility(self):
        sel_layer = self.get_selected_layer()
        if sel_layer:
            sel_layer["visible"] = not sel_layer["visible"]
            self.refresh_layer_listbox()
            self.draw_canvas_scene()

    def delete_selected_layer(self):
        if not self.selected_layer_id:
            return
        self.layers = [l for l in self.layers if l["id"] != self.selected_layer_id]
        if self.layers:
            self.selected_layer_id = self.layers[-1]["id"]
        else:
            self.selected_layer_id = None
        self.refresh_layer_listbox()
        self.draw_canvas_scene()

    def duplicate_selected_layer(self):
        source = self.get_selected_layer()
        if not source:
            return
        dup_layer = {
            "id": f"layer_dup_{int(tk.StringVar().get() or os.urandom(4).hex())}",
            "name": f"{source['name']} Copy",
            "points": list(source["points"]),
            "color": source["color"],
            "thickness": source["thickness"],
            "opacity": source["opacity"],
            "visible": source["visible"],
            # Give slightly displaced translate states so user sees duplication
            "translation": [source["translation"][0] + 15.0, source["translation"][1] + 15.0],
            "rotation": source["rotation"],
            "scale": source["scale"]
        }
        source_idx = self.layers.index(source)
        self.layers.insert(source_idx + 1, dup_layer)
        self.selected_layer_id = dup_layer["id"]
        self.refresh_layer_listbox()
        self.draw_canvas_scene()

    def adjust_z_ordering(self, move_up=True):
        sel_layer = self.get_selected_layer()
        if not sel_layer:
            return
        idx = self.layers.index(sel_layer)
        if move_up:
            if idx < len(self.layers) - 1:
                # Swap up
                self.layers[idx], self.layers[idx+1] = self.layers[idx+1], self.layers[idx]
        else:
            if idx > 0:
                # Swap down
                self.layers[idx], self.layers[idx-1] = self.layers[idx-1], self.layers[idx]
        self.refresh_layer_listbox()
        self.draw_canvas_scene()

    def reset_to_demo_artwork(self):
        self.layers = get_initial_demo_layers()
        self.selected_layer_id = "layer_sun"
        self.refresh_layer_listbox()
        self.draw_canvas_scene()

    def clear_all_layers(self):
        if messagebox.askyesno("Confirm", "Are you sure you want to empty all drawn layers?"):
            self.layers = []
            self.selected_layer_id = None
            self.refresh_layer_listbox()
            self.draw_canvas_scene()

    def update_status_and_replacements(self):
        self.brush_status_lbl.configure(text=f"Brush Color: {self.brush_color}\nBrush size: {self.brush_thickness}px\nTotal layers: {len(self.layers)}")

    # ---------------------------------------------
    # INTERACTIVE DRAWING & HOVER HIT TEST CHECKS
    # ---------------------------------------------
    def on_canvas_mouse_down(self, event):
        click_p = (float(event.x), float(event.y))

        if self.active_tool == "brush":
            self.current_stroke = [click_p]
        elif self.active_tool == "select":
            # Direct click hit-test targeting from top layers downwards (Z-index sequence)
            target_layer = None
            for l in reversed(self.layers):
                if hit_test_layer(click_p, l):
                    target_layer = l
                    break

            if target_layer:
                self.selected_layer_id = target_layer["id"]
                self.refresh_layer_listbox()
                self.is_dragging = True
                self.drag_start_coord = click_p
                self.layer_initial_translation = list(target_layer["translation"])
            else:
                self.selected_layer_id = None
                self.refresh_layer_listbox()
            self.draw_canvas_scene()

    def on_canvas_mouse_drag(self, event):
        drag_p = (float(event.x), float(event.y))

        if self.active_tool == "brush":
            self.current_stroke.append(drag_p)
            # Live draw current stroke trail segment immediately to keep it fluid
            if len(self.current_stroke) >= 2:
                p1, p2 = self.current_stroke[-2], self.current_stroke[-1]
                self.canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=self.brush_color, width=self.brush_thickness, capstyle=tk.ROUND, joinstyle=tk.ROUND, tags="temp_trail")
        elif self.active_tool == "select" and self.is_dragging and self.selected_layer_id:
            sel_layer = self.get_selected_layer()
            if sel_layer:
                dx = drag_p[0] - self.drag_start_coord[0]
                dy = drag_p[1] - self.drag_start_coord[1]
                sel_layer["translation"] = [
                    self.layer_initial_translation[0] + dx,
                    self.layer_initial_translation[1] + dy
                ]
                self.draw_canvas_scene()

    def on_canvas_mouse_release(self, event):
        if self.active_tool == "brush":
            if len(self.current_stroke) > 1:
                # Add finished stroke path as a fresh independent layer
                new_l_id = f"layer_{os.urandom(4).hex()}"
                self.layers.append({
                    "id": new_l_id,
                    "name": f"Layer Object {len(self.layers) + 1}",
                    "points": self.current_stroke,
                    "color": self.brush_color,
                    "thickness": self.brush_thickness,
                    "opacity": self.brush_opacity,
                    "visible": True,
                    "translation": [0.0, 0.0],
                    "rotation": 0.0,
                    "scale": 1.0
                })
                self.selected_layer_id = new_l_id
                self.refresh_layer_listbox()
            self.current_stroke = []
            self.draw_canvas_scene()
        elif self.active_tool == "select":
            self.is_dragging = False

    def on_canvas_mouse_hover(self, event):
        # Simply update the hover coordinate info inside the window, if needed
        pass

    # ---------------------------------------------
    # CANVAS SCENE RENDERER
    # ---------------------------------------------
    def draw_canvas_scene(self):
        self.canvas.delete(tk.ALL)

        cw = 800
        ch = 600

        # Render background mode aesthetic
        if self.canvas_bg_mode == "grid":
            # Checkerboard grid block styling
            self.canvas.configure(bg="#111827")
            grid_sz = 20
            # Horizontal & vertical mini indicator bars
            for x in range(0, cw, grid_sz):
                for y in range(0, ch, grid_sz):
                    if (x // grid_sz + y // grid_sz) % 2 == 0:
                        self.canvas.create_rectangle(x, y, x + grid_sz, y + grid_sz, fill="#1f2937", outline="", tags="bg")
        elif self.canvas_bg_mode == "dark":
            self.canvas.configure(bg="#0f172a") # Midnight blue
        else:
            self.canvas.configure(bg="#ffffff") # Plain white

        # Redeposit layers onto stack
        for layer in self.layers:
            if not layer["visible"] or not layer["points"]:
                continue

            # Compute actual screen points incorporating rot/scale/translate matrices
            scr_points = get_transformed_points(layer)
            if len(scr_points) < 2:
                continue

            # Build flat coordinate vector lists [x0, y0, x1, y1...]
            flat_coords = []
            for p in scr_points:
                flat_coords.extend([p[0], p[1]])

            # Draw smooth stroke segment on Tkinter Canvas
            self.canvas.create_line(
                flat_coords,
                fill=layer["color"],
                width=layer["thickness"],
                capstyle=tk.ROUND,
                joinstyle=tk.ROUND
            )

        # Draw selection borders highlights & helper crosshair on selected layer
        if self.selected_layer_id and self.active_tool == "select":
            sel_layer = self.get_selected_layer()
            if sel_layer and sel_layer["visible"] and sel_layer["points"]:
                scr_points = get_transformed_points(sel_layer)
                box = get_bounding_box(scr_points)
                if box:
                    # Draw dotted dash boundary outline
                    self.canvas.create_rectangle(
                        box["minX"] - 5, box["minY"] - 5,
                        box["maxX"] + 5, box["maxY"] + 5,
                        outline="#10b981", width=1.5, dash=(4, 4)
                    )
                    # Node corners highlight
                    ns = 5
                    corners = [
                        (box["minX"] - 5, box["minY"] - 5),
                        (box["maxX"] + 5, box["minY"] - 5),
                        (box["maxX"] + 5, box["maxY"] + 5),
                        (box["minX"] - 5, box["maxY"] + 5)
                    ]
                    for cx, cy in corners:
                        self.canvas.create_rectangle(
                            cx - ns/2, cy - ns/2, cx + ns/2, cy + ns/2,
                            fill="#ffffff", outline="#10b981", width=1.5
                        )
                    # Central anchor crosshair
                    self.canvas.create_oval(
                        box["centerX"] - 3, box["centerY"] - 3,
                        box["centerX"] + 3, box["centerY"] + 3,
                        fill="#10b981", outline="#10b981"
                    )

    # ---------------------------------------------
    # FILE EXPORTS & CLIPBOARD COMPILING
    # ---------------------------------------------
    def export_canvas_composition_to_svg(self):
        svg_header = (
            f'<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
            f'<svg width="800" height="600" viewBox="0 0 800 600" '
            f'xmlns="http://www.w3.org/2000/svg" style="background-color: '
            f'{"#ffffff" if self.canvas_bg_mode == "light" else "#0f172a" if self.canvas_bg_mode == "dark" else "transparent"}"'
            f'>\n'
        )

        svg_content = ""
        for layer in self.layers:
            if not layer["visible"] or not layer["points"]:
                continue

            box = get_bounding_box(layer["points"])
            if not box:
                continue

            cx, cy = box["centerX"], box["centerY"]
            path_d_list = [f"M {layer['points'][0][0]:.1f} {layer['points'][0][1]:.1f}"]
            for p in layer["points"][1:]:
                path_d_list.append(f"L {p[0]:.1f} {p[1]:.1f}")
            path_str = " ".join(path_d_list)

            # Replicate CSS SVG transform matrix attributes
            trans_attr = f"translate({cx + layer['translation'][0]} {cy + layer['translation'][1]}) rotate({layer['rotation']}) scale({layer['scale']}) translate({-cx} {-cy})"
            svg_content += f'  <path id="{layer["id"]}" d="{path_str}" fill="none" stroke="{layer["color"]}" stroke-width="{layer["thickness"]}" stroke-linecap="round" stroke-linejoin="round" opacity="{layer["opacity"]}" transform="{trans_attr}" />\n'

        svg_footer = "</svg>"

        try:
            with open("composition.svg", "w") as f:
                f.write(svg_header + svg_content + svg_footer)
            messagebox.showinfo("Export Success", "Saved vector draft successfully to local file: composition.svg")
        except Exception as err:
            messagebox.showerror("Export Failed", f"An error occurred while saving composition: {err}")

    def copy_json_metadata_to_clipboard(self):
        # Package structure meta state JSON
        meta = {
            "studio": "Local Layered Canvas Studio (Python Viewport)",
            "canvas": {
                "width": 800,
                "height": 600,
                "bg_mode": self.canvas_bg_mode
            },
            "layersCount": len(self.layers),
            "layers": []
        }

        for layer in self.layers:
            raw_box = get_bounding_box(layer["points"])
            scr_points = get_transformed_points(layer)
            transformed_box = get_bounding_box(scr_points)

            meta["layers"].append({
                "id": layer["id"],
                "name": layer["name"],
                "stroke_color": layer["color"],
                "thickness": layer["thickness"],
                "visible": layer["visible"],
                "pointsCount": len(layer["points"]),
                "raw_coordinate_bounds": raw_box,
                "matrices": {
                    "translation": layer["translation"],
                    "rotation_deg": layer["rotation"],
                    "scale": layer["scale"]
                },
                "final_transformed_bounds": transformed_box
            })

        meta_str = json.dumps(meta, indent=2)
        
        # Deploy onto Tkinter clipboard
        self.clipboard_clear()
        self.clipboard_append(meta_str)
        self.update()
        messagebox.showinfo("Copied Clipboard", "Vector parameters and keyframe alignment JSON metadata copied to clipboard successfully!")


# Main thread safety initiator
if __name__ == "__main__":
    app = LayeredCanvasApp()
    app.mainloop()
