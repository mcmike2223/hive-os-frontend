"use client";

import React, { useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Mention from '@tiptap/extension-mention';
import suggestion from './mention-suggestion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SignaturePad } from '@/components/ui/signature-pad';
import EmojiPicker from 'emoji-picker-react';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Code,
  Image as ImageIcon,
  Eraser,
  Baseline,
  Smile,
  Maximize2,
  Minimize2,
  X,
  FileText,
  Download
} from 'lucide-react';

<<<<<<< HEAD
export interface RichTextEditorRef {
  insertMedia: (
    url: string,
    type: 'image' | 'video' | 'audio' | 'raw',
    altText?: string,
  ) => void;
}
=======
export interface RichTextEditorRef {
  insertMedia: (url: string, type: 'image' | 'video' | 'audio' | 'raw' | 'document') => void;
}
>>>>>>> fix/inventory-warehouse-issues

const ImageNodeView = (props: any) => {
  const { node, updateAttributes, deleteNode, selected } = props;
  
  return (
    <NodeViewWrapper 
      className={cn(
        "relative inline-block group my-4", 
        node.attrs.align === 'center' ? 'block mx-auto' : node.attrs.align === 'right' ? 'float-right ml-4' : 'float-left mr-4'
      )}
      style={{ width: node.attrs.width ? `${node.attrs.width}px` : 'auto', maxWidth: '100%' }}
    >
      <div className={cn("relative overflow-visible inline-block max-w-full", selected && "ring-2 ring-primary ring-offset-2 rounded-md")}>
        <img 
          src={node.attrs.src} 
          alt={node.attrs.alt || 'Image'} 
          className="rounded-md w-full h-auto max-w-full border shadow-sm"
        />
        
        {/* Controls Overlay */}
        <div className={cn(
          "absolute -top-3 -right-3 flex gap-1 opacity-0 transition-opacity", 
          selected && "opacity-100", 
          "group-hover:opacity-100 z-10"
        )}>
          {/* Alignment controls */}
          <div className="bg-background border shadow-sm rounded-md flex overflow-hidden">
            <button 
              className={cn("p-1 hover:bg-muted text-muted-foreground", node.attrs.align === 'left' && "bg-muted text-foreground")} 
              onClick={(e) => { e.preventDefault(); updateAttributes({ align: 'left' }); }}
              title="Align Left"
              type="button"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button 
              className={cn("p-1 hover:bg-muted text-muted-foreground", node.attrs.align === 'center' && "bg-muted text-foreground")} 
              onClick={(e) => { e.preventDefault(); updateAttributes({ align: 'center' }); }}
              title="Align Center"
              type="button"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button 
              className={cn("p-1 hover:bg-muted text-muted-foreground", node.attrs.align === 'right' && "bg-muted text-foreground")} 
              onClick={(e) => { e.preventDefault(); updateAttributes({ align: 'right' }); }}
              title="Align Right"
              type="button"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <button 
            onClick={(e) => { e.preventDefault(); deleteNode(); }} 
            className="bg-destructive text-destructive-foreground p-1 rounded-md shadow-sm hover:opacity-90"
            title="Remove"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Resize Handle */}
        <div className={cn(
          "absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full cursor-nwse-resize opacity-0 transition-opacity",
          selected && "opacity-100",
          "group-hover:opacity-100 z-10 shadow-sm border-2 border-background"
        )}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startWidth = (e.currentTarget.parentElement?.querySelector('img') as HTMLImageElement)?.offsetWidth || 200;
          
          const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.clientX;
            const newWidth = Math.max(50, startWidth + (currentX - startX));
            updateAttributes({ width: newWidth });
          };
          
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
        />
      </div>
    </NodeViewWrapper>
  );
};

const DocumentNodeView = (props: any) => {
  const { node, deleteNode, selected } = props;
  const fileName = node.attrs.src?.split('/').pop() || 'Document';
  
  return (
    <NodeViewWrapper className="relative inline-block group my-2">
      <div className="inline-flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors">
        <FileText className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-foreground">{fileName}</span>
        <a 
          href={node.attrs.src} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-1 hover:bg-primary/30 rounded-md transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-4 w-4 text-primary" />
        </a>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-6 w-6 opacity-0 transition-opacity",
            selected && "opacity-100",
            "group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.preventDefault();
            deleteNode();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </NodeViewWrapper>
  );
};

