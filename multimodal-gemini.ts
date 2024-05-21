// 0. Importing the necessary modules
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/files");
const path = require("path");
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// 1. Function to upload files to Gemini
async function uploadToGemini(filePath: string, mimeType: string) {
    const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: path.basename(filePath),
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

// 2. Function to wait until files are processed and ready
async function waitForFilesActive(...files: any[]) {
    console.log("Waiting for file processing...");
    for (const name of files.map((file) => file.name)) {
        let file = await fileManager.getFile(name);
        while (file.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            file = await fileManager.getFile(name);
        }
        if (file.state !== "ACTIVE") {
            throw Error(`File ${file.name} failed to process`);
        }
    }
    console.log("...all files ready\n");
}

// 3. Configuring the generative model
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    systemInstructions: "You are a helpful assistant.",
});
const generationConfig = {
    temperature: 1,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

async function run() {
    // 4. Upload files to Gemini
    const video1 = await uploadToGemini("./video1.mp4", "video/mp4");
    const audio1 = await uploadToGemini("./audio1.mp3", "audio/mp3");
    const image1 = await uploadToGemini("./image1.jpeg", "image/jpeg");
    const image2 = await uploadToGemini("./image2.jpg", "image/jpeg");

    // 5. Wait for all uploaded files to be processed and ready
    await waitForFilesActive(video1, audio1, image1, image2);

    // 6. Start a chat session with the model using the uploaded files
    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [
                    {
                        // Sending audio1 as part of the user message
                        fileData: {
                            mimeType: audio1.mimeType,
                            fileUri: audio1.uri,
                        },
                    },
                    {
                        // Sending image1 as part of the user message
                        fileData: {
                            mimeType: image1.mimeType,
                            fileUri: image1.uri,
                        },
                    },
                    {
                        fileData: {
                            mimeType: image2.mimeType,
                            fileUri: image2.uri,
                        },
                    },
                    {
                        // Sending video1 as part of the user message
                        fileData: {
                            mimeType: video1.mimeType,
                            fileUri: video1.uri,
                        },
                    },
                ],
            },
        ],
    });

    // 7. Send a message to the chat session and log the response
    const result = await chatSession.sendMessage("Describe in detail the differences between everything i passed in");
    console.log(result.response.usageMetadata);
    console.log(result.response.text());
}

run();