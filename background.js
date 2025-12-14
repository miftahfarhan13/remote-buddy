// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    console.log("Translation requested:", request.text);
    handleTranslation(request.text, sendResponse);
    return true; // Will respond asynchronously
  }
});

async function handleTranslation(text, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get([
      "service",
      "apiKey",
      "sourceLang",
      "targetLang",
    ]);
    const service = settings.service || "mock";
    const targetLang = settings.targetLang || "id"; // Default to Indonesian
    const sourceLang = settings.sourceLang || "en"; // Default to English if not set
    const apiKey = settings.apiKey || "";

    console.log(
      `Using service: ${service}, Source: ${sourceLang}, Target: ${targetLang}, hasKey: ${!!apiKey}`
    );

    let translatedText = "";

    if (service === "mock") {
      translatedText = `[Mock from ${sourceLang}/${targetLang}] ${text}`;
    } else if (service === "maia") {
      translatedText = await translateWithMaia(
        text,
        sourceLang,
        targetLang,
        apiKey
      );
    } else if (service === "gemini") {
      translatedText = await translateWithGemini(
        text,
        sourceLang,
        targetLang,
        apiKey
      );
    } else if (service === "openai") {
      translatedText = await translateWithOpenAI(
        text,
        sourceLang,
        targetLang,
        apiKey
      );
    } else if (service === "deepl") {
      // DeepL doesn't support the smart prompt logic easily, defaulting to target
      translatedText = await translateWithDeepL(text, targetLang, apiKey);
    }

    console.log("Translation success:", translatedText);
    sendResponse({ success: true, translation: translatedText });
  } catch (error) {
    console.error("Translation logic error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

const LANGUAGE_NAMES = {
  en: "English",
  id: "Indonesian",
  ja: "Japanese",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
};

function getSmartPrompt(text, sourceCode, targetCode) {
  const sourceLang = LANGUAGE_NAMES[sourceCode] || sourceCode;
  const targetLang = LANGUAGE_NAMES[targetCode] || targetCode;

  console.log(sourceLang);
  console.log(targetLang);

  return `You are a professional translator.
    You have two languages:
    1. Source Language: "${sourceLang}"
    2. Target Language: "${targetLang}"

    Text: "${text}"

    Task:
    - Detect the language of the provided text.
    - If the text is in "${sourceLang}", translate it to "${targetLang}".
    - If the text is in "${targetLang}", translate it to "${sourceLang}".
    - If it is in ANY OTHER language, translate it to "${targetLang}".

    Rules:
    - Return ONLY the translation.
    - Do not add explanations.
    - Maintain original tone.
    `;
}

async function translateWithMaia(text, sourceLang, targetLang, apiKey) {
  if (!apiKey) throw new Error("API Key required for Maia Router");

  const url = "https://api.maiarouter.ai/v1/chat/completions";
  const prompt = getSmartPrompt(text, sourceLang, targetLang);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "maia/gemini-2.5-flash", // Default model per plan
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || `Maia API error: ${response.status}`
    );
  }

  const data = await response.json();
  if (data.choices && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  return "Translation failed.";
}

async function translateWithOpenAI(text, sourceLang, targetLang, apiKey) {
  if (!apiKey) throw new Error("API Key required for OpenAI");

  const url = "https://api.openai.com/v1/chat/completions";
  const prompt = getSmartPrompt(text, sourceLang, targetLang);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // model: "gpt-5-nano", // Optimized for speed/cost
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || `OpenAI API error: ${response.status}`
    );
  }

  const data = await response.json();
  if (data.choices && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  return "Translation failed.";
}

async function translateWithGemini(text, sourceLang, targetLang, apiKey) {
  if (!apiKey) throw new Error("API Key required for Gemini");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const prompt = getSmartPrompt(text, sourceLang, targetLang);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2000,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || `Gemini API error: ${response.status}`
    );
  }

  const data = await response.json();

  if (data.candidates && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text.trim();
  }

  return "Translation failed.";
}

async function translateWithDeepL(text, targetLang, apiKey) {
  if (!apiKey) throw new Error("API Key required for DeepL");

  const url = "https://api-free.deepl.com/v2/translate";
  const params = new URLSearchParams();
  params.append("auth_key", apiKey);
  params.append("text", text);
  params.append("target_lang", targetLang.toUpperCase());

  const response = await fetch(url, {
    method: "POST",
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DeepL API returned error:", errorText);
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }
  return "Translation failed.";
}
