/**
 * Import all detector files to trigger registration via registerDetector().
 * Adding a new domain requires creating the detector file and adding the import here.
 */

// Single-domain detectors
import "./sleep";
import "./fitness";
import "./chess";
import "./wellbeing";

// Cross-domain detectors
import "./sleep-fitness";
import "./sleep-mood";
import "./sleep-chess";
import "./fitness-mood";
import "./fitness-chess";
import "./chess-mood";

// Manual domain detectors (single)
import "./caffeine";
import "./substances";
import "./screen-time";
import "./hydration";

// Manual domain cross-domain detectors
import "./caffeine-sleep";
import "./substances-sleep";
import "./screen-time-sleep";
import "./screen-time-wellbeing";
import "./hydration-fitness";
import "./hydration-wellbeing";
import "./supplements-sleep";
