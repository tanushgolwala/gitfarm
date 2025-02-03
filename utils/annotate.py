import cv2
import mediapipe as mp
import numpy as np
from collections import deque

class HandDrawingAnnotator:
    def __init__(self):
        # Initialize MediaPipe Hands
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

    def process_frame(self, frame):
        """
        Process a single frame and return the annotated result
        """
        if self.drawing_mask is None:
            self.drawing_mask = np.zeros_like(frame)
            
        # Convert frame to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                try:
                    h, w, _ = frame.shape
                    fingers_together, draw_point = self.fingers_joined(hand_landmarks, h, w)
                    
                    if fingers_together and draw_point:
                        cv2.circle(frame, draw_point, 10, (0, 255, 0), -1)
                        
                        if self.prev_point is not None and self.calculate_distance(self.prev_point, draw_point) < 50:
                            cv2.line(self.drawing_mask, self.prev_point, draw_point, self.color, self.thickness)
                        self.prev_point = draw_point
                        self.drawing = True
                    else:
                        self.drawing = False
                        self.prev_point = None
                    
                    # Draw hand landmarks
                    self.mp_draw.draw_landmarks(frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)
                
                except Exception as e:
                    print(f"Error processing hand landmarks: {e}")
                    continue
        
        # Combine the drawing mask with the frame
        frame = cv2.addWeighted(self.drawing_mask, 0.5, frame, 1.0, 0)
        return frame

    def clear_drawing(self):
        """Clear the drawing mask"""
        if self.drawing_mask is not None:
            self.drawing_mask = np.zeros_like(self.drawing_mask)

    def cleanup(self):
        """Clean up resources"""
        self.hands.close()

# Example usage:
def main():
    # Initialize video capture
    capture_url = 'rtsp://100.68.210.10:8080/h264_pcm.sdp'
    try:
        cap = cv2.VideoCapture(capture_url)
    except:
        cap = cv2.VideoCapture(0)

    # Initialize the annotator
    annotator = HandDrawingAnnotator()

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                continue
                
            frame = cv2.flip(frame, 1)
            
            # Process the frame
            annotated_frame = annotator.process_frame(frame)
            
            # Display the result
            cv2.imshow("Finger Drawing", annotated_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('c'):
                annotator.clear_drawing()

    except Exception as e:
        print(f"Main loop error: {e}")

    finally:
        annotator.cleanup()
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()