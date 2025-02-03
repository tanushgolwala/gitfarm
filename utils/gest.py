import cv2
import numpy as np
import mediapipe as mp

# Import necessary modules from MediaPipe
BaseOptions = mp.tasks.BaseOptions
GestureRecognizer = mp.tasks.vision.GestureRecognizer
GestureRecognizerOptions = mp.tasks.vision.GestureRecognizerOptions
GestureRecognizerResult = mp.tasks.vision.GestureRecognizerResult
VisionRunningMode = mp.tasks.vision.RunningMode

# Callback function to handle gesture recognition results
def print_result(result: GestureRecognizerResult, output_image: mp.Image, timestamp_ms: int):
    if result.gestures:
        recognized_gesture = result.gestures[0][0].category_name  # Get the top recognized gesture
        print(f'Gesture recognized: {recognized_gesture}')
        return recognized_gesture
    return None

# Initialize video capture
cap = cv2.VideoCapture(0)

# Load the gesture recognizer model
options = GestureRecognizerOptions(
    base_options=BaseOptions(model_asset_path='gesture_recognizer.task'),  # Update with the correct model path
    running_mode=VisionRunningMode.LIVE_STREAM,
    result_callback=print_result
)

with GestureRecognizer.create_from_options(options) as recognizer:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            break
        
        # Convert OpenCV frame to MediaPipe image
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        # Get current timestamp
        frame_timestamp_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
        
        # Perform gesture recognition
        recognized_gesture = recognizer.recognize_async(mp_image, frame_timestamp_ms)
        
        # Display the recognized gesture
        if recognized_gesture:
            cv2.putText(frame, recognized_gesture, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        cv2.imshow('Gesture Recognition', frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()