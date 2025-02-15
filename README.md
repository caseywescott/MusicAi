# MusicAI

Main Agent Here: https://github.com/caseywescott/MusicAi/blob/main/daydreams/examples/music-agent.ts

MIDI Sequencer client found here: 

https://github.com/caseywescott/music-ai-client

Video Demo: https://www.dropbox.com/scl/fi/29c9wje77y1f9jje7v9nl/MusicAi_Demo_.mov?rlkey=4rhmr6tnne4w52uh7xo25gnvp&st=cqggnmby&dl=0

An AI-assisted music composition tool that enables real-time collaboration through blockchain technology. Combines a visual piano roll interface with intelligent music operations and on-chain storage.

Enables music storage and collaboration on Starknet

To see Cairo Contract and Note Events: https://sepolia.voyager.online/account-call/519605_4_2

## Features

- 🎹 Interactive Piano Roll Interface
- 🤖 AI Music Assistant for composition
- ⛓️ Starknet Integration for on-chain storage
- 🎵 Musical operations (transposition, voicings, etc.)
- 🤝 Collaborative composition through shared contracts

## Quick Start

### Prerequisites
- Docker
- Node.js
- Yarn

### Running the Application

1. Start the Docker container:

bash
cd daydreams-docker
docker-compose up

2. In a new terminal, start the client:

/daydreams docker exec -it daydreams_app bash   
bun run examples/music-agent.ts

## Usage

1. Use the piano roll to create/edit notes
2. Select notes and use AI commands:
   - "transpose notes up 2 steps in dorian mode"
   - "write notes to contract"
   - "read notes from contract"
   - "read notes from [contract address]"

## Environment Setup

Create a `.env` file in the root directory:

env
STARKNET_RPC_URL=your_rpc_url
STARKNET_ADDRESS=your_contract_address
STARKNET_PRIVATE_KEY=your_private_key
