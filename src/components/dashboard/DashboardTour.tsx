"use client";

import { useState, useEffect } from "react";
import { Joyride, STATUS, type EventData } from "react-joyride";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  {
    target: "#tour-daily-action",
    title: "Today's Focus",
    content: "Your personalized daily coaching based on all your data",
    disableBeacon: true,
  },
  {
    target: "#tour-stat-cards",
    title: "Your Key Metrics",
    content: "Your key metrics at a glance. Click any card to change what's shown",
    disableBeacon: true,
  },
  {
    target: "#tour-graphs",
    title: "Visual Trends",
    content: "Visual trends over time. Click to customize the metric, chart type, and date range",
    disableBeacon: true,
  },
  {
    target: "#tour-goals",
    title: "Goals",
    content: "Set and track personal goals tied to any metric",
    disableBeacon: true,
  },
  {
    target: "#tour-fab",
    title: "Daily Input",
    content: "Tap here daily to log your mood, caffeine, sleep habits, and more",
    disableBeacon: true,
  },
];

interface DashboardTourProps {
  hasSeenTour: boolean;
}

export function DashboardTour({ hasSeenTour }: DashboardTourProps) {
  const [run, setRun] = useState(false);

  // Slight delay so DOM elements are rendered before tour starts
  useEffect(() => {
    if (!hasSeenTour) {
      const id = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(id);
    }
  }, [hasSeenTour]);

  async function handleEvent(data: EventData) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ has_seen_tour: true }).eq("id", user.id);
      }
    }
  }

  if (hasSeenTour) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        buttons: ["back", "primary", "skip"],
        backgroundColor: "#27272a",
        textColor: "#f4f4f5",
        primaryColor: "#3b82f6",
        arrowColor: "#27272a",
        overlayColor: "rgba(0,0,0,0.55)",
        zIndex: 10000,
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
}
