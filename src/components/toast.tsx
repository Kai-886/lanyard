"use client";

import { Toaster, toast } from "sonner";
import { ToastCtx } from "@/components/ui";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const notify = (message: string, opts?: { undo?: () => void }) => {
    if (opts?.undo) {
      toast(message, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            opts.undo?.();
          },
        },
      });
    } else {
      toast(message, { duration: 3200 });
    }
  };

  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <Toaster
        position="bottom-center"
        offset={16}
        richColors={false}
        closeButton={false}
        toastOptions={{
          classNames: {
            toast:
              "lanyard-toast hairline rounded-[3px] bg-paper text-ink text-sm px-4 py-3",
            actionButton: "bg-signal text-on-signal rounded-[3px] px-2.5 py-1 text-xs font-semibold",
            cancelButton: "bg-paper-2 text-ink-2 rounded-[3px] px-2.5 py-1 text-xs",
            description: "text-ink-2",
            title: "text-ink",
          },
        }}
      />
    </ToastCtx.Provider>
  );
}
