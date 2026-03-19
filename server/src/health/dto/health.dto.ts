import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class HealthResponseDto {
    @ApiProperty({
        description: 'The status of the application',
        example: 'ok',
    })
    @IsString()
    @IsNotEmpty()
    status!: string;

    @ApiProperty({
        description: 'The uptime of the application in seconds',
        example: 123,
    })
    @IsNumber()
    @IsNotEmpty()
    uptime!: number;

    @ApiProperty({
        description: 'The timestamp of the health check',
        example: '2022-01-01T00:00:00.000Z',
    })
    @IsString()
    @IsNotEmpty()
    timestamp!: string;
}