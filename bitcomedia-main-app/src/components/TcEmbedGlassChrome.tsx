import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  isTcEmbedFrameMode,
  isTcEmbedGlassChromeMode,
} from "../utils/tcEmbedUi";

/**
 * Clases en documento para iframe embed: fondo cristal (glass) y #root sin forzar 100dvh
 * para que el alto del iframe coincida con el contenido.
 */
export function TcEmbedGlassChrome() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const glass = isTcEmbedGlassChromeMode(searchParams, location.pathname);
  const frame = isTcEmbedFrameMode(searchParams, location.pathname);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (glass) {
      root.classList.add("tc-embed-glass-ui");
      body.classList.add("tc-embed-glass-ui");
    } else {
      root.classList.remove("tc-embed-glass-ui");
      body.classList.remove("tc-embed-glass-ui");
    }
    if (frame) {
      root.classList.add("tc-embed-frame");
      body.classList.add("tc-embed-frame");
    } else {
      root.classList.remove("tc-embed-frame");
      body.classList.remove("tc-embed-frame");
    }
  }, [glass, frame]);

  return null;
}
