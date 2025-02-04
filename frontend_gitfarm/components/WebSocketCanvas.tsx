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

const WebSocketCanvas = () => {
    const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const pdfContainerRef = useRef<HTMLDivElement | null>(null); // Captures both PDF and Annotations
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [pdfFile, setPdfFile] = useState<string | null>(null);
    const [pdfPageWidth, setPdfPageWidth] = useState<number | null>(null);
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

        if (data.to === "2" && data.from === "1") {
          pointCounterRef.current += 1;
          if (pointCounterRef.current % 2 === 0) {
            console.log("Drawing point", data.xdim, data.ydim);

            const x_scaled = data.xval * (window.innerWidth / data.xdim) * 0.75;
            const y_scaled =
              data.yval * (window.innerHeight / data.ydim) * 0.75;
            console.log("Drawing point", x_scaled, y_scaled);

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
  }, []);

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

        // Capture everything (PDF + annotations)
        const canvas = await html2canvas(pdfContainerRef.current, {
            scale: 2, // Increases quality
            useCORS: true,
        });

        const imgData = canvas.toDataURL("image/png");

        const pdfDoc = new jsPDF("landscape", "px", "a4"); // Fit into A4
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

    return (
        <div className="relative w-screen h-screen bg-[#121212] text-white flex items-center justify-center">
            {/* Container to capture both PDF and annotations */}
            <div ref={pdfContainerRef} className="relative flex justify-center w-full h-full">
                {pdfFile && (
                    <Document
                        file={pdfFile}
                        className="shadow-lg rounded-md border z-0 border-gray-700"
                    >
                        <Page
                            pageNumber={1}
                            width={window.innerWidth * 0.8}
                            onLoadSuccess={onPageLoadSuccess}
                        />
                    </Document>
                )}
                {/* Annotation Canvas */}
                <canvas
                    ref={drawingCanvasRef}
                    className="absolute top-0 left-0 w-full z-10 h-full pointer-events-auto"
                    style={{
                        width: pdfPageWidth ? `${pdfPageWidth}px` : "100%",
                        height: "auto",
                    }}
                />
            </div>

            {/* Control Panel */}
            <div className="absolute bottom-5 left-1/3 bg-[#222] p-4 z-20 rounded-lg shadow-lg border border-gray-700 flex flex-col items-center gap-3">
                <h3 className="text-lg font-semibold">
                    WebSocket Status:{" "}
                    <span
                        className={
                            isConnected ? "text-green-400" : "text-red-500"
                        }
                    >
                        {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
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
