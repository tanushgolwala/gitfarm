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
            self.cap = cv2.VideoCapture(4)
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

        self.lastLaserCoords = (0, 0)
        
        if len(self.coords) == 4:
            x_vals, y_vals = zip(*self.coords)
            self.xdim = max(x_vals) - min(x_vals)
            self.ydim = max(y_vals) - min(y_vals)
            self.top_left_x = min(x_vals)
            self.top_left_y = min(y_vals)
        else:

            self.xdim, self.ydim = 1920, 1080
        print(f"Whiteboard dimensions: {self.xdim} x {self.ydim}")
        self.init_mediapipe()
        self.init_gestures()
        self.gesture_result = None
        self.options = self.GestureRecognizerOptions(
            base_options=self.BaseOptions(model_asset_path="gesture_recognizer.task"),  
            running_mode=self.VisionRunningMode.LIVE_STREAM,
            result_callback=self.set_gesture
        )


    def init_gestures(self):
        # Initialize MediaPipe Gesture Recognizer
        self.BaseOptions = mp.tasks.BaseOptions
        self.GestureRecognizer = mp.tasks.vision.GestureRecognizer
        self.GestureRecognizerOptions = mp.tasks.vision.GestureRecognizerOptions
        self.GestureRecognizerResult = mp.tasks.vision.GestureRecognizerResult
        self.VisionRunningMode = mp.tasks.vision.RunningMode

    def set_gesture(self, result, output_image, timestamp_ms):
        """Callback function that receives gesture recognition results."""
        if result and result.gestures:
            self.gesture_result = result.gestures[0][0].category_name
        else:
            self.gesture_result = None


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
            # print(f"Point {len(self.coords)} recorded: ({x}, {y})")

    def init_mediapipe(self):
        """ Initialize MediaPipe for hand tracking. """
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.3
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
    
    def open_palm_detected(self, hand_landmarks, h, w):
        """ Detect if an open palm is present (all fingers extended). """
        try:
            fingers = [
                self.mp_hands.HandLandmark.THUMB_TIP,
                self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                self.mp_hands.HandLandmark.RING_FINGER_TIP,
                self.mp_hands.HandLandmark.PINKY_TIP
            ]

            base_joints = [
                self.mp_hands.HandLandmark.THUMB_CMC,
                self.mp_hands.HandLandmark.INDEX_FINGER_MCP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP,
                self.mp_hands.HandLandmark.RING_FINGER_MCP,
                self.mp_hands.HandLandmark.PINKY_MCP
            ]

            tip_coords = [(int(hand_landmarks.landmark[f].x * w), int(hand_landmarks.landmark[f].y * h)) for f in fingers]
            base_coords = [(int(hand_landmarks.landmark[b].x * w), int(hand_landmarks.landmark[b].y * h)) for b in base_joints]

            # Check if all fingertips are above their respective MCP joints (hand is open)
            all_extended = all(tip[1] < base[1] for tip, base in zip(tip_coords[1:], base_coords[1:]))

            # Check if thumb is extended away from index finger
            thumb_extended = abs(tip_coords[0][0] - tip_coords[1][0]) > 40

            return all_extended and thumb_extended, tip_coords[2]  # Use middle finger tip as reference
        except (AttributeError, TypeError):
            return False, None

    def print_finger_join_point(self, frame):
        """Detect finger join points and send them via WebSocket."""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                h, w, _ = frame.shape
                fingers_together, join_point = self.fingers_joined(hand_landmarks, h, w)
                # open_palm, erase_point = self.open_palm_detected(hand_landmarks, h, w)
                # thumbs_up, next_point = self.thumbs_up_detected(hand_landmarks, h, w)
                # thumbs_down, prev_point = self.thumbs_down_detected(hand_landmarks, h, w)


                # if open_palm and erase_point:
                #     xval, yval = erase_point
                #     if self.check_inside_polygon(xval, yval):
                #         print(f"Erase gesture detected at: {xval}, {yval}")
                #         self.ws_sender.send_sync(xval, yval, 'erase', self.xdim, self.ydim)
                #         return
                
                # if thumbs_up and next_point:
                #     xval, yval = next_point
                #     if self.check_inside_polygon(xval, yval):
                #         print(f"Next slide gesture detected at: {xval}, {yval}")
                #         self.ws_sender.send_sync(xval, yval, 'next', self.xdim, self.ydim)
                #         return

                # if thumbs_down and prev_point:
                #     xval, yval = prev_point
                #     if self.check_inside_polygon(xval, yval):
                #         print(f"Previous slide gesture detected at: {xval}, {yval}")
                #         self.ws_sender.send_sync(xval, yval, 'previous', self.xdim, self.ydim)
                #         return

                if join_point:
                    xval, yval = join_point
                    message_type = "draw" if fingers_together else "laser"
                    if self.check_inside_polygon(xval, yval):
                        print(f"Finger join detected at: {xval}, {yval}")
                        self.ws_sender.send_sync(xval, yval, message_type, self.xdim, self.ydim, self.top_left_x, self.top_left_y)
                        self.lastLaserCoords = (xval, yval)
                        return

    def thumbs_up_detected(self, hand_landmarks, h, w):
        """Detect if hand is making a thumbs-up gesture."""
        try:
            # Get landmarks for all fingertips and their base joints
            fingers = [
                self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                self.mp_hands.HandLandmark.RING_FINGER_TIP,
                self.mp_hands.HandLandmark.PINKY_TIP
            ]
            
            thumb_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_TIP]
            thumb_ip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_IP]
            wrist = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]
            
            # Check if all fingers are closed (tips below PIP joints)
            all_fingers_closed = True
            for finger in fingers:
                tip_y = hand_landmarks.landmark[finger].y
                pip = hand_landmarks.landmark[finger - 2].y  # PIP joint is 2 points before tip
                if tip_y < pip:  # If tip is above PIP, finger is extended
                    all_fingers_closed = False
                    break
            
            # Check if thumb is extended upward
            thumb_extended = thumb_tip.y < thumb_ip.y
            thumb_pointing_up = thumb_tip.y < wrist.y
            
            return all_fingers_closed and thumb_extended and thumb_pointing_up, (
                int(thumb_tip.x * w),
                int(thumb_tip.y * h)
            )
        except (AttributeError, TypeError):
            return False, None

    def thumbs_down_detected(self, hand_landmarks, h, w):
        """Detect if hand is making a thumbs-down gesture."""
        try:
            # Get landmarks for all fingertips and their base joints
            fingers = [
                self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                self.mp_hands.HandLandmark.RING_FINGER_TIP,
                self.mp_hands.HandLandmark.PINKY_TIP
            ]
            
            thumb_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_TIP]
            thumb_ip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_IP]
            wrist = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]
            
            # Check if all fingers are closed
            all_fingers_closed = True
            for finger in fingers:
                tip_y = hand_landmarks.landmark[finger].y
                pip = hand_landmarks.landmark[finger - 2].y
                if tip_y < pip:
                    all_fingers_closed = False
                    break
            
            # Check if thumb is extended downward
            thumb_extended = thumb_tip.y > thumb_ip.y
            thumb_pointing_down = thumb_tip.y > wrist.y
            
            return all_fingers_closed and thumb_extended and thumb_pointing_down, (
                int(thumb_tip.x * w),
                int(thumb_tip.y * h)
            )
        except (AttributeError, TypeError):
            return False, None

    def start_recognition(self):
        """ Start the video capture loop and process frames. """
        timestamp = 0  # Manually track timestamps

        with self.GestureRecognizer.create_from_options(self.options) as recognizer:
            while self.cap.isOpened():
                ret, frame = self.cap.read()
                if not ret:
                    break

                frame = cv2.flip(frame, 1)

                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                recognizer.recognize_async(mp_image, timestamp)
                timestamp += 1  # Ensure monotonically increasing timestamps

                if self.gesture_result and self.gesture_result != "None":
                    print(self.gesture_result)
                    self.ws_sender.send_sync(10000, 100, self.gesture_result, self.xdim, self.ydim, self.top_left_x, self.top_left_y)
                else:
                    self.print_finger_join_point(frame)


class WebSocketSyncSender:
    def __init__(self, url, from_id, to_id):
        self.url = f"{url}?id={from_id}"
        self.from_id = from_id
        self.to_id = to_id
        self.socket = None

    def send_sync(self, xval, yval, gestval, xdim, ydim, top_leftx, top_lefty):
        """ Send (xval, yval) data synchronously to WebSocket. """
        print(f"Sending message: {xval}, {yval}, {gestval}")
        relative_x = xval - top_leftx
        relative_y = yval - top_lefty

        message = json.dumps({
            'to': self.to_id,
            'from': self.from_id,
            'xval': relative_x,
            'yval': relative_y,
            'gestval': gestval,
            'xdim': xdim,
            'ydim': ydim
        })
        try:
            asyncio.run(self._send_message(message))
        except Exception as e:
            print(f"WebSocket send error: {e}")

    async def _send_message(self, message):
        async with websockets.connect(self.url) as websocket:
            await websocket.send(message)

ws_sender = WebSocketSyncSender('ws://localhost:8080/ws', '1', '2')
reader = GestureReader("rtsp://100.104.52.142:8080/h264_pcm.sdp", ws_sender)
reader.start_recognition()