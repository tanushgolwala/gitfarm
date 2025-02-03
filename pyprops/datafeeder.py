import asyncio
import websockets
import json
import random

class WebSocketRandomSender:
    def __init__(self, url, from_id, to_id):
        self.url = f"{url}?id={from_id}"
        self.from_id = from_id
        self.to_id = to_id
        self.socket = None
        self.running = True

    def get_random_gesture(self):
        gestures = ['tap', 'swipe', 'pinch', 'rotate', 'long_press']
        return random.choice(gestures)

    def generate_random_message(self):
        return {
            'to': self.to_id,
            'from': self.from_id,
            'xval': random.uniform(0, 100),
            'yval': random.uniform(0, 100),
            'gestval': self.get_random_gesture()
        }

    async def connect(self):
        async with websockets.connect(self.url) as websocket:
            self.socket = websocket
            sender_task = asyncio.create_task(self.send_messages())
            receiver_task = asyncio.create_task(self.receive_messages())
            await asyncio.gather(sender_task, receiver_task)

    async def send_messages(self):
        while self.running:
            try:
                message = self.generate_random_message()
                await self.socket.send(json.dumps(message))
                await asyncio.sleep(1)
            except Exception as e:
                print(f"Send error: {e}")
                self.running = False

    async def receive_messages(self):
        while self.running:
            try:
                message = await self.socket.recv()
                try:
                    data = json.loads(message)
                    print('Received:', data)
                except json.JSONDecodeError:
                    print('Error parsing message')
            except Exception as e:
                print(f"Receive error: {e}")
                self.running = False

# Usage
async def main():
    sender = WebSocketRandomSender(
        'ws://localhost:8080/ws', 
        '1', 
        '2'
    )
    await sender.connect()

if __name__ == "__main__":
    asyncio.run(main())