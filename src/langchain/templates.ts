const CONDENSE_TEMPLATE = `Given a user's question, perform the following:
1. Detect the language of the question and output its ISO 639-1 code (e.g., 'en', 'es', 'ru').
2. Rewrite the question into a clear, standalone version in the same language.

User Question: {question}

Response format:
Language: <ISO 639-1 code>
Question: <rewritten question>`;

const QA_TEMPLATE = `You are an advanced search assistant tasked with providing concise and accurate answers based on the provided context. Summarize the context and answer the question briefly in the language specified by the detectedLang parameter (e.g., 'ru' for Russian, 'en' for English).

Context:
{context}

Question: {question}
Detected Language: {detectedLang}
Answer:`;

export { CONDENSE_TEMPLATE, QA_TEMPLATE };
