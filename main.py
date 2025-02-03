import cv2
import mediapipe as mp
import numpy as np

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7)
mp_draw = mp.solutions.drawing_utils

# Initialize video capture
cap = cv2.VideoCapture(0)

# Create mask for drawing
drawing_mask = None
prev_point = None
drawing = False

# Drawing settings
color = (0, 0, 255)  # Red color in BGR
thickness = 4

while cap.isOpened():
    _, frame = cap.read()
    frame = cv2.flip(frame, 1)  # Mirror the frame
    
    if drawing_mask is None:
        drawing_mask = np.zeros_like(frame)
    
    # Convert BGR image to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process hand landmarks
    results = hands.process(rgb_frame)
    
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Get index finger tip coordinates
            index_finger_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
            h, w, _ = frame.shape
            x, y = int(index_finger_tip.x * w), int(index_finger_tip.y * h)
            
            # Draw circle at index finger tip
            cv2.circle(frame, (x, y), 10, (0, 255, 0), -1)
            
            # Get index finger MCP (knuckle) position for drawing control
            index_finger_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_MCP]
            mcp_y = index_finger_mcp.y * h
            
            # Start drawing if index finger is raised (tip higher than MCP)
            if index_finger_tip.y < index_finger_mcp.y:
                if prev_point is not None and drawing:
                    cv2.line(drawing_mask, prev_point, (x, y), color, thickness)
                prev_point = (x, y)
                drawing = True
            else:
                drawing = False
                prev_point = None
            
            # Draw hand landmarks for visualization
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
    
    # Combine the drawing with the frame
    frame = cv2.addWeighted(drawing_mask, 0.5, frame, 1.0, 0)
    
    # Display instructions
    # cv2.putText(frame, "Raise index finger to draw", (10, 30),
                # cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    # cv2.putText(frame, "Press 'c' to clear, 'q' to quit", (10, 60),
                # cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    # Show the frame
    cv2.imshow("Finger Drawing", frame)
    
    # Handle key presses
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        drawing_mask = np.zeros_like(frame)

# Clean up
hands.close()
cap.release()
cv2.destroyAllWindows()