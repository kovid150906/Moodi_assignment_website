import { cn } from "../../lib/utils";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect } from "react";

export function TextRewind({
    text = "MOOD INDIGO",
    className = "",
    shadowColors = {
        first: "#ffffff",
        second: "#e0e0e0",
        third: "#c0c0c0",
        fourth: "#a0a0a0",
        glow: "#ffffff",
    },
}) {
    const [isMobile, setIsMobile] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useTransform(mouseY, [-0.5, 0.5], [5, -5]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-5, 5]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth) - 0.5;
            const y = (e.clientY / window.innerHeight) - 0.5;
            mouseX.set(x);
            mouseY.set(y);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY]);

    const textShadowStyle = isMobile ? {
        textShadow: `5px 5px 0px ${shadowColors.first}, 
                     8px 8px 0px ${shadowColors.second}, 
                     10px 10px 0px ${shadowColors.third}, 
                     12px 12px 0px ${shadowColors.fourth}, 
                     20px 20px 5px ${shadowColors.glow}`,
    } : {
        textShadow: `10px 10px 0px ${shadowColors.first}, 
                     15px 15px 0px ${shadowColors.second}, 
                     20px 20px 0px ${shadowColors.third}, 
                     25px 25px 0px ${shadowColors.fourth}, 
                     45px 45px 10px ${shadowColors.glow}`,
    };

    const noShadowStyle = {
        textShadow: "none",
    };

    return (
        <motion.div
            className={cn(
                "text-center cursor-pointer text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold",
                "transition-shadow duration-200 ease-in-out tracking-widest",
                "text-white italic whitespace-nowrap",
                className
            )}
            style={{
                ...textShadowStyle,
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            whileHover={noShadowStyle}
        >
            {text}
        </motion.div>
    );
}

export default TextRewind;
