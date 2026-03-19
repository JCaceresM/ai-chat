import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray } from 'class-validator';
import { Turn } from '../../session/session.types.js';

export class SendMessageDto {
  @ApiProperty({
    description: 'The message sent by the user to the assistant',
    example: 'Tell me about the Engineering department',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty.' })
  message!: string;
}

export class SendMessageResponseDto {
  @ApiProperty({
    description: 'The response from the assistant',
    example: 'The Engineering department has 50 employees and is led by John Doe.',
  })
  @IsString()
  @IsNotEmpty()
  response!: string;
}

export class CreateSessionResponseDto {
  @ApiProperty({
    description: 'The ID of the created session',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}

export class GetHistoryResponseDto {
  @ApiProperty({
    description: 'The ID of the session',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({
    description: 'The history of the conversation',
    example: [
      {
        role: 'user',
        content: 'Tell me about the Engineering department',
      },
      {
        role: 'assistant',
        content: 'The Engineering department has 50 employees and is led by John Doe.',
      },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  turns!: Turn[];
}
