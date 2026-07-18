/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { MenuItem } from "../data/menuData";
import { Maximize2 } from "lucide-react";

interface MenuItemCardProps {
  key?: string | number;
  item: MenuItem;
  onZoom: (item: MenuItem) => void;
  version?: string;
}

export default function MenuItemCard({ item, onZoom, version }: MenuItemCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Reset or instantly resolve image loaded state when URL/image changes
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setImageLoaded(true);
    } else {
      setImageLoaded(false);
    }
  }, [item.image]);

  const getVersionedImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${version || "1"}`;
  };

  const formatPrice = (val?: any) => {
    if (val === undefined || val === null) return "Sob Consulta";
    if (val === "A Consultar" || isNaN(Number(val))) return "Sob Consulta";
    return Number(val).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <motion.div
      id={`menu-item-${item.id}`}
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={item.isOutOfStock ? {} : { y: -4 }}
      className={`group relative flex flex-col bg-white rounded-xl overflow-hidden border border-stone-200/60 shadow-[0_4px_16px_rgba(3,18,36,0.03)] hover:shadow-[0_12px_24px_rgba(197,168,128,0.12)] transition-all duration-300 ${
        item.isOutOfStock ? "opacity-60 grayscale-[20%]" : ""
      }`}
    >
      {/* Tap / Click Image Container */}
      <div 
        onClick={() => onZoom(item)}
        className="relative w-full aspect-[4/3] overflow-hidden bg-stone-100 cursor-zoom-in"
      >
        {/* Shimmer/Skeleton Placeholder */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 animate-pulse" />
        )}

        {/* Compressed optimized Image */}
        <img
          ref={imgRef}
          src={getVersionedImageUrl(item.image || "")}
          alt={item.name}
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 contrast-[1.02] saturate-[1.03] ${
            imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{ imageRendering: "auto", transitionProperty: "opacity, transform" }}
        />

        {/* Top Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Zoom Indicator Icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="px-3 py-1.5 rounded-full bg-brand-navy/80 backdrop-blur-sm border border-brand-gold/40 text-brand-gold text-xs font-medium tracking-wide flex items-center gap-1.5 shadow-lg">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Toque para Ampliar</span>
          </div>
        </div>

        {/* Delicate Highlight Ribbon if appropriate */}
        {item.isHighlight && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-brand-navy text-brand-gold border border-brand-gold/30 rounded text-[10px] font-bold tracking-widest uppercase shadow-sm">
            Destaque
          </div>
        )}

        {/* Esgotado Badge */}
        {item.isOutOfStock && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-red-600 text-white rounded text-[10px] font-bold tracking-widest uppercase shadow-sm z-10">
            Esgotado
          </div>
        )}
      </div>

      {/* Card Content Section */}
      <div className="flex-1 flex flex-col p-5">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h4 className="font-serif text-lg font-bold text-brand-navy group-hover:text-brand-navy-light transition-colors duration-200 leading-snug">
            {item.name}
          </h4>
          <span className="font-sans text-base font-bold text-brand-gold whitespace-nowrap shrink-0 mt-0.5">
            {formatPrice(item.price)}
          </span>
        </div>

        <p className="font-sans text-stone-500 text-xs md:text-sm font-light leading-relaxed mb-4 flex-1">
          {item.description}
        </p>

        {/* Card Footer: touchable action indicator */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-sans uppercase tracking-widest">
          <span>Servido Individual</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onZoom(item);
            }}
            className="text-brand-gold hover:text-brand-gold-dark transition-colors duration-200 font-medium flex items-center gap-1 cursor-zoom-in"
          >
            Ver Detalhes
          </button>
        </div>
      </div>
    </motion.div>
  );
}
