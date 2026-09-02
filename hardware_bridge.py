import serial
import requests
import json
import time

# --- CONFIGURATION ---
PORT = "COM3"
BAUD_RATE = 115200
SENSOR_URL = "http://localhost:3000/api/sensor"
STATUS_URL = "http://localhost:3000/api/hardware/status"
COMMAND_URL = "http://localhost:3000/api/hardware/next-command"

# One shared pump + servo serves all of A1-A4. A command must never be sent
# while a previous pulse is still physically running, so we gate the next
# command poll behind a local timer instead of trusting request timing.
PULSE_DURATION_S = 3.0
PULSE_SETTLE_BUFFER_S = 0.6  # servo travel + serial round-trip slack
IDLE_POLL_INTERVAL_S = 1.0

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

def poll_next_command(ser):
    """Ask the backend for the next queued zone command, independent of the
    sensor-push cycle -- only A1 has a real soil probe, so /api/sensor's own
    dispatch-on-report never fires for A2-A4. See dispatchNextPendingCommand
    in app/api/zones/data.ts for the full reasoning."""
    try:
        r = requests.get(COMMAND_URL, timeout=2)
        if r.status_code != 200:
            return time.time() + IDLE_POLL_INTERVAL_S
        data = r.json()
        zone_id = data.get("zoneId")
        command = data.get("command")
        if not zone_id or not command:
            return time.time() + IDLE_POLL_INTERVAL_S
        cmd = str(command).upper()
        print(f"?? SENDING TO ARDUINO -> {cmd}:{zone_id}")
        ser.write(f"{cmd}:{zone_id}\n".encode())
        ser.flush()
        return time.time() + PULSE_DURATION_S + PULSE_SETTLE_BUFFER_S
    except Exception as e:
        print(f"? Command Poll Error: {e}")
        return time.time() + IDLE_POLL_INTERVAL_S

def forward_status(zone_id, nozzle_status, feedback_message):
    try:
        r = requests.post(
            STATUS_URL,
            json={"zoneId": zone_id, "nozzleStatus": nozzle_status, "feedbackMessage": feedback_message},
            timeout=2,
        )
        if r.status_code == 200:
            print(f"? Status forwarded for {zone_id}: {nozzle_status}")
        else:
            print(f"?? Status Forward Error {zone_id}: {r.status_code}")
    except Exception as e:
        print(f"? Status Connection Error: {e}")

ser = None
while ser is None:
    ser = connect_serial()

next_command_check_at = 0.0
line_buffer = ""

print(f"?? Forwarding sensor data to: {SENSOR_URL}")
print(f"?? Polling for hardware commands at: {COMMAND_URL}")
print("Watching for Serial data (Press Ctrl+C to stop)...\n")

while True:
    try:
        if ser.in_waiting > 0:
            raw = ser.read(ser.in_waiting)
            try:
                # A single Serial.println() on the board can arrive split across
                # multiple ser.read() calls on the PC side. Buffer partial lines
                # instead of processing whatever happened to land in one read --
                # otherwise a JSON line split mid-string gets misread as two
                # separate non-JSON debug lines (its { and } end up apart).
                line_buffer += raw.decode("utf-8", errors="ignore")
                *complete_lines, line_buffer = line_buffer.split("\n")
                for sub_line in complete_lines:
                    sub_line = sub_line.strip()
                    if not sub_line: continue

                    if "{" in sub_line and "}" in sub_line:
                        try:
                            start = sub_line.find("{")
                            end = sub_line.rfind("}") + 1
                            json_str = sub_line[start:end]
                            raw_data = json.loads(json_str)
                            print(f"?? USB RAW: {raw_data}")

                            # Pulse/servo feedback is attributed to whichever zone the
                            # rig is currently aimed at (pulseZone), not the soil-probe
                            # zone -- those differ whenever the pump is servicing A2-A4.
                            if "nozzleStatus" in raw_data:
                                pulse_zone = raw_data.get("pulseZone", "A1")
                                forward_status(pulse_zone, raw_data["nozzleStatus"], raw_data.get("feedbackMessage"))

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
                                        r = requests.post(SENSOR_URL, json=payload, timeout=2)
                                        if r.status_code == 200:
                                            print(f"? Forwarded {zone_id} | Moisture: {payload['soilMoisture']}% | Server: OK")
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

        # Independent command-dispatch timer -- fires whether or not a sensor
        # line just came in, and never while a prior pulse is still running.
        if time.time() >= next_command_check_at:
            next_command_check_at = poll_next_command(ser)

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
