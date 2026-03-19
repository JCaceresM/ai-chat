import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service.js';
import type { Turn } from '../session/session.types.js';

const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn().mockImplementation(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
  SchemaType: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
  FinishReason: {
    STOP: 'STOP',
    SAFETY: 'SAFETY',
    RECITATION: 'RECITATION',
    LANGUAGE: 'LANGUAGE',
    BLOCKLIST: 'BLOCKLIST',
    PROHIBITED_CONTENT: 'PROHIBITED_CONTENT',
    SPII: 'SPII',
  },
}));

function createResponse(parts: unknown[], finishReason = 'STOP') {
  return {
    candidates: [
      {
        content: { parts },
        finishReason,
      },
    ],
  };
}

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(() => {
    jest.clearAllMocks();

    const configService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'LLM_API_KEY') return 'test-api-key';
          if (key === 'LLM_MODEL') return 'gemini-2.0-flash';
          return defaultValue ?? '';
        }),
    } as unknown as ConfigService;

    service = new LlmService(configService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should pass conversation history to the model', async () => {
    const history: Turn[] = [
      {
        role: 'user',
        content: 'Tell me about Engineering',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: 'Engineering is our largest team.',
        timestamp: Date.now(),
      },
    ];

    mockGenerateContent.mockResolvedValue({
      response: createResponse([{ text: 'Final response' }]),
    });
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield createResponse([{ text: 'Streamed ' }]);
        yield createResponse([{ text: 'response' }]);
      })(),
      response: Promise.resolve(
        createResponse([{ text: 'Streamed response' }]),
      ),
    });

    const chunks: Array<{ token?: string; error?: string }> = [];
    for await (const chunk of service.streamResponse({
      history,
      newMessage: 'Who leads it?',
    })) {
      chunks.push(chunk);
    }

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);

    const planningCallArgs = mockGenerateContent.mock.calls[0] as Array<{
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    }>;
    const contents = planningCallArgs[0]?.contents;

    expect(contents).toHaveLength(3);
    expect(contents?.[2]?.parts[0]?.text).toBe('Who leads it?');
    expect(chunks.map((chunk) => chunk.token)).toEqual([
      'Streamed ',
      'response',
    ]);
  });

  it('should handle the tool call cycle before yielding tokens', async () => {
    mockGenerateContent.mockResolvedValue({
      response: createResponse([
        {
          functionCall: {
            name: 'get_department_info',
            args: { department_name: 'Engineering' },
          },
        },
      ]),
    });
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield createResponse([{ text: 'Engineering has 48 members' }]);
      })(),
      response: Promise.resolve(
        createResponse([{ text: 'Engineering has 48 members' }]),
      ),
    });

    const chunks: Array<{ token?: string; error?: string }> = [];
    for await (const chunk of service.streamResponse({
      history: [],
      newMessage: 'Tell me about Engineering',
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ token: 'Engineering has 48 members' }]);
    expect(mockGenerateContentStream).toHaveBeenCalled();

    const streamCallArgs = mockGenerateContentStream.mock.calls[0] as Array<{
      contents: Array<{ role: string; parts: unknown[] }>;
    }>;
    const streamContents = streamCallArgs[0]?.contents;

    expect(streamContents).toHaveLength(3);
    expect(streamContents?.[1]?.role).toBe('model');
    expect(streamContents?.[2]?.role).toBe('user');
  });

  it('should refuse off-topic requests without calling the model', async () => {
    const chunks: Array<{ token?: string; error?: string }> = [];
    for await (const chunk of service.streamResponse({
      history: [],
      newMessage: 'What is the weather today?',
    })) {
      chunks.push(chunk);
    }

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockGenerateContentStream).not.toHaveBeenCalled();
    expect(chunks).toEqual([
      {
        token:
          "I'm a Department Information Assistant and can only help with questions about our company's departments. Would you like to know about Engineering, Marketing, Sales, Human Resources, or Finance?",
      },
    ]);
  });

  it('should inspect the final finish reason before yielding buffered tokens', async () => {
    mockGenerateContent.mockResolvedValue({
      response: createResponse([{ text: 'Unsafe draft' }]),
    });
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield createResponse([{ text: 'Unsafe ' }]);
        yield createResponse([{ text: 'draft' }]);
      })(),
      response: Promise.resolve(
        createResponse([{ text: 'Unsafe draft' }], 'SAFETY'),
      ),
    });

    const chunks: Array<{ token?: string; error?: string }> = [];
    for await (const chunk of service.streamResponse({
      history: [],
      newMessage: 'Tell me about Engineering',
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        token:
          "I'm a Department Information Assistant and can only help with questions about our company's departments. Would you like to know about Engineering, Marketing, Sales, Human Resources, or Finance?",
      },
    ]);
  });

  it('should yield error on LLM stream failure', async () => {
    mockGenerateContent.mockResolvedValue({
      response: createResponse([{ text: 'Final response' }]),
    });
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield createResponse([{ text: 'Partial ' }]);
        throw new Error('stream failed');
      })(),
      response: Promise.reject(new Error('stream failed')),
    });

    const chunks: Array<{ token?: string; error?: string }> = [];
    for await (const chunk of service.streamResponse({
      history: [],
      newMessage: 'Tell me about Engineering',
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ error: 'LLM unavailable' }]);
  });
});
