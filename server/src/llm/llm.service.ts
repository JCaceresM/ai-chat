import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FinishReason,
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type EnhancedGenerateContentResponse,
  type FunctionCall,
  type Part,
  type FunctionDeclaration,
  type Tool,
} from '@google/generative-ai';
import { Turn } from '../session/session.types.js';
import {
  getDepartmentInfo,
  getAvailableDepartments,
} from './tools/department.tool.js';

export interface StreamChunk {
  token?: string;
  done?: boolean;
  turnIndex?: number;
  error?: string;
}

export interface StreamResponseInput {
  history: Turn[];
  newMessage: string;
}

const AVAILABLE_DEPARTMENTS = getAvailableDepartments();
const REFUSAL_MESSAGE =
  "I'm a Department Information Assistant and can only help with questions about our company's departments. Would you like to know about Engineering, Marketing, Sales, Human Resources, or Finance?";
const BLOCKED_FINISH_REASONS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.LANGUAGE,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);
const SYSTEM_PROMPT = `You are a helpful Department Information Assistant for a company. Your role is to provide information about different departments within the organization.

You have access to a tool called "get_department_info" that can look up detailed information about departments including their size, leadership, description, and recent projects.

Available departments: ${AVAILABLE_DEPARTMENTS.join(', ')}.

RULES:
1. You MUST ONLY answer questions related to company departments, their structure, personnel, and operations.
2. If a user asks about something unrelated to departments or company operations, politely decline and redirect them. Respond in the same language the user is speaking.
3. When a user asks about a specific department, ALWAYS use the get_department_info tool to retrieve the latest information before responding. If you already have the information in recent history, you can use that.
4. Be conversational and helpful within your domain. Keep the context of the conversation.
5. If a department is not found, let the user know and list the available departments.`;

const DEPARTMENT_TOOL_DECLARATION: FunctionDeclaration = {
  name: 'get_department_info',
  description:
    'Retrieves detailed information about a company department including head count, lead, description, and recent projects.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      department_name: {
        type: SchemaType.STRING,
        description:
          'The name of the department to look up (e.g., Engineering, Marketing, Sales, HR, Finance)',
      },
    },
    required: ['department_name'],
  },
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('LLM_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'LLM_MODEL',
      '',
    );
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async *streamResponse(
    input: StreamResponseInput,
  ): AsyncGenerator<StreamChunk> {
    const { history, newMessage } = input;

    try {
      const planningModel = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [DEPARTMENT_TOOL_DECLARATION] } as Tool],
      });
      const finalModel = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: SYSTEM_PROMPT,
      });

      const contents = this.buildConversationContents(history, newMessage);

      const planningResult = await planningModel.generateContent({ contents });
      const planningResponse = planningResult.response;
      const planningBlockReason = this.getBlockedReason(planningResponse);

      if (planningBlockReason) {
        this.logger.warn(
          `Blocked planning response for "${newMessage}": ${planningBlockReason}`,
        );
        yield { token: REFUSAL_MESSAGE };
        return;
      }

      const finalContents = this.buildFinalContents(contents, planningResponse);
      const streamResult = await finalModel.generateContentStream({
        contents: finalContents,
      });
      const bufferedTokens: string[] = [];

      try {
        for await (const chunk of streamResult.stream) {
          const text = this.readTextSafely(chunk);
          if (text) {
            bufferedTokens.push(text);
          }
        }
      } catch (error) {
        await streamResult.response.catch(() => undefined);
        this.logger.error('LLM stream error', error);
        yield { error: 'LLM unavailable' };
        return;
      }

      const finalResponse = await streamResult.response;
      const finalBlockReason = this.getBlockedReason(finalResponse);
      if (finalBlockReason) {
        this.logger.warn(
          `Blocked final response for "${newMessage}": ${finalBlockReason}`,
        );
        yield { token: REFUSAL_MESSAGE };
        return;
      }

      if (bufferedTokens.length === 0) {
        const fallbackText = this.readTextSafely(finalResponse);
        if (fallbackText) {
          bufferedTokens.push(fallbackText);
        }
      }

      if (bufferedTokens.length === 0) {
        yield { error: 'LLM unavailable' };
        return;
      }

      for (const token of bufferedTokens) {
        yield { token };
      }
    } catch (error) {
      this.logger.error('LLM stream error', error);
      yield { error: 'LLM unavailable' };
    }
  }

  private buildConversationContents(
    history: Turn[],
    newMessage: string,
  ): Content[] {
    return [
      ...history.map((turn) => ({
        role: turn.role === 'user' ? 'user' : 'model',
        parts: [{ text: turn.content } as Part],
      })),
      {
        role: 'user',
        parts: [{ text: newMessage } as Part],
      },
    ];
  }

  private buildFinalContents(
    contents: Content[],
    response: EnhancedGenerateContentResponse,
  ): Content[] {
    const functionCalls = this.getFunctionCalls(response);
    if (functionCalls.length === 0) {
      return contents;
    }

    const toolCallParts = response.candidates?.[0]?.content?.parts ?? [];
    const functionResponses = functionCalls.map((functionCall) =>
      this.handleToolCall(functionCall),
    );

    return [
      ...contents,
      {
        role: 'model',
        parts: toolCallParts,
      },
      {
        role: 'user',
        parts: functionResponses,
      },
    ];
  }

  private getFunctionCalls(
    response: EnhancedGenerateContentResponse,
  ): FunctionCall[] {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return parts.flatMap((part) =>
      part.functionCall ? [part.functionCall] : [],
    );
  }

  private handleToolCall(functionCall: FunctionCall): Part {
    const { name, args } = functionCall;
    this.logger.log(`Tool call: ${name}(${JSON.stringify(args)})`);

    if (name !== 'get_department_info') {
      return {
        functionResponse: {
          name,
          response: {
            error: `Unknown tool "${name}"`,
          },
        },
      };
    }

    const departmentName = (args as Record<string, unknown>)['department_name'];
    if (typeof departmentName !== 'string' || departmentName.trim() === '') {
      return {
        functionResponse: {
          name,
          response: {
            error: 'department_name must be a non-empty string',
          },
        },
      };
    }

    const info = getDepartmentInfo(departmentName);
    return {
      functionResponse: {
        name,
        response: info
          ? { result: info }
          : {
            error: `Department "${departmentName}" not found. Available: ${AVAILABLE_DEPARTMENTS.join(', ')}`,
          },
      },
    };
  }

  private getBlockedReason(
    response: EnhancedGenerateContentResponse,
  ): string | null {
    if (!response.candidates?.length && response.promptFeedback?.blockReason) {
      return response.promptFeedback.blockReason;
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) {
      return finishReason;
    }

    return null;
  }

  private readTextSafely(response: EnhancedGenerateContentResponse): string {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return parts
      .map((part) => part.text ?? '')
      .join('');
  }


}
