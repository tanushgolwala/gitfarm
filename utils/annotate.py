import cv2
import mediapipe as mp
import numpy as np
from collections import deque

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7)
mp_draw = mp.solutions.drawing_utils

# Initialize video capture
capture_url = 'rtsp://100.68.210.10:8080/h264_pcm.sdp'

try:
    cap = cv2.VideoCapture(capture_url)
except:
    cap = cv2.VideoCapture(0)
# Create mask for drawing
drawing_mask = None
prev_point = None

drawing = False
color = (0, 0, 255)  # Red color in BGR
thickness = 4

# Stability buffer
point_buffer = deque(maxlen=3)

def calculate_distance(point1, point2):
    return np.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)

def get_smoothed_point(new_point):
    point_buffer.append(new_point)
    if len(point_buffer) < 2:
        return new_point
    x = int(sum(p[0] for p in point_buffer) / len(point_buffer))
    y = int(sum(p[1] for p in point_buffer) / len(point_buffer))
    return (x, y)

def fingers_joined(hand_landmarks, h, w, threshold=40):
    try:
        index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
        middle_tip = hand_landmarks.landmark[mp_hands.HandLandmark.MIDDLE_FINGER_TIP]

        index_x, index_y = int(index_tip.x * w), int(index_tip.y * h)
        middle_x, middle_y = int(middle_tip.x * w), int(middle_tip.y * h)

        distance = calculate_distance((index_x, index_y), (middle_x, middle_y))
        return distance < threshold, (index_x, index_y)
    except (AttributeError, TypeError):
        return False, None

try:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            continue
            
        frame = cv2.flip(frame, 1)
        
        if drawing_mask is None:
            drawing_mask = np.zeros_like(frame)
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                try:
                    h, w, _ = frame.shape
                    fingers_together, draw_point = fingers_joined(hand_landmarks, h, w)
                    
                    if fingers_together and draw_point:
                        cv2.circle(frame, draw_point, 10, (0, 255, 0), -1)
                        
                        if prev_point is not None and calculate_distance(prev_point, draw_point) < 50:
                            cv2.line(drawing_mask, prev_point, draw_point, color, thickness)
                        prev_point = draw_point
                        drawing = True
                    else:
                        drawing = False
                        prev_point = None
                    
                    # Draw hand landmarks
                    mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                
                except Exception as e:
                    print(f"Error processing hand landmarks: {e}")
                    continue
        
        frame = cv2.addWeighted(drawing_mask, 0.5, frame, 1.0, 0)
        cv2.imshow("Finger Drawing", frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c'):
            drawing_mask = np.zeros_like(frame)

except Exception as e:
    print(f"Main loop error: {e}")

finally:
    hands.close()
    cap.release()
    cv2.destroyAllWindows()
