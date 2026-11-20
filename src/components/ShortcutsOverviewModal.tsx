import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsOverviewModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS: Array<{
  heading: string;
  items: Array<{ keys: string[]; description: string }>;
}> = [
  {
    heading: 'Editing & History',
    items: [
      { keys: ['Ctrl / Cmd', 'Z'], description: 'Undo last bed action' },
      { keys: ['Ctrl / Cmd', 'Shift', 'Z'], description: 'Redo undone action' },
      { keys: ['Ctrl / Cmd', 'D'], description: 'Duplicate selected element(s)' },
      { keys: ['Del / Backspace'], description: 'Delete selected element(s)' },
    ],
  },
  {
    heading: 'Selection & Precision Placement',
    items: [
      { keys: ['Ctrl / Cmd', 'A'], description: 'Select all visible objects on bed' },
      { keys: ['Shift', 'Click'], description: 'Add or remove element from selection' },
      { keys: ['Drag Empty Bed'], description: 'Marquee box selection (Shift to add)' },
      { keys: ['Arrow Keys'], description: 'Nudge selection by 1 mm' },
      { keys: ['Shift', 'Arrow Keys'], description: 'Nudge selection by 5 mm' },
    ],
  },
  {
    heading: 'Snapping & Scaling',
    items: [
      { keys: ['Shift', 'Drag'], description: 'Bypass 1 mm grid & smart alignment guides' },
      { keys: ['Shift', 'Resize'], description: 'Lock element aspect ratio' },
      { keys: ['?'], description: 'Toggle this shortcuts overview' },
      { keys: ['Esc'], description: 'Close active overlay' },
    ],
  },
];

export const ShortcutsOverviewModal: React.FC<ShortcutsOverviewModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-[#232A3B] bg-[#131722] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#232A3B] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-4 w-4 text-[#38BDF8]" />
            <div>
              <h2 className="text-sm font-semibold text-[#F1F5F9]">
                Keyboard Shortcuts Overview
              </h2>
              <p className="mt-0.5 text-xs text-[#94A3B8]">
                Quick controls for the 400 × 400 mm AtomStack X20 Pro canvas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts overview"
            className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1E2534] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-2">
              <h3 className="text-xs font-semibold text-[#CBD5E1]">
                {group.heading}
              </h3>
              <div className="divide-y divide-[#232A3B] rounded-md border border-[#232A3B] bg-[#0D1018]">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-xs"
                  >
                    <span className="text-[#CBD5E1]">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={`${k}-${idx}`}>
                          {idx > 0 && (
                            <span className="text-[10px] text-[#64748B]">+</span>
                          )}
                          <kbd className="rounded border border-[#334155] bg-[#161C2A] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#F1F5F9]">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
