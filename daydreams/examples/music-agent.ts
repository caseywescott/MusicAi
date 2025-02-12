import chalk from "chalk";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { ChainOfThought } from "../packages/core/src/core/chain-of-thought";
import { StarknetChain } from "../packages/core/src/core/chains/starknet";
import { LLMClient } from "../packages/core/src/core/llm-client";
import { HandlerRole, LogLevel } from "../packages/core/src/core/types";
//import { ETERNUM_CONTEXT, PROVIDER_GUIDE } from "./eternum-context";
import { MUSIC_PROVIDER_GUIDE } from "./music-context";

import cors from "cors";
import express from "express";

// Import PitchClass from koji.js
import {
    PitchClass,
    bjorklund,
    generateVoicingArray,
    generateVoicingFromIntervals,
    get_notes_of_key,
    modes,
    modalTransposeNotes,
} from "../packages/music/src/koji";

// Import Server from node-osc

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const memory = {
    search: async () => [],
    storeDocument: async (doc: any) => "mock-document-id",
    purge: async () => {},
    findSimilar: async () => [],
    store: async () => {},
    delete: async () => {},
    storeInConversation: async () => {},
    findSimilarEpisodes: async () => [],
    findSimilarDocuments: async () => [],
    findRelevantDocuments: async () => [],
    storeEpisode: async () => "mock-episode-id",
    deleteAll: async () => {},
    deleteCollection: async () => {},
    findSimilarInConversation: async () => [],
    storeSystemMetadata: async () => {},
    getSystemMetadata: async () => ({}),
    getRecentEpisodes: async () => [],
    getConversationContext: async () => [],
    getExperienceCount: async () => 0,
    searchDocumentsByTag: async () => [],
    updateDocument: async () => {},
};

// Helper function to decode hex string to ASCII
function decodeHexString(hex: string): string {
    hex = hex.replace("0x", "");
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
    }
    return str;
}

type StarknetResponse = {
    success: boolean;
    raw: string[];
    decoded: string;
    error?: string;
};

interface Document {
    id: string;
    content: string;
    title: string;
    category: string;
    tags: string[];
    lastUpdated: Date;
}

interface Experience {
    action: string;
    timestamp: string;
    outcome: any;
}

let lastResponse = '';

