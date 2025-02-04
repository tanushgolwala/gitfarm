import cv2
import numpy as np
from collections import deque
import mediapipe as mp
import json
import websockets
import asyncio

class GestureReader:
    def __init__(self, ip, ws_sender):
        try:
            self.cap = cv2.VideoCapture(0)
        except:
            self.cap = cv2.VideoCapture(0)

        ret, frame = self.cap.read()
        if not ret:
            print("Failed to capture image from camera.")
            return

        self.coords = []
        self.ws_sender = ws_sender  # WebSocket sender instance
        self.get_whiteboard(frame)
        self.xdim = 0
        self.ydim = 0
        

        if len(self.coords) == 4:
            x_vals, y_vals = zip(*self.coords)
            self.xdim = max(x_vals) - min(x_vals)
            self.ydim = max(y_vals) - min(y_vals)
        else:
            self.xdim, self.ydim = 1920, 1080
        print(f"Whiteboard dimensions: {self.xdim} x {self.ydim}")
        self.init_mediapipe()

    def get_whiteboard(self, image):
        """ Allow user to define a region by clicking four points. """
        print("Click 4 points on the image to define the whiteboard area.")
        self.tempimg = image.copy()
        cv2.imshow("image", self.tempimg)
        cv2.setMouseCallback("image", self.click_event)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

    def click_event(self, event, x, y, flags, params):
        """ Store clicked points to define the whiteboard region. """
        if event == cv2.EVENT_LBUTTONDOWN and len(self.coords) < 4:
            cv2.circle(self.tempimg, (x, y), 5, (0, 0, 255), -1)
            cv2.imshow("image", self.tempimg)
            self.coords.append((x, y))
            print(f"Point {len(self.coords)} recorded: ({x}, {y})")

    def init_mediapipe(self):
        """ Initialize MediaPipe for hand tracking. """
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.point_buffer = deque(maxlen=3)

    def calculate_distance(self, point1, point2):
        return np.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2)

    def check_inside_polygon(self, x, y):
        """ Check if a point (x, y) is inside the defined polygon. """
        if len(self.coords) < 4:
            return False  # Not enough points defined
        polygon = np.array(self.coords, np.int32)
        result = cv2.pointPolygonTest(polygon, (x, y), False)
        return result >= 0

    def fingers_joined(self, hand_landmarks, h, w, threshold=40):
        """ Detect if index and middle fingers are touching. """
        try:
            index_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
            middle_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP]

            index_x, index_y = int(index_tip.x * w), int(index_tip.y * h)
            middle_x, middle_y = int(middle_tip.x * w), int(middle_tip.y * h)

            distance = self.calculate_distance((index_x, index_y), (middle_x, middle_y))
            return distance < threshold, (index_x, index_y)
        except (AttributeError, TypeError):
            return False, None

    def print_finger_join_point(self, frame):
        """ Detect finger join points and send them via WebSocket. """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                h, w, _ = frame.shape
                fingers_together, join_point = self.fingers_joined(hand_landmarks, h, w)

                if fingers_together and join_point:
                    xval, yval = join_point
                    if self.check_inside_polygon(xval, yval):
                        print(f"Finger join detected at: {xval}, {yval}")
                        self.ws_sender.send_sync(xval, yval, self.xdim, self.ydim)

    def start_recognition(self):
        """ Start the video capture loop and process frames. """
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break

        
            frame = cv2.flip(frame, 1)
            self.print_finger_join_point(frame)

class WebSocketSyncSender:
    def __init__(self, url, from_id, to_id):
        self.url = f"{url}?id={from_id}"
        self.from_id = from_id
        self.to_id = to_id
        self.socket = None

    def send_sync(self, xval, yval,xdim, ydim):
        """ Send (xval, yval) data synchronously to WebSocket. """
        message = json.dumps({
            'to': self.to_id,
            'from': self.from_id,
            'xval': xval,
            'yval': yval,
            'gestval': 'tap',
            'xdim': xdim,
            'ydim': ydim
        })
        try:
            asyncio.run(self._send_message(message))
        except Exception as e:
            print(f"WebSocket send error: {e}")

    async def _send_message(self, message):
        """ Internal method to connect and send data via WebSocket. """
        async with websockets.connect(self.url) as websocket:
            await websocket.send(message)

# Initialize WebSocket sender
ws_sender = WebSocketSyncSender('ws://localhost:8080/ws', '1', '2')

# Start GestureReader with WebSocket integration
reader = GestureReader("rtsp://192.0.0.4:8080/h264_pcm.sdp", ws_sender)
reader.start_recognition()
