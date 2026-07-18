/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface ZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: string;
  name: string;
  description?: string;
  price?: number | "A Consultar";
  isOutOfStock?: boolean;
  version?: string;
}

export default function ZoomModal({
  isOpen,
  onClose,
  image,
  name,
  description,
  price,
  isOutOfStock,
  version,
}: ZoomModalProps) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const getVersionedImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${version || "1"}`;
  };

  const formatPrice = (val?: any) => {
    if (val === undefined || val === null) return "";
    if (val === "A Consultar" || isNaN(Number(val))) return "Sob Consulta";
    return Number(val).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="zoom-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-brand-navy/95 cursor-zoom-out"
        >
          {/* Modal Container */}
          <motion.div
            id="zoom-modal-container"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()} // Prevent close on modal content click
            className="relative w-full max-w-3xl bg-brand-navy-light border border-brand-gold/20 rounded-2xl overflow-hidden shadow-2xl cursor-default"
          >
            {/* Close button */}
            <button
              id="zoom-modal-close"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-brand-navy/60 text-white hover:text-brand-gold hover:bg-brand-navy/90 transition-all duration-200 border border-white/10"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Food Image */}
            <div className="relative w-full aspect-[4/3] md:aspect-[16/10] overflow-hidden bg-brand-navy">
              <img
                src={getVersionedImageUrl(image || "")}
                alt={name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none contrast-[1.02] saturate-[1.03]"
                style={{ imageRendering: "auto" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy to-transparent opacity-60" />
            </div>

            {/* Dish Details */}
            <div className="p-6 md:p-8 bg-brand-navy-light text-white">
              {isOutOfStock && (
                <div className="mb-4 px-3 py-2 bg-red-600/25 border border-red-500/40 rounded-lg text-red-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Esgotado Temporariamente
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <h3 className="font-serif text-2xl md:text-3xl font-semibold text-white tracking-tight">
                  {name}
                </h3>
                {price !== undefined && (
                  <span className="font-sans text-xl md:text-2xl font-bold text-brand-gold whitespace-nowrap">
                    {formatPrice(price)}
                  </span>
                )}
              </div>

              {description && (
                <p className="font-sans text-stone-300 text-sm md:text-base leading-relaxed font-light">
                  {description}
                </p>
              )}

              {/* Sophisticated Footer Sign in Modal */}
              <div className="mt-6 pt-4 border-t border-brand-gold/10 flex items-center justify-between text-xs text-stone-400">
                <span>Dom Eduardo Restobar</span>
                <span className="text-brand-gold/80 italic font-serif">Tradição & Sofisticação</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
