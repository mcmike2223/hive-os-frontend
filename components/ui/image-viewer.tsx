"use client";

import {
  ImageEditorWorkspace,
  type ImageEditorWorkspaceProps,
} from "@/components/ui/image-editor-workspace";

export type ImageViewerProps = ImageEditorWorkspaceProps;

/**
 * Backwards-compatible entry point for the shared image preview/editor.
 * File Manager, profile, settings, chat, and mail pickers can keep importing
 * ImageViewer while the implementation remains reusable in one workspace.
 */
export function ImageViewer(props: ImageViewerProps) {
  return <ImageEditorWorkspace {...props} />;
}
