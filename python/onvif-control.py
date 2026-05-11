from onvif import ONVIFCamera
import time

# --- 카메라 접속 정보 설정 ---
CAMERA_IP = '27.35.108.50'
CAMERA_PORT = 8080            
USER = 'admin'
PASSWORD = 'cdp2-cam-small'
# --- 실제로는 백엔드에서 조합해서 보내야 함

def check_ptz_support(mycam: ONVIFCamera):
    try:
        capabilities = mycam.devicemgmt.GetCapabilities({'Category': 'All'})
        if hasattr(capabilities, 'PTZ') and capabilities.PTZ is not None:
            # print(f"PTZ Endpoint Address: {capabilities.PTZ.XAddr}")
            return True
        else:
            # print("This camera does not support PTZ...")
            return False
    except AttributeError as e:
        print(f"Attribute Lookup Error: {e}")
    except Exception as e:
        print(f"Unexpected Exception: {e}")
    

def ptz_control_right(profile_token, ptz_service, speed):
    ## 1. Right-side rotation
    try:     
        request = ptz_service.create_type('ContinuousMove')
        request.ProfileToken = profile_token

        print("Camera is rotated to right-side... ", end='')
        request.Velocity = {
            'PanTilt': {'x': speed, 'y': 0.0},
            'Zoom': {'x': 0.0}
        }
        ptz_service.ContinuousMove(request)
        time.sleep(1) # Rotate during 1 sec.
        print("Stop.")
        ptz_service.Stop({'ProfileToken': profile_token})
        time.sleep(1)

    except Exception as e:
        print(f"Unexpected Exception: {e}")

def ptz_control_left(profile_token, ptz_service, speed):
    ## 1. Right-side rotation
    try:     
        request = ptz_service.create_type('ContinuousMove')
        request.ProfileToken = profile_token

        print("Camera is rotated to left-side... ", end='')
        request.Velocity = {
            'PanTilt': {'x': -speed, 'y': 0.0},
            'Zoom': {'x': 0.0}
        }
        ptz_service.ContinuousMove(request)
        time.sleep(1) # Rotate during 1 sec.
        print("Stop.")
        ptz_service.Stop({'ProfileToken': profile_token})
        time.sleep(1)

    except Exception as e:
        print(f"Unexpected Exception: {e}")

def ptz_control_up(profile_token, ptz_service, speed):
    try:
        request = ptz_service.create_type('ContinuousMove')
        request.ProfileToken = profile_token

        print("Camera is rotated to top... ", end='')
        request.Velocity = {
            'PanTilt': {'x': 0.0, 'y': speed},
            'Zoom': {'x': 0.0}
        }
        ptz_service.ContinuousMove(request)
        time.sleep(1) 
        print("Stop.")
        ptz_service.Stop({'ProfileToken': profile_token})
        time.sleep(1)

    except Exception as e:
        print(f"Unexpected Exception: {e}")

def ptz_control_down(profile_token, ptz_service, speed):
    try:
        request = ptz_service.create_type('ContinuousMove')
        request.ProfileToken = profile_token

        print("Camera is rotated to oown... ", end='')
        request.Velocity = {
            'PanTilt': {'x': 0.0, 'y': -speed},
            'Zoom': {'x': 0.0}
        }
        ptz_service.ContinuousMove(request)
        time.sleep(1) 
        print("Stop.")
        ptz_service.Stop({'ProfileToken': profile_token})
        time.sleep(1)

    except Exception as e:
        print(f"Unexpected Exception: {e}")

if __name__ == '__main__':
    mycam = ONVIFCamera(CAMERA_IP, CAMERA_PORT, USER, PASSWORD)
    if (check_ptz_support(mycam=mycam) == False):
        print("This camera does not support PTZ.")
        exit(1)

    media_service = mycam.create_media_service()
    ptz_service = mycam.create_ptz_service()
    profiles = media_service.GetProfiles()

    if not profiles:
        print("Error: Media Profile does not found.")
        exit(1)

    media_profile = profiles[0]
    profile_token = media_profile.token
    if not profiles:
        print("Error: Media Profile does not found.")
        exit(1)

    # Speed: 이동 속도
    # 각 함수 내부에서, ContinuousMove 실행 후 time.sleep() 지정된 시간만큼 계속 움직임
    # 명시적으로 stop 하지 않으면 끝까지 회전 -> 실제 구현에서는 프론트에서 클릭 Release 감지 필요 (클릭 풀면 정지)

    ptz_control_right(profile_token=profile_token, ptz_service=ptz_service, speed=0.5)
    ptz_control_left(profile_token=profile_token, ptz_service=ptz_service, speed=0.5)
    ptz_control_up(profile_token=profile_token, ptz_service=ptz_service, speed=0.5)
    ptz_control_down(profile_token=profile_token, ptz_service=ptz_service, speed=0.5)