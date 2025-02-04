import Image from "next/image";
import MyCanvas from "@/components/MyCanvas";
import WebSocketCanvas from "@/components/WebSocketCanvas";

export default function Home() {
    return (
        <>
            <WebSocketCanvas />
        </>
    );
}
