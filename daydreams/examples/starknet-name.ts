import { ChainOfThought } from "../packages/core/src/core/chain-of-thought";
import { LLMClient } from "../packages/core/src/core/llm-client";
import { HandlerRole } from "../packages/core/src/core/types";
import { LogLevel } from "../packages/core/src/core/types";
import { StarknetChain } from "../packages/core/src/core/chains/starknet";
import { z } from "zod";
import chalk from "chalk";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ChromaVectorDB } from "../packages/core/src/core/vector-db";
import { ETERNUM_CONTEXT, PROVIDER_GUIDE } from "./eternum-context";
import readline from "readline";

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const memory = {
    search: async () => [],
    storeDocument: async () => "mock-document-id",
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
    updateDocument: async () => {}
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
        title: "Provider Guide",
        content: PROVIDER_GUIDE,
        category: "actions",
        tags: ["actions", "provider-guide"],
        lastUpdated: new Date(),
    });
    // Initialize Chain of Thought
    const dreams = new ChainOfThought(
        llmClient,
        memory, // No memory for now
        {
            worldState: `You are an AI assistant that helps users interact with Starknet smart contracts.
            When users ask about contract names or details, use the STARKNET_NAME action to fetch the information.
            
            Available actions:
            - RESPONSE: For general responses
            - STARKNET_NAME: For fetching contract names`
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
            console.log(chalk.green(data.payload.message));
            return {
                content: data.payload.message
            };
        },
        outputSchema: z.object({
            message: z.string()
        })
    });

    dreams.registerOutput({
        name: "STARKNET_NAME",
        role: HandlerRole.ACTION,
        execute: async (): Promise<StarknetResponse> => {
            try {
                const result = await starknet.read({
                    contractAddress: "0x029c4a89d43d618d62d0b0aab56ac0f0f5124b692ee2c0428eee29d0e0e97ff2",
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
        })
    });

    // Create readline interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Start interactive loop
    console.log(chalk.cyan("🤖 What would you like me to do? (type 'exit' to quit):"));
    
    rl.on('line', async (line) => {
        if (line.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        console.log(chalk.yellow("🎯 Processing your request..."));
        
        try {
            const result = await dreams.think(line);
            console.log("\n🤖 What would you like me to do? (type 'exit' to quit):");
        } catch (error) {
            console.error(chalk.red("Error:"), error);
            console.log("\n🤖 What would you like me to do? (type 'exit' to quit):");
        }
    });
}

main().catch((error) => {
    console.error(chalk.red("Fatal error:"), error);
    process.exit(1);
});
