import { useCallback, useEffect, useRef, useState } from "react";

// Text morphing effect for loading screen
function GooeyText({
  texts = ["Hello", "World"],
  morphTime = 1.5,
  cooldownTime = 0.5,
  className = "",
}) {
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);
  const [textIndex, setTextIndex] = useState(0);
  const morphRef = useRef(0);
  const cooldownRef = useRef(cooldownTime);
  const timeRef = useRef(null);

  const setMorph = useCallback(
    (fraction) => {
      if (!text1Ref.current || !text2Ref.current) return;

      text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      const invertedFraction = 1 - fraction;
      text1Ref.current.style.filter = `blur(${Math.min(8 / invertedFraction - 8, 100)}px)`;
      text1Ref.current.style.opacity = `${Math.pow(invertedFraction, 0.4) * 100}%`;

      text1Ref.current.textContent = texts[textIndex % texts.length];
      text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
    },
    [textIndex, texts]
  );

  const doMorph = useCallback(() => {
    morphRef.current -= cooldownRef.current;
    cooldownRef.current = 0;

    let fraction = morphRef.current / morphTime;

    if (fraction > 1) {
      cooldownRef.current = cooldownTime;
      fraction = 1;
    }

    setMorph(fraction);

    if (fraction === 1) {
      setTextIndex((prev) => (prev + 1) % texts.length);
    }
  }, [morphTime, cooldownTime, setMorph, texts.length]);

  const doCooldown = useCallback(() => {
    morphRef.current = 0;

    if (text2Ref.current) {
      text2Ref.current.style.filter = "";
      text2Ref.current.style.opacity = "100%";
    }

    if (text1Ref.current) {
      text1Ref.current.style.filter = "";
      text1Ref.current.style.opacity = "0%";
    }
  }, []);

  useEffect(() => {
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const newTime = new Date();
      const shouldIncrementIndex = cooldownRef.current > 0;
      const dt = (newTime - (timeRef.current || newTime)) / 1000;
      timeRef.current = newTime;

      cooldownRef.current -= dt;

      if (cooldownRef.current <= 0) {
        if (shouldIncrementIndex) {
          morphRef.current = 0;
        }

        doMorph();
      } else {
        doCooldown();
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [doMorph, doCooldown]);

  return (
    <div className={className}>
      <div className="relative w-full flex items-center justify-center">
        <span
          ref={text1Ref}
          className="absolute font-bold text-white"
          style={{
            fontSize: "clamp(2rem, 8vw, 4rem)",
            letterSpacing: "0.1em",
          }}
        >
          {texts[0]}
        </span>
        <span
          ref={text2Ref}
          className="absolute font-bold text-white"
          style={{
            fontSize: "clamp(2rem, 8vw, 4rem)",
            letterSpacing: "0.1em",
          }}
        >
          {texts[1]}
        </span>
      </div>
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="gooey-text-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

export { GooeyText };
