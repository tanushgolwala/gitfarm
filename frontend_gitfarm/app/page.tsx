import Image from "next/image";
import MyCanvas from "@/components/MyCanvas";
import WebSocketCanvas from "@/components/WebSocketCanvas";
import GenerateImagePage from "@/components/GenerateImage";

export default function Home() {
  return (
    <>
      <WebSocketCanvas />
      {/* <GenerateImagePage /> */}
    </>
  );
}
