import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { SessionModule } from '../session/session.module.js';
import { LlmModule } from '../llm/llm.module.js';

@Module({
  imports: [SessionModule, LlmModule],
  controllers: [ChatController],
})
export class ChatModule {}
