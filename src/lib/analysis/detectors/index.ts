/**
 * Import all detector files to trigger registration via registerDetector().
 * Adding a new domain requires creating the detector file and adding the import here.
 */

// Single-domain detectors
import "./sleep";
import "./fitness";
import "./chess";
import "./mood";

// Cross-domain detectors
import "./sleep-fitness";
import "./sleep-mood";
import "./sleep-chess";
import "./fitness-mood";
import "./fitness-chess";
import "./chess-mood";
