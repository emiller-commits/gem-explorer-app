// Vercel Serverless Function to securely call the Gemini API
// This file should be placed in the `/api` directory of your project.

export default async function handler(request, response) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return response.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const { action, payload } = request.body;
    let requestBody;
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-preview-0527:generateContent?key=${geminiApiKey}`;

    // Determine the correct request body based on the action from the client
    switch (action) {
      case 'filter':
        requestBody = {
          contents: [
            payload.systemInstruction,
            ...payload.chatHistory,
            { role: 'user', parts: [{ text: payload.userMessage }] }
          ],
          generationConfig: {
            response_mime_type: "application/json",
            response_schema: payload.responseSchema,
          }
        };
        break;
      
      case 'summarize':
      case 'suggest':
        requestBody = {
          contents: [{ parts: [{ text: payload.prompt }] }]
        };
        break;

      default:
        return response.status(400).json({ error: 'Invalid action specified.' });
    }

    // Call the Gemini API
    const apiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API request failed with status ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    
    // Send the successful response back to the client
    response.status(200).json(data);

  } catch (error) {
    console.error('Error in Vercel function:', error);
    response.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
}
