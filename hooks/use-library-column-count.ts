"use client";

import { useEffect, useState } from "react";

function columnCountForWidth(width: number): number {
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

export function useLibraryColumnCount() {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const update = () => setColumnCount(columnCountForWidth(window.innerWidth));

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columnCount;
}
