import serial
import requests
import json
import time

# --- CONFIGURATION ---
PORT = "COM5" 
BAUD_RATE = 115200
WEB_URL = "http://localhost:3000/api/sensor"

print("\n" + "="*50)
print("   BHOOMITRA - OFFLINE HARDWARE BRIDGE")
print("="*50)

def connect_serial():
    try:
        ser = serial.Serial(PORT, BAUD_RATE, timeout=0.1)
        ser.setDTR(False)
        ser.setRTS(False)
        time.sleep(0.5)
        ser.setDTR(True)
        ser.setRTS(True)
        print(f"? Successfully connected to {PORT} at {BAUD_RATE} baud")
        return ser
    except Exception as e:
        print(f"? Error: Could not open {PORT}. retrying in 2 seconds...")
        time.sleep(2)
        return None

ser = None
while ser is None:
    ser = connect_serial()

print(f"?? Forwarding data to: {WEB_URL}")
print("Watching for Serial data (Press Ctrl+C to stop)...\n")

while True:
    try:
        if ser.in_waiting > 0:
            raw = ser.read(ser.in_waiting)
            try:
                decoded_text = raw.decode("utf-8", errors="ignore")
                for sub_line in decoded_text.split("\n"):
                    sub_line = sub_line.strip()
                    if not sub_line: continue
                    
                    if "{" in sub_line and "}" in sub_line:
                        try:
                            start = sub_line.find("{")
                            end = sub_line.rfind("}") + 1
                            json_str = sub_line[start:end]
                            raw_data = json.loads(json_str)
                            print(f"?? USB RAW: {raw_data}")
                            
                            incoming_keys = {"zone1": "A1", "zone2": "A2", "zone3": "A3"}

                            for raw_key, zone_id in incoming_keys.items():
                                if raw_key in raw_data:
                                    payload = {
                                        "zoneId": zone_id,
                                        "soilMoisture": raw_data[raw_key],
                                        "temperature": raw_data.get("temperature"),
                                        "humidity": raw_data.get("humidity")
                                    }
                                    try:
                                        r = requests.post(WEB_URL, json=payload, timeout=2)
                                        if r.status_code == 200:
                                            print(f"? Forwarded {zone_id} | Moisture: {payload['soilMoisture']}% | Server: OK")
                                            res_json = r.json()
                                            if res_json.get("command"):
                                                cmd = res_json["command"].upper()
                                                target = res_json.get("targetZone") or zone_id
                                                print(f"?? SENDING TO ARDUINO -> {cmd}:{target}")
                                                ser.write(f"{cmd}:{target}\n".encode())
                                                ser.flush()
                                        else:
                                            print(f"?? Forward Error {zone_id}: {r.status_code}")
                                    except Exception as e:
                                        print(f"? Server Connection Error: {e}")
                        except json.JSONDecodeError:
                            print(f"?? HW Debug: {sub_line}")
                    else:
                        print(f"?? Arduino: {sub_line}")
            except Exception as e:
                print(f"?? Serial Decode Error: {e}")

    except serial.SerialException as e:
        print(f"\n? Connection lost: {e}. Reconnecting...")
        ser = None
        while ser is None: ser = connect_serial()
    except KeyboardInterrupt:
        print("\n?? Bridge stopped by user.")
        break
    except Exception as e:
        print(f"?? Unexpected Loop Error: {e}")
        time.sleep(1)

