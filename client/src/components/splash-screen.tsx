import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoVideo from "@assets/63b23561e57f5457aeb66edb9e798448fd87786ac7b2acf27503ed49da6c8ccd_1763986553727.mp4";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [show, setShow] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 5000);

    return () => clearTimeout(fallbackTimer);
  }, [onComplete]);

  const handleVideoEnd = () => {
    setShow(false);
    setTimeout(onComplete, 500);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
          data-testid="splash-screen"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnd}
            className="max-w-full max-h-full object-contain"
            data-testid="video-logo-animation"
          >
            <source src={logoVideo} type="video/mp4" />
          </video>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
