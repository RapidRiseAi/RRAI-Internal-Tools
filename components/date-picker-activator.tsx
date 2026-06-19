"use client";

import { useEffect } from "react";

export function DatePickerActivator() {
  useEffect(() => {
    const openPicker = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "date" && target.type !== "datetime-local") return;
      target.showPicker?.();
    };
    document.addEventListener("focusin", openPicker);
    document.addEventListener("click", openPicker);
    return () => {
      document.removeEventListener("focusin", openPicker);
      document.removeEventListener("click", openPicker);
    };
  }, []);
  return null;
}
