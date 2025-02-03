"use client";

import { useEffect, useRef, useState } from "react";

const WS_SERVER = "ws://localhost:8080/ws?id=2"; // WebSocket server URL

const WebSocketCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const pointCounterRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#39FF14"; // Neon Green for contrast
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctxRef.current = ctx;

        return () => {
            ctxRef.current = null;
        };
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
                        console.log("Drawing point", data.xval, data.yval);
                        drawPoint(data.xval, data.yval);
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
        if (!ctxRef.current) return;

        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();
    };

    const resetCanvas = () => {
        if (!canvasRef.current || !ctxRef.current) return;
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const saveCanvasAsPNG = () => {
        if (!canvasRef.current || !ctxRef.current) return;

        // Create a temporary canvas to draw the background color
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;

        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;

        // Fill the background color
        tempCtx.fillStyle = "#181818"; // Background color
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the original canvas on top
        tempCtx.drawImage(canvasRef.current, 0, 0);

        // Create a link to download the image
        const link = document.createElement("a");
        link.href = tempCanvas.toDataURL("image/jpg");
        link.download = "gesture_drawing.jpg";
        link.click();
    };

    return (
        <div className="relative w-screen h-screen bg-[#121212] text-white flex items-center justify-center">
            {/* Full-Page Canvas */}
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full bg-[#181818]" />

            {/* Floating Control Panel */}
            <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-[#222] p-5 rounded-lg shadow-lg border border-gray-700 flex flex-col items-center gap-3">
                <h3 className="text-lg font-semibold">
                    WebSocket Status:{" "}
                    <span className={isConnected ? "text-green-400" : "text-red-500"}>
                        {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
                    </span>
                </h3>
                <div className="w-full flex gap-3">
                    <button
                        onClick={resetCanvas}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-all duration-300"
                    >
                        🔄 Reset Canvas
                    </button>
                    <button
                        onClick={saveCanvasAsPNG}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-all duration-300"
                    >
                        💾 Save as PNG
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WebSocketCanvas;