async function main() {
    // Initialize LLM client
    const llmClient = new LLMClient({
        model: "anthropic/claude-3-5-sonnet-latest",
        temperature: 0.3,
    });

    // Initialize Starknet client
    const starknet = new StarknetChain({
        rpcUrl: process.env.STARKNET_RPC_URL!,
        address: process.env.STARKNET_ADDRESS!,
        privateKey: process.env.STARKNET_PRIVATE_KEY!,
    });

    await memory.storeDocument({
        title: "Music Provider Guide",
        content: MUSIC_PROVIDER_GUIDE,
        category: "actions",
        tags: ["actions", "provider-guide"],
        lastUpdated: new Date(),
    });
    // Initialize Chain of Thought
    const dreams = new ChainOfThought(
        llmClient,
        memory,
        {
            worldState: `You are an AI music assistant that helps users with musical operations.
            
            Available actions:
            - RESPONSE: For general responses
            - TRANSPOSE_NOTE: For transposing notes in a mode (use when asked to transpose notes)
            - TRANSPOSE_NOTES: For transposing multiple notes in a mode (use when asked to transpose multiple notes)
            - GENERATE_VOICING: For generating chord voicings (use when asked to generate voicings or chords)
            - GENERATE_RHYTHM: For creating rhythmic patterns (use when asked about rhythms)
            - GET_SCALE_NOTES: For getting notes in a scale/mode (use when asked about scales)
            - SEND_TO_STARKNET: For sending note data to the Starknet contract (use when asked to send notes to blockchain)
            - WRITE_NOTES: For writing notes to the Starknet event contract (use when asked to write notes to blockchain)
            - READ_NOTES: For reading notes from the Starknet contract (use when asked to read notes from blockchain)
            - READ_ADDRESS: For reading notes from a specific Starknet contract address (use when asked to read notes from a specific address)
            
            When asked to "generate a voicing", always use the GENERATE_VOICING action.`,
        },
        {
            logLevel: LogLevel.DEBUG,
        }
    );

    // Register handlers
    dreams.registerOutput({
        name: "RESPONSE",
        role: HandlerRole.OUTPUT,
        execute: async (data: any) => {
            const message = data.payload.message;
            console.log(chalk.green(message));
            lastResponse = message;
            return {
                content: message,
            };
        },
        outputSchema: z.object({
            message: z.string(),
        }),
    });

    // Add this right after your other handler registrations
    let sendToStarknetHandler: any;

    dreams.registerOutput({
        name: "SEND_TO_STARKNET",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            sendToStarknetHandler = data.execute;
            try {
                const notes = data.payload.notes;
                
                // Prepare arrays for contract
                const noteArray = notes.map(n => n.pitch);
                const startTimeArray = notes.map(n => n.x);
                const velocityArray = notes.map(n => n.velocity);
                const durationArray = notes.map(n => n.width);

                const result = await starknet.write({
                    contractAddress: "0x037faf946c80126a20e63d2a33c46d0669ab2a016ba598be8f3ade71af1cad51",
                    entrypoint: "increase_balance",
                    calldata: [noteArray, startTimeArray, velocityArray, durationArray]
                });

                return {
                    success: true,
                    transaction: result,
                    notes: notes
                };
            } catch (error) {
                console.error('Starknet error:', error);
                return {
                    success: false,
                    error: String(error)
                };
            }
        },
        outputSchema: z.object({
            success: z.boolean(),
            transaction: z.any().optional(),
            notes: z.array(z.object({
                pitch: z.number(),
                x: z.number(),
                width: z.number(),
                velocity: z.number()
            })).optional(),
            error: z.string().optional()
        })
    });

    dreams.registerOutput({
        name: "STARKNET_NAME",
        role: HandlerRole.ACTION,
        execute: async (): Promise<StarknetResponse> => {
            try {
                const result = await starknet.read({
                    contractAddress:
                        "0x029c4a89d43d618d62d0b0aab56ac0f0f5124b692ee2c0428eee29d0e0e97ff2",
                    entrypoint: "name",
                    calldata: [],
                });

                const decodedName = decodeHexString(result[1]);
                return {
                    success: true,
                    raw: result,
                    decoded: decodedName,
                };
            } catch (error) {
                return {
                    success: false,
                    raw: [],
                    decoded: "",
                    error: String(error),
                };
            }
        },
        outputSchema: z.object({
            success: z.boolean(),
            raw: z.array(z.string()).optional(),
            decoded: z.string().optional(),
            error: z.string().optional(),
        }),
    });

    // Register a handler for note manipulation
    dreams.registerOutput({
        name: "PROCESS_NOTES",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            // Extract the notes array from LLM response
            const notes = data.payload.notes;

            // Manipulate each note (e.g., transpose up by 2)
            const processedNotes = notes.map((note) => note + 2);

            return {
                original: notes,
                processed: processedNotes,
            };
        },
        outputSchema: z.object({
            notes: z.array(z.number()),
        }),
    });

    // Register a transposition handler
    dreams.registerOutput({
        name: "TRANSPOSE_NOTE",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            const note = data.payload.note;     // MIDI note to transpose
            const steps = data.payload.steps;   // Number of steps to transpose
            const modeName = data.payload.mode; // Name of the mode (e.g., "dorian")
            const tonic = data.payload.tonic;   // MIDI note number for tonic

            // Get mode intervals from modes object
            const modeIntervals = modes[modeName.toLowerCase()] || modes.major;

            const pc = new PitchClass(note % 12, Math.floor(note / 12));
            const tonicPC = new PitchClass(tonic % 12, Math.floor(tonic / 12));
            const transposed = pc.modalTransposition(steps, tonicPC, modeIntervals);

            const result = {
                original: note,
                transposed: transposed.pcToKeynum(),
                steps: steps,
                tonic: tonic,
                mode: modeName,
                intervals: modeIntervals
            };

            lastResponse = `TRANSPOSE_NOTE completed successfully:\n${JSON.stringify(result, null, 2)}`;
            return result;
        },
        outputSchema: z.object({
            note: z.number(),
            steps: z.number(),
            mode: z.string(),
            tonic: z.number(),
        }),
    });

    // Register Voicing generation handler
    dreams.registerOutput({
        name: "GENERATE_VOICING",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            const root = data.payload.root;
            const mode = [2, 2, 1, 2, 2, 2, 1]; // Major mode intervals
            const tonic = data.payload.tonic;

            const pc = new PitchClass(root % 12, Math.floor(root / 12));
            const tonicPC = new PitchClass(tonic % 12, Math.floor(tonic / 12));
            const voicing = generateVoicingArray();
            const notes = generateVoicingFromIntervals(pc, tonicPC, mode, voicing);

            const result = {
                root: root,
                voicing: voicing,
                notes: notes
            };
            
            lastResponse = `GENERATE_VOICING completed successfully:\n${JSON.stringify(result, null, 2)}`;
            return result;
        },
        outputSchema: z.object({
            root: z.number(),
            scale: z.array(z.number()).optional(),
            tonic: z.number(),
        }),
    });

    // Rhythm generation handler
    dreams.registerOutput({
        name: "GENERATE_RHYTHM",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            const steps = data.payload.steps; // Total steps
            const pulses = data.payload.pulses; // Number of active beats

            return {
                pattern: bjorklund(steps, pulses),
            };
        },
    });

    // Scale/mode analysis handler
    dreams.registerOutput({
        name: "GET_SCALE_NOTES",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            const tonic = data.payload.tonic;
            const mode = data.payload.mode;

            const tonicPC = new PitchClass(tonic % 12, Math.floor(tonic / 12));
            return {
                notes: get_notes_of_key(tonicPC, mode),
            };
        },
    });

    // Register a transposition handler for multiple notes
    dreams.registerOutput({
        name: "TRANSPOSE_NOTES",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            const notes = data.payload.notes;
            const steps = data.payload.steps;
            const tonic = data.payload.tonic;
            const modeName = data.payload.mode;

            // Get mode intervals
            const modeIntervals = modes[modeName.toLowerCase()] || modes.major;
            const tonicPC = new PitchClass(tonic % 12, Math.floor(tonic / 12));

            // Only transpose the pitch values
            const transposedPitches = modalTransposeNotes(
                notes.map(n => n.pitch), 
                steps, 
                tonicPC,  // Pass PitchClass instance
                modeIntervals
            );

            console.log('Original pitches:', notes.map(n => n.pitch));
            console.log('Transposed pitches:', transposedPitches);

            // Combine transposed pitches with original timing data
            const transposedNotes = notes.map((note, i) => ({
                pitch: transposedPitches[i],
                x: note.x,
                width: note.width,
                velocity: note.velocity
            }));
            
            const result = {
                original: notes,
                transposed: transposedNotes,
                steps: steps,
                tonic: tonic,
                mode: modeName,
                intervals: modeIntervals
            };

            lastResponse = `TRANSPOSE_NOTES completed successfully:\n${JSON.stringify(result, null, 2)}`;
            return result;
        },
        outputSchema: z.object({
            notes: z.array(z.object({
                pitch: z.number(),
                x: z.number(),
                width: z.number(),
                velocity: z.number()
            })),
            steps: z.number(),
            tonic: z.number(),
            mode: z.string(),
        }),
    });

    dreams.registerOutput({
        name: "WRITE_NOTES",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            try {
                const notes = data.payload.notes;
                
                // Prepare arrays for contract
                const noteArray = notes.map(n => n.pitch);
                const startTimeArray = notes.map(n => n.x);
                const velocityArray = notes.map(n => n.velocity);
                const durationArray = notes.map(n => n.width);
                const count = notes.length;

                const result = await starknet.write({
                    contractAddress: "0x0463558505962ced528ce51283601ea197782627c58c9ad3342c059c19b97dd6",
                    entrypoint: "write",
                    calldata: [noteArray, startTimeArray, velocityArray, durationArray, count]
                });

                return {
                    success: true,
                    transaction: result,
                    notes: notes
                };
            } catch (error) {
                console.error('Starknet error:', error);
                return {
                    success: false,
                    error: String(error)
                };
            }
        },
        outputSchema: z.object({
            success: z.boolean(),
            transaction: z.any().optional(),
            notes: z.array(z.object({
                pitch: z.number(),
                x: z.number(),
                width: z.number(),
                velocity: z.number()
            })).optional(),
            error: z.string().optional()
        })
    });

    dreams.registerOutput({
        name: "READ_NOTES",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            try {
                console.log("Executing READ_NOTES action");
                const result = await starknet.read({
                    contractAddress: "0x0463558505962ced528ce51283601ea197782627c58c9ad3342c059c19b97dd6",
                    entrypoint: "read"
                });

                console.log("Raw Starknet result:", result);
                
                // Convert hex strings to numbers
                const numbers = result.map(hex => Number(hex));
                console.log("Converted numbers:", numbers);
                
                // First value is count of notes
                const count = numbers[0];
                
                // Process all notes based on count
                const notes: Array<{
                    pitch: number;
                    x: number;
                    velocity: number;
                    width: number;
                }> = [];
                
                for (let i = 0; i < count; i++) {
                    const pitchIndex = i + 1;
                    const xIndex = i + count + 2;
                    const velocityIndex = i + 2*count + 3;
                    const widthIndex = i + 3*count + 4;
                    
                    console.log(`Note ${i} indices:`, {
                        pitchIndex,
                        xIndex,
                        velocityIndex,
                        widthIndex,
                        values: {
                            pitch: result[pitchIndex],
                            x: result[xIndex],
                            velocity: result[velocityIndex],
                            width: result[widthIndex]
                        }
                    });
                    
                    notes.push({
                        pitch: Number(result[pitchIndex]),
                        x: Number(result[xIndex]),
                        velocity: Number(result[velocityIndex]),
                        width: Number(result[widthIndex])
                    });
                }

                console.log("All constructed note objects:", notes);

                const response = {
                    success: true,
                    notes: notes,
                    count: count
                };

                lastResponse = `READ_NOTES completed successfully:\n${JSON.stringify(response, null, 2)}`;
                return response;

            } catch (error) {
                console.error('Starknet read error:', error);
                return {
                    success: false,
                    error: String(error)
                };
            }
        },
        outputSchema: z.object({
            success: z.boolean(),
            notes: z.array(z.object({
                pitch: z.number(),
                x: z.number(),
                width: z.number(),
                velocity: z.number()
            })),
            count: z.number()
        })
    });

    dreams.registerOutput({
        name: "READ_ADDRESS",
        role: HandlerRole.ACTION,
        execute: async (data: any) => {
            try {
                console.log("Executing READ_ADDRESS action");
                const result = await starknet.read({
                    contractAddress: data.payload.address,
                    entrypoint: "read"
                });

                console.log("Raw Starknet result:", result);
                
                // Convert hex strings to numbers
                const numbers = result.map(hex => Number(hex));
                console.log("Converted numbers:", numbers);
                
                // First value is count
                const count = numbers[0];
                
                const notes: Array<{
                    pitch: number;
                    x: number;
                    velocity: number;
                    width: number;
                }> = [];
                
                for (let i = 0; i < count; i++) {
                    const pitchIndex = i + 1;
                    const xIndex = i + count + 2;
                    const velocityIndex = i + 2*count + 3;
                    const widthIndex = i + 3*count + 4;
                    
                    console.log(`Note ${i} indices:`, {
                        pitchIndex,
                        xIndex,
                        velocityIndex,
                        widthIndex,
                        values: {
                            pitch: result[pitchIndex],
                            x: result[xIndex],
                            velocity: result[velocityIndex],
                            width: result[widthIndex]
                        }
                    });
                    
                    notes.push({
                        pitch: Number(result[pitchIndex]),
                        x: Number(result[xIndex]),
                        velocity: Number(result[velocityIndex]),
                        width: Number(result[widthIndex])
                    });
                }

                const response = {
                    success: true,
                    notes: notes,
                    count: count
                };

                lastResponse = `READ_ADDRESS completed successfully:\n${JSON.stringify(response, null, 2)}`;
                return response;

            } catch (error) {
                console.error('Starknet read error:', error);
                return {
                    success: false,
                    error: String(error)
                };
            }
        },
        outputSchema: z.object({
            address: z.string(),
        })
    });

    // Create Express server
    const app = express();

    // Enable CORS for all routes
    app.use(
        cors({
            origin: "http://localhost:3000",
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Accept"],
        })
    );

    app.use(express.json());

    // Add error handling middleware
    app.use(
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            console.error("Error:", err);
            res.status(500).send("Something broke!");
        }
    );

    // Add request logging
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });

    app.get("/", (req, res) => {
        try {
            console.log("Root endpoint hit");
            res.send("Hello World!");
        } catch (error) {
            console.error("Error in root endpoint:", error);
            res.status(500).send("Error in root endpoint");
        }
    });

    app.get("/test", (req, res) => {
        console.log("Test endpoint hit!");
        res.send("Test endpoint works!");
    });

    // Think endpoint
    app.post('/think', async (req, res) => {
        try {
            const { prompt } = req.body;
            await dreams.think(prompt);
            
            // Wait a moment for the experience to be stored
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the latest stored experience
            const experiences = await memory.getRecentEpisodes() as Experience[];
            const lastExperience = experiences[0];
            
            console.log('\n📝 Experience:', lastExperience);
            
            if (lastExperience?.action?.includes('GENERATE_VOICING')) {
                try {
                    // Extract the JSON part after "GENERATE_VOICING RESULT: "
                    const jsonPart = lastExperience.action.split('RESULT: ')[1];
                    console.log('\n📦 JSON Part:', jsonPart);
                    
                    // Remove the quotes around the JSON string
                    const cleanJson = jsonPart.replace(/^"|"$/g, '');
                    console.log('\n🧹 Clean JSON:', cleanJson);
                    
                    const match = cleanJson.match(/\{[^]*\}/);
                    if (match) {
                        const voicingData = JSON.parse(match[0]);
                        console.log('\n🎹 Parsed notes:', voicingData.notes);
                        
                        res.json({ 
                            result: { 
                                type: 'GENERATE_VOICING',
                                content: lastExperience.action,
                                notes: voicingData.notes
                            } 
                        });
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing voicing data:', e);
                }
            }
            
            res.json({ 
                result: { 
                    type: 'RESPONSE',
                    content: lastResponse || 'No response generated'
                } 
            });
            
        } catch (error) {
            console.error('\n❌ Error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Add the notes endpoint right before the server start
    app.post('/notes', async (req, res) => {
        try {
            const note = req.body;
            console.log('Received note from indexer:', note);

            // Convert indexer format to your note format
            const noteEvent = {
                pitch: note.data.pitch,
                x: note.data.x,
                width: note.data.width,
                velocity: note.data.velocity
            };

            // Use the existing SEND_TO_STARKNET handler format since your client already understands it
            await sendToStarknetHandler({
                payload: {
                    notes: [noteEvent]
                }
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error processing note:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Start server
    const PORT = 3000; // Use 3000 internally (maps to 3001 externally)
    console.log(`Starting server on port ${PORT}...`);
    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running internally on port ${PORT}`);
        console.log(`Access externally on port 3001`);
    });

    // Handle server errors
    server.on("error", (error) => {
        console.error("Server error:", error);
    });

    // Handle process termination
    process.on("SIGTERM", () => {
        console.log("SIGTERM received. Shutting down gracefully...");
        server.close(() => {
            console.log("Server closed");
            process.exit(0);
        });
    });
}

main().catch(console.error);
