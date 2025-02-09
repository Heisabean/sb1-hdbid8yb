import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  KeyboardEvent,
} from "react";
import { Play, Trophy, Settings, Volume2, VolumeX } from "lucide-react";
import { SOUNDS, initializeSounds, playSound } from "../utils/sound";

/* --- Utility: AABB Collision Detection --- */
function isColliding(rect1: DOMRect, rect2: DOMRect): boolean {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

/* --- DraggableCharacter Component ---
   - 캐릭터를 드래그할 수 있으며, 중력과 충돌 물리 효과를 적용합니다.
   - 버튼과 충돌 시 효과음을 재생하고 버튼에 시각적 효과(커짐, 테두리 강조, 아이콘 기울임)를 줍니다.
   - 키보드 화살표와 스페이스 키로 조작할 수 있도록 했습니다.
*/
interface DraggableCharacterProps {
  initialPos?: { x: number; y: number };
  onButtonActivate?: (button: string) => void;
}

const DraggableCharacter: React.FC<DraggableCharacterProps> = ({
  initialPos,
  onButtonActivate,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(
    initialPos || { x: window.innerWidth - 80, y: 100 }
  );
  const [isSqueezing, setIsSqueezing] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);

  const posRef = useRef<{ x: number; y: number }>(pos);
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const characterRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const draggingRef = useRef<boolean>(false);
  const lastCollidedButton = useRef<string | null>(null);

  // 눈 움직임 관련 상수
  const EYE_CONSTANTS = {
    LEFT_EYE_X: 0.35,
    RIGHT_EYE_X: 0.65,
    EYE_Y: 0.4,
    LEFT_PUPIL_OFFSET: 0.926524,
    RIGHT_PUPIL_OFFSET: 0.879059,
    MAX_PUPIL_OFFSET: 2,
  };

  // 충돌 물리 파라미터
  const PHYSICS_PARAMS: {
    ground: { bounceFactor: number; friction: number; landingThreshold: number };
    obstacle: { bounceFactor: number; friction: number; landingThreshold: number };
  } = {
    ground: { bounceFactor: 0.7, friction: 0.95, landingThreshold: 150 },
    obstacle: { bounceFactor: 0.7, friction: 0.98, landingThreshold: 200 },
  };
  const gravity = 2000;
  const bounceFactor = 0.7;

  // 버튼과 충돌 시 효과 및 사운드 처리 + 메뉴 아이콘 기울임 효과 추가
  const handleCollisionWithButton = useCallback(
    (button: string, isCollidingFlag: boolean) => {
      const buttonElement = document.querySelector(
        `[data-menu-item="${button}"]`
      ) as HTMLElement | null;
      if (isCollidingFlag) {
        if (!lastCollidedButton.current) {
          SOUNDS.hover.play().catch(console.warn);
        }
        buttonElement?.classList.add("scale-110", "ring-4", "ring-white/50");
        // 메뉴 버튼 내 아이콘 기울임 효과
        const icon = buttonElement?.querySelector("svg") as HTMLElement | null;
        if (icon) {
          icon.style.transform = "rotate(-10deg)";
        }
        if (onButtonActivate) onButtonActivate(button);
      } else {
        buttonElement?.classList.remove("scale-110", "ring-4", "ring-white/50");
        const icon = buttonElement?.querySelector("svg") as HTMLElement | null;
        if (icon) {
          icon.style.transform = "";
        }
      }
    },
    [onButtonActivate]
  );

  // native 이벤트에서 좌표 추출
  const getNativePointerCoords = (e: MouseEvent | TouchEvent): { x: number; y: number; movementX: number } => {
    if (e instanceof TouchEvent) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY, movementX: 0 };
    } else {
      return { x: e.clientX, y: e.clientY, movementX: e.movementX || 0 };
    }
  };

  // 메인 물리 시뮬레이션
  const physicsStep = (time: number) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
    }
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    if (!draggingRef.current) velocityRef.current.vy += gravity * dt;
    posRef.current.x += velocityRef.current.vx * dt;
    posRef.current.y += velocityRef.current.vy * dt;

    const charElem = characterRef.current;
    if (charElem) {
      const { width: charWidth, height: charHeight } = charElem.getBoundingClientRect();
      // 경계 충돌 처리
      if (posRef.current.x < 0) {
        posRef.current.x = 0;
        velocityRef.current.vx = -velocityRef.current.vx * bounceFactor;
      }
      if (posRef.current.x + charWidth > window.innerWidth) {
        posRef.current.x = window.innerWidth - charWidth;
        velocityRef.current.vx = -velocityRef.current.vx * bounceFactor;
      }
      if (posRef.current.y < 0) {
        posRef.current.y = 0;
        velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
      }
      if (posRef.current.y + charHeight > window.innerHeight) {
        if (Math.abs(velocityRef.current.vy) > 100)
          SOUNDS.land.play().catch(console.warn);
        posRef.current.y = window.innerHeight - charHeight;
        velocityRef.current.vy = -velocityRef.current.vy * bounceFactor;
      }
      // 충돌 검사: 버튼, 제목, Tangram 조각 등
      const obstacles = document.querySelectorAll(".obstacle");
      obstacles.forEach((obstacle) => {
        const obsElem = obstacle as HTMLElement;
        if (obsElem === charElem) return;
        const obsRect = obsElem.getBoundingClientRect();
        const charRect = charElem.getBoundingClientRect();
        if (isColliding(charRect, obsRect)) {
          if (obsElem.dataset.menuItem) {
            const buttonName = obsElem.dataset.menuItem;
            if (buttonName && buttonName !== lastCollidedButton.current) {
              handleCollisionWithButton(buttonName, true);
              lastCollidedButton.current = buttonName;
            }
          } else {
            if (lastCollidedButton.current) {
              handleCollisionWithButton(lastCollidedButton.current, false);
              lastCollidedButton.current = null;
            }
          }
          if (Math.abs(velocityRef.current.vy) > 100)
            SOUNDS.land.play().catch(console.warn);
          if (!obsElem.dataset.menuItem && obsElem.tagName === "DIV") {
            obsElem.classList.add("shake-piece", "glow-piece");
            setTimeout(() => obsElem.classList.remove("shake-piece", "glow-piece"), 500);
          }
          // 최소 오버랩에 따른 위치 보정
          const overlapLeft = charRect.right - obsRect.left;
          const overlapRight = obsRect.right - charRect.left;
          const overlapTop = charRect.bottom - obsRect.top;
          const overlapBottom = obsRect.bottom - charRect.top;
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          const isLetterObstacle = (obsElem.textContent || "").trim().length === 1;
          const params = isLetterObstacle ? PHYSICS_PARAMS.obstacle : PHYSICS_PARAMS.ground;
          if (minOverlap === overlapTop) {
            let letterOffsetY = 0;
            if (isLetterObstacle) {
              const computedStyle = window.getComputedStyle(obsElem);
              const transform = computedStyle.transform;
              if (transform && transform !== "none") {
                try {
                  letterOffsetY = new DOMMatrix(transform).m42;
                } catch (e) {
                  if (obsElem.classList.contains("translate-y-2")) letterOffsetY = 8;
                }
              } else if (obsElem.classList.contains("translate-y-2")) {
                letterOffsetY = 8;
              }
            }
            if (Math.abs(velocityRef.current.vy) < params.landingThreshold) {
              posRef.current.y = obsRect.top - charHeight + letterOffsetY;
              velocityRef.current.vy = 0;
              velocityRef.current.vx *= params.friction;
              if (Math.abs(velocityRef.current.vx) < (isLetterObstacle ? 2 : 5))
                velocityRef.current.vx = 0;
            } else {
              posRef.current.y -= minOverlap;
              velocityRef.current.vy = -velocityRef.current.vy * params.bounceFactor;
            }
          } else if (minOverlap === overlapBottom) {
            posRef.current.y += minOverlap;
            velocityRef.current.vy = -velocityRef.current.vy * params.bounceFactor;
          } else if (minOverlap === overlapLeft) {
            posRef.current.x -= minOverlap;
            velocityRef.current.vx =
              Math.abs(velocityRef.current.vx) < params.landingThreshold
                ? 0
                : -velocityRef.current.vx * params.bounceFactor;
          } else if (minOverlap === overlapRight) {
            posRef.current.x += minOverlap;
            velocityRef.current.vx =
              Math.abs(velocityRef.current.vx) < params.landingThreshold
                ? 0
                : -velocityRef.current.vx * params.bounceFactor;
          }
        } else if (
          obsElem.dataset.menuItem &&
          obsElem.dataset.menuItem === lastCollidedButton.current
        ) {
          handleCollisionWithButton(lastCollidedButton.current, false);
          lastCollidedButton.current = null;
        }
      });
    }
    setPos({ x: posRef.current.x, y: posRef.current.y });
    if (characterRef.current) {
      const charRect = characterRef.current.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent<{ charRect: DOMRect }>("characterMove", {
          detail: { charRect },
        })
      );
    }
    if (
      draggingRef.current ||
      Math.abs(velocityRef.current.vx) > 1 ||
      Math.abs(velocityRef.current.vy) > 1
    ) {
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  };

  // onMouseDown / onTouchStart (React 이벤트) – native 좌표 추출
  const getPointerCoords = (
    e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>
  ): { x: number; y: number; movementX: number } => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY, movementX: 0 };
    } else {
      return {
        x: (e as ReactMouseEvent<HTMLDivElement>).clientX,
        y: (e as ReactMouseEvent<HTMLDivElement>).clientY,
        movementX: (e as ReactMouseEvent<HTMLDivElement>).movementX || 0,
      };
    }
  };

  // Start dragging (React 이벤트)
  const handleDragStart = (
    e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    draggingRef.current = true;
    setIsSqueezing(true);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const { x, y } = getPointerCoords(e);
    const rect = characterRef.current?.getBoundingClientRect();
    if (rect) {
      offsetRef.current = { x: x - rect.left, y: y - rect.top };
    }
  };

  // Window 이벤트용 드래그 핸들러 (native 이벤트)
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    const { x, y, movementX } = getNativePointerCoords(e);
    if (e instanceof MouseEvent && movementX) {
      setRotation((prev) => Math.max(-30, Math.min(30, prev + movementX * 0.1)));
    }
    const newX = x - offsetRef.current.x;
    const newY = y - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    setPos({ x: newX, y: newY });
  }, []);

  // End dragging and resume physics
  const handleDragEnd = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = false;
      setIsSqueezing(false);
      setRotation(0);
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(physicsStep);
    }
  }, []);

  // Move pupils toward mouse pointer (native 이벤트)
  const handlePupilMovement = useCallback((e: MouseEvent) => {
    const charRect = characterRef.current?.getBoundingClientRect();
    if (!charRect) return;
    const getEyeCenter = (eyeX: number) => ({
      x: charRect.left + charRect.width * eyeX,
      y: charRect.top + charRect.height * EYE_CONSTANTS.EYE_Y,
    });
    const leftEyeCenter = getEyeCenter(EYE_CONSTANTS.LEFT_EYE_X);
    const rightEyeCenter = getEyeCenter(EYE_CONSTANTS.RIGHT_EYE_X);
    const calcOffset = (center: { x: number; y: number }) => {
      const dx = e.clientX - center.x;
      const dy = e.clientY - center.y;
      const angle = Math.atan2(dy, dx);
      return {
        x: Math.cos(angle) * EYE_CONSTANTS.MAX_PUPIL_OFFSET,
        y: Math.sin(angle) * EYE_CONSTANTS.MAX_PUPIL_OFFSET,
      };
    };
    const leftOffset = calcOffset(leftEyeCenter);
    const rightOffset = calcOffset(rightEyeCenter);
    if (characterRef.current) {
      const leftPupil = characterRef.current.querySelector("#leftPupil");
      const rightPupil = characterRef.current.querySelector("#rightPupil");
      if (leftPupil && rightPupil) {
        leftPupil.setAttribute(
          "transform",
          `translate(${EYE_CONSTANTS.LEFT_PUPIL_OFFSET + leftOffset.x} ${leftOffset.y})`
        );
        rightPupil.setAttribute(
          "transform",
          `translate(${EYE_CONSTANTS.RIGHT_PUPIL_OFFSET + rightOffset.x} ${rightOffset.y})`
        );
      }
    }
  }, []);

  // 키보드 조작 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        posRef.current.x = Math.max(0, posRef.current.x - 20);
        setPos({ ...posRef.current });
      } else if (e.key === "ArrowRight") {
        posRef.current.x = Math.min(window.innerWidth - 48, posRef.current.x + 20);
        setPos({ ...posRef.current });
      } else if (e.key === " " || e.key === "Spacebar") {
        if (!draggingRef.current) {
          setIsSqueezing(true);
          velocityRef.current.vy = -800;
          velocityRef.current.vx += (Math.random() - 0.5) * 200;
          lastTimeRef.current = performance.now();
          animationFrameRef.current = requestAnimationFrame(physicsStep);
          setTimeout(() => setIsSqueezing(false), 300);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 윈도우에 native 이벤트 추가 (타입 단언 사용)
  useEffect(() => {
    window.addEventListener("mousemove", handlePupilMovement);
    window.addEventListener("mousemove", handleDragMove as EventListener);
    window.addEventListener("mouseup", handleDragEnd as EventListener);
    window.addEventListener("touchmove", handleDragMove as EventListener, { passive: false });
    window.addEventListener("touchend", handleDragEnd as EventListener);
    return () => {
      window.removeEventListener("mousemove", handlePupilMovement);
      window.removeEventListener("mousemove", handleDragMove as EventListener);
      window.removeEventListener("mouseup", handleDragEnd as EventListener);
      window.removeEventListener("touchmove", handleDragMove as EventListener);
      window.removeEventListener("touchend", handleDragEnd as EventListener);
    };
  }, [handlePupilMovement, handleDragMove, handleDragEnd]);

  // 클릭 시 점프 (React 이벤트)
  const handleClick = () => {
    if (!draggingRef.current) {
      setIsSqueezing(true);
      velocityRef.current.vy = -800;
      velocityRef.current.vx += (Math.random() - 0.5) * 200;
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(physicsStep);
      setTimeout(() => setIsSqueezing(false), 300);
    }
  };

  return (
    <div
      ref={characterRef}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      onClick={handleClick}
      className={`absolute cursor-grab ${!draggingRef.current ? "bounce" : ""}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: "3rem",
        height: "3rem",
        zIndex: 1000,
        transform: `rotate(${rotation}deg)`,
        transition: draggingRef.current ? "none" : "transform 0.3s ease",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient
            id="character-gradient"
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="1"
            spreadMethod="pad"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="#010022" />
          </linearGradient>
          <style>{`
            @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
            .blink { animation: blink 3s infinite; transform-origin: center; transform-box: fill-box; }
            .bounce { animation: bounce 1s ease-in-out infinite; }
          `}</style>
        </defs>
        <g transform="translate(20 20)">
          <rect
            width="30"
            height="30"
            rx="4"
            ry="4"
            transform="translate(-15 -15)"
            fill="#FFD700"
          />
          <path d="M0,-15v30" stroke="#FFE666" strokeWidth="1" opacity="0.5" />
          <path d="M-15,0h30" stroke="#FFE666" strokeWidth="1" opacity="0.5" />
          <g transform="matrix(1.37111 0 0 2.052324 0 -0.428863)" className="blink">
            <g transform="translate(-4.334689 0)">
              <circle r="3" fill="#fff" />
              <circle id="leftPupil" r="1.5" transform="translate(0.926524 0)" fill="#333" />
            </g>
            <g transform="translate(4.334688 0)">
              <circle r="3" fill="#fff" />
              <circle id="rightPupil" r="1.5" transform="translate(0.879059 0)" fill="#333" />
            </g>
          </g>
          <circle
            r="2.5"
            transform="matrix(1 0 0 0.884546 -8 7.75)"
            opacity="0.6"
            fill="#FFB6C1"
          />
          <circle
            r="2.5"
            transform="matrix(1 0 0 0.884546 8 7.75)"
            opacity="0.6"
            fill="#FFB6C1"
          />
          {isSqueezing ? (
            <circle cx="0" cy="7" r="3" fill="#dd595b" />
          ) : (
            <path
              d="M-4,7q4,3,8,0"
              fill="none"
              stroke="#333"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
    </div>
  );
};

/* --- TitleLetter Component ---
   - 개별 타이틀 글자를 렌더링하며, 캐릭터와 충돌 시 아래로 이동합니다.
*/
interface TitleLetterProps {
  children: React.ReactNode;
  color: string;
}

const TitleLetter = React.forwardRef<HTMLSpanElement, TitleLetterProps>(
  ({ children, color }, ref) => {
    const [isPressed, setIsPressed] = useState<boolean>(false);
    const innerRef = useRef<HTMLSpanElement>(null);
    const letterRef = (ref as React.RefObject<HTMLSpanElement>) || innerRef;
    const colorClasses = {
      cyan: 'text-cyan-400',
      yellow: 'text-yellow-400',
      purple: 'text-purple-400',
      green: 'text-green-400',
      red: 'text-red-400',
      blue: 'text-blue-400'
    } as const;
    
    useEffect(() => {
      const checkCollision = (charRect: DOMRect) => {
        if (letterRef.current) {
          const letterRect = letterRef.current.getBoundingClientRect();
          setIsPressed(
            !(
              charRect.right < letterRect.left ||
              charRect.left > letterRect.right ||
              charRect.bottom < letterRect.top ||
              charRect.top > letterRect.bottom
            )
          );
        }
      };
      const handleCharacterMove = (e: Event) => {
        const customEvent = e as CustomEvent<{ charRect: DOMRect }>;
        if (customEvent.detail.charRect) checkCollision(customEvent.detail.charRect);
      };
      window.addEventListener("characterMove", handleCharacterMove);
      return () => window.removeEventListener("characterMove", handleCharacterMove);
    }, [letterRef]);

    return (
      <span
        ref={letterRef}
        className={`
  obstacle 
  ${colorClasses[color as keyof typeof colorClasses]} 
  transition-all 
  duration-300 
  text-6xl 
  relative 
  leading-none 
  inline-block
  opacity-100
  ${isPressed ? "transform translate-y-2" : ""}
`}
      >
        {children}
      </span>
    );
  }
);

/* --- SoundControl Component ---
   - 우측 하단에 사운드 토글 버튼을 렌더링합니다.
*/
const SoundControl: React.FC = () => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const toggleSound = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    Object.values(SOUNDS).forEach((sound) => {
      sound.muted = newMuted;
    });
  };
  return (
    <button
      onClick={toggleSound}
      className="fixed bottom-4 right-4 p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-full transition-all duration-300 text-white/70 hover:text-white"
    >
      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
};

/* --- PatternPreview Component ---
   - 게임에서 만들 수 있는 간단한 패턴(물고기, 새 모양)을 타이틀 화면에 반투명하게 떠다니도록 추가합니다.
*/
const PatternPreview: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="relative w-full h-full">
        {/* 물고기 모양 패턴 */}
        <div className="absolute right-32 top-1/4 opacity-20 hover:opacity-40 transition-opacity">
          <svg viewBox="0 0 100 60" className="w-16 h-16">
            <path
              d="M10,30 Q30,10 50,30 Q70,50 90,30 Q70,10 50,30 Q30,50 10,30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan-400"
            />
          </svg>
        </div>
        {/* 새 모양 패턴 */}
        <div className="absolute left-32 bottom-1/4 opacity-20 hover:opacity-40 transition-opacity">
          <svg viewBox="0 0 100 100" className="w-16 h-16">
            <path
              d="M20,50 L50,20 L80,50 L50,80 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-400"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

/* --- SevenDropsTitle Component ---
   - 메인 컴포넌트: 배경 Tangram 조각, 타이틀, 메뉴 버튼, 캐릭터, 사운드 컨트롤, 그리고 패턴 프리뷰를 렌더링합니다.
*/
const SevenDropsTitle: React.FC = () => {
  const [hoveredButton, setHoveredButton] = useState<number | null>(null);
  const [characterInitialPos, setCharacterInitialPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [parallaxOffset, setParallaxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const letterSRef = useRef<HTMLSpanElement>(null);

  // Tangram 조각 정보 (그라데이션 효과 추가)
  const tangramPieces: { color: string; style: React.CSSProperties }[] = [
    {
      color: "bg-cyan-500",
      style: {
        width: "4rem",
        height: "4rem",
        clipPath: "polygon(0 0, 100% 0, 50% 100%)",
      },
    },
    {
      color: "bg-yellow-500",
      style: { width: "4rem", height: "4rem", clipPath: "none" },
    },
    {
      color: "bg-purple-500",
      style: {
        width: "3rem",
        height: "3rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-green-500",
      style: {
        width: "4rem",
        height: "3rem",
        clipPath: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)",
      },
    },
    {
      color: "bg-red-500",
      style: {
        width: "5rem",
        height: "5rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-blue-500",
      style: {
        width: "5rem",
        height: "5rem",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      },
    },
    {
      color: "bg-pink-500",
      style: {
        width: "4rem",
        height: "4rem",
        clipPath: "polygon(0 0, 100% 50%, 0 100%)",
      },
    },
  ];

  // 캐릭터 초기 위치는 "S" 글자의 위치를 기준으로 설정
  useEffect(() => {
    if (letterSRef.current) {
      const rect = letterSRef.current.getBoundingClientRect();
      setCharacterInitialPos({
        x: rect.left + (rect.width - 48) / 2,
        y: rect.top - 48,
      });
    }
  }, []);

  // 사운드 초기화 및 BGM 자동 재생
  useEffect(() => {
    initializeSounds();
  }, []);
  useEffect(() => {
    const playBgm = () => {
      playSound(SOUNDS.bgm);
      document.removeEventListener("click", playBgm);
    };
    document.addEventListener("click", playBgm, { once: true });
  }, []);

  const handleButtonActivate = (btn: string) => {
    console.log("Button activated:", btn);
  };

  // 메뉴 버튼 스타일
  const getButtonStyle = (color: string, isHovered: boolean): React.CSSProperties => {
    const colors: Record<
      string,
      { background: string; hover: string; border: string }
    > = {
      cyan: {
        background: "rgba(6, 182, 212, 0.70)",
        hover: "rgba(6, 182, 212, 0.90)",
        border: "rgba(6, 182, 212, 0.3)",
      },
      purple: {
        background: "rgba(147, 51, 234, 0.70)",
        hover: "rgba(147, 51, 234, 0.90)",
        border: "rgba(147, 51, 234, 0.3)",
      },
      settings: {
        background: "rgba(100, 116, 139, 0.70)",
        hover: "rgba(100, 116, 139, 0.90)",
        border: "rgba(100, 116, 139, 0.3)",
      },
    };
    return {
      backgroundColor: isHovered ? colors[color].hover : colors[color].background,
      borderColor: colors[color].border,
    };
  };

  const menuButtons: {
    icon: React.ComponentType<{ size: number }>;
    text: string;
    color: string;
    onClick: () => void;
  }[] = [
    {
      icon: Play,
      text: "게임 시작",
      color: "cyan",
      onClick: () => {
        /* 게임 시작 기능 */
      },
    },
    {
      icon: Trophy,
      text: "챌린지",
      color: "purple",
      onClick: () => {
        /* 챌린지 기능 */
      },
    },
    {
      icon: Settings,
      text: "환경설정",
      color: "settings",
      onClick: () => {
        /* 환경설정 기능 */
      },
    },
  ];

  return (
    <>
      {/* Tangram 애니메이션 CSS */}
      <style>{`
        @keyframes rotateAndFade {
          0% { transform: translate(var(--translateX, 0px), var(--translateY, 0px)) rotate(0deg); opacity: 0.2; }
          50% { transform: translate(var(--translateX, 0px), var(--translateY, 0px)) rotate(180deg); opacity: 0.5; }
          100% { transform: translate(var(--translateX, 0px), var(--translateY, 0px)) rotate(360deg); opacity: 0.2; }
        }
        .tangram { animation: rotateAndFade 8s linear infinite; }
        .tangram:hover { opacity: 0.9; transition: opacity 0.3s ease; }
      `}</style>
      <div className="h-screen w-full bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
        {/* 패턴 프리뷰 요소 */}
        <PatternPreview />
        {/* 떠다니는 Tangram 조각 (그라데이션 효과 포함) */}
        {tangramPieces.map((piece, index) => (
          <div
            key={index}
            className={`absolute obstacle tangram ${piece.color} transition-all duration-300`}
            style={{
              ...piece.style,
              left: `${Math.random() * 80 + 10}%`,
              top: `${Math.random() * 80 + 10}%`,
              animationDelay: `${index * -2}s`,
              "--translateX": `${parallaxOffset.x}px`,
              "--translateY": `${parallaxOffset.y}px`,
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.1), rgba(0,0,0,0.1))",
            } as React.CSSProperties}
          />
        ))}

        {/* 타이틀 */}
        <div className="relative mb-16">
          {/* h1에 z-index 적용하여 오버레이보다 위로 */}
          <h1 className="font-bold mb-12 tracking-widest flex items-center justify-center gap-1 relative z-10">
            <TitleLetter color="cyan">7</TitleLetter>
            <TitleLetter color="yellow">D</TitleLetter>
            <TitleLetter color="purple">R</TitleLetter>
            <TitleLetter color="green">O</TitleLetter>
            <TitleLetter color="red">P</TitleLetter>
            <TitleLetter ref={letterSRef} color="blue">
              S
            </TitleLetter>
          </h1>
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-lg blur opacity-10" />
        </div>

        {/* 메뉴 버튼 */}
        <div className="flex flex-col gap-4 w-64 relative z-10">
          {menuButtons.map((btn, index) => (
            <button
              key={index}
              data-menu-item={btn.text}
              className={`
                obstacle
                text-white/85
                backdrop-blur-sm
                py-4 px-6 
                rounded-lg 
                flex items-center 
                justify-center 
                gap-2 
                transform 
                transition-all 
                duration-300
                ${hoveredButton === index ? "scale-105 -translate-y-1" : ""}
                shadow-lg 
                border
              `}
              style={getButtonStyle(btn.color, hoveredButton === index)}
              onMouseEnter={() => {
                setHoveredButton(index);
                setParallaxOffset({ x: 10, y: 10 });
                playSound(SOUNDS.hover);
              }}
              onMouseLeave={() => {
                setHoveredButton(null);
                setParallaxOffset({ x: 0, y: 0 });
              }}
              onClick={btn.onClick}
            >
              <btn.icon size={24} />
              <span className="font-semibold">{btn.text}</span>
            </button>
          ))}
        </div>

        {/* 드래그 가능한 캐릭터 */}
        {characterInitialPos && (
          <DraggableCharacter
            initialPos={characterInitialPos}
            onButtonActivate={handleButtonActivate}
          />
        )}

        {/* 사운드 토글 */}
        <SoundControl />
      </div>
    </>
  );
};

export default SevenDropsTitle;