const CustomImage = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
      },
      align: {
        default: 'center',
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

<<<<<<< HEAD
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onOpenMediaPicker?: () => void;
  appearance?: 'app' | 'document';
}
=======
const Document = Node.create({
  name: 'document',
  group: 'inline',
  inline: true,
  atom: true,
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="document"]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'document' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DocumentNodeView);
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onOpenMediaPicker?: () => void;
}
>>>>>>> fix/inventory-warehouse-issues

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    } as any;
  },
});

const FONT_FAMILIES = ["Inter", "Comic Sans MS", "Georgia", "Impact", "Times New Roman", "monospace"];
const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px"];

const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      class: {
        default: 'rounded-md border shadow-sm w-full max-w-[600px] my-4 block',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes)];
  },
});

const AudioExtension = Node.create({
  name: 'audio',
  group: 'block',
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      class: {
        default: 'w-full max-w-[400px] my-4 block',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'audio',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['audio', mergeAttributes(HTMLAttributes)];
  },
});

const MenuBar = ({ editor, onOpenMediaPicker, onOpenSignaturePad, isFullscreen, toggleFullscreen, appearance }: { editor: any, onOpenMediaPicker?: () => void, onOpenSignaturePad: () => void, isFullscreen: boolean, toggleFullscreen: () => void, appearance: 'app' | 'document' }) => {
  if (!editor) {
    return null;
  }

  const isDocumentSurface = appearance === 'document';

  const handleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const buttons = [
    {
      icon: <Undo className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().undo().run(),
      disabled: !editor.can().chain().focus().undo().run(),
      title: 'Undo',
    },
    {
      icon: <Redo className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().redo().run(),
      disabled: !editor.can().chain().focus().redo().run(),
      title: 'Redo',
    },
    { divider: true },
    {
      icon: <Eraser className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
      title: 'Remove Formatting',
    },
    { divider: true },
    {
      icon: <Heading1 className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      title: 'Heading 1',
    },
    {
      icon: <Heading2 className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      title: 'Heading 2',
    },
    {
      icon: <Heading3 className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
      title: 'Heading 3',
    },
    { divider: true },
    {
      icon: <Bold className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      title: 'Bold (Cmd+B)',
    },
    {
      icon: <Italic className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      title: 'Italic (Cmd+I)',
    },
    {
      icon: <UnderlineIcon className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      title: 'Underline (Cmd+U)',
    },
    {
      icon: <Strikethrough className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
      title: 'Strikethrough',
    },
    {
      icon: <Highlighter className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleHighlight().run(),
      isActive: editor.isActive('highlight'),
      title: 'Highlight',
    },
    { divider: true },
    {
      icon: <AlignLeft className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: editor.isActive({ textAlign: 'left' }),
      title: 'Align Left',
    },
    {
      icon: <AlignCenter className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: editor.isActive({ textAlign: 'center' }),
      title: 'Align Center',
    },
    {
      icon: <AlignRight className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: editor.isActive({ textAlign: 'right' }),
      title: 'Align Right',
    },
    { divider: true },
    {
      icon: <List className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      title: 'Bullet List',
    },
    {
      icon: <ListOrdered className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      title: 'Ordered List',
    },
    { divider: true },
    {
      icon: <Quote className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      title: 'Blockquote',
    },
    {
      icon: <Code className="h-[15px] w-[15px]" />,
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
      title: 'Code Block',
    },
    {
      icon: <Link2 className="h-[15px] w-[15px]" />,
      onClick: handleLink,
      isActive: editor.isActive('link'),
      title: 'Insert Link',
    },
    { divider: true },
    {
      icon: <ImageIcon className="h-[15px] w-[15px] text-emerald-500" />,
      onClick: () => {
        if (onOpenMediaPicker) {
          onOpenMediaPicker();
        } else {
          const url = window.prompt('Image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }
      },
      title: 'Insert Media',
    }
  ];

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-1 border-b p-1.5",
        isDocumentSurface
          ? "border-slate-500 bg-slate-100 text-slate-950"
          : "border-border bg-muted/30",
      )}
    >
      {isDocumentSurface ? (
        <span className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
          Font
        </span>
      ) : null}
      <Select
        value={editor.getAttributes('textStyle').fontFamily || "default"}
        onValueChange={(val) => {
          if (val === "default") editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(val).run();
        }}
      >
        <SelectTrigger
          aria-label="Font"
          className={cn(
            "w-[120px] text-xs",
            isDocumentSurface
              ? "!h-11 !border-slate-500 !bg-white !text-slate-950 focus:ring-2 focus:ring-slate-800 dark:!border-slate-500 dark:!bg-white dark:!text-slate-950"
              : "h-7",
          )}
        >
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
           <SelectItem value="default">Default Font</SelectItem>
           {FONT_FAMILIES.map(v => <SelectItem key={v} value={v} style={{fontFamily: v}}>{v.split(',')[0]}</SelectItem>)}
        </SelectContent>
      </Select>

      {isDocumentSurface ? (
        <span className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
          Size
        </span>
      ) : null}
      <Select
        value={editor.getAttributes('textStyle').fontSize || "default"}
        onValueChange={(val) => {
          if (val === "default") (editor.chain().focus() as any).unsetFontSize().run();
          else (editor.chain().focus() as any).setFontSize(val).run();
        }}
      >
        <SelectTrigger
          aria-label="Size"
          className={cn(
            "w-[75px] text-xs",
            isDocumentSurface
              ? "!h-11 !border-slate-500 !bg-white !text-slate-950 focus:ring-2 focus:ring-slate-800 dark:!border-slate-500 dark:!bg-white dark:!text-slate-950"
              : "h-7",
          )}
        >
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
           <SelectItem value="default">Auto</SelectItem>
           {FONT_SIZES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-md p-1 transition-colors",
          isDocumentSurface
            ? "h-11 w-11 border border-slate-500 bg-white text-slate-700 hover:bg-slate-200 hover:text-slate-950 focus-within:ring-2 focus-within:ring-slate-800"
            : "h-7 w-7 hover:bg-muted",
        )}
      >
        <Baseline aria-hidden="true" className="pointer-events-none absolute z-0 h-4 w-4 drop-shadow-[0_0_1px_rgb(15,23,42)]" style={{ color: editor.getAttributes('textStyle').color || "currentColor" }} />
        <input
           type="color"
           onInput={e => editor.chain().focus().setColor(e.currentTarget.value).run()}
           value={editor.getAttributes('textStyle').color || "#000000"}
           aria-label="Text color"
           className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
           title="Text Color"
        />
      </div>

      <div className="w-[1px] h-[18px] bg-border mx-[2px]" />

      {buttons.map((btn, index) => {
        if (btn.divider) {
          return <div key={index} className="w-[1px] h-[18px] bg-border mx-[2px]" />;
        }
        return (
          <Button
            key={index}
            variant="ghost"
            size="icon"
            onMouseDown={(e) => {
              e.preventDefault();
              btn.onClick?.();
            }}
            disabled={btn.disabled}
            className={cn(
              isDocumentSurface
                ? "h-11 w-11 text-slate-700 hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-800"
                : "h-7 w-7 text-muted-foreground hover:text-foreground",
              btn.isActive && (
                isDocumentSurface
                  ? "bg-slate-200 font-bold text-slate-950 shadow-sm"
                  : "bg-muted font-bold text-foreground shadow-sm"
              )
            )}
            title={btn.title}
            aria-label={btn.title}
            aria-pressed={typeof btn.isActive === 'boolean' ? btn.isActive : undefined}
            type="button"
          >
            <span aria-hidden="true">{btn.icon}</span>
          </Button>
        );
      })}

      <div className="w-[1px] h-[18px] bg-border mx-[2px]" />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              isDocumentSurface
                ? "h-11 w-11 text-amber-700 hover:bg-amber-100 hover:text-amber-900 focus-visible:ring-2 focus-visible:ring-slate-800"
                : "h-7 w-7 text-muted-foreground hover:text-foreground",
            )}
            aria-label="Insert Emoji"
            title="Insert Emoji"
            type="button"
          >
            <Smile aria-hidden="true" className="h-[15px] w-[15px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="end" sideOffset={5} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="h-[400px] overflow-hidden rounded-md border shadow-md">
             <EmojiPicker 
               onEmojiClick={(data) => editor.chain().focus().insertContent(data.emoji).run()} 
               width="100%" 
               height="100%"
               lazyLoadEmojis={true}
             />
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          isDocumentSurface
            ? "h-11 w-11 text-slate-700 hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-800"
            : "h-7 w-7 text-muted-foreground hover:text-foreground",
        )}
        aria-label="Add Signature"
        title="Add Signature"
        type="button"
        onClick={onOpenSignaturePad}
      >
        <span aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </span>
      </Button>

      <div className="flex-1" />
      <Button
         variant="ghost"
         size="icon"
         className={cn(
           isDocumentSurface
             ? "h-11 w-11 text-slate-700 hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-800"
             : "h-7 w-7 text-muted-foreground hover:text-foreground",
         )}
         onClick={toggleFullscreen}
         aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
         title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
         type="button"
      >
         <span aria-hidden="true">
           {isFullscreen ? <Minimize2 className="h-[15px] w-[15px]" /> : <Maximize2 className="h-[15px] w-[15px]" />}
         </span>
      </Button>
    </div>
  );
};

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder = "Write something...", className, onOpenMediaPicker, appearance = 'app' }, ref) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSignatureOpen, setIsSignatureOpen] = useState(false);
    const isDocumentSurface = appearance === 'document';
    
    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
            HTMLAttributes: {
              class: isDocumentSurface
                ? 'font-bold mt-6 mb-2 !leading-tight text-slate-950'
                : 'font-bold mt-6 mb-2 !leading-tight text-foreground',
            },
          },
          bulletList: {
            HTMLAttributes: {
              class: 'list-disc list-outside ml-6 space-y-1 mb-4',
            },
          },
          orderedList: {
            HTMLAttributes: {
              class: 'list-decimal list-outside ml-6 space-y-1 mb-4',
            },
          },
          blockquote: {
            HTMLAttributes: {
              class: isDocumentSurface
                ? 'border-l-4 border-cyan-800 bg-slate-100 text-slate-800 italic pl-4 py-2 my-4 rounded-r-md'
                : 'border-l-4 border-primary/50 bg-muted/40 text-muted-foreground italic pl-4 py-2 my-4 rounded-r-md',
            },
          },
          codeBlock: {
            HTMLAttributes: {
              class: isDocumentSurface
                ? 'rounded-md border border-slate-500 bg-slate-100 p-4 my-4 font-mono text-sm text-slate-950 shadow-inner'
                : 'bg-muted/60 rounded-md p-4 my-4 font-mono text-sm border shadow-inner',
            },
          },
        }),
        TextStyle as any,
        Color as any,
        FontFamily as any,
        FontSize as any,
        Underline,
        Highlight,
        CustomImage.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
             class: 'rounded-md max-w-full my-4 border shadow-sm',
          }
        }),
        VideoExtension,
        AudioExtension,
        Document,
        Link.configure({
          openOnClick: false,
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Mention.configure({
          HTMLAttributes: {
            class: 'mention inline-block px-1.5 py-0.5 rounded-md bg-[#8b5cf6]/20 text-[#8b5cf6] font-semibold tracking-tight shadow-sm border border-[#8b5cf6]/30',
          },
          suggestion,
        }),
      ],
      content: value,
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-sm max-w-none p-4 focus:outline-none",
            isDocumentSurface
              ? "min-h-[160px] prose-slate text-slate-950 caret-slate-950"
              : "min-h-[220px] dark:prose-invert",
            "prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
            isDocumentSurface
              ? "prose-p:leading-relaxed prose-a:text-cyan-800 prose-a:underline"
              : "prose-p:leading-relaxed prose-a:text-primary prose-a:underline",
            className
          ),
        },
      },
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
    });

    useImperativeHandle(ref, () => ({
<<<<<<< HEAD
      insertMedia: (
        url: string,
        type: 'image' | 'video' | 'audio' | 'raw',
        altText?: string,
      ) => {
        if (!editor) return;
        
        if (type === 'image') {
          editor.chain().focus().setImage({ src: url, alt: altText || 'Letter media' }).run();
=======
      insertMedia: (url: string, type: 'image' | 'video' | 'audio' | 'raw' | 'document') => {
        if (!editor) return;
        
        if (type === 'image') {
          editor.chain().focus().insertContent([
            {
              type: 'image',
              attrs: { src: url }
            },
            {
              type: 'paragraph'
            }
          ]).run();
>>>>>>> fix/inventory-warehouse-issues
        } else if (type === 'video') {
          editor.chain().focus().insertContent([
            {
              type: 'video',
              attrs: { src: url }
            },
            {
              type: 'paragraph'
            }
          ]).run();
        } else if (type === 'audio') {
          editor.chain().focus().insertContent([
            {
              type: 'audio',
              attrs: { src: url }
            },
            {
              type: 'paragraph'
            }
          ]).run();
        } else if (type === 'document') {
          editor.chain().focus().insertContent([
            {
              type: 'document',
              attrs: { src: url }
            },
            {
              type: 'paragraph'
            }
          ]).run();
        }
      }
    }));

    useEffect(() => {
      if (editor && value !== editor.getHTML()) {
         if (value === '') {
             editor.commands.setContent('');
         } else {
<<<<<<< HEAD
             editor.commands.setContent(value, { emitUpdate: false });
=======
             editor.commands.setContent(value);
>>>>>>> fix/inventory-warehouse-issues
         }
      }
    }, [value, editor]);

    return (
      <div className={cn(
        "flex max-w-[100vw] flex-col overflow-hidden rounded-md border transition-shadow shadow-sm",
        isDocumentSurface
          ? "border-slate-500 bg-white text-slate-950"
          : "border-input bg-background",
        isFullscreen
          ? "fixed inset-0 z-[100] rounded-none border-none shadow-xl"
          : isDocumentSurface
            ? "focus-within:ring-2 focus-within:ring-slate-800"
            : "focus-within:ring-1 focus-within:ring-ring"
      )}>
        <SignaturePad
          open={isSignatureOpen}
          onOpenChange={setIsSignatureOpen}
          onSave={(dataUrl) => {
            if (editor) editor.chain().focus().setImage({ src: dataUrl }).run();
          }}
        />
        <MenuBar
           editor={editor}
           onOpenMediaPicker={onOpenMediaPicker}
           onOpenSignaturePad={() => setIsSignatureOpen(true)}
           isFullscreen={isFullscreen}
           toggleFullscreen={() => setIsFullscreen(!isFullscreen)}
           appearance={appearance}
        />
        <div
           className={cn(
             "cursor-text text-sm",
             isFullscreen
               ? isDocumentSurface
                 ? "h-full flex-1 overflow-y-auto bg-slate-200 p-8"
                 : "h-full flex-1 overflow-y-auto bg-muted/10 p-8"
               : isDocumentSurface
                 ? "h-[300px] flex-none overflow-y-scroll [scrollbar-color:#64748b_#e2e8f0] [scrollbar-gutter:stable] [scrollbar-width:thin]"
                 : "max-h-[50dvh] flex-1 overflow-y-auto",
           )}
           onClick={() => editor?.commands.focus()}
        >
          <div
            className={cn(
              isFullscreen && "mx-auto min-h-[800px] max-w-[1000px] rounded-md border p-4 shadow-sm",
              isFullscreen && (
                isDocumentSurface
                  ? "border-slate-500 bg-white text-slate-950"
                  : "bg-background"
              ),
            )}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    );
  }
);
RichTextEditor.displayName = 'RichTextEditor';
