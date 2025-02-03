import cv2
import numpy as np
import utils.calibrate
from utils.annotate import HandDrawingAnnotator

# Initialize video capture
ip = input()
capture_url = f'rtsp://{ip}:8080/h264_pcm.sdp'
try:
    cap = cv2.VideoCapture(capture_url)
except:
    cap = cv2.VideoCapture(0)

calibrate_reference_result, calibrate_reference_image = cap.read()
coords = utils.calibrate.get_whiteboard(calibrate_reference_image)

# Initialize the annotator
annotator = HandDrawingAnnotator(coords)

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
