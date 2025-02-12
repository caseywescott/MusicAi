from pythonosc.udp_client import SimpleUDPClient
import time

PORT = 8000
print("🚀 Creating OSC client...")
client = SimpleUDPClient("127.0.0.1", PORT)

print("📤 Sending think command...")
prompt = "Generate a voicing for MIDI note 60 in C major"
print(f"\nSending to /think: {prompt}")
client.send_message("/think", prompt)
time.sleep(0.5)

print("\n✅ Done sending message!")