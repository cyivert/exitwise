import * as React from "react";

export interface PerspectiveMarqueeProps {
  items?: string[];
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  rotateY?: number;
  rotateX?: number;
  perspective?: number;
  fadeColor?: string;
  background?: string;
  speed?: number;
  className?: string;
}

const DEFAULT_ITEMS = [
  "Structured capture for unstructured experience",
  "Honor their legacy by ensuring their hard-won knowledge outlasts their tenure",
  "Tacit to Tangible",
  "The unwritten rules, finally written",
  "Experience is an asset. Don't let it expire",
  "Manuals teach the 'what.' We capture the 'why.'",
];

export function PerspectiveMarquee({
  items = DEFAULT_ITEMS,
  fontSize = 40,
  color = "#1a3a2a", // green-deep
  fontWeight = 800,
  rotateY = -15,
  rotateX = 5,
  perspective = 1000,
  fadeColor = "transparent",
  background = "transparent",
  speed = 0.5,
  className,
}: PerspectiveMarqueeProps) {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setOffset((prev) => (prev - speed) % 5000); // Arbitrary large number to keep it moving
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [speed]);

  const rendered = [...items, ...items, ...items, ...items];

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        perspective: `${perspective}px`,
        zIndex: 0,
      }}
    >
      <div
        style={{
          width: "200%", // wider to cover diagonal gaps
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(-12deg)`, // rotateZ for diagonal
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            display: "flex",
            whiteSpace: "nowrap",
            transform: `translateX(${offset}px)`,
          }}
        >
          {rendered.map((item, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: "var(--font-serif)",
                fontSize: `${fontSize}px`,
                fontWeight,
                color,
                letterSpacing: "-0.01em",
                padding: "10px 40px",
                marginRight: "80px",
                fontStyle: "italic",
                backgroundColor: "#f7f3ec", // bg-cream
                border: "2px solid #1a3a2a", // border-green-deep
                boxShadow: "4px 4px 0px 0px rgba(26, 58, 42, 1)",
                borderRadius: "0px",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>


      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(90deg, ${fadeColor} 0%, transparent 20%, transparent 80%, ${fadeColor} 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(180deg, ${fadeColor} 0%, transparent 30%, transparent 70%, ${fadeColor} 100%)`,
        }}
      />
    </div>
  );
}
