from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import BlockingOSCUDPServer

def handler(address, *args):
    print(f"\n🎯 Received message:")
    print(f"Address: {address}")
    print(f"Args: {args}")

dispatcher = Dispatcher()
dispatcher.map("/*", handler)

PORT = 8000
server = BlockingOSCUDPServer(("0.0.0.0", PORT), dispatcher)
print(f"\n✅ OSC Server listening on 0.0.0.0:{PORT}")

try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\n⛔ Server stopped") 