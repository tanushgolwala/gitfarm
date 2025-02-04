"use client";
import { useCallback } from "react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import VoiceInputModal from "./VoiceModal";

// Configure PDF worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const WS_SERVER = "ws://localhost:8080/ws?id=2";
const DISTANCE_THRESHOLD = 50;
const GESTURE_COOLDOWN = 500;

const WebSocketCanvas = () => {
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null); // Captures both PDF and Annotations
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastGestureTimeRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [pdfPageWidth, setPdfPageWidth] = useState<number | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const pointCounterRef = useRef(0);
  const laserCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const laserCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const laserPointerRef = useRef<{ x: number; y: number } | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (drawingCanvasRef.current && laserCanvasRef.current) {
      const canvas = drawingCanvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const laserCanvas = laserCanvasRef.current;
      laserCanvas!.width = window.innerWidth;
      laserCanvas!.height = window.innerHeight;

      const laserCtx = laserCanvas!.getContext("2d");

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#880808";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        drawingCtxRef.current = ctx;
      }

      if (laserCtx) {
        laserCtxRef.current = laserCtx;
        laserCtx.clearRect(0, 0, laserCanvas!.width, laserCanvas!.height);
      }

      return () => {
        drawingCtxRef.current = null;
        laserCtxRef.current = null;
      };
    }
  }, []);

  const resetCanvas = useCallback(() => {
    if (!drawingCanvasRef.current || !drawingCtxRef.current) return;
    drawingCtxRef.current.clearRect(
      0,
      0,
      drawingCanvasRef.current.width,
      drawingCanvasRef.current.height
    );
    lastPointRef.current = null;
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => {
      if (prev >= numPages) return prev;
      resetCanvas();
      return prev + 1;
    });
  }, [numPages, resetCanvas]);

  const goToPreviousPage = useCallback(() => {
    setPageNumber((prev) => {
      if (prev <= 1) return prev;
      resetCanvas();
      return prev - 1;
    });
  }, [resetCanvas]);

  useEffect(() => {
    const ws = new WebSocket(WS_SERVER);

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data);
        const now = Date.now();
        if (now - lastGestureTimeRef.current > GESTURE_COOLDOWN) {
          lastGestureTimeRef.current = now;
          if (
            data.to === "2" &&
            data.from === "1" &&
            data.gestval === "Thumb_Up"
          ) {
            goToNextPage();
            return;
          } else if (
            data.to === "2" &&
            data.from === "1" &&
            data.gestval === "Thumb_Down"
          ) {
            goToPreviousPage();
            return;
          } else if (
            data.to === "2" &&
            data.from === "1" &&
            data.gestval === "ILoveYou"
          ) {
            setShowImageModal((prev) => !prev);
            return;
          }
        } else if (data.to === "2" && data.from === "1") {
          pointCounterRef.current += 1;
          const x_scaled = data.xval * (window.innerWidth / data.xdim);
          const y_scaled = data.yval * (window.innerHeight / data.ydim);

          if (pointCounterRef.current % 2 === 0) {
            if (data.gestval === "draw") {
              drawPoint(x_scaled, y_scaled);
            } else {
              updateLaserPointer(x_scaled, y_scaled);
            }
          }
        }
      } catch (error) {
        console.error("Invalid WebSocket message", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [goToNextPage, goToPreviousPage]);

  const drawPoint = (x: number, y: number) => {
    if (!drawingCtxRef.current) return;
    const ctx = drawingCtxRef.current;

    if (lastPointRef.current) {
      const { x: lastX, y: lastY } = lastPointRef.current;
      const distance = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);

      if (distance > DISTANCE_THRESHOLD) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    lastPointRef.current = { x, y };
  };

  const updateLaserPointer = (x: number, y: number) => {
    laserPointerRef.current = { x, y };
    drawLaserPointer();
  };

  const drawLaserPointer = () => {
    if (!laserCtxRef.current || !laserPointerRef.current) return;
    const laserCtx = laserCtxRef.current;
    const laserCanvas = laserCanvasRef.current;

    laserCtx.clearRect(0, 0, laserCanvas!.width, laserCanvas!.height);

    if (laserPointerRef.current) {
      const { x, y } = laserPointerRef.current;
      laserCtx.beginPath();
      laserCtx.fillStyle = "#39FF14";
      laserCtx.arc(x, y, 20, 0, 2 * Math.PI);
      laserCtx.fill();
      laserCtx.closePath();
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const saveAsPDF = async () => {
    if (!pdfFile) {
      // HERE SAVE CANVAS AS PNG
      if (!drawingCanvasRef.current) return;

      const canvas = drawingCanvasRef.current;
      const imgData = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = imgData;
      link.download = "canvas_image.png";
      link.click();
      return;
    }
    if (!pdfContainerRef.current) return;

    // Capture everything (PDF + annotations)
    const canvas = await html2canvas(pdfContainerRef.current, {
      scale: 2, // Increases quality
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdfDoc = new jsPDF("landscape", "px", "a4"); //
    const pdfWidth = pdfDoc.internal.pageSize.getWidth();
    const pdfHeight = pdfDoc.internal.pageSize.getHeight();

    pdfDoc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdfDoc.save("annotated_document.pdf");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const fileURL = URL.createObjectURL(file);
      setPdfFile(fileURL);
    } else {
      alert("Only PDFs are supported for now!");
    }
  };

  const onPageLoadSuccess = ({ width }: { width: number }) => {
    setPdfPageWidth(width);
  };

  const toggleModal = () => {
    setShowImageModal((prev) => !prev);
  };

  return (
    <div className="relative min-w-screen min-h-screen bg-[#121212] text-white flex items-center justify-center">
      <div
        ref={pdfContainerRef}
        className="relative flex justify-center w-full h-full"
      >
        {pdfFile && (
          <Document
            file={pdfFile}
            className="shadow-lg rounded-md border z-0 border-gray-700 max-h-[100vh] overflow-hidden"
            onLoadSuccess={onDocumentLoadSuccess}
          >
            <Page
              pageNumber={pageNumber}
              width={window.innerWidth * 0.9}
              onLoadSuccess={onPageLoadSuccess}
            />
          </Document>
        )}
        <canvas
          ref={drawingCanvasRef}
          className="fixed top-0 left-0 w-full z-10 h-full pointer-events-auto"
          style={{
            width: pdfPageWidth ? `${pdfPageWidth}px` : "100%",
            height: "auto",
          }}
        />
        <canvas
          ref={laserCanvasRef}
          className="fixed top-0 left-0 w-full z-20 h-full pointer-events-none"
          style={{
            width: pdfPageWidth ? `${pdfPageWidth}px` : "100%",
            height: "auto",
          }}
        />
      </div>

      {/* Modal */}
      {showImageModal && (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center z-30">
          <div className="relative bg-black p-6 rounded-xl shadow-lg w-80 h-96 flex flex-col items-center justify-center">
            <h2 className="text-lg font-semibold text-white">Listening...</h2>

            {/* Floating spheres container */}
            <div className="relative w-32 h-16 mt-6 flex justify-center items-center space-x-2">
              <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="w-5 h-5 bg-blue-500 rounded-full animate-float"></div>
              <div className="w-6 h-6 bg-blue-600 rounded-full animate-pulse"></div>
              <div className="w-5 h-5 bg-blue-500 rounded-full animate-float"></div>
              <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
            </div>

            {/* Cool Text Box */}
            <div className="relative mt-6 w-72">
              <input
                type="text"
                className="w-full bg-transparent border border-blue-500 text-blue-300 text-sm p-2 rounded-md text-center placeholder-blue-400 focus:outline-none animate-glow"
              />
            </div>

            <button
              onClick={toggleModal}
              className="mt-6 bg-red-500 text-white px-4 py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      {pdfFile && (
        <div className="absolute top-5 transform -translate-x-1/2 bg-[#222] p-4 rounded-lg shadow-lg border border-gray-700 flex items-center gap-4 z-20">
          <button
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-all duration-300"
          >
            ← Previous
          </button>
          <span className="text-white">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-all duration-300"
          >
            Next →
          </button>
        </div>
      )}

      {/* Control Panel */}
      <div className="absolute bottom-5 bg-[#222] p-4 z-20 rounded-lg shadow-lg border border-gray-700 flex flex-col items-center gap-3">
        <h3 className="text-lg font-semibold">
          WebSocket Status:{" "}
          <span className={isConnected ? "text-green-400" : "text-red-500"}>
            {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </span>
        </h3>

        {/* Draw / Erase Status
        <h3 className="text-lg font-semibold">
          Mode:{" "}
          <span className={isErasing ? "text-red-500" : "text-green-500"}>
            {isErasing ? "🧽 Eraser" : "✏️ Drawing"}
          </span>
        </h3> */}

        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="text-white border border-gray-500 p-2 rounded bg-gray-800"
        />
        <button
          onClick={resetCanvas}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-all duration-300"
        >
          🔄 Reset Canvas
        </button>
        <button
          onClick={saveAsPDF}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-all duration-300"
        >
          {pdfFile ? "📄 Save as PDF" : "🖼️ Save as image"}
        </button>
      </div>
    </div>
  );
};

export default WebSocketCanvas;
