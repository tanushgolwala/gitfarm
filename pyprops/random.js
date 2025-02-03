class WebSocketRandomSender {
    constructor(url, fromId, toId) {
        this.socket = new WebSocket(`${url}?id=${fromId}`);
        this.fromId = fromId;
        this.toId = toId;
        
        this.socket.onopen = () => this.startSendingRandomMessages();
        this.socket.onmessage = (event) => this.handleMessage(event);
        this.socket.onerror = (error) => console.error('WebSocket Error:', error);
    }

    getRandomGesture() {
        const gestures = ['tap', 'swipe', 'pinch', 'rotate', 'long_press'];
        return gestures[Math.floor(Math.random() * gestures.length)];
    }

    generateRandomMessage() {
        return {
            to: this.toId,
            from: this.fromId,
            xval: Math.random() * 100,
            yval: Math.random() * 100,
            gestval: this.getRandomGesture()
        };
    }

    startSendingRandomMessages() {
        this.messageInterval = setInterval(() => {
            const message = this.generateRandomMessage();
            this.socket.send(JSON.stringify(message));
        }, 1000); // Send message every second
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Received:', data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    stop() {
        clearInterval(this.messageInterval);
        this.socket.close();
    }
}

// Usage example
const sender = new WebSocketRandomSender(
    'ws://localhost:8080/ws', 
    '1', 
    '2'
);