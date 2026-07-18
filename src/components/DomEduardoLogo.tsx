/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
// @ts-ignore
import logoImg from "../assets/images/dom_eduardo_logo_1783978775413.jpg";

interface LogoProps {
  className?: string;
  light?: boolean;
}

export default function DomEduardoLogo({ className = "w-40 h-40", light = false }: LogoProps) {
  return (
    <div className={`flex items-center justify-center select-none overflow-hidden rounded-full ${className}`} id="restaurant-logo">
      <img
        src={logoImg}
        alt="Dom Eduardo Restobar"
        className="w-full h-full object-cover rounded-full"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

