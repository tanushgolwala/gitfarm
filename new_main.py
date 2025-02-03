import cv2
import numpy as np
from collections import deque
import mediapipe as mp
import asyncio
import websockets
import json

class GestureReader:
    def __init__(self, ip, websocket_url, from_id, to_id):
        try:
            self.cap = cv2.VideoCapture(ip)
        except:
            self.cap = cv2.VideoCapture(0)

        ret, frame = self.cap.read()
        if not ret:
            print("Failed to capture image from camera.")
            return

        self.coords = []
        self.get_whiteboard(frame)
        
        self.websocket_url = f"{websocket_url}?id={from_id}"
        self.from_id = from_id
        self.to_id = to_id
        self.websocket = None
        self.running = True

    def init_mediapipe(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7)
        self.mp_draw = mp.solutions.drawing_utils

        self.drawing_mask = None
        self.prev_point = None
        self.drawing = False
        self.color = (0, 0, 255)
        self.thickness = 4
        
        self.point_buffer = deque(maxlen=3)
    
    def calculate_distance(self, point1, point2):
        return np.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)

    def get_smoothed_point(self, new_point):
        self.point_buffer.append(new_point)
        if len(self.point_buffer) < 2:
            return new_point
        x = int(sum(p[0] for p in self.point_buffer) / len(self.point_buffer))
        y = int(sum(p[1] for p in self.point_buffer) / len(self.point_buffer))
        return (x, y)
    
    def check_inside_polygon(self, x, y):
        polygon = np.array(self.coords, np.int32)
        result = cv2.pointPolygonTest(polygon, (x,y), False)
        return result >= 0

    def fingers_joined(self, hand_landmarks, h, w, threshold=40):
        try:
            index_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
            middle_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP]

            index_x, index_y = int(index_tip.x * w), int(index_tip.y * h)
            middle_x, middle_y = int(middle_tip.x * w), int(middle_tip.y * h)

            distance = self.calculate_distance((index_x, index_y), (middle_x, middle_y))
            return distance < threshold, (index_x, index_y)
        except (AttributeError, TypeError):
            return False, None

    def click_event(self, event, x, y, flags, params):
        if event == cv2.EVENT_LBUTTONDOWN and len(self.coords) < 4:
            cv2.circle(self.tempimg, (x, y), 5, (0, 0, 255), -1)
            cv2.imshow("image", self.tempimg)
            self.coords.append((x, y))

    def get_whiteboard(self, image):
        cv2.imshow("image", image)
        self.tempimg = image.copy()
        cv2.setMouseCallback("image", self.click_event)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

    async def send_websocket_message(self, join_point):
        try:
            async with websockets.connect(self.websocket_url) as websocket:
                message = {
                    'to': self.to_id,
                    'from': self.from_id,
                    'xval': join_point[0],
                    'yval': join_point[1],
                    'gestval': 'join_point'
                }
                await websocket.send(json.dumps(message))
                print(f"Sent join point: {message}")
        except Exception as e:
            print(f"WebSocket send error: {e}")

    def draw_visual_feedback(self, frame, hand_landmarks, join_point=None):
        h, w, _ = frame.shape
        
        # Draw polygon
        if len(self.coords) > 0:
            pts = np.array(self.coords, np.int32)
            cv2.polylines(frame, [pts], True, (0, 255, 0), 2)

        # Draw hand landmarks
        self.mp_draw.draw_landmarks(frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)
        
        # Draw join point if detected
        if join_point:
            cv2.circle(frame, join_point, 10, (255, 0, 0), -1)
            
            # Add text to show if point is inside polygon
            status = "Inside" if self.check_inside_polygon(join_point[0], join_point[1]) else "Outside"
            cv2.putText(frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        return frame

    def print_finger_join_point(self, frame):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                try:
                    h, w, _ = frame.shape
                    fingers_together, join_point = self.fingers_joined(hand_landmarks, h, w)
                    
                    # Draw visual feedback
                    frame = self.draw_visual_feedback(frame, hand_landmarks, join_point if fingers_together else None)
                    
                    if fingers_together and join_point and self.check_inside_polygon(join_point[0], join_point[1]):
                        asyncio.create_task(self.send_websocket_message(join_point))
                
                except Exception as e:
                    print(f"Error detecting finger join point: {e}")
        
        cv2.imshow("Hand Tracking", frame)
        cv2.waitKey(1)

    async def start_recognition(self):
        self.init_mediapipe()
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            self.print_finger_join_point(frame)
            
            await asyncio.sleep(0.1)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        self.cap.release()
        cv2.destroyAllWindows()

async def main():
    reader = GestureReader(
        "rtsp://192.0.0.4:8080/h264_pcm.sdp", 
        'ws://localhost:8080/ws', 
        '1', 
        '2'
    )
    await reader.start_recognition()

if __name__ == "__main__":
    asyncio.run(main())