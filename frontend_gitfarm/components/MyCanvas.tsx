"use client";

import { useEffect, useRef, useState } from "react";

const MyCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState("pencil");
    const [strokeColor, setStrokeColor] = useState("black");
    const [lineWidth, setLineWidth] = useState(2);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);
    const historyRef = useRef<ImageData[]>([]);
    const redoStackRef = useRef<ImageData[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctxRef.current = ctx;

        return () => {
            ctxRef.current = null;
        };
    }, [lineWidth, strokeColor]);

    // Function to get precise mouse coordinates inside canvas
    const getMousePos = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const saveToHistory = () => {
        if (!canvasRef.current || !ctxRef.current) return;
        historyRef.current.push(
            ctxRef.current.getImageData(
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height
            )
        );
        redoStackRef.current = []; // Clear redo stack when a new action is made
    };

    const undo = () => {
        if (!ctxRef.current || historyRef.current.length === 0) return;
        redoStackRef.current.push(historyRef.current.pop()!);
        if (historyRef.current.length === 0) {
            ctxRef.current.clearRect(
                0,
                0,
                canvasRef.current!.width,
                canvasRef.current!.height
            );
        } else {
            ctxRef.current.putImageData(
                historyRef.current[historyRef.current.length - 1],
                0,
                0
            );
        }
    };

    const redo = () => {
        if (!ctxRef.current || redoStackRef.current.length === 0) return;
        const redoImage = redoStackRef.current.pop()!;
        historyRef.current.push(redoImage);
        ctxRef.current.putImageData(redoImage, 0, 0);
    };

    const startDrawing = (e: React.MouseEvent) => {
        setIsDrawing(true);
        const { x, y } = getMousePos(e);
        startPointRef.current = { x, y };

        saveToHistory(); // Save initial state before drawing

        if (tool === "pencil" || tool === "eraser") {
            ctxRef.current!.beginPath();
            ctxRef.current!.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !ctxRef.current || !startPointRef.current) return;
        const { x, y } = getMousePos(e);
        const ctx = ctxRef.current;

        if (tool === "pencil") {
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (tool === "eraser") {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 20;
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = (e: React.MouseEvent) => {
        if (!isDrawing || !ctxRef.current || !startPointRef.current) return;
        setIsDrawing(false);

        const { x, y } = getMousePos(e);
        const { x: startX, y: startY } = startPointRef.current;
        const ctx = ctxRef.current;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;

        if (tool === "line") {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (tool === "rectangle") {
            ctx.strokeRect(startX, startY, x - startX, y - startY);
        } else if (tool === "circle") {
            const radius = Math.sqrt(
                Math.pow(x - startX, 2) + Math.pow(y - startY, 2)
            );
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        startPointRef.current = null;
    };

    const resetCanvas = () => {
        if (!canvasRef.current || !ctxRef.current) return;
        ctxRef.current.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
        );
        historyRef.current = [];
        redoStackRef.current = [];
    };

    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
            {/* Floating Sidebar */}
            <div
                style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    width: "220px",
                    padding: "10px",
                    background: "#000",
                    borderRadius: "10px",
                    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
                }}
            >
                <h3>Tools</h3>
                <button onClick={() => setTool("pencil")}>✏️ Free Draw</button>
                <button onClick={() => setTool("eraser")}>🧽 Eraser</button>
                <button onClick={() => setTool("line")}>📏 Line</button>
                <button onClick={() => setTool("rectangle")}>
                    ⬛ Rectangle
                </button>
                <button onClick={() => setTool("circle")}>⚫ Circle</button>
                <hr />
                <h3>Settings</h3>
                <label>Color: </label>
                <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                />
                <br />
                <label>Line Width: </label>
                <input
                    type="range"
                    min="1"
                    max="10"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(parseInt(e.target.value))}
                />
                <hr />
                <button onClick={undo}>⏪ Undo</button>
                <button onClick={redo}>⏩ Redo</button>
                <button
                    onClick={resetCanvas}
                    style={{
                        background: "red",
                        color: "white",
                        padding: "5px",
                        width: "100%",
                    }}
                >
                    🔄 Reset Canvas
                </button>
            </div>

            {/* Full-Page Canvas */}
            <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    background: "white",
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
            />
        </div>
    );
};

export default MyCanvas;
