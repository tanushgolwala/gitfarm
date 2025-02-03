import cv2
import mediapipe as mp
import numpy as np
from collections import deque
import utils.calibrate
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

calibrate_reference_result, calibrate_reference_image = cap.read()
coords = utils.calibrate.get_whiteboard(calibrate_reference_image) 
print(coords)