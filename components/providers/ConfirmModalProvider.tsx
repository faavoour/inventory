"use client";

import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import ConfirmActionModal from "@/components/modals/ConfirmActionModal";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "", description: "" });
  const [resolvePromise, setResolvePromise] = useState<(value: boolean) => void>(() => {});

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolvePromise(true);
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolvePromise(false);
  }, [resolvePromise]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmActionModal
        isOpen={isOpen}
        title={options.title}
        description={options.description}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        isDanger={options.isDanger}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirmAction() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirmAction must be used within a ConfirmModalProvider");
  }
  return context;
}
