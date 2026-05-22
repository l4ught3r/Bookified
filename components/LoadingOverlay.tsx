"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

const LoadingOverlay = () => {
  const t = useTranslations("Loading");

  return (
    <div className="loading-wrapper">
      <div className="loading-shadow-wrapper bg-white shadow-soft-lg">
        <div className="loading-shadow">
          <Loader2 className="loading-animation w-12 h-12 text-[#663820]" />
          <h2 className="loading-title">{t("title")}</h2>
          <p className="text-[#777] text-center max-w-xs">{t("description")}</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
