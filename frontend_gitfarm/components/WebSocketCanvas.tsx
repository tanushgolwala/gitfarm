"use client";

import { useEffect, useRef, useState } from "react";

const WS_SERVER = "ws://localhost:8080/ws?id=2"; // Replace with your WebSocket server URL

const WebSocketCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.strokeStyle = "blue";
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
        // console.log("WebSocket message", data);

        if (data.to === "2" && data.from === "1") {
            console.log("Drawing point", data.xval, data.yval);
          drawPoint(data.xval, data.yval);
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
          background: "#f4f4f4",
          borderRadius: "10px",
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h3>WebSocket Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}</h3>
        <hr />
        <button onClick={resetCanvas} style={{ background: "red", color: "white", padding: "5px", width: "100%" }}>
          🔄 Reset Canvas
        </button>
      </div>

      {/* Full-Page Canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ display: "block", width: "100%", height: "100%", background: "white" }}
      />
    </div>
  );
};

export default WebSocketCanvas;
