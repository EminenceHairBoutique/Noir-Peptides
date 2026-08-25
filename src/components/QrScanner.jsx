// src/components/QrScanner.jsx
// Camera QR scanner for vial verification codes, mounted in the accessible
// BottomSheet primitive. Progressive: native BarcodeDetector where the
// browser has it, else jsQR (lazy-loaded) over canvas frames; if the camera
// is denied or unavailable, a photo-capture input decodes a still instead —
// that path works on every phone browser. A decoded QR that is not a Noir
// Peptides verification code is reported and scanning continues; a valid one
// navigates to /v/<code>. The camera stream never leaves the device.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageUp } from "lucide-react";
import BottomSheet from "./ui/BottomSheet";
import { parseScannedCode } from "../lib/qrScanParse";

const FRAME_MS = 200; // ~5 fps decode cadence — plenty for a hand-held vial
const DECODE_SIZE = 480; // downscale frames; QR modules stay well resolved

async function loadJsQr() {
  return (await import("jsqr")).default;
}

async function decodeImageSource(source, width, height) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, DECODE_SIZE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jsQR = await loadJsQr();
  const hit = jsQR(img.data, img.width, img.height);
  return hit?.data || null;
}

export default function QrScanner({ open, onClose }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  // phase: starting | scanning | camera-error ; notice: transient message
  const [phase, setPhase] = useState("starting");
  const [notice, setNotice] = useState("");

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    (code) => {
      stopAll();
      onClose();
      navigate(`/v/${code}`);
    },
    [stopAll, onClose, navigate]
  );

  const handleDecoded = useCallback(
    (raw) => {
      const code = parseScannedCode(raw);
      if (code) {
        finish(code);
        return true;
      }
      setNotice("That QR is not a Noir Peptides verification code.");
      return false;
    },
    [finish]
  );

  // Live camera pipeline, only while the sheet is open.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setPhase("starting");
    setNotice("");

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setPhase("scanning");

        const detector =
          "BarcodeDetector" in window
            ? new window.BarcodeDetector({ formats: ["qr_code"] })
            : null;

        timerRef.current = setInterval(async () => {
          if (busyRef.current || cancelled) return;
          const v = videoRef.current;
          if (!v || !v.videoWidth) return;
          busyRef.current = true;
          try {
            let raw = null;
            if (detector) {
              const found = await detector.detect(v);
              raw = found[0]?.rawValue || null;
            } else {
              raw = await decodeImageSource(v, v.videoWidth, v.videoHeight);
            }
            if (raw) handleDecoded(raw);
          } catch {
            // one bad frame is not an error state; keep scanning
          } finally {
            busyRef.current = false;
          }
        }, FRAME_MS);
      } catch {
        if (!cancelled) setPhase("camera-error");
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open, handleDecoded, stopAll]);

  // Photo-capture fallback (also offered while scanning, for tricky lighting).
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const raw = await decodeImageSource(bmp, bmp.width, bmp.height);
      bmp.close?.();
      if (!raw) {
        setNotice("No QR code found in that photo — try again closer to the label.");
        return;
      }
      handleDecoded(raw);
    } catch {
      setNotice("Could not read that image.");
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Scan vial QR">
      <div className="space-y-4">
        <p className="text-[12px] text-se-steel font-accent">
          Point the camera at the QR code on your vial label. The scan happens
          on your device — no photos are uploaded.
        </p>

        {phase !== "camera-error" && (
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-square">
            {/* Decoding happens off the element; the video is presentational */}
            <video
              ref={videoRef}
              playsInline
              muted
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 m-auto h-3/5 w-3/5 border-2 border-se-gold/70 rounded-lg pointer-events-none"
            />
          </div>
        )}

        <p role="status" className="text-[12px] font-accent text-se-steel min-h-[1.5em]">
          {phase === "starting" && "Starting camera…"}
          {phase === "scanning" && !notice && "Scanning…"}
          {phase === "camera-error" &&
            "Camera unavailable or permission declined. Take a photo of the label instead, or type the lot number below."}
          {notice}
        </p>

        <label className="inline-flex items-center gap-2 min-h-[44px] px-4 border border-se-concrete text-[11px] font-accent uppercase tracking-[0.12em] text-se-bone/80 hover:border-se-gold/40 transition cursor-pointer">
          <ImageUp size={15} aria-hidden="true" />
          {phase === "camera-error" ? "Take a photo of the QR" : "Use a photo instead"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="sr-only"
            data-testid="qr-file-input"
          />
        </label>
      </div>
    </BottomSheet>
  );
}
