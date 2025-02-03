import cv2
import numpy as np
from collections import deque
import mediapipe as mp

class GestureReader:
    def __init__(self, ip):
        try:
            self.cap = cv2.VideoCapture(ip)
        except:
            self.cap = cv2.VideoCapture(0)

        ret, frame = self.cap.read()  # Unpack correctly
        if not ret:
            print("Failed to capture image from camera.")
            return

        self.coords = []
        self.get_whiteboard(frame)  # Pass only the frame
        print(self.coords)

    def init_mediapipe(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7)
        self.mp_draw = mp.solutions.drawing_utils
        
        # Drawing properties
        self.drawing_mask = None
        self.prev_point = None
        self.drawing = False
        self.color = (0, 0, 255)  # Red color in BGR
        self.thickness = 4
        
        # Stability buffer
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
    
    def check_inside_polygon(self,x,y,):
        polygon = np.array(self.coords,np.int32)
        result = cv2.pointPolygonTest(polygon, (x,y), False)
        if result < 0:
            return False
        return True

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
        print(type(image), image.shape)  # Debugging info
        cv2.imshow("image", image)
        self.tempimg = image.copy()  # Ensure you modify a copy
        cv2.setMouseCallback("image", self.click_event)  # Use self.click_event
        cv2.waitKey(0)
        cv2.destroyAllWindows()

    def print_finger_join_point(self, frame):
        """
        Prints the coordinates of the point where index and middle fingers join
        """
        # Convert frame to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                try:
                    h, w, _ = frame.shape
                    fingers_together, join_point = self.fingers_joined(hand_landmarks, h, w)
                    
                    if fingers_together and join_point:

                        #do something with the coords 
                        if self.check_inside_polygon(join_point[0],join_point[1]):
                            print(f"Finger join point coordinates: {join_point}")
                
                except Exception as e:
                    print(f"Error detecting finger join point: {e}")


    def start_recognition(self):
        self.init_mediapipe()
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            self.print_finger_join_point(frame)

        pass


reader = GestureReader("rtsp://192.0.0.4:8080/h264_pcm.sdp")
reader.start_recognition()
