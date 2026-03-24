"use client";

import type { InsightCategory } from "@/types/index";

/**
 * Animated gold domain motif shown only on Legendary insight cards.
 * Positioned absolute at bottom of card.
 */
export function LegendaryMotif({ category }: { category: InsightCategory }) {
  const color = "#CA8A04";
  const opacity = 0.28;

  return (
    <div
      className="absolute bottom-2 left-2.5 right-2.5 pointer-events-none"
      style={{ opacity }}
    >
      {category === "fitness" ? (
        <EcgTrace color={color} />
      ) : category === "sleep" ? (
        <SineWave color={color} />
      ) : category === "recovery" ? (
        <PulseDot color={color} />
      ) : (
        <Constellation color={color} />
      )}
    </div>
  );
}

function EcgTrace({ color }: { color: string }) {
  return (
    <svg width="100%" height="10" viewBox="0 0 200 10" preserveAspectRatio="none">
      <polyline
        points="0,5 30,5 40,5 45,1 50,9 55,3 60,5 90,5 130,5 140,5 145,1 150,9 155,3 160,5 200,5"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeDasharray="200"
        strokeDashoffset="200"
      >
        <animate attributeName="stroke-dashoffset" from="200" to="0" dur="3s" repeatCount="indefinite" />
      </polyline>
    </svg>
  );
}

function SineWave({ color }: { color: string }) {
  return (
    <svg width="100%" height="10" viewBox="0 0 200 10" preserveAspectRatio="none">
      <path
        d="M0,5 C20,0 40,10 60,5 C80,0 100,10 120,5 C140,0 160,10 180,5 C190,2.5 200,5 200,5"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeDasharray="220"
        strokeDashoffset="220"
      >
        <animate attributeName="stroke-dashoffset" from="220" to="0" dur="4s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <svg width="100%" height="10" viewBox="0 0 200 10" preserveAspectRatio="xMidYMid meet">
      <circle cx="100" cy="5" r="2" fill={color}>
        <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Constellation({ color }: { color: string }) {
  return (
    <svg width="100%" height="10" viewBox="0 0 200 10" preserveAspectRatio="none">
      {/* Dots */}
      <circle cx="30" cy="3" r="1" fill={color}><animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" /></circle>
      <circle cx="70" cy="7" r="1.2" fill={color}><animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite" /></circle>
      <circle cx="110" cy="2" r="1" fill={color}><animate attributeName="opacity" values="0.5;1;0.5" dur="3.5s" repeatCount="indefinite" /></circle>
      <circle cx="150" cy="8" r="1.3" fill={color}><animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" /></circle>
      <circle cx="180" cy="4" r="1" fill={color}><animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" /></circle>
      {/* Lines */}
      <line x1="30" y1="3" x2="70" y2="7" stroke={color} strokeWidth="0.5" opacity="0.4" />
      <line x1="70" y1="7" x2="110" y2="2" stroke={color} strokeWidth="0.5" opacity="0.4" />
      <line x1="110" y1="2" x2="150" y2="8" stroke={color} strokeWidth="0.5" opacity="0.4" />
      <line x1="150" y1="8" x2="180" y2="4" stroke={color} strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}
