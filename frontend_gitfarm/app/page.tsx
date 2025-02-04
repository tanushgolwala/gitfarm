import Image from "next/image";
import MyCanvas from "@/components/MyCanvas";
import WebSocketCanvas from "@/components/WebSocketCanvas";
import GenerateImagePage from "@/components/generate-image";

export default function Home() {
    return (
        <>
            <GenerateImagePage />
        </>
    );
}
