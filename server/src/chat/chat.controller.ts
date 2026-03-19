import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Sse,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SessionService } from '../session/session.service.js';
import { LlmService } from '../llm/llm.service.js';
import {
  SendMessageDto,
  CreateSessionResponseDto,
  GetHistoryResponseDto,
} from './dto/chat.dto.js';

@Controller('chat')
@ApiTags('chat')
export class ChatController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly llmService: LlmService,
  ) { }

  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    type: CreateSessionResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createSession(): Promise<CreateSessionResponseDto> {
    const session = await this.sessionService.create();
    return { sessionId: session.id };
  }

  @Post(':sessionId/message')
  @Sse()
  @ApiOperation({ summary: 'Send a message to the assistant' })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    type: SendMessageDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 400, description: 'Message is required' })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
  ): Promise<Observable<MessageEvent>> {
    const history = await this.sessionService.getTurns(sessionId);

    return new Observable<MessageEvent>((subscriber) => {
      const run = async () => {
        try {
          let hasError = false;
          let fullReply = '';
          const stream = this.llmService.streamResponse({
            history,
            newMessage: dto.message,
          });

          for await (const chunk of stream) {
            if (chunk.error) {
              hasError = true;
              subscriber.next({ data: { error: chunk.error } });
              break;
            }
            if (chunk.token) {
              fullReply += chunk.token;
              subscriber.next({ data: { token: chunk.token } });
            }
          }

          if (hasError) {
            return;
          }

          if (!fullReply) {
            subscriber.next({ data: { error: 'LLM unavailable' } });
            return;
          }

          await this.sessionService.addTurn(sessionId, dto.message, fullReply);
          const turnIndex = await this.sessionService.getTurnCount(sessionId);
          subscriber.next({ data: { done: true, turnIndex } });
        } catch {
          subscriber.next({ data: { error: 'LLM unavailable' } });
        } finally {
          subscriber.complete();
        }
      };

      void run();
    });
  }

  @Get(':sessionId/history')
  @ApiOperation({ summary: 'Get chat history' })
  @ApiResponse({
    status: 200,
    description: 'Chat history retrieved successfully',
    type: GetHistoryResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getHistory(
    @Param('sessionId') sessionId: string,
  ): Promise<GetHistoryResponseDto> {
    const turns = await this.sessionService.getTurns(sessionId);
    return { sessionId, turns };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete chat session' })
  @ApiResponse({ status: 204, description: 'Session deleted successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async deleteSession(@Param('sessionId') sessionId: string): Promise<void> {
    await this.sessionService.delete(sessionId);
  }
}
