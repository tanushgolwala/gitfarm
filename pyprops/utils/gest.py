import cv2
import numpy as np
import mediapipe as mp

# Initialize MediaPipe Gesture Recognizer
BaseOptions = mp.tasks.BaseOptions
GestureRecognizer = mp.tasks.vision.GestureRecognizer
GestureRecognizerOptions = mp.tasks.vision.GestureRecognizerOptions
GestureRecognizerResult = mp.tasks.vision.GestureRecognizerResult
VisionRunningMode = mp.tasks.vision.RunningMode

# Define callback function to display results
gesture_result = None  # Global variable to store the latest result

def print_result(result: GestureRecognizerResult, output_image: mp.Image, timestamp_ms: int):
    global gesture_result
    if result.gestures:
        gesture_result = result.gestures[0][0].category_name  # Get the top recognized gesture
    else:
        gesture_result = None  # No gesture detected

# Load the gesture recognizer model
options = GestureRecognizerOptions(
    base_options=BaseOptions(model_asset_path=r"E:\Projects\gitframe\utils\gesture_recognizer.task"),  
    running_mode=VisionRunningMode.LIVE_STREAM,
    result_callback=print_result
)

# Open webcam
cap = cv2.VideoCapture(0)

# Initialize the gesture recognizer
with GestureRecognizer.create_from_options(options) as recognizer:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Convert OpenCV frame to MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # Send the image to the recognizer asynchronously
        recognizer.recognize_async(mp_image, int(cap.get(cv2.CAP_PROP_POS_MSEC)))

        # Display recognized gesture on frame
        if gesture_result:
            cv2.putText(frame, f"Gesture: {gesture_result}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Show the video feed
        cv2.imshow('Gesture Recognition', frame)

        # Exit on pressing 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

# Release resources
cap.release()
cv2.destroyAllWindows()
