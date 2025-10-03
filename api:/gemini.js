// This file acts as a secure backend on Vercel's servers.

// All API requests from the frontend will come to this function.
export default async function handler(req, res) {
  // Ensure this is a POST request.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get the secret API key from Vercel's environment variables.
  const API_KEY = process.env.GEMINI_API_KEY;

  // This is a crucial check. If the key is missing, the function will fail.
  if (!API_KEY) {
    // Return a clear error message to the Vercel logs.
    console.error("GEMINI_API_KEY is not configured in Vercel project settings.");
    return res.status(500).json({ error: 'API key is not configured.' });
  }

  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-preview-0527:generateContent?key=" + API_KEY;

  try {
    const { type, payload } = req.body;
    let requestBody;

    // Build the correct request body based on the 'type' from the frontend
    switch (type) {
      case 'filter':
        requestBody = {
          contents: [
            { role: "system", parts: [{ text: "Analyze the user's query to identify relevant product categories and keywords for filtering a product catalog. The possible categories are 'Design Analysis', 'Research & Strategy', and 'Design Generation'. RESPOND ONLY WITH a valid JSON object matching the provided schema. Do not include any other text, explanations, or markdown formatting." }] },
            ...payload.chatHistory,
          ],
          generationConfig: {
            response_mime_type: "application/json",
            response_schema: { type: "OBJECT", properties: { category: { type: "STRING" }, keywords: { type: "ARRAY", items: { type: "STRING" } } } },
          }
        };
        break;

      case 'summarize':
        requestBody = {
          contents: [{ parts: [{ text: `In a single, concise sentence, summarize what this product does: Name: ${payload.product.name}, Description: ${payload.product.description}, Specs: ${payload.product.specs}` }] }]
        };
        break;

      case 'suggest':
        const productList = JSON.stringify(payload.products.map(p => ({id: p.id, name: p.name, description: p.description})));
        requestBody = {
            contents: [{ parts: [{ text: `A user needs help with the following task: "${payload.userInput}". Review this list of available tools: ${productList}. Which one is the absolute best fit for the user's task? Respond with only a valid JSON object containing the ID of the single best product. Example: { "recommendedId": 3 }` }] }],
            generationConfig: {
                response_mime_type: "application/json",
                response_schema: { type: "OBJECT", properties: { recommendedId: { type: "NUMBER" } } }
            }
        };
        break;

      default:
        return res.status(400).json({ error: 'Invalid request type' });
    }

    // Call the Gemini API
    const geminiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error("Gemini API Error:", errorBody);
        throw new Error(`Gemini API Error: ${geminiResponse.statusText}`);
    }

    const data = await geminiResponse.json();
    const aiText = data.candidates[0].content.parts[0].text;

    // Send the processed response back to the frontend
    if (type === 'filter') {
        const aiResponseObject = JSON.parse(aiText);
        const modelChatMessage = `Sure! I'm filtering for products in the '${aiResponseObject.category}' category or related to these keywords: ${aiResponseObject.keywords.join(', ')}. Here are the results.`;
        return res.status(200).json({ aiResponseObject, modelChatMessage });
    }
    if (type === 'summarize') {
        return res.status(200).json({ summary: aiText });
    }
    if (type === 'suggest') {
        const { recommendedId } = JSON.parse(aiText);
        const allProducts = payload.products;
        const recommendedProduct = allProducts.find(p => p.id === recommendedId);
        return res.status(200).json({ recommendedProduct });
    }

  } catch (error) {
    console.error('Function execution error:', error);
    return res.status(500).json({ error: 'An error occurred while processing the AI request.' });
  }
}

