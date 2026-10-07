import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Compass,
  Mic,
  ListOrdered,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  ArrowUpRight,
  Layers,
  Share2,
  Check,
  Copy,
} from 'lucide-react';
import {
  SLIDES_DATA,
  PRESENTATION_PLAN,
  CENTRAL_TIMELINE_MILESTONES,
  SlideNode,
  SubNodeData,
} from './data/presentationData';

const CANVAS_WIDTH = 5400;
const CANVAS_HEIGHT = 3650;

// Helper to build a smooth cubic bezier SVG path through all slide coordinates
function buildSmoothSplinePath(nodes: SlideNode[]): string {
  if (nodes.length === 0) return '';
  let d = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let i = 0; i < nodes.length - 1; i++) {
    const curr = nodes[i];
    const next = nodes[i + 1];
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const cx1 = curr.x + dx * 0.45;
    const cy1 = curr.y + dy * 0.1;
    const cx2 = curr.x + dx * 0.55;
    const cy2 = next.y - dy * 0.1;
    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${next.x} ${next.y}`;
  }
  return d;
}

export default function App() {
  // null = Full Prezi Spatial Map Overview
  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);
  // Active sub-node index on Slide 10 (true spatial nested zoom!)
  const [activeSubNodeIndex, setActiveSubNodeIndex] = useState<number | null>(null);
  // Swoop mid-flight state for dramatic Prezi zoom-out-then-in effect on distant jumps
  const [isSwooping, setIsSwooping] = useState<boolean>(false);

  const [showSpeakerNotes, setShowSpeakerNotes] = useState<boolean>(true);
  const [showPlanDrawer, setShowPlanDrawer] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1440, height: 820 });

  // Manual pan and wheel zoom in overview
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [overviewZoomBoost, setOverviewZoomBoost] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const swoopTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (stageRef.current) {
        setViewport({
          width: stageRef.current.clientWidth,
          height: stageRef.current.clientHeight,
        });
      } else {
        setViewport({
          width: window.innerWidth,
          height: window.innerHeight - 115,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Read initial slide from URL hash (e.g. #slide-5) so shared links open directly on that slide
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#slide-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= SLIDES_DATA.length) {
        setActiveSlideIndex(num - 1);
      }
    }
  }, []);

  // Keep URL hash in sync with active slide for instant sharing
  useEffect(() => {
    if (activeSlideIndex === null) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#slide-${activeSlideIndex + 1}`
      );
    }
  }, [activeSlideIndex]);

  const clearSwoopTimer = () => {
    if (swoopTimeoutRef.current) {
      window.clearTimeout(swoopTimeoutRef.current);
      swoopTimeoutRef.current = null;
    }
  };

  const goToOverview = useCallback(() => {
    clearSwoopTimer();
    setIsSwooping(false);
    setActiveSubNodeIndex(null);
    setActiveSlideIndex(null);
    setPanOffset({ x: 0, y: 0 });
    setOverviewZoomBoost(1);
    setIsAutoPlaying(false);
  }, []);

  // Prezi-style camera flight with arc swoop when jumping across slides
  const goToSlide = useCallback(
    (targetIndex: number) => {
      clearSwoopTimer();
      setActiveSubNodeIndex(null);
      setPanOffset({ x: 0, y: 0 });

      if (activeSlideIndex !== null && activeSlideIndex !== targetIndex) {
        const distance = Math.abs(targetIndex - activeSlideIndex);
        if (distance > 1) {
          // Multi-slide jump: brief mid-air zoom pull-back before diving into target
          setIsSwooping(true);
          setActiveSlideIndex(targetIndex);
          swoopTimeoutRef.current = window.setTimeout(() => {
            setIsSwooping(false);
          }, 320);
          return;
        }
      }

      setIsSwooping(false);
      setActiveSlideIndex(targetIndex);
    },
    [activeSlideIndex]
  );

  // Zoom directly into a circular satellite sub-node around Slide 10
  const goToSubNode = useCallback((subIdx: number) => {
    clearSwoopTimer();
    setIsSwooping(false);
    setActiveSlideIndex(9); // Slide 10 is index 9
    setActiveSubNodeIndex(subIdx);
  }, []);

  const handleNext = useCallback(() => {
    if (activeSlideIndex === null) {
      goToSlide(0);
      return;
    }
    // If on Slide 10 (index 9), step through its 6 Prezi sub-nodes before moving to Slide 11!
    const currentSlide = SLIDES_DATA[activeSlideIndex];
    if (currentSlide.subNodes && currentSlide.subNodes.length > 0) {
      if (activeSubNodeIndex === null) {
        setActiveSubNodeIndex(0);
        return;
      } else if (activeSubNodeIndex < currentSlide.subNodes.length - 1) {
        setActiveSubNodeIndex(activeSubNodeIndex + 1);
        return;
      } else {
        setActiveSubNodeIndex(null);
      }
    }

    if (activeSlideIndex < SLIDES_DATA.length - 1) {
      goToSlide(activeSlideIndex + 1);
    } else {
      goToOverview();
    }
  }, [activeSlideIndex, activeSubNodeIndex, goToSlide, goToOverview]);

  const handlePrev = useCallback(() => {
    if (activeSubNodeIndex !== null) {
      if (activeSubNodeIndex > 0) {
        setActiveSubNodeIndex(activeSubNodeIndex - 1);
      } else {
        setActiveSubNodeIndex(null);
      }
      return;
    }
    if (activeSlideIndex === null) {
      goToSlide(SLIDES_DATA.length - 1);
    } else if (activeSlideIndex > 0) {
      goToSlide(activeSlideIndex - 1);
    } else {
      goToOverview();
    }
  }, [activeSlideIndex, activeSubNodeIndex, goToSlide, goToOverview]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (activeSubNodeIndex !== null) {
          setActiveSubNodeIndex(null);
        } else if (showPlanDrawer) {
          setShowPlanDrawer(false);
        } else {
          goToOverview();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, activeSubNodeIndex, showPlanDrawer, goToOverview]);

  // Auto-play presentation mode
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6200);
    return () => clearInterval(timer);
  }, [isAutoPlaying, handleNext]);

  // Calculate satellite coordinates for Slide 10's 6 Prezi sub-nodes
  const getSatelliteCoords = (slide: SlideNode, subIdx: number, _total: number) => {
    // Arrange satellites in a clean lower fan below Slide 10 (angles in degrees, where +90 is straight down)
    const angles = [150, 126, 102, 78, 54, 30];
    const angleDeg = angles[subIdx % angles.length];
    const rad = (angleDeg * Math.PI) / 180;
    const radiusX = 760;
    const radiusY = 580;
    return {
      x: slide.x + Math.cos(rad) * radiusX,
      y: slide.y + Math.sin(rad) * radiusY,
      rotation: (subIdx % 2 === 0 ? 1 : -1) * 2.5,
    };
  };

  // Compute target camera state (x, y, scale, rotate) for Framer Motion spring physics
  const getCameraTarget = () => {
    const vw = viewport.width;
    const vh = viewport.height;

    if (activeSlideIndex === null) {
      const scaleX = (vw * 0.9) / CANVAS_WIDTH;
      const scaleY = (vh * 0.85) / CANVAS_HEIGHT;
      const baseScale = Math.min(scaleX, scaleY, 0.42) * overviewZoomBoost;
      const cx = CANVAS_WIDTH / 2;
      const cy = CANVAS_HEIGHT / 2;
      return {
        x: vw / 2 - cx * baseScale + panOffset.x,
        y: vh / 2 - cy * baseScale + panOffset.y,
        scale: baseScale,
        rotate: 0,
      };
    }

    const slide = SLIDES_DATA[activeSlideIndex];

    // If zoomed into one of Slide 10's circular Prezi sub-nodes!
    if (
      activeSubNodeIndex !== null &&
      slide.subNodes &&
      slide.subNodes[activeSubNodeIndex]
    ) {
      const sat = getSatelliteCoords(slide, activeSubNodeIndex, slide.subNodes.length);
      const subScale = Math.min((vw * 0.85) / 560, (vh * 0.82) / 520, 1.55);
      const rad = (-sat.rotation * Math.PI) / 180;
      const rx = sat.x * Math.cos(rad) - sat.y * Math.sin(rad);
      const ry = sat.x * Math.sin(rad) + sat.y * Math.cos(rad);
      return {
        x: vw / 2 - rx * subScale,
        y: vh / 2 - ry * subScale,
        scale: subScale,
        rotate: -sat.rotation,
      };
    }

    // Standard Slide focus with rotational Prezi alignment
    const targetScale = Math.min((vw * 0.88) / 920, (vh * 0.84) / 650, 1.16);
    const effectiveScale = isSwooping ? targetScale * 0.58 : targetScale;
    const rad = (-slide.rotation * Math.PI) / 180;
    const rx = slide.x * Math.cos(rad) - slide.y * Math.sin(rad);
    const ry = slide.x * Math.sin(rad) + slide.y * Math.cos(rad);

    return {
      x: vw / 2 - rx * effectiveScale,
      y: vh / 2 - ry * effectiveScale,
      scale: effectiveScale,
      rotate: isSwooping ? 0 : -slide.rotation,
    };
  };

  const cameraTarget = getCameraTarget();

  // Mouse drag & wheel handlers for interactive overview map
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeSlideIndex !== null) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || activeSlideIndex !== null) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (activeSlideIndex === null) {
      const delta = -e.deltaY * 0.0012;
      setOverviewZoomBoost((z) => Math.min(Math.max(z + delta, 0.7), 1.85));
    }
  };

  const splinePathD = buildSmoothSplinePath(SLIDES_DATA);
  const currentSlide = activeSlideIndex !== null ? SLIDES_DATA[activeSlideIndex] : null;
  const currentSubNode: SubNodeData | null =
    currentSlide &&
    activeSubNodeIndex !== null &&
    currentSlide.subNodes &&
    currentSlide.subNodes[activeSubNodeIndex]
      ? currentSlide.subNodes[activeSubNodeIndex]
      : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#060911] text-[#F8FAFC] select-none">
      {/* Top Bar Contract: Strict 3-zone header */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800/80 bg-[#060911]/90 backdrop-blur-xl z-30 shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            goToOverview();
          }}
          className="text-xl font-bold tracking-tight text-white font-display whitespace-nowrap"
        >
          Россия: 1991–2026
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={goToOverview}
            className={`hover:text-white transition-colors whitespace-nowrap py-1 border-b-2 cursor-pointer ${
              activeSlideIndex === null ? 'border-[#DC2626] text-white' : 'border-transparent'
            }`}
          >
            Карта Prezi
          </button>
          <button
            onClick={() => goToSlide(0)}
            className={`hover:text-white transition-colors whitespace-nowrap py-1 border-b-2 cursor-pointer ${
              activeSlideIndex !== null && activeSlideIndex <= 2
                ? 'border-[#DC2626] text-white'
                : 'border-transparent'
            }`}
          >
            1991: Истоки
          </button>
          <button
            onClick={() => goToSlide(3)}
            className={`hover:text-white transition-colors whitespace-nowrap py-1 border-b-2 cursor-pointer ${
              activeSlideIndex !== null && activeSlideIndex >= 3 && activeSlideIndex <= 6
                ? 'border-[#DC2626] text-white'
                : 'border-transparent'
            }`}
          >
            1990–2000-е
          </button>
          <button
            onClick={() => goToSlide(7)}
            className={`hover:text-white transition-colors whitespace-nowrap py-1 border-b-2 cursor-pointer ${
              activeSlideIndex !== null && (activeSlideIndex === 7 || activeSlideIndex === 8)
                ? 'border-[#DC2626] text-white'
                : 'border-transparent'
            }`}
          >
            2014–2022
          </button>
          <button
            onClick={() => goToSlide(9)}
            className={`hover:text-white transition-colors whitespace-nowrap py-1 border-b-2 cursor-pointer ${
              activeSlideIndex !== null && activeSlideIndex >= 9
                ? 'border-[#DC2626] text-white'
                : 'border-transparent'
            }`}
          >
            2026 и Итоги
          </button>
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlanDrawer((prev) => !prev)}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900/90 border border-slate-700/80 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer"
          >
            <ListOrdered className="w-3.5 h-3.5 text-slate-400" />
            <span>План (12 слайдов)</span>
          </button>
          <button
            onClick={() => {
              if (activeSlideIndex === null) {
                goToSlide(0);
              } else {
                goToOverview();
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer shadow-lg shadow-[#DC2626]/25"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{activeSlideIndex === null ? 'Начать презентацию' : 'Общий вид карты'}</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Prezi Spatial Viewport */}
      <main
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative flex-1 overflow-hidden ${
          activeSlideIndex === null ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        {/* Dynamic Ambient Spotlight Backdrop that shifts color depending on era */}
        <div
          className="pointer-events-none absolute inset-0 transition-all duration-1000"
          style={{
            background:
              currentSlide?.accentColor === 'red'
                ? 'radial-gradient(circle at 65% 35%, rgba(220, 38, 38, 0.20), transparent 50%), radial-gradient(circle at 25% 75%, rgba(29, 78, 216, 0.14), transparent 50%), radial-gradient(circle at 50% 50%, #0B1120 0%, #050811 100%)'
                : 'radial-gradient(circle at 30% 30%, rgba(37, 99, 235, 0.22), transparent 50%), radial-gradient(circle at 75% 70%, rgba(220, 38, 38, 0.14), transparent 50%), radial-gradient(circle at 50% 50%, #0B1120 0%, #050811 100%)',
          }}
        />

        {/* Overview Floating Header & Camera Controls */}
        <AnimatePresence>
          {activeSlideIndex === null && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="absolute top-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-4 pointer-events-none"
            >
              <div className="bg-slate-900/85 border border-slate-800/90 backdrop-blur-xl px-5 py-3 rounded-xl pointer-events-auto shadow-2xl">
                <div className="text-xs text-slate-400 font-mono-num">
                  ИНТЕРАКТИВНЫЙ ХОЛСТ PREZI · 12 СЛАЙДОВ + 6 ВЛОЖЕННЫХ СУБУЗЛОВ
                </div>
                <div className="text-sm font-medium text-slate-100 mt-0.5">
                  Нажмите на любую станцию для 3D-перелёта камеры или вращайте колесо мыши для масштаба
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/85 border border-slate-800/90 backdrop-blur-xl p-1.5 rounded-xl pointer-events-auto shadow-2xl">
                <button
                  onClick={() => setOverviewZoomBoost((z) => Math.min(z + 0.18, 1.85))}
                  title="Приблизить карту"
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOverviewZoomBoost((z) => Math.max(z - 0.18, 0.7))}
                  title="Отдалить карту"
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setPanOffset({ x: 0, y: 0 });
                    setOverviewZoomBoost(1);
                  }}
                  title="Сбросить вид"
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breadcrumb HUD when zoomed into a Slide or Sub-Node */}
        <AnimatePresence>
          {activeSlideIndex !== null && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-slate-900/85 border border-slate-800 backdrop-blur-xl px-4 py-2 rounded-xl text-xs shadow-xl"
            >
              <button
                onClick={goToOverview}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Карта Prezi
              </button>
              <span className="text-slate-600">/</span>
              <button
                onClick={() => setActiveSubNodeIndex(null)}
                className={`transition-colors cursor-pointer ${
                  activeSubNodeIndex === null
                    ? 'text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Слайд {activeSlideIndex + 1}: {currentSlide?.yearBadge}
              </button>
              {currentSubNode && (
                <>
                  <span className="text-slate-600">/</span>
                  <span className="text-[#60A5FA] font-semibold">{currentSubNode.label}</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Mini-Map Radar in Bottom-Right Corner when zoomed in */}
        <AnimatePresence>
          {activeSlideIndex !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="hidden md:block absolute bottom-4 right-6 z-20 w-56 h-36 bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 backdrop-blur-xl shadow-2xl"
            >
              <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400 mb-1">
                <span>РАДАР ХОЛСТА</span>
                <button
                  onClick={goToOverview}
                  className="text-[#60A5FA] hover:underline cursor-pointer"
                >
                  Весь холст
                </button>
              </div>
              <div className="relative w-full h-24 bg-slate-900/80 rounded-lg overflow-hidden border border-slate-800/60">
                <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="w-full h-full">
                  <path
                    d={splinePathD}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeWidth="25"
                  />
                  {SLIDES_DATA.map((s, idx) => {
                    const isCurr = activeSlideIndex === idx;
                    return (
                      <circle
                        key={s.id}
                        cx={s.x}
                        cy={s.y}
                        r={isCurr ? 110 : 65}
                        fill={isCurr ? '#DC2626' : '#3B82F6'}
                        className="cursor-pointer"
                        onClick={() => goToSlide(idx)}
                      />
                    );
                  })}
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Framer Motion 2.5D Spring-Physics Camera Canvas */}
        <motion.div
          animate={{
            x: cameraTarget.x,
            y: cameraTarget.y,
            scale: cameraTarget.scale,
            rotate: cameraTarget.rotate,
          }}
          transition={
            isDragging
              ? { duration: 0 }
              : {
                  type: 'spring',
                  stiffness: isSwooping ? 85 : 62,
                  damping: isSwooping ? 18 : 16,
                  mass: 0.95,
                }
          }
          style={{
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            transformOrigin: '0 0',
          }}
          className="relative will-change-transform"
        >
          {/* SVG Architectural Cartography & Animated Trajectory Layer */}
          <svg
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#F8FAFC" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#DC2626" stopOpacity="0.9" />
              </linearGradient>
              <radialGradient id="nodeGlowBlue" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nodeGlowRed" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#DC2626" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Architectural blueprint grid */}
            {[600, 1300, 2000, 2700, 3400, 4100, 4800].map((gx) => (
              <line
                key={`gx-${gx}`}
                x1={gx}
                y1={0}
                x2={gx}
                y2={CANVAS_HEIGHT}
                stroke="rgba(148, 163, 184, 0.04)"
                strokeWidth="2"
              />
            ))}
            {[500, 1200, 1900, 2600, 3300].map((gy) => (
              <line
                key={`gy-${gy}`}
                x1={0}
                y1={gy}
                x2={CANVAS_WIDTH}
                y2={gy}
                stroke="rgba(148, 163, 184, 0.04)"
                strokeWidth="2"
              />
            ))}

            {/* Soft background spline glow */}
            <path
              d={splinePathD}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="14"
              strokeOpacity="0.15"
              strokeLinecap="round"
            />

            {/* Animated flowing Prezi trajectory curve */}
            <path
              d={splinePathD}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="4"
              strokeDasharray="16 14"
              className="animate-dash-flow"
            />

            {/* Orbit rings & satellite connectors around each slide station */}
            {SLIDES_DATA.map((slide, idx) => {
              const isSelected = activeSlideIndex === idx;
              return (
                <g key={`orbit-${slide.id}`}>
                  {/* Ambient radial aura behind node */}
                  <circle
                    cx={slide.x}
                    cy={slide.y}
                    r={650}
                    fill={
                      slide.accentColor === 'red' ? 'url(#nodeGlowRed)' : 'url(#nodeGlowBlue)'
                    }
                  />

                  {/* Outer rotating Prezi compass ring */}
                  <circle
                    cx={slide.x}
                    cy={slide.y}
                    r={isSelected ? 520 : 475}
                    fill="none"
                    stroke={
                      slide.accentColor === 'red'
                        ? 'rgba(220, 38, 38, 0.26)'
                        : 'rgba(59, 130, 246, 0.26)'
                    }
                    strokeWidth={isSelected ? '3' : '2'}
                    strokeDasharray="24 16 6 16"
                    className="animate-orbit-slow"
                  />

                  {/* If Slide 10 has Prezi satellite sub-nodes, draw connecting spokes */}
                  {slide.subNodes &&
                    (activeSlideIndex === null || activeSlideIndex === idx) &&
                    slide.subNodes.map((sub, subIdx) => {
                      const sat = getSatelliteCoords(slide, subIdx, slide.subNodes!.length);
                      const isSubSelected =
                        activeSlideIndex === idx && activeSubNodeIndex === subIdx;
                      return (
                        <g key={`spoke-${sub.id}`}>
                          <line
                            x1={slide.x}
                            y1={slide.y}
                            x2={sat.x}
                            y2={sat.y}
                            stroke={isSubSelected ? '#60A5FA' : 'rgba(96, 165, 250, 0.35)'}
                            strokeWidth={isSubSelected ? '4' : '2.5'}
                            strokeDasharray="8 8"
                          />
                          <circle
                            cx={sat.x}
                            cy={sat.y}
                            r={isSubSelected ? 235 : 195}
                            fill="none"
                            stroke="rgba(96, 165, 250, 0.25)"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    })}
                </g>
              );
            })}
          </svg>

          {/* Render All 12 Spatial Slide Stations */}
          {SLIDES_DATA.map((slide, index) => {
            const isSelected = activeSlideIndex === index && activeSubNodeIndex === null;
            const isParentOfActiveSub =
              activeSlideIndex === index && activeSubNodeIndex !== null;
            const isDimmed =
              activeSlideIndex !== null && !isSelected && !isParentOfActiveSub;
            const isHovered = hoveredNodeIndex === index;

            const borderAccent =
              slide.accentColor === 'red'
                ? isSelected
                  ? 'border-[#EF4444] shadow-[0_0_70px_-10px_rgba(220,38,38,0.45)]'
                  : 'border-[#DC2626]/65 hover:border-[#EF4444]'
                : slide.accentColor === 'blue'
                ? isSelected
                  ? 'border-[#3B82F6] shadow-[0_0_70px_-10px_rgba(59,130,246,0.45)]'
                  : 'border-[#2563EB]/65 hover:border-[#60A5FA]'
                : isSelected
                ? 'border-slate-400 shadow-[0_0_70px_-10px_rgba(148,163,184,0.35)]'
                : 'border-slate-600/75 hover:border-slate-300';

            return (
              <React.Fragment key={slide.id}>
                <div
                  onMouseEnter={() => setHoveredNodeIndex(index)}
                  onMouseLeave={() => setHoveredNodeIndex(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSelected) {
                      goToSlide(index);
                    }
                  }}
                  style={{
                    left: `${slide.x}px`,
                    top: `${slide.y}px`,
                    width: '860px',
                    transform: `translate(-50%, -50%) rotate(${slide.rotation}deg) scale(${
                      activeSlideIndex === null && isHovered ? 1.035 : 1
                    })`,
                  }}
                  className={`absolute rounded-2xl bg-[#0B1222]/95 backdrop-blur-xl border-2 transition-all duration-300 ${borderAccent} ${
                    isSelected ? 'z-30 cursor-default' : 'z-10 cursor-pointer'
                  } ${
                    isDimmed
                      ? 'opacity-10 hover:opacity-65'
                      : isParentOfActiveSub
                      ? 'opacity-35 hover:opacity-85'
                      : 'opacity-100'
                  }`}
                >
                  {/* Top Russian Tricolor luminous bar */}
                  <div className="h-1.5 w-full rounded-t-2xl flex overflow-hidden">
                    <div className="w-1/3 bg-white" />
                    <div className="w-1/3 bg-[#2563EB]" />
                    <div className="w-1/3 bg-[#DC2626]" />
                  </div>

                  {/* Overview Badge Overlay so stations are recognizable at 0.35x zoom */}
                  {activeSlideIndex === null && (
                    <div className="absolute -top-12 left-0 flex items-center gap-3 pointer-events-none">
                      <span className="px-3.5 py-1 rounded-lg bg-slate-900/95 border border-slate-700 text-lg font-mono-num font-bold text-white shadow-lg">
                        {String(slide.slideNumber).padStart(2, '0')} · {slide.yearBadge}
                      </span>
                    </div>
                  )}

                  <div className="p-7">
                    {/* Editorial unboxed metadata header (Zero-Pill Discipline) */}
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono-num border-b border-slate-800/90 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">
                          СЛАЙД {String(slide.slideNumber).padStart(2, '0')} / 12
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#60A5FA] font-semibold">{slide.yearBadge}</span>
                        <span aria-hidden="true">·</span>
                        <span>Эпоха: {slide.eraGroup}</span>
                      </div>
                      {isSelected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            goToOverview();
                          }}
                          className="text-xs text-slate-300 hover:text-white underline cursor-pointer whitespace-nowrap"
                        >
                          Общая карта (Esc)
                        </button>
                      ) : (
                        <span className="text-slate-300 flex items-center gap-1 font-sans">
                          <span>Приблизить</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Main Slide Title & Subtitle */}
                    <h2 className="text-3xl font-bold text-white font-display tracking-wide leading-tight">
                      {slide.title}
                    </h2>
                    <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                      {slide.subtitle}
                    </p>

                    {/* Staggered content body */}
                    <motion.div
                      key={`content-${slide.id}-${isSelected ? 'active' : 'idle'}`}
                      initial={isSelected ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.1 }}
                      className={`mt-5 grid gap-6 ${
                        slide.imageUrl ? 'grid-cols-12' : 'grid-cols-1'
                      }`}
                    >
                      <div className={slide.imageUrl ? 'col-span-7' : 'col-span-12'}>
                        {slide.leadText && (
                          <p className="text-xs font-medium text-slate-300 mb-2.5">
                            {slide.leadText}
                          </p>
                        )}

                        <ul className="space-y-2 text-sm text-slate-100 leading-relaxed">
                          {slide.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2.5">
                              <span
                                className={`font-mono-num font-bold select-none mt-0.5 ${
                                  slide.accentColor === 'red'
                                    ? 'text-[#EF4444]'
                                    : 'text-[#60A5FA]'
                                }`}
                              >
                                0{bIdx + 1}
                              </span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Timeline steps if present (Slide 3 December 1991 chronology) */}
                        {slide.timelineSteps && (
                          <div className="mt-4 pt-3 border-t border-slate-800/90">
                            <div className="text-xs font-semibold text-slate-200 mb-2">
                              {slide.highlightTitle}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {slide.timelineSteps.map((step, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="bg-slate-900/95 border border-slate-800 px-3 py-2 rounded-lg"
                                >
                                  <div className="text-xs font-mono-num font-semibold text-[#60A5FA]">
                                    {step.date}
                                  </div>
                                  <div className="text-xs text-slate-300 mt-0.5">{step.event}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Highlight / Interesting Fact callout */}
                        {slide.highlightText && (
                          <div className="mt-4 pt-3 border-t border-slate-800/90">
                            <div className="text-xs text-slate-300 leading-relaxed">
                              <span className="font-semibold text-white">
                                {slide.highlightTitle || 'Интересный факт'}:{' '}
                              </span>
                              {slide.highlightText}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Visual Media Column */}
                      {slide.imageUrl && (
                        <div className="col-span-5 flex flex-col justify-between">
                          <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 aspect-4/3 shadow-lg group">
                            <img
                              src={slide.imageUrl}
                              alt={slide.title}
                              loading={index === 0 ? 'eager' : 'lazy'}
                              decoding="async"
                              fetchPriority={index === 0 ? 'high' : 'low'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                            <div className="absolute bottom-2.5 left-3 right-3 text-[11px] text-slate-200 font-serif italic leading-snug">
                              {slide.imageCaption}
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Quick Sub-Node Launchers inside Slide 10 */}
                    {slide.subNodes && (
                      <div className="mt-5 pt-4 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#60A5FA]" />
                            <span>
                              Орбитальные субузлы Prezi (нажмите для 3D-перелёта к субузлу):
                            </span>
                          </span>
                          <span className="text-xs text-slate-400 font-mono-num">
                            6 круговых станций вокруг слайда
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {slide.subNodes.map((sub, subIdx) => (
                            <button
                              key={sub.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                goToSubNode(subIdx);
                              }}
                              className="text-left p-2.5 rounded-xl bg-slate-900/95 border border-slate-700/80 hover:border-[#60A5FA] hover:bg-slate-800/90 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
                                <span>СУБУЗЕЛ 10.{subIdx + 1}</span>
                                <span className="text-[#60A5FA] group-hover:translate-x-0.5 transition-transform">
                                  Зум →
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-white mt-0.5 truncate">
                                {sub.label}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Speaker Speech Quote */}
                    {showSpeakerNotes && (
                      <div className="mt-5 pt-3.5 border-t border-slate-800/90 bg-slate-950/75 -mx-7 -mb-7 px-7 py-4 rounded-b-2xl">
                        <div className="flex items-center gap-2 text-[11px] font-mono-num text-[#60A5FA] mb-1">
                          <span>ТЕКСТ ДЛЯ ВЫСТУПЛЕНИЯ</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">ГОТОВАЯ РЕЧЬ ДОКЛАДЧИКА</span>
                        </div>
                        <blockquote className="text-sm font-display italic text-slate-100 leading-relaxed">
                          «{slide.speechQuote}»
                        </blockquote>
                        {slide.secondaryQuote && (
                          <blockquote className="text-xs font-display italic text-slate-300 leading-relaxed mt-1.5">
                            «{slide.secondaryQuote}»
                          </blockquote>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Spatial Circular Prezi Satellite Nodes placed directly on the canvas around Slide 10! */}
                {slide.subNodes &&
                  slide.subNodes.map((sub, subIdx) => {
                    const sat = getSatelliteCoords(slide, subIdx, slide.subNodes!.length);
                    const isSubActive =
                      activeSlideIndex === index && activeSubNodeIndex === subIdx;
                    const isVisibleContext =
                      activeSlideIndex === null || activeSlideIndex === index;

                    return (
                      <div
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          goToSubNode(subIdx);
                        }}
                        style={{
                          left: `${sat.x}px`,
                          top: `${sat.y}px`,
                          width: '350px',
                          height: '350px',
                          transform: `translate(-50%, -50%) rotate(${sat.rotation}deg) scale(${
                            isVisibleContext ? 1 : 0.75
                          })`,
                        }}
                        className={`absolute rounded-full bg-gradient-to-br from-[#0F172A] via-[#0B1329] to-[#1E1B4B] border-2 transition-all duration-500 flex flex-col justify-between p-6 text-center shadow-2xl ${
                          !isVisibleContext
                            ? 'opacity-0 pointer-events-none z-0'
                            : isSubActive
                            ? 'border-[#60A5FA] shadow-[0_0_60px_rgba(96,165,250,0.55)] z-40 cursor-default opacity-100'
                            : activeSlideIndex === index && activeSubNodeIndex !== null
                            ? 'border-[#3B82F6]/40 z-20 cursor-pointer opacity-30 hover:opacity-90'
                            : 'border-[#3B82F6]/65 hover:border-white z-20 cursor-pointer opacity-90 hover:opacity-100'
                        }`}
                      >
                        <div className="text-[10px] font-mono-num text-[#60A5FA] tracking-wider">
                          PREZI УЗЕЛ 10.{subIdx + 1}
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-white font-display leading-snug">
                            {sub.label}
                          </h3>
                          {sub.metric && (
                            <div className="text-[11px] font-mono-num text-emerald-300 mt-1">
                              {sub.metric}
                            </div>
                          )}
                          <ul className="mt-3 space-y-1.5 text-left text-[11px] text-slate-200 leading-snug">
                            {sub.details.map((d, dIdx) => (
                              <li key={dIdx} className="flex items-start gap-1.5">
                                <span className="text-[#60A5FA] font-bold">•</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          {isSubActive ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSubNodeIndex(null);
                              }}
                              className="px-3 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-[11px] text-white cursor-pointer"
                            >
                              ← Назад к Слайду 10
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              Нажмите для приближения
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </motion.div>

        {/* Slide Plan & Recommendations Drawer */}
        <AnimatePresence>
          {showPlanDrawer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlanDrawer(false)}
              className="absolute inset-0 z-30 bg-black/65 backdrop-blur-xs flex justify-end"
            >
              <motion.div
                initial={{ x: 380 }}
                animate={{ x: 0 }}
                exit={{ x: 380 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0B1120] border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white font-display">
                        План презентации (1991–2026)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Выберите слайд для мгновенного 3D-перелёта камеры
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPlanDrawer(false)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    {PRESENTATION_PLAN.map((item, idx) => {
                      const isCurrent = activeSlideIndex === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            goToSlide(idx);
                            setShowPlanDrawer(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                            isCurrent
                              ? 'bg-[#1D4ED8] text-white'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{item}</span>
                          <span className="font-mono-num text-[11px] opacity-75 ml-2 shrink-0">
                            {SLIDES_DATA[idx].yearBadge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-white">
                      Ключевые фразы для выступления
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-white">Начало речи:</strong> «1991 год — точка
                      отсчёта новой России».
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-white">Финал речи:</strong> «35 лет — это всего одно
                      поколение, но за это время страна прошла через несколько исторических эпох».
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 mt-6 flex items-center justify-between text-xs text-slate-400">
                  <span>Клавиши: ← / → / Пробел / Esc</span>
                  <button
                    onClick={() => setShowPlanDrawer(false)}
                    className="text-white hover:underline cursor-pointer"
                  >
                    Закрыть
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share & GitHub Pages Link Modal */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-lg w-full bg-[#0B1120] border border-slate-700 rounded-2xl p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                  <div>
                    <h3 className="text-xl font-bold text-white font-display">
                      Ссылка на презентацию и публикация в GitHub
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Поделитесь текущим слайдом или опубликуйте на GitHub Pages
                    </p>
                  </div>
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Прямая ссылка на текущий вид:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={typeof window !== 'undefined' ? window.location.href : ''}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num text-slate-200 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            navigator.clipboard.writeText(window.location.href);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }
                        }}
                        className="px-3.5 py-2 bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="text-xs font-semibold text-white">
                      Как получить постоянную ссылку на GitHub Pages:
                    </div>
                    <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>
                        Загрузите этот проект в свой репозиторий на GitHub (файл автоматической
                        публикации <code className="text-[#60A5FA]">.github/workflows/deploy.yml</code> уже встроен).
                      </li>
                      <li>
                        В репозитории откройте <strong>Settings → Pages</strong> и в поле{' '}
                        <strong>Source</strong> выберите <strong>GitHub Actions</strong>.
                      </li>
                      <li>
                        Через 40 секунд ваша презентация будет доступна по ссылке:
                        <div className="mt-1 px-2.5 py-1.5 bg-slate-950 rounded border border-slate-800 font-mono-num text-[11px] text-[#60A5FA]">
                          https://&lt;ваш-логин&gt;.github.io/&lt;имя-репозитория&gt;/
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Готово
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Interactive Timeline & Prezi Playback Control Dock */}
      <footer className="border-t border-slate-800/90 bg-[#060911]/95 backdrop-blur-xl px-6 py-2.5 z-30 shrink-0">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Playback & Overview Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToOverview}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSlideIndex === null
                  ? 'bg-white text-slate-950 border-white font-semibold'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Карта (Overview)</span>
            </button>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={handlePrev}
                title="Предыдущий шаг (←)"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-mono-num text-slate-200 whitespace-nowrap">
                {activeSlideIndex === null
                  ? 'ОБЗОР КАРТЫ'
                  : activeSubNodeIndex !== null
                  ? `СЛАЙД 10.${activeSubNodeIndex + 1}`
                  : `${String(activeSlideIndex + 1).padStart(2, '0')} / ${SLIDES_DATA.length}`}
              </span>
              <button
                onClick={handleNext}
                title="Следующий шаг (→)"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsAutoPlaying((p) => !p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isAutoPlaying
                  ? 'bg-[#DC2626] text-white border-[#DC2626]'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isAutoPlaying ? 'Пауза' : 'Автотур'}</span>
            </button>
          </div>

          {/* Center: Interactive Timeline Rail */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/90 px-3 py-1.5 rounded-lg">
            <span className="text-[11px] text-slate-400 mr-1 whitespace-nowrap">Хронология:</span>
            {CENTRAL_TIMELINE_MILESTONES.map((m, idx) => {
              const isActive = activeSlideIndex === m.slideIndex;
              return (
                <React.Fragment key={m.year}>
                  <button
                    onClick={() => goToSlide(m.slideIndex)}
                    className={`px-2 py-1 rounded text-xs font-mono-num transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#DC2626] text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {m.year}
                  </button>
                  {idx < CENTRAL_TIMELINE_MILESTONES.length - 1 && (
                    <span className="text-slate-600 text-xs select-none">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Right: Speaker Script Toggle & Share Link Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSpeakerNotes((s) => !s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                showSpeakerNotes
                  ? 'bg-[#1D4ED8]/25 text-white border-[#3B82F6]/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Речь спикера: {showSpeakerNotes ? 'Вкл' : 'Выкл'}</span>
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-200 border border-slate-700 hover:border-slate-500 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Ссылка / GitHub</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
