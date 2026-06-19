import subprocess
from pathlib import Path

import bpy

bl_info = {
    "name": "DX Blender Command Center",
    "author": "DX",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "3D Viewport > Sidebar > DX",
    "description": "Run approved DX commands from Blender.",
    "category": "System",
}

DX_COMMANDS = {
    "status": ("dx", "status"),
    "doctor": ("dx", "doctor"),
}


def run_dx_command(command_id):
    command = DX_COMMANDS[command_id]
    return subprocess.run(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=False,
        check=False,
        timeout=90,
    )


class DX_OT_show_status(bpy.types.Operator):
    bl_idname = "dx.show_status"
    bl_label = "Show DX Status"
    bl_description = "Run dx status with shell-free argv"

    def execute(self, context):
        result = run_dx_command("status")
        if result.returncode == 0:
            self.report({"INFO"}, "DX status completed.")
            return {"FINISHED"}

        self.report({"ERROR"}, "DX status failed.")
        return {"CANCELLED"}


class DX_OT_run_doctor(bpy.types.Operator):
    bl_idname = "dx.run_doctor"
    bl_label = "Run DX Doctor"
    bl_description = "Run dx doctor with shell-free argv"

    def execute(self, context):
        result = run_dx_command("doctor")
        if result.returncode == 0:
            self.report({"INFO"}, "DX doctor completed.")
            return {"FINISHED"}

        self.report({"ERROR"}, "DX doctor failed.")
        return {"CANCELLED"}


class DX_OT_open_receipts(bpy.types.Operator):
    bl_idname = "dx.open_receipts"
    bl_label = "Open DX Receipts"
    bl_description = "Open the local DX receipts folder"

    def execute(self, context):
        receipts_path = Path.home() / ".dx" / "receipts"
        bpy.ops.wm.path_open(filepath=str(receipts_path))
        return {"FINISHED"}


class DX_PT_command_center(bpy.types.Panel):
    bl_idname = "DX_PT_command_center"
    bl_label = "DX"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "DX"

    def draw(self, context):
        layout = self.layout
        layout.operator(DX_OT_show_status.bl_idname)
        layout.operator(DX_OT_run_doctor.bl_idname)
        layout.operator(DX_OT_open_receipts.bl_idname)


CLASSES = (
    DX_OT_show_status,
    DX_OT_run_doctor,
    DX_OT_open_receipts,
    DX_PT_command_center,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
