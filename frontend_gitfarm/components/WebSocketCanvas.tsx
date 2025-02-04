"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Configure PDF worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const WS_SERVER = "ws://localhost:8080/ws?id=2";
const DISTANCE_THRESHOLD = 35;
const GESTURE_TIMEOUT = 500; // Timeout for gesture debounce

const WebSocketCanvas = () => {
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [pdfPageWidth, setPdfPageWidth] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);

  const [isErasing, setIsErasing] = useState(false); // Track eraser mode
  const [lastGestureTime, setLastGestureTime] = useState(0); // Track the last gesture time

  const pointCounterRef = useRef(0);

  useEffect(() => {
    if (drawingCanvasRef.current) {
      const canvas = drawingCanvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#39FF14";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        drawingCtxRef.current = ctx;
      }
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_SERVER);

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received data", data.gestval);

        // Only process gestures after the debounce timeout
        const currentTime = Date.now();
        if (currentTime - lastGestureTime < GESTURE_TIMEOUT) return;

        setLastGestureTime(currentTime);

        if (data.to === "2" && data.from === "1") {
          pointCounterRef.current += 1;

          // Handle Open_Palm gesture (toggle eraser mode)
          if (data.gestval === "Open_Palm") {
            console.log("Eraser mode toggled");
            setIsErasing((prev) => !prev);
          }

          // Handle Thumb_Up (next slide) and Thumb_Down (previous slide)
          if (data.gestval === "Thumb_Up") {
            goToNextPage();
          } else if (data.gestval === "Thumb_Down") {
            goToPreviousPage();
          }

          if (pointCounterRef.current % 2 === 0) {
            const x_scaled = data.xval * (window.innerWidth / data.xdim) * 0.75;
            const y_scaled =
              data.yval * (window.innerHeight / data.ydim) * 0.75;

            drawPoint(x_scaled, y_scaled);
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
  }, [lastGestureTime]);

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

  const resetCanvas = () => {
    if (!drawingCanvasRef.current || !drawingCtxRef.current) return;
    drawingCtxRef.current.clearRect(
      0,
      0,
      drawingCanvasRef.current.width,
      drawingCanvasRef.current.height
    );
    lastPointRef.current = null;
  };

  const saveAsPDF = async () => {
    if (!pdfContainerRef.current) return;

    const canvas = await html2canvas(pdfContainerRef.current, {
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdfDoc = new jsPDF("landscape", "px", "a4");
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
      setPageNumber(1); // Reset to first page when new file is loaded
    } else {
      alert("Only PDFs are supported for now!");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = ({ width }: { width: number }) => {
    setPdfPageWidth(width);
  };

  const goToPreviousPage = () => {
    setPageNumber((prevPageNumber) => {
      if (prevPageNumber <= 1) return 1;
      resetCanvas(); // Clear annotations when changing pages
      return prevPageNumber - 1;
    });
  };

  const goToNextPage = () => {
    setPageNumber((prevPageNumber) => {
      if (prevPageNumber >= numPages) return numPages;
      resetCanvas(); // Clear annotations when changing pages
      return prevPageNumber + 1;
    });
  };

  return (
    <div className="relative w-screen h-screen bg-[#121212] text-white flex items-center justify-center">
      <div
        ref={pdfContainerRef}
        className="relative flex justify-center w-full h-full"
      >
        {pdfFile && (
          <Document
            file={pdfFile}
            className="shadow-lg rounded-md border z-0 border-gray-700"
            onLoadSuccess={onDocumentLoadSuccess}
          >
            <Page
              pageNumber={pageNumber}
              width={window.innerWidth * 0.8}
              onLoadSuccess={onPageLoadSuccess}
            />
          </Document>
        )}
        <canvas
          ref={drawingCanvasRef}
          className="absolute top-0 left-0 w-full z-10 h-full pointer-events-auto"
          style={{
            width: pdfPageWidth ? `${pdfPageWidth}px` : "100%",
            height: "auto",
          }}
        />
      </div>

      {/* Navigation Controls */}
      {pdfFile && (
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-[#222] p-4 rounded-lg shadow-lg border border-gray-700 flex items-center gap-4 z-20">
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
      <div className="absolute bottom-5 left-1/3 bg-[#222] p-4 z-20 rounded-lg shadow-lg border border-gray-700 flex flex-col items-center gap-3">
        <h3 className="text-lg font-semibold">
          WebSocket Status:{" "}
          <span className={isConnected ? "text-green-400" : "text-red-500"}>
            {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </span>
        </h3>

        {/* Draw / Erase Status */}
        <h3 className="text-lg font-semibold">
          Mode:{" "}
          <span className={isErasing ? "text-red-500" : "text-green-500"}>
            {isErasing ? "🧽 Eraser" : "✏️ Drawing"}
          </span>
        </h3>

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
          📄 Save as PDF
        </button>
      </div>
    </div>
  );
};

export default WebSocketCanvas;
