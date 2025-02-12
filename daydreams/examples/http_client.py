import requests
import json

def send_prompt(prompt):
    url = "http://localhost:3001/think"  # Using port 3001 (external port)
    data = {"prompt": prompt}
    
    print(f"\n🤔 Sending prompt: {prompt}")
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()  # Raise an error for bad status codes
        
        result = response.json()
        print("\n✨ Result:", json.dumps(result, indent=2))
    except requests.exceptions.RequestException as e:
        print("\n❌ Error:", e)

if __name__ == "__main__":
    prompt = "Generate a voicing for MIDI note 60 in C major"
    send_prompt(prompt) 